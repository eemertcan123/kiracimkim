import type {
  CandidateProfile,
  HandoverChecklistState,
  HandoverPhoto,
  LandlordProperty,
  UserRole,
  UserSession,
} from '../types/kiracimkim';
import {
  loadRentPayments,
  loadTenantReferences,
  parsePaymentRecords,
  paymentStatusLabel,
  receiptsForProperty,
  receiptsFromStoredPayments,
} from './payments';
import type { RentReceipt } from '../types/kiracimkim';
import { handoverSubmitError } from './handoverSteps';
import { parseTurkishMobile } from './phone';
import { supabase } from './supabase';

const PROFILE_COLUMNS = new Set([
  'id',
  'full_name',
  'role',
  'carnet_code',
  'created_at',
  'transparency_pledge_accepted',
]);

export interface ProfileRow {
  id: string;
  full_name: string | null;
  role: string | null;
  carnet_code: string | null;
  created_at?: string;
  [key: string]: unknown;
}

export interface PropertyRow {
  id: string;
  title: string;
  landlord_id: string | null;
  district: string | null;
  created_at?: string;
}

export interface RentalRow {
  id: string;
  property_id: string | null;
  landlord_id: string | null;
  tenant_id: string | null;
  status: string | null;
  invite_code?: string | null;
  landlord_approved?: boolean | null;
  tenant_submitted?: boolean | null;
  handover_report?: HandoverReport | null;
  payment_records?: unknown;
  created_at?: string;
}

export interface HandoverReport {
  photos: HandoverPhoto[];
  checklist: Pick<
    HandoverChecklistState,
    | 'electricMeterNo'
    | 'electricMeterPhoto'
    | 'waterMeterNo'
    | 'waterMeterPhoto'
    | 'gasMeterNo'
    | 'gasMeterPhoto'
    | 'keysCount'
    | 'sealed'
    | 'sealedAt'
    | 'sealHash'
  >;
}

export interface TenantHistoryReference {
  id: string;
  landlordName: string;
  comment: string;
  signedAt: string;
}

export interface TenantHistory {
  approvedPaymentCount: number;
  references: TenantHistoryReference[];
  rentals: { id: string; title: string; active: boolean }[];
  payments: Pick<RentReceipt, 'id' | 'monthLabel' | 'propertyNickname' | 'amount' | 'status'>[];
}

export interface PendingMatch {
  rentalId: string;
  landlordName: string;
  propertyTitle: string;
  officialLocation: string;
}

let pledgeColumn: string | null = null;

export function maskPersonName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Kullanıcı';
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  return `${parts.slice(0, -1).join(' ')} ${last.charAt(0).toUpperCase()}.`;
}

export function normalizeRole(value: string | null | undefined): UserRole {
  const role = (value ?? '').toLocaleLowerCase('tr-TR');
  if (
    role.includes('landlord') ||
    role.includes('ev') ||
    role.includes('sahip') ||
    role.includes('owner')
  ) {
    return 'landlord';
  }
  return 'tenant';
}

export function rememberPledgeColumn(row: ProfileRow | null | undefined) {
  if (!row) return;
  if (pledgeColumn && pledgeColumn in row) return;
  const match = Object.entries(row).find(
    ([key, value]) => !PROFILE_COLUMNS.has(key) && typeof value === 'boolean'
  );
  if (match) pledgeColumn = match[0];
}

const PLEDGE_COLUMN = 'transparency_pledge_accepted';

export function readPledge(row: ProfileRow | null | undefined): boolean {
  if (!row) return false;
  if (PLEDGE_COLUMN in row) return Boolean(row[PLEDGE_COLUMN]);
  rememberPledgeColumn(row);
  if (!pledgeColumn) return false;
  return Boolean(row[pledgeColumn]);
}

export const HANDOVER_APPROVAL_KEY = 'kiracimkim.handoverApproved';

export function readHandoverApproval(propertyId: string) {
  try {
    const raw = localStorage.getItem(HANDOVER_APPROVAL_KEY);
    const ids = raw ? (JSON.parse(raw) as string[]) : [];
    return ids.includes(propertyId);
  } catch {
    return false;
  }
}

export function rememberHandoverApproval(propertyId: string) {
  try {
    const raw = localStorage.getItem(HANDOVER_APPROVAL_KEY);
    const ids = new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
    ids.add(propertyId);
    localStorage.setItem(HANDOVER_APPROVAL_KEY, JSON.stringify([...ids]));
  } catch {
    return;
  }
}

const HANDOVER_REPORT_PREFIX = 'kiracimkim.handoverReport.';

function readCachedHandoverReport(rentalId: string): HandoverReport | null {
  try {
    const raw = localStorage.getItem(`${HANDOVER_REPORT_PREFIX}${rentalId}`);
    if (!raw) return null;
    return JSON.parse(raw) as HandoverReport;
  } catch {
    return null;
  }
}

function writeCachedHandoverReport(rentalId: string, report: HandoverReport) {
  try {
    localStorage.setItem(`${HANDOVER_REPORT_PREFIX}${rentalId}`, JSON.stringify(report));
  } catch {
    return;
  }
}

function asHandoverReport(value: unknown): HandoverReport | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<HandoverReport>;
  if (!Array.isArray(record.photos) || !record.checklist || typeof record.checklist !== 'object') {
    return null;
  }
  return record as HandoverReport;
}

function applyHandoverReport(property: LandlordProperty, report: HandoverReport | null) {
  if (!report) return;
  property.photos = report.photos;
  property.checklist = { ...property.checklist, ...report.checklist };
}

