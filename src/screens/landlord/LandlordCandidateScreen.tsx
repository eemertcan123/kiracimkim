import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  Search,
  ShieldCheck,
  AlertCircle,
  X,
  ChevronDown,
  Info,
  Copy,
  Share2,
  Clock,
} from 'lucide-react';
import {
  findProfileByShareCode,
  fetchProfile,
  loadCandidateTrust,
  loadLandlordTenantRental,
  profileToCandidate,
  readPledge,
  type LandlordTenantRental,
} from '../../lib/account';
import { supabase } from '../../lib/supabase';
import { CandidateProfile, LandlordProperty } from '../../types/kiracimkim';

const SHARE_CODE_PATTERN = /\bKMK-\d{4}-\d{4}\b/;
const RECENT_CANDIDATE_LIMIT = 6;

interface RecentCandidateLookup {
  code: string;
  maskedName: string;
  queriedAt: string;
}

function recentCandidateKey(landlordId: string) {
  return `kiracimkim.recentCandidates.v1.${landlordId}`;
}

function readRecentCandidates(landlordId: string): RecentCandidateLookup[] {
  try {
    const raw = localStorage.getItem(recentCandidateKey(landlordId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const record = item as Partial<RecentCandidateLookup>;
      const code = typeof record.code === 'string' ? record.code.toUpperCase() : '';
      const maskedName = typeof record.maskedName === 'string' ? record.maskedName.trim() : '';
      if (!SHARE_CODE_PATTERN.test(code) || !maskedName) return [];
      return [{ code, maskedName, queriedAt: record.queriedAt || '' }];
    }).slice(0, RECENT_CANDIDATE_LIMIT);
  } catch {
    return [];
  }
}

function rememberRecentCandidate(landlordId: string, entry: RecentCandidateLookup) {
  const next = [
    entry,
    ...readRecentCandidates(landlordId).filter((item) => item.code !== entry.code),
  ].slice(0, RECENT_CANDIDATE_LIMIT);
  try {
    localStorage.setItem(recentCandidateKey(landlordId), JSON.stringify(next));
  } catch {
    return next;
  }
  return next;
}

const HOW_IT_WORKS = [
  { step: '1', title: 'Adayın KMK Kodunu Girin' },
  { step: '2', title: 'Güven Karnesini İnceleyin' },
  { step: '3', title: 'Kiracılık Daveti Gönderin' },
] as const;

function propertyInviteRestriction(property: LandlordProperty) {
  if (property.tenantName !== null) return 'Aktif kiracılık';
  if (property.rentalId || property.pendingInvite) return 'Açık kiracılık kaydı';
  return '';
}

interface LandlordCandidateScreenProps {
  landlordId: string;
  properties: LandlordProperty[];
  selectedPropertyId: string;
  focusedCandidateCode: string | null;
  onClearFocusedCandidate: () => void;
  lookupCandidates?: CandidateProfile[];
  onSendRentalInvite: (propertyId: string, carnetCode: string) => Promise<string>;
  onCreateProperty: (title: string, district: string) => Promise<string>;
  onOpenHandover: (propertyId: string) => void;
  onNotify: (message: string) => void;
}

