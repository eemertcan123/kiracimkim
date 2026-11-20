import { RentReceipt } from '../types/kiracimkim';
import { supabase } from './supabase';

const MONTHS = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];

export interface RentPaymentRecord {
  id: string;
  rental_id: string | null;
  property_id: string | null;
  tenant_id: string | null;
  landlord_id: string | null;
  status: string | null;
  amount: number | string | null;
  period: string | null;
  payment_date: string | null;
  receipt_url: string | null;
  created_at?: string | null;
  payment_type: string | null;
  properties?: { title?: string | null; district?: string | null } | null;
  tenant?: { full_name?: string | null } | null;
}

export function periodFromIsoDate(iso: string) {
  const [year, month] = iso.split('-');
  const label = MONTHS[Number(month) - 1];
  return label && year ? `${label} ${year}` : iso;
}

function displayDate(value?: string | null) {
  if (!value) return '';
  const dateOnly = value.slice(0, 10);
  const match = dateOnly.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[3]}.${match[2]}.${match[1]}`;
  return value;
}

export function paymentStatusLabel(status: string | null | undefined): RentReceipt['status'] {
  const value = (status ?? '').toLocaleLowerCase('tr-TR');
  if (value === 'approved' || value === 'onaylandi' || value === 'onaylandı') return 'Onaylandı';
  if (
    value.includes('object') ||
    value.includes('reject') ||
    value.includes('dispute') ||
    value.includes('itiraz')
  ) {
    return 'İtirazlı';
  }
  return 'Ev Sahibi Onayı Bekliyor';
}

function isPreviewImage(url: string) {
  return url.startsWith('data:image/') || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url);
}

function storagePathFromUrl(receiptUrl: string) {
  const match = receiptUrl.match(/\/receipts\/([^?]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function viewableReceiptUrl(receiptUrl: string | null) {
  if (!receiptUrl) return undefined;
  const path = storagePathFromUrl(receiptUrl);
  if (!path) return receiptUrl;
  const signed = await supabase.storage.from('receipts').createSignedUrl(path, 60 * 60);
  return signed.data?.signedUrl || receiptUrl;
}

export function mapPaymentRecord(row: RentPaymentRecord, previewUrl?: string): RentReceipt {
  const paid = displayDate(row.payment_date || row.created_at);
  const year = Number((row.payment_date || row.created_at || '').slice(0, 4)) || new Date().getFullYear();
  const type = (row.payment_type ?? '').toLocaleLowerCase('tr-TR').includes('aidat')
    ? 'Aidat'
    : 'Kira Bedeli';
  const fileName = row.receipt_url?.startsWith('data:')
    ? undefined
    : row.receipt_url?.split('?')[0].split('/').pop();
  const imageUrl = row.receipt_url && isPreviewImage(row.receipt_url) ? row.receipt_url : undefined;
  return {
    id: row.id,
    propertyId: row.property_id ?? undefined,
    propertyNickname: row.properties?.title ?? undefined,
    monthLabel: row.period?.trim() || 'Kira Ödemesi',
    year,
    type,
    amount: Number(row.amount) || 0,
    dueDate: paid,
    paidDate: paid,
    status: paymentStatusLabel(row.status),
    iban: '',
    ibanMatched: paymentStatusLabel(row.status) === 'Onaylandı',
    senderName: row.tenant?.full_name?.trim() || 'Kiracı',
    tenantId: row.tenant_id ?? undefined,
    fileName: fileName ? decodeURIComponent(fileName) : undefined,
    previewImageUrl: previewUrl || imageUrl,
    fileUrl: row.receipt_url || undefined,
    landlordApprovedAt: paymentStatusLabel(row.status) === 'Onaylandı' ? paid : undefined,
  };
}

function asOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function loadRentPayments(userId: string) {
  const columns =
    'id, rental_id, property_id, tenant_id, landlord_id, status, amount, period, payment_date, receipt_url, created_at, payment_type';
  const filter = `landlord_id.eq.${userId},tenant_id.eq.${userId}`;
  const joined = await supabase
    .from('rent_payments')
    .select(`${columns}, properties(title, district), tenant:profiles!tenant_id(full_name)`)
    .or(filter)
    .order('created_at', { ascending: false });
  const result = joined.error
    ? await supabase.from('rent_payments').select(columns).or(filter).order('created_at', { ascending: false })
    : joined;
  if (result.error) throw result.error;

  const rows = ((result.data ?? []) as Array<RentPaymentRecord & {
    properties?: RentPaymentRecord['properties'] | NonNullable<RentPaymentRecord['properties']>[];
    tenant?: RentPaymentRecord['tenant'] | NonNullable<RentPaymentRecord['tenant']>[];
  }>).map((row) => ({
    ...row,
    properties: asOne(row.properties),
    tenant: asOne(row.tenant),
  }));

  return Promise.all(
    rows.map(async (row) => mapPaymentRecord(row, await viewableReceiptUrl(row.receipt_url)))
  );
}

export interface TenantReferenceRecord {
  id: string;
  tenant_id: string | null;
  landlord_name: string | null;
  comment: string | null;
  created_at?: string | null;
}

export async function loadTenantReferences(tenantId: string) {
  const { data, error } = await supabase
    .from('tenant_references')
    .select('id, tenant_id, landlord_name, comment, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as TenantReferenceRecord[];
}

export function receiptsForProperty(receipts: RentReceipt[], propertyId: string) {
  return receipts.filter((receipt) => receipt.propertyId === propertyId);
}

function safeFileName(name: string) {
  return name.replace(/[^\w.\-]+/g, '_').slice(0, 80) || 'dekont';
}

export interface StoredPaymentRecord {
  id: string;
  period: string;
  amount: number;
  payment_date: string;
  receipt_url: string;
  file_name?: string;
  status: 'pending' | 'approved' | 'objected';
  created_at?: string;
}

export function parsePaymentRecords(value: unknown): StoredPaymentRecord[] {
  let source = value;
  if (typeof value === 'string') {
    try {
      source = JSON.parse(value) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(source)) return [];
  return source.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Partial<StoredPaymentRecord>;
    if (!row.id || !row.period) return [];
    const status =
      row.status === 'approved' || row.status === 'objected' ? row.status : 'pending';
    return [
      {
        id: String(row.id),
        period: String(row.period),
        amount: Number(row.amount) || 0,
        payment_date: String(row.payment_date || ''),
        receipt_url: String(row.receipt_url || ''),
        file_name: row.file_name ? String(row.file_name) : undefined,
        status,
        created_at: row.created_at ? String(row.created_at) : undefined,
      },
    ];
  });
}

export function receiptsFromStoredPayments(
  records: StoredPaymentRecord[],
  context: { propertyId: string; tenantId?: string | null; tenantName?: string }
): RentReceipt[] {
  return records.map((row) => {
    const receipt = mapPaymentRecord(
      {
        id: row.id,
        rental_id: null,
        property_id: context.propertyId,
        tenant_id: context.tenantId ?? null,
        landlord_id: null,
        status: row.status,
        amount: row.amount,
        period: row.period,
        payment_date: row.payment_date,
        receipt_url: row.receipt_url,
        created_at: row.created_at ?? null,
        payment_type: 'Kira Bedeli',
        tenant: { full_name: context.tenantName ?? null },
      },
      isPreviewImage(row.receipt_url) ? row.receipt_url : undefined
    );
    return { ...receipt, fileName: row.file_name || receipt.fileName };
  });
}

async function readStoredPayments(rentalId: string) {
  const { data, error } = await supabase
    .from('rentals')
    .select('payment_records')
    .eq('id', rentalId)
    .maybeSingle();
  if (error) throw error;
  return parsePaymentRecords(data?.payment_records);
}

async function saveStoredPayments(rentalId: string, records: StoredPaymentRecord[]) {
  const { data, error } = await supabase
    .from('rentals')
    .update({ payment_records: records })
    .eq('id', rentalId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error('Ödeme kaydı veritabanına yazılamadı. Kiralama satırı güncellenemedi.');
  }
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Dekont dosyası okunamadı.'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Dekont dosyası okunamadı.'));
    reader.readAsDataURL(file);
  });
}

async function storeReceiptFile(file: File, tenantId: string, rentalId: string) {
  const path = `${tenantId}/${rentalId}/${Date.now()}-${safeFileName(file.name)}`;
  const uploaded = await supabase.storage.from('receipts').upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (uploaded.error) throw uploaded.error;
  return supabase.storage.from('receipts').getPublicUrl(path).data.publicUrl;
}

export async function submitRentPayment(input: {
  file: File;
  amount: number;
  period: string;
  paymentDate: string;
  rentalId: string;
  propertyId: string;
  tenantId: string;
  landlordId: string;
}) {
  let receiptUrl = '';
  try {
    receiptUrl = await storeReceiptFile(input.file, input.tenantId, input.rentalId);
  } catch (error) {
    console.error('Dekont dosyası depoya yazılamadı, kayıt base64 olarak saklanacak:', error);
    receiptUrl = await fileToDataUrl(input.file);
  }

  const records = await readStoredPayments(input.rentalId);
  const next: StoredPaymentRecord = {
    id: crypto.randomUUID(),
    period: input.period,
    amount: input.amount,
    payment_date: input.paymentDate,
    receipt_url: receiptUrl,
    file_name: input.file.name,
    status: 'pending',
    created_at: new Date().toISOString(),
  };
  await saveStoredPayments(input.rentalId, [next, ...records]);
  return next;
}

export async function setRentalPaymentStatus(
  rentalId: string,
  paymentId: string,
  status: StoredPaymentRecord['status']
) {
  const records = await readStoredPayments(rentalId);
  const index = records.findIndex((row) => row.id === paymentId);
  if (index < 0) {
    if (status === 'approved') return approveRentPayment(paymentId);
    if (status === 'objected') return objectRentPayment(paymentId);
    throw new Error('Ödeme kaydı bulunamadı.');
  }
  const next = records.slice();
  next[index] = { ...next[index], status };
  await saveStoredPayments(rentalId, next);
  return next[index];
}

async function writePaymentStatus(paymentId: string, statuses: string[]) {
  let lastError: Error | null = null;
  for (const status of statuses) {
    const { error } = await supabase.from('rent_payments').update({ status }).eq('id', paymentId);
    if (!error) return status;
    lastError = error;
  }
  throw lastError ?? new Error('Ödeme durumu güncellenemedi.');
}

export function approveRentPayment(paymentId: string) {
  return writePaymentStatus(paymentId, ['approved']);
}

export function objectRentPayment(paymentId: string) {
  return writePaymentStatus(paymentId, ['objected', 'rejected', 'disputed']);
}