function withHandoverApproval(property: LandlordProperty, rental?: RentalRow) {
  if (!rental) return property;
  property.rentalStatus = rental.status;
  property.tenantSubmitted = Boolean(rental.tenant_submitted);
  if (rental.tenant_submitted) {
    property.checklist = { ...property.checklist, sealed: true };
  }
  if (rental.landlord_approved || readHandoverApproval(property.id)) {
    property.checklist = { ...property.checklist, landlordStatus: 'approved' };
  }
  applyHandoverReport(
    property,
    asHandoverReport(rental.handover_report) ?? readCachedHandoverReport(rental.id)
  );
  return property;
}

function receiptsForRental(
  rental: RentalRow | undefined,
  propertyId: string,
  tableReceipts: RentReceipt[],
  tenantId?: string | null,
  tenantName?: string
) {
  const stored = receiptsFromStoredPayments(parsePaymentRecords(rental?.payment_records), {
    propertyId,
    tenantId,
    tenantName,
  });
  const storedIds = new Set(stored.map((receipt) => receipt.id));
  return [...stored, ...tableReceipts.filter((receipt) => !storedIds.has(receipt.id))].map(
    (receipt) => ({
      ...receipt,
      propertyNickname: receipt.propertyNickname,
      senderName:
        tenantName && (receipt.senderName === 'Kiracı' || !receipt.senderName)
          ? tenantName
          : receipt.senderName,
      tenantId: receipt.tenantId ?? tenantId ?? undefined,
    })
  );
}

export function handoverReportFromProperty(property: LandlordProperty): HandoverReport {
  return {
    photos: property.photos,
    checklist: {
      electricMeterNo: property.checklist.electricMeterNo,
      electricMeterPhoto: property.checklist.electricMeterPhoto,
      waterMeterNo: property.checklist.waterMeterNo,
      waterMeterPhoto: property.checklist.waterMeterPhoto,
      gasMeterNo: property.checklist.gasMeterNo,
      gasMeterPhoto: property.checklist.gasMeterPhoto,
      keysCount: property.checklist.keysCount,
      sealed: property.checklist.sealed,
      sealedAt: property.checklist.sealedAt,
      sealHash: property.checklist.sealHash,
    },
  };
}

export async function saveRentalHandoverReport(rentalId: string, report: HandoverReport) {
  writeCachedHandoverReport(rentalId, report);
  const { error } = await supabase
    .from('rentals')
    .update({ handover_report: report })
    .eq('id', rentalId);
  if (!error) return;
  const message = error.message ?? '';
  if (/handover_report/i.test(message) && /does not exist|42703|schema cache/i.test(message)) {
    console.error('rentals.handover_report sütunu yok. Tutanak bu oturumda saklandı:', error);
    return;
  }
  console.error('Teslim tutanağı kaydedilemedi:', error);
  throw error;
}

export async function submitTenantHandover(rentalId: string, report?: HandoverReport | null) {
  const stored = report ?? readCachedHandoverReport(rentalId);
  const problem = stored
    ? handoverSubmitError(stored.photos, stored.checklist)
    : 'Teslim tutanağı gönderilemedi. Kayıt bulunamadı.';
  if (problem) {
    throw new Error(problem);
  }
  const { data, error } = await supabase
    .from('rentals')
    .update({ tenant_submitted: true })
    .eq('id', rentalId)
    .select('id, tenant_submitted')
    .maybeSingle();
  if (error) {
    console.error('tenant_submitted güncellenemedi:', error);
    throw new Error(error.message);
  }
  if (!data?.tenant_submitted) {
    const message = 'Teslim tutanağı gönderilemedi. rentals.tenant_submitted doğrulanamadı.';
    console.error(message, data);
    throw new Error(message);
  }
}

export async function publishHandoverApproval(propertyId: string, rentalId?: string | null) {
  rememberHandoverApproval(propertyId);
  if (rentalId) {
    const { error } = await supabase
      .from('rentals')
      .update({ landlord_approved: true })
      .eq('id', rentalId);
    if (error && !/landlord_approved/i.test(error.message ?? '')) throw error;
  }
  const channel = supabase.channel(`handover-approval-${propertyId}`, {
    config: { broadcast: { self: false } },
  });
  await new Promise<void>((resolve) => {
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        resolve();
      }
    });
  });
  await channel.send({
    type: 'broadcast',
    event: 'approved',
    payload: { propertyId },
  });
  window.setTimeout(() => {
    void supabase.removeChannel(channel);
  }, 800);
}

function blankChecklist(): HandoverChecklistState {
  return {
    electricMeterNo: '',
    waterMeterNo: '',
    gasMeterNo: '',
    keysCount: 0,
    sealed: false,
    landlordStatus: 'pending',
  };
}

export function mapPropertyRow(row: PropertyRow): LandlordProperty {
  const district = row.district?.trim() || 'Konum belirtilmedi';
  return {
    id: row.id,
    landlordUserId: row.landlord_id,
    nickname: row.title,
    officialLocation: district,
    fullAddress: district,
    tenantName: null,
    tenantMaskedName: null,
    pendingInvite: null,
    iban: '',
    contractStartDate: '',
    monthlyRent: 0,
    verificationStatus: 'verified',
    photos: [],
    checklist: blankChecklist(),
    receipts: [],
    rentIncreases: [],
    reference: null,
  };
}

function formatStamp(iso?: string) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} · ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function rentalPhase(status: string | null): 'pending' | 'active' | 'closed' {
  const value = (status ?? '').toLocaleLowerCase('tr-TR');
  if (['active', 'accepted', 'approved', 'onaylandi', 'onaylandı'].includes(value)) {
    return 'active';
  }
  if (['dismissed', 'rejected', 'cancelled', 'canceled', 'iptal', 'declined'].includes(value)) {
    return 'closed';
  }
  return 'pending';
}

export function generateKarneCode() {
  const suffix = String(Math.floor(1000 + Math.random() * 9000));
  return `KMK-2026-${suffix}`;
}