export function LandlordCandidateScreen({
  landlordId,
  properties,
  selectedPropertyId,
  focusedCandidateCode,
  onClearFocusedCandidate,
  onSendRentalInvite,
  onCreateProperty,
  onOpenHandover,
  onNotify,
}: LandlordCandidateScreenProps) {
  const ownedProperties = properties.filter((property) => property.landlordUserId === landlordId);
  const hasOwnedProperties = ownedProperties.length > 0;

  const [query, setQuery] = useState('');
  const [recentCandidates, setRecentCandidates] = useState<RecentCandidateLookup[]>(() =>
    readRecentCandidates(landlordId)
  );

  useEffect(() => {
    setRecentCandidates(readRecentCandidates(landlordId));
  }, [landlordId]);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateProfile | null>(null);
  const [searchError, setSearchError] = useState('');
  const [searching, setSearching] = useState(false);
  const lookupRequest = useRef(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previouslyShowingCandidate = useRef(false);
  const showingCandidate = selectedCandidate !== null;

  const [inviteCandidateModalOpen, setInviteCandidateModalOpen] = useState(false);
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteMode, setInviteMode] = useState<'existing' | 'new'>('existing');
  const [newPropertyTitle, setNewPropertyTitle] = useState('');
  const [newPropertyDistrict, setNewPropertyDistrict] = useState('');
  const [invitePropertyId, setInvitePropertyId] = useState('');
  const [candidateInviteError, setCandidateInviteError] = useState('');
  const [tenantRental, setTenantRental] = useState<LandlordTenantRental | null>(null);
  const [tenantRentalReady, setTenantRentalReady] = useState(false);
  const [inviteCodeCopied, setInviteCodeCopied] = useState(false);
  const useNewProperty = !hasOwnedProperties || inviteMode === 'new';
  const inviteProperty = ownedProperties.find((property) => property.id === invitePropertyId);
  const canInviteToSelectedProperty = inviteProperty && !propertyInviteRestriction(inviteProperty);

  const handleResetLookup = useCallback(() => {
    lookupRequest.current += 1;
    setQuery('');
    setSearchError('');
    setSearching(false);
    setSelectedCandidate(null);
    setTenantRental(null);
    setTenantRentalReady(false);
    setInviteCodeCopied(false);
    setInviteCandidateModalOpen(false);
  }, []);

  useLayoutEffect(() => {
    if (showingCandidate) {
      headingRef.current?.focus();
    } else if (previouslyShowingCandidate.current) {
      searchInputRef.current?.focus();
    }
    previouslyShowingCandidate.current = showingCandidate;
  }, [showingCandidate]);

  useEffect(() => {
    const discardCachedCard = (event: PageTransitionEvent) => {
      if (event.persisted) flushSync(handleResetLookup);
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (session && session.user.id !== landlordId)) {
        handleResetLookup();
      }
    });
    window.addEventListener('popstate', handleResetLookup);
    window.addEventListener('pagehide', discardCachedCard);
    window.addEventListener('pageshow', discardCachedCard);
    return () => {
      lookupRequest.current += 1;
      subscription.unsubscribe();
      window.removeEventListener('popstate', handleResetLookup);
      window.removeEventListener('pagehide', discardCachedCard);
      window.removeEventListener('pageshow', discardCachedCard);
    };
  }, [handleResetLookup, landlordId]);

  const lookupCandidate = useCallback(async (rawCode: string) => {
    handleResetLookup();
    const code = rawCode.toUpperCase().match(SHARE_CODE_PATTERN)?.[0];
    setQuery(code ?? rawCode);
    if (!code) {
      setSearchError('KMK kodunu KMK-2026-XXXX biçiminde girin.');
      return;
    }

    const request = lookupRequest.current;
    setSearching(true);
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (request !== lookupRequest.current) return;
      if (error || user?.id !== landlordId) {
        setSearchError('KMK kodunu sorgulamak için tekrar giriş yapın.');
        return;
      }

      const row = await findProfileByShareCode(code);
      if (request !== lookupRequest.current) return;
      const candidate = row ? profileToCandidate(row) : null;
      if (candidate?.code.toUpperCase() !== code) {
        setSearchError('Bu KMK kodu geçersiz veya artık etkin değil. Kodu kontrol edin.');
        return;
      }

      setTenantRentalReady(false);
      setSelectedCandidate(candidate);
      setRecentCandidates(
        rememberRecentCandidate(landlordId, {
          code: candidate.code.toUpperCase(),
          maskedName: candidate.maskedName,
          queriedAt: new Date().toISOString(),
        })
      );
      setQuery('');
    } catch (error) {
      if (request !== lookupRequest.current) return;
      console.error('Paylaşım kodu araması başarısız:', error);
      setSearchError('Güven Karnesi sorgulanamadı. Lütfen tekrar deneyin.');
    } finally {
      if (request === lookupRequest.current) setSearching(false);
    }
  }, [handleResetLookup, landlordId]);

  useEffect(() => {
    if (!focusedCandidateCode) return;
    onClearFocusedCandidate();
    void lookupCandidate(focusedCandidateCode);
  }, [focusedCandidateCode, lookupCandidate, onClearFocusedCandidate]);

  useEffect(() => {
    const tenantId = selectedCandidate?.tenantId;
    if (!tenantId || selectedCandidate.trustLoaded) return;
    let active = true;
    void loadCandidateTrust(tenantId)
      .then((trust) => {
        if (!active) return;
        setSelectedCandidate((current) => {
          if (current?.tenantId !== tenantId) return current;
          const payments = trust.approvedPaymentCount;
          const handovers = trust.handoverCount;
          const refs = trust.referenceCount;
          const first = payments === 0 && handovers === 0 && refs === 0;
          return {
            ...current,
            ...trust,
            isFirstRental: first,
            verifiedPaymentsSummary: first
              ? 'İlk Kiralama Adayı (Kayıtlı geçmiş kira verisi yok)'
              : `${payments} Onaylı Dekont`,
            handoverCountText:
              handovers > 0
                ? `${handovers} Teslim Tutanağı`
                : first
                  ? 'Teslim Tutanağı: Eşleşme sonrası oluşturulacak'
                  : 'Henüz Yok',
            referenceCountText: first ? 'Kayıtlı geçmiş kira verisi yok' : `${refs} Referans`,
            delayDetails: '',
          };
        });
      })
      .catch((error: unknown) => {
        console.error(error);
        if (!active) return;
        setSelectedCandidate((current) =>
          current?.tenantId === tenantId ? { ...current, trustLoaded: true } : current
        );
      });
    return () => {
      active = false;
    };
  }, [selectedCandidate?.tenantId, selectedCandidate?.trustLoaded]);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (!searching) void lookupCandidate(query);
  };

  useEffect(() => {
    const tenantId = selectedCandidate?.tenantId;
    if (!landlordId || !tenantId) {
      setTenantRental(null);
      setTenantRentalReady(true);
      return;
    }
    let active = true;
    const refresh = () =>
      loadLandlordTenantRental(landlordId, tenantId)
        .then((row) => {
          if (active) setTenantRental(row);
          return fetchProfile(tenantId);
        })
        .then((profile) => {
          if (!active || !profile) return;
          const pledged = readPledge(profile);
          setSelectedCandidate((current) =>
            current?.tenantId === tenantId
              ? { ...current, transparentEntryPledged: pledged }
              : current
          );
        })
        .catch(() => {
          if (active) setTenantRental(null);
        })
        .finally(() => {
          if (active) setTenantRentalReady(true);
        });
    setTenantRentalReady(false);
    void refresh();
    const channel = supabase
      .channel(`candidate-rental-${landlordId}-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rentals',
          filter: `landlord_id=eq.${landlordId}`,
        },
        () => {
          void refresh();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'rentals',
          filter: `landlord_id=eq.${landlordId}`,
        },
        () => {
          void refresh();
        }
      )
      .subscribe();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      void refresh();
    }, 4000);
    return () => {
      active = false;
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [landlordId, selectedCandidate?.tenantId]);

  const handleOpenCandidateInviteModal = () => {
    if (!selectedCandidate) return;
    const eligibleProperties = ownedProperties.filter((property) => !propertyInviteRestriction(property));
    const chosenId =
      eligibleProperties.find((property) => property.id === selectedPropertyId)?.id ??
      eligibleProperties[0]?.id ??
      '';
    setInvitePropertyId(chosenId);
    setInviteMode(hasOwnedProperties ? 'existing' : 'new');
    setNewPropertyTitle('');
    setNewPropertyDistrict('');
    setCandidateInviteError('');
    setInviteCandidateModalOpen(true);
  };

  const handleSubmitCandidateInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedCandidate || inviteSending) return;

    const title = newPropertyTitle.trim();
    const district = newPropertyDistrict.trim();
    if (useNewProperty && (!title || !district)) {
      setCandidateInviteError('Mülk adını ve konumunu girin.');
      return;
    }
    if (!useNewProperty && !canInviteToSelectedProperty) {
      setCandidateInviteError('Davet için uygun bir mülk seçin.');
      return;
    }

    const request = lookupRequest.current;
    setInviteSending(true);
    setCandidateInviteError('');
    try {
      const propertyId = useNewProperty ? await onCreateProperty(title, district) : invitePropertyId;
      const inviteCode = await onSendRentalInvite(propertyId, selectedCandidate.code);
      if (request !== lookupRequest.current) return;
      setInviteCodeCopied(false);
      setTenantRental({
        id: `pending-${propertyId}`,
        propertyId,
        status: 'pending',
        inviteCode: inviteCode || null,
        landlordApproved: false,
      });
      setInviteCandidateModalOpen(false);
    } catch (error) {
      if (request === lookupRequest.current) {
        setCandidateInviteError(error instanceof Error ? error.message : 'Davet kodu oluşturulamadı.');
      }
    } finally {
      setInviteSending(false);
    }
  };

  const selectedPropObj = properties.find((p) => p.id === selectedPropertyId);
  const processStatus = tenantRental?.landlordApproved
    ? { value: 'Aktif Takipte', detail: 'Tutanak onaylandı' }
    : tenantRental?.status === 'active'
      ? { value: 'Başlangıç Aşamasında', detail: 'Tutanak ve dekont takibi açık' }
      : { value: 'Henüz başlamadı', detail: 'Davet kabul edilince süreç açılır' };

  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div className="pb-5 border-b border-slate-200/80">
        <p className="text-xs font-medium text-emerald-700">
          Aday &amp; Referans ·{' '}
          {selectedPropObj
            ? `${selectedPropObj.nickname} (${selectedPropObj.officialLocation})`
            : `Tüm Mülkler (${properties.length} Daire)`}
        </p>
        <h1
          ref={headingRef}
          tabIndex={showingCandidate ? -1 : undefined}
          className="mt-1 scroll-mt-24 text-2xl sm:text-3xl font-display font-bold text-[#0B192C] tracking-tight outline-none"
        >
          {showingCandidate ? 'Kiracı Güven Karnesi' : 'Kiracı Güven Karnesi Sorgula'}
        </h1>
        {!showingCandidate && (
          <p className="mt-2 text-sm text-slate-600">
            Kiracı adayının düzenli kira ödeme geçmişini ve önceki teslim tutanağı kayıtlarını incelemek için sizinle paylaştığı KMK kodunu girin.
          </p>
        )}
      </div>

      <div className="max-w-4xl mx-auto">
        {!selectedCandidate ? (
          <div className="max-w-3xl mx-auto bg-gradient-to-b from-emerald-50/60 via-white to-white border border-slate-200/90 rounded-3xl p-4 sm:p-7 shadow-sm">
            <form onSubmit={handleSearch} aria-busy={searching} className="space-y-3">
              <label htmlFor="candidate-code-input" className="block text-sm font-semibold text-[#0B192C]">
                KMK kodu
              </label>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative min-w-0 flex-1">
                  <Search
                    className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    ref={searchInputRef}
                    id="candidate-code-input"
                    type="text"
                    value={query}
                    readOnly={searching}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setSearchError('');
                    }}
                    placeholder="Örn. KMK-2026-XXXX"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    aria-invalid={Boolean(searchError)}
                    aria-describedby={searchError ? 'candidate-code-error' : undefined}
                    className="w-full min-h-[50px] pl-11 pr-4 py-2.5 bg-white border border-slate-300 rounded-2xl text-base font-mono-tabular text-[#0B192C] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 shadow-xs"
                  />
                </div>
                <button
                  type="submit"
                  disabled={searching}
                  className="min-h-[50px] px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70 text-white text-sm font-semibold rounded-2xl transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-600"
                >
                  {searching ? 'Sorgulanıyor…' : 'Güven Karnesini Gör'}
                </button>
              </div>
              {searchError && (
                <p id="candidate-code-error" role="alert" className="flex items-start gap-2 text-sm text-rose-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {searchError}
                </p>
              )}
            </form>
            <div className="mt-5">
              <p className="text-xs font-semibold tracking-wide text-slate-500">NASIL ÇALIŞIR?</p>
              <ol className="mt-2 grid grid-cols-3 gap-2">
                {HOW_IT_WORKS.map((item) => (
                  <li
                    key={item.step}
                    className="min-w-0 rounded-2xl border border-slate-200 bg-white px-2.5 py-3 sm:px-3"
                  >
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">
                      {item.step}
                    </span>
                    <p className="mt-2 text-xs font-semibold leading-snug text-[#0B192C]">
                      {item.title}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
            <div className="mt-5">
              <p className="text-xs font-semibold tracking-wide text-slate-500">SON SORGULANAN ADAYLAR</p>
              {recentCandidates.length > 0 ? (
                <ul className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  {recentCandidates.map((candidate) => (
                    <li key={candidate.code} className="border-t border-slate-100 first:border-t-0">
                      <button
                        type="button"
                        disabled={searching}
                        onClick={() => void lookupCandidate(candidate.code)}
                        className="flex min-h-[44px] w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-emerald-50 disabled:opacity-70"
                      >
                        <span className="min-w-0 truncate text-sm font-semibold text-[#0B192C]">
                          {candidate.maskedName}
                        </span>
                        <span className="shrink-0 font-mono-tabular text-xs font-semibold text-emerald-800">
                          {candidate.code}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 rounded-2xl border border-dashed border-slate-200 bg-white px-3 py-3 text-xs text-slate-500">
                  Henüz sorguladığınız bir aday yok. KMK kodu girdiğinizde burada listelenir.
                </p>
              )}
            </div>
          </div>
        ) : (
          <>
            <article aria-labelledby="candidate-name" className="bg-white border border-slate-200/90 rounded-3xl overflow-hidden shadow-sm">
              <div className="bg-[#0B192C] text-white px-6 sm:px-8 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-400">
                    <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Kimliği Doğrulanmış Kiracı</span>
                  </div>
                  <h2 id="candidate-name" className="mt-1.5 text-xl sm:text-2xl font-display font-bold text-white">
                    {selectedCandidate.maskedName}
                  </h2>
                </div>
                <div className="flex flex-col items-start sm:items-end gap-1.5 self-start sm:self-auto shrink-0 sm:max-w-xs">
                  <span className="text-[10px] font-bold tracking-[0.16em] text-emerald-300">
                    GÜVEN KARNESİ
                  </span>
                  <span className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-xs font-semibold text-emerald-100 leading-snug sm:text-right">
                    Kiracı Tarafından Paylaşılan Kod:{' '}
                    <span className="font-mono-tabular font-semibold text-emerald-300">
                      {selectedCandidate.code}
                    </span>
                  </span>
                </div>
              </div>

              <div className="p-6 sm:p-8 space-y-6">
                {selectedCandidate.tenantId && selectedCandidate.trustLoaded !== true ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5">
                    <p className="text-sm text-slate-600">Kayıtlar yükleniyor.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold tracking-wide text-slate-500">
                      KİRACI GEÇMİŞİ
                    </p>
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                      {(selectedCandidate.approvedPaymentCount ?? 0) > 0 ||
                      (selectedCandidate.handoverCount ?? 0) > 0 ||
                      (selectedCandidate.referenceCount ?? 0) > 0 ? (
                        <>
                          <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-[11px] font-semibold tracking-wide text-slate-500">Kira Ödemeleri</p>
                            <p className="mt-1.5 text-sm font-display font-bold text-[#0B192C]">
                              {selectedCandidate.approvedPaymentCount ?? 0} Onaylı Dekont
                            </p>
                            <p className="mt-1 text-xs leading-snug text-slate-500">Doğrulanmış ödeme kaydı</p>
                          </div>
                          <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-[11px] font-semibold tracking-wide text-slate-500">Teslim Tutanağı</p>
                            <p className="mt-1.5 text-sm font-display font-bold text-[#0B192C]">
                              {(selectedCandidate.handoverCount ?? 0) > 0
                                ? `${selectedCandidate.handoverCount} Tutanak`
                                : 'Bekleniyor'}
                            </p>
                            <p className="mt-1 text-xs leading-snug text-slate-500">
                              {(selectedCandidate.handoverCount ?? 0) > 0
                                ? 'Zaman damgalı kayıt'
                                : 'Eşleşme sonrası oluşturulur'}
                            </p>
                          </div>
                          <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-[11px] font-semibold tracking-wide text-slate-500">Süreç Durumu</p>
                            <p className="mt-1.5 text-sm font-display font-bold text-[#0B192C]">
                              {processStatus.value}
                            </p>
                            <p className="mt-1 text-xs leading-snug text-slate-500">{processStatus.detail}</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-[11px] font-semibold tracking-wide text-slate-500">Kira Ödemeleri</p>
                            <p className="mt-1.5 text-sm font-display font-bold text-[#0B192C]">Henüz Kayıt Yok</p>
                            <p className="mt-1 text-xs leading-snug text-slate-500">İlk kiralama adayı</p>
                          </div>
                          <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-[11px] font-semibold tracking-wide text-slate-500">Teslim Tutanağı</p>
                            <p className="mt-1.5 text-sm font-display font-bold text-[#0B192C]">Bekleniyor</p>
                            <p className="mt-1 text-xs leading-snug text-slate-500">Eşleşme sonrası oluşturulur</p>
                          </div>
                          <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-[11px] font-semibold tracking-wide text-slate-500">Süreç Durumu</p>
                            <p className="mt-1.5 text-sm font-display font-bold text-[#0B192C]">
                              {processStatus.value}
                            </p>
                            <p className="mt-1 text-xs leading-snug text-slate-500">{processStatus.detail}</p>
                          </div>
                        </>
                      )}
                    </div>
                    {selectedCandidate.referenceComment ? (
                      <p className="text-sm text-[#0B192C] leading-relaxed">
                        {selectedCandidate.referenceComment}
                      </p>
                    ) : null}
                  </div>
                )}

                {selectedCandidate.trustLoaded === true &&
                  (selectedCandidate.approvedPaymentCount ?? 0) === 0 &&
                  (selectedCandidate.handoverCount ?? 0) === 0 &&
                  (selectedCandidate.referenceCount ?? 0) === 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5">
                      <p className="text-sm font-semibold text-[#0B192C]">Neden geçmiş kaydı yok?</p>
                      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                        Bu aday KiracımKim&apos;i ilk kez kullanıyor veya ilk kiralamasını yapacak. Kiracılık daveti gönderdiğinizde adaydan; evi fotoğraflı teslim tutanağıyla devralmayı ve düzenli kira dekontu yüklemeyi kabul ettiği Şeffaflık Taahhüdü&apos;nü onaylaması istenir.
                      </p>
                    </div>
                  )}

                <div>
                  {tenantRental?.status === 'pending' ? (
                    <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-4 sm:p-5 space-y-4">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-amber-700 border border-amber-200">
                          <Clock className="w-4 h-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm sm:text-base font-display font-bold text-[#0B192C] leading-snug">
                            Kiracının onayı bekleniyor
                          </p>
                          <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                            Bu 6 haneli kodu kiracınızla paylaşın. Kiracınız kodu KiracımKim
                            hesabına girerek daveti onayladığında kiralama süreci başlayacak.
                          </p>
                        </div>
                      </div>
                      <p className="rounded-xl border border-amber-200/70 bg-white px-3 py-3 text-center text-2xl font-bold tracking-[0.28em] text-[#0B192C] font-mono-tabular">
                        {tenantRental.inviteCode || '—'}
                      </p>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          type="button"
                          disabled={!tenantRental.inviteCode}
                          onClick={async () => {
                            const code = tenantRental.inviteCode;
                            if (!code) return;
                            try {
                              await navigator.clipboard.writeText(code);
                              setInviteCodeCopied(true);
                              onNotify('Davet kodu kopyalandı.');
                              window.setTimeout(() => setInviteCodeCopied(false), 2500);
                            } catch {
                              onNotify('Davet kodu kopyalanamadı.');
                            }
                          }}
                          className="flex-1 min-h-[44px] px-3 py-2 bg-[#0B192C] hover:bg-[#132946] disabled:opacity-50 text-white text-xs font-semibold rounded-xl inline-flex items-center justify-center gap-1.5"
                        >
                          <Copy className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>{inviteCodeCopied ? 'Kopyalandı' : 'Kodu Kopyala'}</span>
                        </button>
                        <button
                          type="button"
                          disabled={!tenantRental.inviteCode}
                          onClick={() => {
                            const code = tenantRental.inviteCode;
                            if (!code) return;
                            const message = `Merhaba, Kiracımkim davet kodunuz: ${code}. Güven Karnem ekranında bu 6 haneli kodu girerek kiralama sürecini başlatabilirsiniz.`;
                            window.open(
                              `https://wa.me/?text=${encodeURIComponent(message)}`,
                              '_blank',
                              'noopener,noreferrer'
                            );
                          }}
                          className="flex-1 min-h-[44px] px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl inline-flex items-center justify-center gap-1.5"
                        >
                          <Share2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>WhatsApp ile Gönder</span>
                        </button>
                      </div>
                    </div>
                  ) : tenantRental?.status !== 'active' && tenantRentalReady ? (
                    <div className="flex flex-col sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={handleOpenCandidateInviteModal}
                        disabled={inviteSending}
                        className="min-h-[48px] px-5 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70 text-white text-sm font-semibold rounded-xl transition-colors inline-flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-600"
                      >
                        Kiracılık Daveti Gönder
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </article>
            {tenantRental?.status === 'active' && (
              <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-[#0B192C]">
                  Aday Davetinizi Kabul Etti • Süreç Başladı
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (tenantRental.propertyId) onOpenHandover(tenantRental.propertyId);
                  }}
                  disabled={!tenantRental.propertyId}
                  className="shrink-0 min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-[#0B192C] hover:bg-slate-50 disabled:opacity-50"
                >
                  Mülk &amp; Tutanak&apos;a Git →
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={handleResetLookup}
              className="mt-2 min-h-[44px] rounded text-sm font-medium text-emerald-700 underline underline-offset-4 hover:text-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              Başka Bir Aday Sorgula
            </button>
          </>
        )}
      </div>

      {inviteCandidateModalOpen && selectedCandidate && (
        <div
          className="fixed inset-0 z-50 bg-[#0B192C]/75 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="candidate-invite-title"
        >
          <div className="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain bg-white rounded-3xl shadow-2xl border border-slate-200">
            <div className="bg-[#0B192C] text-white px-4 sm:px-6 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-400 font-medium">
                  {selectedCandidate.maskedName} • {selectedCandidate.code}
                </p>
                <h3 id="candidate-invite-title" className="text-base font-display font-bold mt-0.5">
                  Kiracılık Daveti
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInviteCandidateModalOpen(false)}
                disabled={inviteSending}
                aria-label="Kapat"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-white/10 disabled:opacity-50"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSubmitCandidateInvite} className="p-4 sm:p-6 space-y-3">
              <fieldset disabled={inviteSending} className="min-w-0 space-y-3">
                <legend className="text-sm font-medium text-[#0B192C]">
                  Kiracıyı hangi dairenize davet etmek istiyorsunuz?
                </legend>
                {hasOwnedProperties && (
                  <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
                    {([
                      ['existing', 'Kayıtlı Mülklerimden Seç'],
                      ['new', 'Yeni Mülk Ekle'],
                    ] as const).map(([mode, label]) => (
                      <label key={mode} className="min-w-0">
                        <input
                          type="radio"
                          name="invite-property-mode"
                          value={mode}
                          checked={inviteMode === mode}
                          onChange={() => {
                            setInviteMode(mode);
                            setCandidateInviteError('');
                          }}
                          className="peer sr-only"
                        />
                        <span className="flex min-h-[44px] items-center justify-center rounded-lg px-2 py-1 text-center text-xs font-semibold text-slate-600 cursor-pointer peer-checked:bg-white peer-checked:text-[#0B192C] peer-checked:shadow-xs peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-600">
                          {label}
                        </span>
                      </label>
                    ))}
                  </div>
                )}

                {!useNewProperty ? (
                  <div className="relative">
                    <label htmlFor="candidate-invite-property" className="sr-only">
                      Kayıtlı mülk
                    </label>
                    <select
                      id="candidate-invite-property"
                      value={canInviteToSelectedProperty ? invitePropertyId : ''}
                      onChange={(e) => {
                        setInvitePropertyId(e.target.value);
                        setCandidateInviteError('');
                      }}
                      className="w-full min-h-[46px] pl-3.5 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-sm font-semibold text-[#0B192C] appearance-none cursor-pointer focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    >
                      <option value="" disabled>
                        Mülk seçin
                      </option>
                      {ownedProperties.map((property) => {
                        const restriction = propertyInviteRestriction(property);
                        return (
                          <option key={property.id} value={property.id} disabled={Boolean(restriction)}>
                            {property.nickname} ({property.officialLocation}){restriction && ` · ${restriction}`}
                          </option>
                        );
                      })}
                    </select>
                    <ChevronDown
                      className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label
                        htmlFor="invite-new-title"
                        className="block text-xs font-semibold text-[#0B192C] mb-1.5"
                      >
                        Mülk / Daire Adı
                      </label>
                      <input
                        id="invite-new-title"
                        type="text"
                        required
                        value={newPropertyTitle}
                        onChange={(e) => {
                          setNewPropertyTitle(e.target.value);
                          setCandidateInviteError('');
                        }}
                        placeholder="Örn. Moda Sahil Dairesi 2+1"
                        className="w-full min-h-[46px] px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-sm text-[#0B192C] focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="invite-new-district"
                        className="block text-xs font-semibold text-[#0B192C] mb-1.5"
                      >
                        Mülk Konumu
                      </label>
                      <input
                        id="invite-new-district"
                        type="text"
                        required
                        value={newPropertyDistrict}
                        onChange={(e) => {
                          setNewPropertyDistrict(e.target.value);
                          setCandidateInviteError('');
                        }}
                        placeholder="Örn. Kadıköy / Caferağa Mah."
                        className="w-full min-h-[46px] px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-sm text-[#0B192C] focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                  </div>
                )}
              </fieldset>

              <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="text-xs font-bold text-[#0B192C]">Davet sonrasında ne olacak?</p>
                  <ol className="mt-1 list-decimal space-y-1 pl-4 text-xs leading-relaxed text-slate-600">
                    <li>Kiracınızla paylaşabileceğiniz 6 haneli davet kodu oluşturulur.</li>
                    <li>Kiracı bu kodu hesabına girerek daveti kabul eder.</li>
                    <li>Ardından teslim tutanağı ve kira ödeme takibi başlatılabilir.</li>
                  </ol>
                </div>
              </div>

              {candidateInviteError && (
                <p
                  role="alert"
                  className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5"
                >
                  {candidateInviteError}
                </p>
              )}

              <div className="flex gap-2.5 pt-1">
                <button
                  type="submit"
                  disabled={inviteSending || (!useNewProperty && !canInviteToSelectedProperty)}
                  className="flex-1 min-h-[46px] px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70 text-white font-semibold text-sm rounded-xl transition-colors inline-flex items-center justify-center gap-2"
                >
                  {inviteSending ? 'Kod oluşturuluyor…' : 'Davet Kodu Oluştur'}
                </button>
                <button
                  type="button"
                  onClick={() => setInviteCandidateModalOpen(false)}
                  disabled={inviteSending}
                  className="min-h-[46px] px-4 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl disabled:opacity-50"
                >
                  Vazgeç
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