const ACTIVE_ROLE_KEY = 'kiracimkim.activeRole';

export function readActiveRole(): UserRole | null {
  try {
    const value = localStorage.getItem(ACTIVE_ROLE_KEY);
    if (value === 'landlord' || value === 'tenant') return value;
  } catch {
    return null;
  }
  return null;
}

export function writeActiveRole(role: UserRole) {
  try {
    localStorage.setItem(ACTIVE_ROLE_KEY, role);
  } catch {
    return;
  }
}

export function roleFromLoginChoice(profileRole: UserRole, selectedRole: UserRole): UserRole {
  if (selectedRole === 'landlord' || profileRole === 'landlord') return 'landlord';
  return 'tenant';
}

export function toSession(
  profile: ProfileRow,
  email?: string | null,
  phone = ''
): UserSession {
  const fullName = profile.full_name?.trim() || email || 'Kullanıcı';
  return {
    authenticated: true,
    userId: profile.id,
    fullName,
    maskedName: maskPersonName(fullName),
    phone,
    role: normalizeRole(profile.role),
    verifiedViaEDevlet: false,
    activeTenantPropertyId: '',
    carnetCode: readProfileCode(profile),
  };
}

const SHARE_CODE_COLUMNS = ['share_code', 'karne_code', 'carnet_code'] as const;
const OPTIONAL_PROFILE_COLUMNS = [
  'full_name',
  'role',
  'carnet_code',
  'share_code',
  'karne_code',
  'created_at',
  'transparency_pledge_accepted',
] as const;

let readableProfileColumns: string[] | null = null;

function isMissingPhoneColumn(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  const message = error.message ?? '';
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    (/phone/i.test(message) && /does not exist|schema cache|could not find|42703/i.test(message))
  );
}

function isMissingContactRpc(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  const message = error.message ?? '';
  return (
    error.code === 'PGRST202' ||
    error.code === '42883' ||
    (/profile_contact_phones/i.test(message) &&
      /could not find|does not exist|schema cache|42883/i.test(message))
  );
}

async function readableProfileSelect() {
  if (readableProfileColumns) return readableProfileColumns;
  const found = ['id'];
  for (const column of OPTIONAL_PROFILE_COLUMNS) {
    const { error } = await supabase.from('profiles').select(column).limit(0);
    if (!error) found.push(column);
  }
  readableProfileColumns = found;
  return found;
}

async function profileColumns() {
  // The cast only satisfies the Supabase client. Runtime selection never includes phone.
  return (await readableProfileSelect()).join(',') as '*';
}

async function profileCodeColumns() {
  const columns = await readableProfileSelect();
  const found = SHARE_CODE_COLUMNS.filter((column) => columns.includes(column));
  if (found.length === 0) {
    const message =
      'Paylaşım kodu kaydedilemedi: profiles tablosunda share_code, karne_code veya carnet_code sütunu yok.';
    console.error(message);
    throw new Error(message);
  }
  return found;
}

async function readMetadataPhone() {
  const { data } = await supabase.auth.getUser();
  const metadata = (data.user?.user_metadata ?? {}) as { phone?: unknown };
  if (typeof metadata.phone !== 'string') return '';
  const parsed = parseTurkishMobile(metadata.phone);
  return parsed.ok ? parsed.value.national : '';
}

async function readOwnPhoneColumn(userId: string) {
  const { data, error } = await supabase.from('profiles').select('phone').eq('id', userId).maybeSingle();
  if (error) {
    if (!isMissingPhoneColumn(error) && !/permission denied|42501/i.test(error.message ?? '')) {
      console.error('Profil telefonu okunamadı:', error);
    }
    return '';
  }
  if (!data) return '';
  const raw = (data as { phone?: string | null }).phone ?? '';
  const parsed = parseTurkishMobile(raw);
  return parsed.ok ? parsed.value.national : '';
}

async function writeProfilePhone(userId: string, national: string) {
  const { error } = await supabase.from('profiles').update({ phone: national }).eq('id', userId);
  if (!error) return { status: 'saved' as const };
  if (isMissingPhoneColumn(error)) return { status: 'missing' as const };
  return { status: 'error' as const, message: error.message };
}

async function profilePhoneIsBlank(userId: string) {
  const rpc = await supabase.rpc('profile_contact_phones', { target_ids: [userId] });
  if (!rpc.error) {
    const rows = (rpc.data ?? []) as { id?: string; phone?: string | null }[];
    const own = rows.find((row) => row.id === userId);
    return !own?.phone;
  }
  if (!isMissingContactRpc(rpc.error)) return null;
  const { data, error } = await supabase.from('profiles').select('phone').eq('id', userId).maybeSingle();
  if (error) return isMissingPhoneColumn(error) ? null : null;
  return !((data as { phone?: string | null } | null)?.phone ?? '').trim();
}

async function copyMetadataPhoneToProfile(userId: string) {
  const metadataPhone = await readMetadataPhone();
  if (!metadataPhone) return;
  const blank = await profilePhoneIsBlank(userId);
  if (blank !== true) return;
  const written = await writeProfilePhone(userId, metadataPhone);
  if (written.status === 'error') {
    console.error('Telefon profiline yazılamadı:', written.message);
  }
}

export async function saveOwnPhone(userId: string, rawPhone: string) {
  const parsed = parseTurkishMobile(rawPhone);
  if (!parsed.ok) throw new Error(parsed.message);
  const national = parsed.value.national;
  const metadata = await supabase.auth.updateUser({ data: { phone: national } });
  const written = await writeProfilePhone(userId, national);
  if (written.status === 'saved') return national;
  if (written.status === 'missing' && !metadata.error) return national;
  if (written.status === 'error') {
    if (/row-level security/i.test(written.message)) {
      throw new Error('Telefon profilinize kaydedilemedi. Kendi profil satırınızı güncelleme izni gerekli.');
    }
    throw new Error(written.message || 'Telefon numarası profilinize kaydedilemedi.');
  }
  throw new Error(
    'Telefon numarası kaydedilemedi. Supabase SQL editöründe profiles telefon migration dosyasını çalıştırın.'
  );
}

export async function loadVisiblePhones(ids: string[], selfId: string) {
  const phones = new Map<string, string>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length > 0) {
    const { data, error } = await supabase.rpc('profile_contact_phones', { target_ids: unique });
    if (!error) {
      for (const row of (data ?? []) as { id?: string; phone?: string | null }[]) {
        if (!row.id || !row.phone) continue;
        const parsed = parseTurkishMobile(row.phone);
        if (parsed.ok) phones.set(row.id, parsed.value.national);
      }
    } else if (!isMissingContactRpc(error)) {
      console.error('İletişim telefonları okunamadı:', error);
    }
  }
  if (selfId && !phones.get(selfId)) {
    const metadataPhone = await readMetadataPhone();
    const ownPhone = metadataPhone || (await readOwnPhoneColumn(selfId));
    if (ownPhone) phones.set(selfId, ownPhone);
  }
  return phones;
}

export function readProfileCode(row: ProfileRow | null | undefined) {
  if (!row) return '';
  const record = row as Record<string, unknown>;
  for (const column of SHARE_CODE_COLUMNS) {
    const value = record[column];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

export async function ensureProfileShareCode(userId: string) {
  const columns = await profileCodeColumns();
  const { data, error } = await supabase
    .from('profiles')
    .select(columns.join(','))
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.error('Paylaşım kodu okunamadı:', error);
    throw error;
  }
  const existing = readProfileCode(data as ProfileRow | null);
  if (existing) return existing;
  return saveProfileShareCode(userId, await uniqueKarneCode());
}

export const TENANT_GUIDE_STORAGE_PREFIX = 'kiracimkim.tenantGuide.v1.';

export function clearAppStorage() {
  try {
    for (const store of [localStorage, sessionStorage]) {
      for (const key of Object.keys(store)) {
        if (key.startsWith('sb-') || key.startsWith(TENANT_GUIDE_STORAGE_PREFIX)) continue;
        store.removeItem(key);
      }
    }
  } catch {
    return;
  }
}

export async function signOutAccount() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  try {
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(TENANT_GUIDE_STORAGE_PREFIX)) localStorage.removeItem(key);
    }
    sessionStorage.clear();
  } catch {
    return;
  }
}

export function profileToCandidate(row: ProfileRow, code = readProfileCode(row)): CandidateProfile {
  const pledged = readPledge(row);
  const name = row.full_name?.trim() || 'Kiracı';
  return {
    tenantId: row.id,
    code,
    maskedName: maskPersonName(name),
    maskedDistrict: 'Kayıtlı profil',
    isFirstRental: true,
    transparentEntryPledged: pledged,
    verifiedPaymentsSummary: '0 Onaylı Dekont (İlk Kiralama)',
    delayDetails: '',
    handoverCountText: 'Henüz Yok',
    referenceCountText: '0 Referans',
    approvedPaymentCount: 0,
    handoverCount: 0,
    referenceCount: 0,
    eDevletVerified: false,
    previousLandlordNote: '',
  };
}

async function codeTaken(code: string) {
  const columns = await profileCodeColumns();
  for (const column of columns) {
    const { data, error } = await supabase.from('profiles').select('id').ilike(column, code).limit(1);
    if (error) {
      console.error('Paylaşım kodu kontrolü başarısız:', error);
      throw error;
    }
    if (data && data.length > 0) return true;
  }
  return false;
}

export async function saveProfileShareCode(userId: string, code: string) {
  const codeColumns = await profileCodeColumns();
  const payload = Object.fromEntries(codeColumns.map((column) => [column, code]));
  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', userId)
    .select(await profileColumns())
    .maybeSingle();
  if (error) {
    console.error('Paylaşım kodu profiles tablosuna kaydedilemedi:', error);
    throw new Error(error.message);
  }
  const saved = readProfileCode(data as ProfileRow | null);
  if (!data || saved.toLowerCase() !== code.toLowerCase()) {
    const message = `Paylaşım kodu kaydedilemedi. profiles satırı doğrulanamadı (beklenen ${code}).`;
    console.error(message, data);
    throw new Error(message);
  }
  return saved;
}

export async function findProfileByShareCode(rawCode: string) {
  const code = rawCode.trim();
  if (!code) return null;
  const codeColumns = await profileCodeColumns();
  const fields = await profileColumns();
  for (const column of codeColumns) {
    const { data, error } = await supabase.from('profiles').select(fields).ilike(column, code).limit(1);
    if (error) {
      console.error('Paylaşım kodu sorgusu başarısız:', error);
      throw new Error(error.message);
    }
    if (data && data[0]) return data[0] as ProfileRow;
  }
  return null;
}

async function uniqueKarneCode() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateKarneCode();
    if (!(await codeTaken(code))) return code;
  }
  return `KMK-2026-${Date.now().toString().slice(-4)}`;
}

export async function resetTenantTestData(userId: string) {
  const carnetCode = await saveProfileShareCode(userId, await uniqueKarneCode());

  const rentals = await supabase
    .from('rentals')
    .select('id, status')
    .eq('tenant_id', userId);
  if (rentals.error) throw rentals.error;
  const openIds = (rentals.data ?? [])
    .filter((row) => rentalPhase(row.status) !== 'closed')
    .map((row) => row.id);
  if (openIds.length > 0) {
    const removed = await supabase.from('rentals').delete().in('id', openIds);
    if (removed.error) throw removed.error;
  }

  try {
    localStorage.removeItem('kiracimkim.handoverApproved');
  } catch {
    // Tarayıcı depolaması kapalıysa test sıfırlama yine de kodu günceller.
  }

  return carnetCode;
}

export async function registerAccount(input: {
  fullName: string;
  email: string;
  password: string;
  role: UserRole;
  phone: string;
}) {
  const parsedPhone = parseTurkishMobile(input.phone);
  if (!parsedPhone.ok) throw new Error(parsedPhone.message);
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      data: {
        full_name: input.fullName.trim(),
        role: input.role,
        phone: parsedPhone.value.national,
      },
    },
  });
  if (error) throw error;
  const user = data.user;
  if (!user) throw new Error('Kayıt tamamlanamadı. Lütfen tekrar deneyin.');

  const carnetCode = input.role === 'tenant' ? await uniqueKarneCode() : null;
  const payload: Record<string, unknown> = {
    id: user.id,
    full_name: input.fullName.trim(),
    role: input.role,
    phone: parsedPhone.value.national,
  };
  if (carnetCode) {
    for (const column of await profileCodeColumns()) payload[column] = carnetCode;
  }

  const fields = await profileColumns();
  let inserted = await supabase.from('profiles').insert(payload).select(fields).maybeSingle();
  if (inserted.error && isMissingPhoneColumn(inserted.error)) {
    const { phone: _phone, ...withoutPhone } = payload;
    inserted = await supabase.from('profiles').insert(withoutPhone).select(fields).maybeSingle();
  }
  if (inserted.error) {
    console.error('Kayıt profili profiles tablosuna yazılamadı:', inserted.error);
    throw inserted.error;
  }
  const profile = (inserted.data as ProfileRow | null) ?? {
    id: user.id,
    full_name: input.fullName.trim(),
    role: input.role,
    carnet_code: carnetCode,
  };
  if (carnetCode && readProfileCode(profile).toLowerCase() !== carnetCode.toLowerCase()) {
    const message = `Kayıt kodu profiles tablosuna kaydedilemedi (beklenen ${carnetCode}).`;
    console.error(message, profile);
    throw new Error(message);
  }
  rememberPledgeColumn(profile);

  return {
    needsEmailConfirmation: !data.session,
    profile,
    session: data.session,
  };
}

export async function signInAccount(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
  if (!data.user) throw new Error('Giriş tamamlanamadı.');
  const profile = await ensureProfile(data.user.id, email.trim());
  return { userId: data.user.id, profile };
}

export async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select(await profileColumns())
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const profile = data as ProfileRow;
  rememberPledgeColumn(profile);
  return profile;
}

export async function ensureProfile(userId: string, email?: string | null) {
  const existing = await fetchProfile(userId);
  if (existing) {
    await copyMetadataPhoneToProfile(userId);
    if (!readProfileCode(existing)) {
      await ensureProfileShareCode(userId);
      return (await fetchProfile(userId)) ?? existing;
    }
    return existing;
  }

  const { data: userData } = await supabase.auth.getUser();
  const authUser = userData.user;
  const resolvedEmail = (email ?? authUser?.email ?? '').trim();
  const metadata = (authUser?.user_metadata ?? {}) as { full_name?: string; role?: string; phone?: string };
  const fullName = metadata.full_name?.trim() || resolvedEmail || 'Kullanıcı';
  const role = metadata.role === 'landlord' ? 'landlord' : 'tenant';
  const metadataPhone = parseTurkishMobile(metadata.phone ?? '');
  const carnetCode = await uniqueKarneCode();
  const payload: Record<string, unknown> = {
    id: userId,
    full_name: fullName,
    role,
  };
  if (metadataPhone.ok) payload.phone = metadataPhone.value.national;
  for (const column of await profileCodeColumns()) payload[column] = carnetCode;

  const fields = await profileColumns();
  let inserted = await supabase.from('profiles').insert(payload).select(fields).maybeSingle();
  if (inserted.error && payload.phone && isMissingPhoneColumn(inserted.error)) {
    const { phone: _phone, ...withoutPhone } = payload;
    inserted = await supabase.from('profiles').insert(withoutPhone).select(fields).maybeSingle();
  }

  if (inserted.error) {
    const raced = await fetchProfile(userId);
    if (raced) return raced;
    console.error('Profil kaydı oluşturulamadı:', inserted.error);
    throw inserted.error;
  }

  const profile = (inserted.data as ProfileRow | null) ?? {
    id: userId,
    full_name: fullName,
    role,
    carnet_code: carnetCode,
  };
  rememberPledgeColumn(profile);
  return profile;
}

export async function updatePledge(userId: string, pledged: boolean) {
  const { error } = await supabase
    .from('profiles')
    .update({ [PLEDGE_COLUMN]: pledged })
    .eq('id', userId);
  if (error) throw error;
}

export async function loadCandidateTrust(tenantId: string) {
  const [references, payments, rentals] = await Promise.all([
    loadTenantReferences(tenantId),
    supabase.from('rent_payments').select('status').eq('tenant_id', tenantId),
    supabase.from('rentals').select('payment_records, handover_report, tenant_submitted').eq('tenant_id', tenantId),
  ]);
  if (payments.error) throw payments.error;
  if (rentals.error) throw rentals.error;

  const approvedFromPayments = (payments.data ?? []).filter(
    (row) => paymentStatusLabel((row as { status?: string | null }).status) === 'Onaylandı'
  ).length;
  const approvedFromRecords = (rentals.data ?? [])
    .flatMap((row) => parsePaymentRecords((row as { payment_records?: unknown }).payment_records))
    .filter((row) => row.status === 'approved').length;
  const handoverCount = (rentals.data ?? []).filter((row) => {
    const record = row as { handover_report?: unknown; tenant_submitted?: boolean | null };
    const report = asHandoverReport(record.handover_report);
    return Boolean(report?.checklist?.sealed) || Boolean(record.tenant_submitted);
  }).length;
  const comment = references.find((row) => row.comment?.trim())?.comment?.trim() || '';

  return {
    approvedPaymentCount: approvedFromPayments + approvedFromRecords,
    handoverCount,
    referenceCount: references.length,
    referenceComment: comment,
    trustLoaded: true,
  };
}

export async function loadWorkspace(userId: string) {
  const profile = await ensureProfile(userId);

  const [propertyResult, landlordRentalResult, tenantRentalResult] = await Promise.all([
    supabase.from('properties').select('*').eq('landlord_id', userId).order('created_at', { ascending: true }),
    supabase.from('rentals').select('*').eq('landlord_id', userId).order('created_at', { ascending: false }),
    supabase.from('rentals').select('*').eq('tenant_id', userId).order('created_at', { ascending: false }),
  ]);
  if (propertyResult.error) throw propertyResult.error;
  if (landlordRentalResult.error) throw landlordRentalResult.error;
  if (tenantRentalResult.error) throw tenantRentalResult.error;

  const ownedRows = (propertyResult.data ?? []) as PropertyRow[];
  const rentalById = new Map<string, RentalRow>();
  for (const row of [...(landlordRentalResult.data ?? []), ...(tenantRentalResult.data ?? [])] as RentalRow[]) {
    rentalById.set(row.id, row);
  }
  const rentals = [...rentalById.values()];
  const ownedIds = new Set(ownedRows.map((item) => item.id));
  const rentedPropertyIds = [
    ...new Set(
      rentals
        .filter((entry) => entry.tenant_id === userId && entry.property_id && !ownedIds.has(entry.property_id))
        .map((entry) => entry.property_id as string)
    ),
  ];
  let rentedRows: PropertyRow[] = [];
  if (rentedPropertyIds.length > 0) {
    const rentedResult = await supabase.from('properties').select('*').in('id', rentedPropertyIds);
    if (rentedResult.error) throw rentedResult.error;
    rentedRows = (rentedResult.data ?? []) as PropertyRow[];
  }

  const profileIds = new Set<string>([userId]);
  for (const entry of rentals) {
    if (entry.tenant_id) profileIds.add(entry.tenant_id);
    if (entry.landlord_id) profileIds.add(entry.landlord_id);
  }
  const profileResult = await supabase.from('profiles').select(await profileColumns()).in('id', [...profileIds]);
  if (profileResult.error) throw profileResult.error;

  const profiles = (profileResult.data ?? []) as ProfileRow[];
  profiles.forEach((item) => rememberPledgeColumn(item));
  const profileById = new Map(profiles.map((item) => [item.id, item]));
  const visiblePhoneIds = new Set<string>([userId]);
  for (const entry of rentals) {
    if (rentalPhase(entry.status) !== 'active') continue;
    if (entry.landlord_id === userId && entry.tenant_id) visiblePhoneIds.add(entry.tenant_id);
    if (entry.tenant_id === userId && entry.landlord_id) visiblePhoneIds.add(entry.landlord_id);
  }
  const phones = await loadVisiblePhones([...visiblePhoneIds], userId);
  const rentPayments = await loadRentPayments(userId);
  const properties = [...ownedRows, ...rentedRows];
  const propertyById = new Map(properties.map((item) => [item.id, item]));

  const owned = properties
    .filter((item) => item.landlord_id === userId)
    .map((item) => {
      const property = mapPropertyRow(item);
      const rental = rentals.find(
        (entry) => entry.property_id === item.id && rentalPhase(entry.status) !== 'closed'
      );
      if (rental) property.rentalId = rental.id;
      const tenant = rental?.tenant_id ? profileById.get(rental.tenant_id) : undefined;
      const tenantName = tenant?.full_name?.trim() || 'Kiracı';
      property.receipts = receiptsForRental(
        rental,
        item.id,
        receiptsForProperty(rentPayments, item.id),
        rental?.tenant_id,
        rental?.tenant_id ? tenantName : undefined
      );
      withHandoverApproval(property, rental);
      if (!rental?.tenant_id) return property;
      if (rentalPhase(rental.status) === 'pending') {
        property.pendingInvite = {
          fullName: tenantName,
          phone: '',
          maskedPhone: maskPersonName(tenantName),
          invitedAt: formatStamp(rental.created_at),
        };
        return property;
      }
      property.tenantName = tenantName;
      property.tenantMaskedName = maskPersonName(tenantName);
      property.tenantPhone = rental.tenant_id ? phones.get(rental.tenant_id) ?? null : null;
      property.tenantTransparencyPledged = readPledge(tenant);
      property.receipts = property.receipts.map((receipt) => ({
        ...receipt,
        propertyNickname: property.nickname,
        senderName: receipt.senderName === 'Kiracı' ? tenantName : receipt.senderName,
      }));
      return property;
    });

  const myRentals = rentals.filter(
    (entry) => entry.tenant_id === userId && rentalPhase(entry.status) !== 'closed'
  );
  const pendingRental = myRentals.find((entry) => rentalPhase(entry.status) === 'pending');
  const activeRental =
    myRentals.find((entry) => rentalPhase(entry.status) === 'active') ?? null;

  const tenantProperties = myRentals
    .map((entry) => {
      if (!entry.property_id) return null;
      const source = propertyById.get(entry.property_id);
      if (!source) return null;
      const property = mapPropertyRow(source);
      property.receipts = receiptsForRental(
        entry,
        source.id,
        receiptsForProperty(rentPayments, source.id),
        userId,
        profile.full_name?.trim() || 'Kiracı'
      ).map((receipt) => ({
        ...receipt,
        propertyNickname: property.nickname,
      }));
      property.rentalId = entry.id;
      property.landlordUserId = entry.landlord_id;
      if (rentalPhase(entry.status) === 'active' && entry.landlord_id) {
        property.landlordPhone = phones.get(entry.landlord_id) ?? null;
      }
      withHandoverApproval(property, entry);
      const landlord = entry.landlord_id ? profileById.get(entry.landlord_id) : undefined;
      const landlordName = landlord?.full_name?.trim() || 'Ev Sahibi';
      property.reference = {
        landlordName,
        districtLabel: property.officialLocation,
        criteria: {
          paymentDiscipline: 'Eksiksiz & Zamanında',
          propertyCondition: 'Hasarsız & Temiz',
          communication: 'Şeffaf & Ulaşılabilir',
          contractCompliance: 'Sözleşmeye Tam Uyum',
        },
        comment: '',
        signedAt: formatStamp(entry.created_at),
        signatureHash: entry.id.slice(0, 8).toUpperCase(),
        verified: false,
      };
      return property;
    })
    .filter((item): item is LandlordProperty => Boolean(item));

  const pendingProperty = pendingRental?.property_id
    ? propertyById.get(pendingRental.property_id)
    : undefined;
  const pendingLandlord = pendingRental?.landlord_id
    ? profileById.get(pendingRental.landlord_id)
    : undefined;

  const seenTenants = new Set<string>();
  const candidates: CandidateProfile[] = [];
  for (const entry of rentals) {
    if (entry.landlord_id !== userId || !entry.tenant_id || seenTenants.has(entry.tenant_id)) continue;
    seenTenants.add(entry.tenant_id);
    const tenant = profileById.get(entry.tenant_id);
    if (!tenant) continue;
    const code = readProfileCode(tenant);
    if (!code) continue;
    candidates.push(profileToCandidate(tenant, code));
  }

  const referenceRows = await loadTenantReferences(userId);
  const tenantRentalsWithPayments = rentals
    .filter((entry) => entry.tenant_id === userId)
    .map((entry) => ({
      entry,
      title: (entry.property_id && propertyById.get(entry.property_id)?.title) || 'Daire',
      payments: parsePaymentRecords(entry.payment_records),
    }));
  const tenantTablePayments = rentPayments.filter((receipt) => receipt.tenantId === userId);
  const storedPayments = tenantRentalsWithPayments.flatMap(({ title, payments }) =>
    payments.map((payment) => ({
      id: payment.id,
      monthLabel: payment.period,
      propertyNickname: title,
      amount: payment.amount,
      status: paymentStatusLabel(payment.status),
    }))
  );
  const storedPaymentIds = new Set(storedPayments.map(({ id }) => id));
  const tenantHistory: TenantHistory = {
    approvedPaymentCount:
      storedPayments.filter((payment) => payment.status === 'Onaylandı').length +
      tenantTablePayments.filter((payment) => payment.status === 'Onaylandı').length,
    references: referenceRows.map((row) => ({
      id: row.id,
      landlordName: row.landlord_name?.trim() || 'Ev Sahibi',
      comment: row.comment?.trim() || '',
      signedAt: formatStamp(row.created_at ?? undefined),
    })),
    rentals: tenantRentalsWithPayments.flatMap(({ entry, title, payments }) => {
      const active = rentalPhase(entry.status) === 'active';
      return active || entry.tenant_submitted || entry.landlord_approved || payments.length > 0
        ? [{ id: entry.id, title, active }]
        : [];
    }),
    payments: [
      ...storedPayments,
      ...tenantTablePayments
        .filter(({ id }) => !storedPaymentIds.has(id))
        .map(({ id, monthLabel, propertyNickname, amount, status }) => ({
          id, monthLabel, propertyNickname, amount, status,
        })),
    ],
  };

  const session = toSession(profile, undefined, phones.get(userId) ?? '');
  const focusRental = activeRental ?? pendingRental ?? null;
  session.activeTenantPropertyId = focusRental?.property_id ?? tenantProperties[0]?.id ?? '';

  const pendingMatch: PendingMatch | null = pendingRental
      ? {
          rentalId: pendingRental.id,
          landlordName: pendingLandlord?.full_name?.trim() || 'Ev Sahibi',
          propertyTitle: pendingProperty?.title?.trim() || 'Daire',
          officialLocation: pendingProperty?.district?.trim() || 'Konum belirtilmedi',
        }
      : null;

  return {
    profile,
    session,
    ownedProperties: owned,
    tenantProperties,
    transparentEntryPledged: readPledge(profile),
    tenantInviteStatus: activeRental ? ('active' as const) : ('pending' as const),
    tenantMatchDismissed: !pendingMatch && !activeRental,
    pendingMatch,
    activeRentalId: activeRental?.id ?? null,
    pendingRentalId: pendingRental?.id ?? null,
    candidates,
    tenantHistory,
  };
}

export async function insertProperty(input: {
  landlordId: string;
  title: string;
  district: string;
}) {
  const { data, error } = await supabase
    .from('properties')
    .insert({
      title: input.title,
      district: input.district,
      landlord_id: input.landlordId,
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapPropertyRow(data as PropertyRow);
}

export async function findOrInsertPropertyForInvite(input: Parameters<typeof insertProperty>[0]) {
  const { data, error } = await supabase
    .from('properties')
    .select('id, title, district, landlord_id')
    .eq('landlord_id', input.landlordId);
  if (error) throw error;

  const normalize = (value: string | null) =>
    (value ?? '').normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR');
  const title = normalize(input.title);
  const district = normalize(input.district);
  const matches = ((data ?? []) as PropertyRow[]).filter(
    (property) => normalize(property.title) === title && normalize(property.district) === district
  );
  if (matches.length > 1) {
    throw new Error('Bu ad ve konumla birden fazla daire kayıtlı. Listeden davet edeceğiniz daireyi seçin.');
  }
  if (matches.length === 1) return mapPropertyRow(matches[0]);
  return insertProperty(input);
}

export interface LandlordTenantRental {
  id: string;
  propertyId: string | null;
  status: 'pending' | 'active';
  inviteCode: string | null;
  landlordApproved: boolean;
}

function mapOpenRental(row: RentalRow): LandlordTenantRental | null {
  const phase = rentalPhase(row.status);
  if (phase === 'closed') return null;
  return {
    id: row.id,
    propertyId: row.property_id,
    status: phase,
    inviteCode: row.invite_code ?? null,
    landlordApproved: row.landlord_approved === true,
  };
}

export async function loadLandlordTenantRental(
  landlordId: string,
  tenantId: string
): Promise<LandlordTenantRental | null> {
  const filters = (columns: string) =>
    supabase
      .from('rentals')
      .select(columns)
      .eq('landlord_id', landlordId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

  let { data, error } = await filters(
    'id, property_id, landlord_id, tenant_id, status, invite_code, landlord_approved, created_at'
  );
  if (error && /landlord_approved/i.test(error.message ?? '')) {
    const retry = await filters(
      'id, property_id, landlord_id, tenant_id, status, invite_code, created_at'
    );
    data = retry.data;
    error = retry.error;
  }
  if (error && /invite_code/i.test(error.message ?? '')) {
    const retry = await filters('id, property_id, landlord_id, tenant_id, status, created_at');
    data = retry.data;
    error = retry.error;
  }
  if (error) throw error;
  const open = ((data ?? []) as unknown as RentalRow[])
    .map(mapOpenRental)
    .filter((row): row is LandlordTenantRental => Boolean(row));
  return open.find((row) => row.status === 'active') ?? open[0] ?? null;
}

export async function deleteProperty(propertyId: string, landlordId: string) {
  const { error } = await supabase
    .from('properties')
    .delete()
    .eq('id', propertyId)
    .eq('landlord_id', landlordId);
  if (error) throw error;
}

function mapInviteColumnError(error: { message?: string }) {
  if (/invite_code/i.test(error.message ?? '')) {
    return new Error(
      'Davet kodu kaydedilemedi: rentals tablosunda invite_code sütunu yok. Sütunu ekledikten sonra daveti yeniden gönderin.'
    );
  }
  return error;
}

function generateInviteCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function uniqueInviteCode() {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = generateInviteCode();
    const { data, error } = await supabase
      .from('rentals')
      .select('id')
      .eq('invite_code', code)
      .limit(1);
    if (error) throw mapInviteColumnError(error);
    if (!data || data.length === 0) return code;
  }
  return generateInviteCode();
}

export async function createRentalMatch(input: {
  propertyId: string;
  landlordId: string;
  carnetCode: string;
}) {
  const { data: ownedProperty, error: propertyError } = await supabase
    .from('properties')
    .select('id')
    .eq('id', input.propertyId)
    .eq('landlord_id', input.landlordId)
    .maybeSingle();
  if (propertyError) throw propertyError;
  if (!ownedProperty) throw new Error('Bu mülk için davet kodu oluşturma yetkiniz yok.');

  const tenant = await findProfileByShareCode(input.carnetCode.trim());
  if (!tenant) throw new Error('Bu karne koduna ait kiracı bulunamadı.');

  const { data: existing, error: existingError } = await supabase
    .from('rentals')
    .select('status')
    .eq('property_id', input.propertyId);
  if (existingError) throw existingError;
  const phases = (existing ?? []).map((row) => rentalPhase(row.status));
  if (phases.includes('active')) {
    throw new Error('Bu dairede aktif bir kiracılık var.');
  }
  if (phases.includes('pending')) {
    throw new Error('Bu daire için onay bekleyen bir davet var.');
  }

  const inviteCode = await uniqueInviteCode();
  const { data, error } = await supabase
    .from('rentals')
    .insert({
      property_id: input.propertyId,
      landlord_id: input.landlordId,
      tenant_id: tenant.id,
      status: 'pending',
      invite_code: inviteCode,
    })
    .select('*')
    .single();
  if (error) throw mapInviteColumnError(error);
  return { ...(data as RentalRow), invite_code: inviteCode };
}

export async function acceptRentalByInviteCode(tenantId: string, rawCode: string) {
  const code = rawCode.replace(/\D/g, '');
  if (code.length !== 6) {
    throw new Error('Davet kodu 6 haneli olmalıdır.');
  }
  const { data, error } = await supabase
    .from('rentals')
    .select('id, status, tenant_id')
    .eq('invite_code', code)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) throw mapInviteColumnError(error);
  if (!data) throw new Error('Bu davet kodu hesabınıza ait bir kayıtla eşleşmedi.');
  if (rentalPhase(data.status) === 'active') {
    throw new Error('Bu davet zaten onaylanmış.');
  }
  if (rentalPhase(data.status) === 'closed') {
    throw new Error('Bu davet artık geçerli değil.');
  }
  await acceptRental(data.id);
  return data.id;
}

async function writeRentalStatus(rentalId: string, statuses: string[]) {
  let lastError: Error | null = null;
  for (const status of statuses) {
    const { error } = await supabase.from('rentals').update({ status }).eq('id', rentalId);
    if (!error) return;
    lastError = error;
  }
  throw lastError ?? new Error('Kiralama kaydı güncellenemedi.');
}

export function acceptRental(rentalId: string) {
  return writeRentalStatus(rentalId, ['active']);
}

export function dismissRental(rentalId: string) {
  return writeRentalStatus(rentalId, ['dismissed', 'rejected', 'cancelled']);
}
