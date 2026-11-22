import { useEffect, useState } from 'react';
import {
  Search,
  ShieldCheck,
  AlertCircle,
  X,
  ChevronDown,
  Building2,
  Send,
  Info,
  Receipt,
  FileCheck2,
  Award,
  Copy,
  Share2,
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
  lookupCandidates = [],
  onSendRentalInvite,
  onCreateProperty,
  onOpenHandover,
  onNotify,
}: LandlordCandidateScreenProps) {
  const vacantProperties = properties.filter((p) => p.tenantName === null);
  const hasVacantProperties = vacantProperties.length > 0;

  const [query, setQuery] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateProfile | null>(null);
  const [notFoundCode, setNotFoundCode] = useState<string | null>(null);

  // Invite Candidate to Vacant Property Modal State
  const [inviteCandidateModalOpen, setInviteCandidateModalOpen] = useState(false);
  const [inviteSending, setInviteSending] = useState(false);
  const [sentInviteCode, setSentInviteCode] = useState<string | null>(null);
  const [inviteMode, setInviteMode] = useState<'existing' | 'new'>('existing');
  const [newPropertyTitle, setNewPropertyTitle] = useState('');
  const [newPropertyDistrict, setNewPropertyDistrict] = useState('');
  const [selectedEmptyPropId, setSelectedEmptyPropId] = useState<string>(
    vacantProperties[0]?.id ?? ''
  );
  const [candidateInviteError, setCandidateInviteError] = useState('');
  const [tenantRental, setTenantRental] = useState<LandlordTenantRental | null>(null);
  const [tenantRentalReady, setTenantRentalReady] = useState(false);
  const [inviteCodeCopied, setInviteCodeCopied] = useState(false);

  const [directory, setDirectory] = useState<CandidateProfile[]>(lookupCandidates);
  const [searching, setSearching] = useState(false);
  const allLookupPool = directory;

  useEffect(() => {
    if (focusedCandidateCode) {
      const found = allLookupPool.find((c) => c.code === focusedCandidateCode);
      if (found) {
        setQuery('');
        setSelectedCandidate(found);
        setNotFoundCode(null);
      }
      onClearFocusedCandidate();
    }
  }, [focusedCandidateCode]);

  const extractCode = (raw: string) => {
    const trimmed = raw.trim().toUpperCase();
    const match = trimmed.match(/KMK-\d{4}-\d{4}/);
    return match ? match[0] : trimmed;
  };

  useEffect(() => {
    setDirectory(lookupCandidates);
  }, [lookupCandidates]);

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
    const code = extractCode(query);
    if (!code) {
      onNotify('Lütfen sorgulamak istediğiniz kiracı paylaşım kodunu girin.');
      return;
    }
    setSearching(true);
    void findProfileByShareCode(code)
      .then((row) => {
        const shareCode = row ? profileToCandidate(row).code : '';
        if (!row || !shareCode) {
          setSelectedCandidate(null);
          setNotFoundCode(code);
          setQuery('');
          return;
        }
        const found = profileToCandidate(row);
        setSelectedCandidate(found);
        setNotFoundCode(null);
        setQuery('');
        onNotify(`${found.maskedName} (${found.code}) doğrulanmış metrikleri getirildi.`);
      })
      .catch((error: unknown) => {
        console.error('Paylaşım kodu araması başarısız:', error);
        onNotify(error instanceof Error ? error.message : 'Paylaşım kodu sorgulanamadı.');
      })
      .finally(() => setSearching(false));
  };

  const handleQuickSelect = (candidate: CandidateProfile) => {
    setQuery('');
    setSelectedCandidate(candidate);
    setNotFoundCode(null);
  };

  const handleResetLookup = () => {
    setQuery('');
    setSelectedCandidate(null);
    setNotFoundCode(null);
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
    const chosenId =
      selectedPropertyId !== 'all' && selectedPropertyId !== 'empty-demo'
        ? properties.find((property) => property.id === selectedPropertyId && property.tenantName === null)
            ?.id ?? vacantProperties[0]?.id ?? ''
        : vacantProperties[0]?.id ?? '';
    setSelectedEmptyPropId(chosenId);
    setInviteMode(vacantProperties.length > 0 ? 'existing' : 'new');
    setNewPropertyTitle('');
    setNewPropertyDistrict('');
    setSentInviteCode(null);
    setCandidateInviteError('');
    setInviteCandidateModalOpen(true);
  };

  const submitRentalInvite = async (propertyId: string, carnetCode: string) => {
    setInviteSending(true);
    setCandidateInviteError('');
    try {
      const inviteCode = await onSendRentalInvite(propertyId, carnetCode);
      setSentInviteCode(inviteCode);
      setTenantRental({
        id: `pending-${propertyId}`,
        propertyId,
        status: 'pending',
        inviteCode: inviteCode || null,
      });
      setInviteCandidateModalOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Davet gönderilemedi.';
      setCandidateInviteError(message);
      onNotify(message);
    } finally {
      setInviteSending(false);
    }
  };

  const handleSubmitCandidateInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedCandidate || inviteSending) return;
    try {
      const useNewProperty = !hasVacantProperties || inviteMode === 'new';
      let propertyId = selectedEmptyPropId;
      if (useNewProperty) {
        if (!newPropertyTitle.trim() || !newPropertyDistrict.trim()) {
          setCandidateInviteError('Yeni daire için başlık ve konum girin.');
          return;
        }
        setInviteSending(true);
        propertyId = await onCreateProperty(newPropertyTitle.trim(), newPropertyDistrict.trim());
        setSelectedEmptyPropId(propertyId);
      } else if (!propertyId) {
        setCandidateInviteError('Lütfen bir daire seçin veya yeni daire bilgisi girin.');
        return;
      }
      await submitRentalInvite(propertyId, selectedCandidate.code);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Daire kaydedilemedi.';
      setCandidateInviteError(message);
      onNotify(message);
      setInviteSending(false);
    }
  };

  const selectedPropObj = properties.find((p) => p.id === selectedPropertyId);

  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div className="pb-5 border-b border-slate-200/80">
        <p className="text-xs font-medium text-emerald-700">
          Aday &amp; Referans ·{' '}
          {selectedPropObj
            ? `${selectedPropObj.nickname} (${selectedPropObj.officialLocation})`
            : `Tüm Mülkler (${properties.length} Daire)`}
        </p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-display font-bold text-[#0B192C] tracking-tight">
          Kiracı Paylaşım Kodu
        </h1>
      </div>

      <div className="max-w-4xl mx-auto">
          {!selectedCandidate && !notFoundCode ? (
            /* AŞAMA 1 — İLK AÇILIŞ (SADECE ARAMA) */
            <div className="max-w-3xl mx-auto mt-2 sm:mt-8 bg-gradient-to-b from-emerald-50/60 via-white to-white border border-slate-200/90 rounded-3xl p-6 sm:p-9 lg:p-10 shadow-sm text-center">
              <div className="max-w-xl mx-auto">
                <h2 className="text-2xl sm:text-3xl font-display font-bold text-[#0B192C] tracking-tight leading-snug">
                  Evinizi Kime Emanet Edeceğinizi Önceden Bilin
                </h2>
                <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
                  Kiracı adayınızın size WhatsApp veya SMS ile gönderdiği paylaşım kodunu girerek
                  önceki kira ödemelerini ve ev sahibi referanslarını inceleyin.
                </p>
              </div>

              <form
                onSubmit={handleSearch}
                className="mt-6 max-w-xl mx-auto flex flex-col sm:flex-row items-stretch gap-2.5"
              >
                <label htmlFor="candidate-code-input" className="sr-only">
                  Kiracı Paylaşım Kodu
                </label>
                <div className="relative flex-1">
                  <Search
                    className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="candidate-code-input"
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Kiracı Paylaşım Kodu (Örn: KMK-2026-5104)"
                    className="w-full min-h-[50px] pl-11 pr-4 py-2.5 bg-white border border-slate-300 rounded-2xl text-sm font-mono-tabular text-[#0B192C] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 shadow-xs"
                  />
                </div>
                <button
                  type="submit"
                  disabled={searching}
                  className="min-h-[50px] px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70 text-white text-sm font-semibold rounded-2xl transition-colors whitespace-nowrap shrink-0 inline-flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-600 shadow-xs"
                >
                  <span>{searching ? 'Sorgulanıyor…' : 'Kiracı Geçmişini Gör'}</span>
                </button>
              </form>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {allLookupPool.map((candidate) => (
                  <button
                    key={candidate.tenantId ?? candidate.code}
                    type="button"
                    onClick={() => handleQuickSelect(candidate)}
                    className="min-h-[34px] px-3 py-1 rounded-xl text-xs font-medium transition-colors border whitespace-nowrap bg-slate-50 border-slate-200 text-slate-700 hover:bg-emerald-50 hover:border-emerald-500 hover:text-emerald-800"
                  >
                    {candidate.maskedName} ({candidate.code})
                    {candidate.isFirstRental ? ' • İlk Kiralama' : ''}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* AŞAMA 2 — KOD SORGULANDIĞINDA (İNCE ARAMA ÇUBUĞU + KARNE MERKEZDE) */
            <div className="space-y-5">
              {/* Tek satırlık ince arama çubuğu */}
              <form
                onSubmit={handleSearch}
                className="bg-white border border-slate-200/90 rounded-2xl p-2 sm:px-3 sm:py-2 shadow-xs flex items-center gap-2"
              >
                <label htmlFor="candidate-slim-code-input" className="sr-only">
                  Yeni Kod Sorgula
                </label>
                <div className="relative flex-1 min-w-0">
                  <Search
                    className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="candidate-slim-code-input"
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Yeni Kod Sorgula..."
                    className="w-full min-h-[40px] pl-9 pr-3 py-1.5 bg-slate-50/70 border border-transparent focus:bg-white focus:border-emerald-600 rounded-xl text-xs sm:text-sm font-mono-tabular text-[#0B192C] placeholder:text-slate-400 focus:outline-none transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={searching}
                  className="min-h-[40px] px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70 text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0"
                >
                  {searching ? 'Sorgulanıyor…' : 'Kiracı Geçmişini Gör'}
                </button>
                <button
                  type="button"
                  onClick={handleResetLookup}
                  aria-label="Arama ekranına dön"
                  title="Arama ekranına dön"
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:text-[#0B192C] hover:bg-slate-50 transition-colors shrink-0"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </form>

              {notFoundCode ? (
                <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
                  <div className="flex items-start gap-3.5">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                    <div>
                      <p className="text-sm sm:text-base font-bold text-[#0B192C]">
                        &ldquo;{notFoundCode}&rdquo; koduna ait aktif karne bulunamadı
                      </p>
                      <p className="mt-1 text-xs sm:text-sm text-slate-500">
                        Lütfen paylaşım kodunu kontrol edin veya aşağıdaki örnek kodlardan birini
                        seçin.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                    {allLookupPool.map((candidate) => (
                      <button
                        key={candidate.tenantId ?? candidate.code}
                        type="button"
                        onClick={() => handleQuickSelect(candidate)}
                        className="min-h-[34px] px-3 py-1 rounded-xl text-xs font-medium transition-colors border whitespace-nowrap bg-slate-50 border-slate-200 text-slate-700 hover:bg-emerald-50 hover:border-emerald-500 hover:text-emerald-800"
                      >
                        {candidate.maskedName} ({candidate.code})
                        {candidate.isFirstRental ? ' • İlk Kiralama' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              ) : selectedCandidate ? (
                <div className="bg-white border border-slate-200/90 rounded-3xl overflow-hidden shadow-sm">
                  <div className="bg-[#0B192C] text-white px-6 sm:px-8 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-400">
                        <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span>Kimliği Doğrulanmış Kiracı</span>
                      </div>
                      <h3 className="mt-1.5 text-xl sm:text-2xl font-display font-bold text-white">
                        {selectedCandidate.maskedName}
                      </h3>
                    </div>
                    <span className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-xs font-mono-tabular font-semibold text-emerald-300 self-start sm:self-auto shrink-0">
                      {selectedCandidate.code}
                    </span>
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
                        <div className="flex flex-wrap gap-2">
                          {(selectedCandidate.approvedPaymentCount ?? 0) > 0 ||
                          (selectedCandidate.handoverCount ?? 0) > 0 ||
                          (selectedCandidate.referenceCount ?? 0) > 0 ? (
                            <>
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
                                <Receipt className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                {selectedCandidate.approvedPaymentCount ?? 0} Onaylı Dekont
                              </span>
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs font-semibold text-[#0B192C]">
                                <FileCheck2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                {(selectedCandidate.handoverCount ?? 0) > 0
                                  ? `${selectedCandidate.handoverCount} Teslim Tutanağı`
                                  : 'Teslim Tutanağı: Henüz Yok'}
                              </span>
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs font-semibold text-[#0B192C]">
                                <Award className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                {selectedCandidate.referenceCount ?? 0} Referans
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
                                <Award className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                İlk Kiralama Adayı (Kayıtlı geçmiş kira verisi yok)
                              </span>
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs font-semibold text-[#0B192C]">
                                <FileCheck2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                Teslim Tutanağı: Eşleşme sonrası oluşturulacak
                              </span>
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

                    {(selectedCandidate.approvedPaymentCount ?? 0) === 0 &&
                      (selectedCandidate.handoverCount ?? 0) === 0 &&
                      (selectedCandidate.referenceCount ?? 0) === 0 &&
                      selectedCandidate.trustLoaded === true && (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                        <p className="text-sm font-display font-bold text-[#0B192C]">
                          Bu aday davet edildiğinde
                        </p>
                        <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                          Bu adayın KiracımKim üzerinde henüz doğrulanmış kira geçmişi bulunmuyor.
                          Davet gönderildiğinde adaya 6 haneli eşleşme kodu iletilir. Aday, daveti
                          kabul ederek Kiracı Taahhüdünü onaylayabilir ve kiracılık sürecini
                          başlatabilir.
                        </p>
                      </div>
                    )}

                    <div>
                      {tenantRental?.status === 'active' ? (
                        <div className="space-y-3 pt-2 border-t border-slate-100">
                          <div className="bg-emerald-50 border border-emerald-300 rounded-2xl px-4 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-emerald-900 leading-snug">
                              ✅ Kiracı Daveti Onayladı • Kiralama Aktif
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                if (tenantRental.propertyId) onOpenHandover(tenantRental.propertyId);
                              }}
                              disabled={!tenantRental.propertyId}
                              className="shrink-0 min-h-[44px] px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl whitespace-nowrap"
                            >
                              Mülk &amp; Tutanak Sekmesine Git →
                            </button>
                          </div>
                          {selectedCandidate.transparentEntryPledged ? (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3">
                              <p className="text-sm font-semibold text-emerald-800 leading-snug">
                                Şeffaflık Taahhüdü Onaylandı
                              </p>
                            </div>
                          ) : (
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                              <p className="text-sm font-medium text-amber-950 leading-snug">
                                Taahhüt Onaylanmadan Devam Edildi
                              </p>
                            </div>
                          )}
                        </div>
                      ) : tenantRental?.status === 'pending' ? (
                        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 sm:p-5 space-y-4">
                          <p className="text-sm font-semibold text-[#0B192C] leading-snug">
                            Davet gönderildi. Kiracı bu kodu girmeden kiralama başlamaz.
                          </p>
                          <div className="flex items-center justify-between gap-2">
                            <p className="min-w-0 text-2xl font-bold tracking-widest text-[#0B192C] font-mono-tabular whitespace-nowrap">
                              {tenantRental.inviteCode || '—'}
                            </p>
                            <button
                              type="button"
                              disabled={!tenantRental.inviteCode}
                              onClick={() => {
                                const code = tenantRental.inviteCode;
                                if (!code) return;
                                void navigator.clipboard.writeText(code).catch(() => undefined);
                                setInviteCodeCopied(true);
                                onNotify(`Davet kodu kopyalandı: ${code}`);
                                window.setTimeout(() => setInviteCodeCopied(false), 2500);
                              }}
                              className="shrink-0 min-h-[40px] px-3 py-2 bg-[#0B192C] hover:bg-[#132946] disabled:opacity-50 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap"
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
                              className="shrink-0 min-h-[40px] px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap"
                            >
                              <Share2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                              <span>WhatsApp ile Gönder</span>
                            </button>
                          </div>
                        </div>
                      ) : tenantRentalReady ? (
                        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                            <button
                              type="button"
                              onClick={handleResetLookup}
                              className="min-h-[48px] px-5 py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl"
                            >
                              Vazgeç
                            </button>
                            <button
                              type="button"
                              onClick={handleOpenCandidateInviteModal}
                              disabled={inviteSending}
                              className="min-h-[48px] px-5 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70 text-white text-sm font-semibold rounded-xl transition-colors inline-flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-600"
                            >
                              <span>
                                {inviteSending ? 'İletiliyor…' : 'Kiracılık Daveti Gönder'}
                              </span>
                            </button>
                          </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>


      {/* Invite Candidate to Vacant Property Modal */}
      {inviteCandidateModalOpen && selectedCandidate && (
        <div
          className="fixed inset-0 z-50 bg-[#0B192C]/75 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Kiracılık Daveti Gönder"
        >
          <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200">
            <div className="bg-[#0B192C] text-white px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-400 font-medium">
                  {selectedCandidate.maskedName} • {selectedCandidate.code}
                </p>
                <h3 className="text-base font-display font-bold mt-0.5">
                  Kiracılık Daveti Gönder
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInviteCandidateModalOpen(false)}
                aria-label="Kapat"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-white/10"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {sentInviteCode ? (
              <div className="p-6 space-y-4">
                <p className="text-sm text-[#0B192C] leading-relaxed">
                  Davet kiracının paneline düştü. SMS veya WhatsApp ile iletebileceğiniz 6 haneli
                  kod:
                </p>
                <p className="text-center text-3xl font-display font-bold tracking-[0.3em] text-emerald-700">
                  {sentInviteCode}
                </p>
                <button
                  type="button"
                  onClick={() => setInviteCandidateModalOpen(false)}
                  className="w-full min-h-[46px] bg-[#0B192C] text-white text-sm font-semibold rounded-xl"
                >
                  Kapat
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitCandidateInvite} className="p-6 space-y-4">
                <div>
                  <p className="text-sm font-display font-bold text-[#0B192C]">
                    Kiracılık daveti oluştur
                  </p>
                  <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                    Bu adayı kiracı olarak eşleştirmek istediğiniz dairenin bilgilerini girin. Bu
                    bilgiler davet mesajında kiracıya gösterilecek.
                  </p>
                </div>
                {hasVacantProperties ? (
                  <div
                    className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 border border-slate-200/90 rounded-2xl"
                    role="tablist"
                    aria-label="Davet edilecek daire"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={inviteMode === 'existing'}
                      onClick={() => {
                        setInviteMode('existing');
                        setCandidateInviteError('');
                      }}
                      className={`min-h-[42px] px-2 py-2 rounded-xl text-xs font-semibold ${
                        inviteMode === 'existing'
                          ? 'bg-white text-[#0B192C] shadow-xs'
                          : 'text-slate-600'
                      }`}
                    >
                      Kayıtlı Daire Seç
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={inviteMode === 'new'}
                      onClick={() => {
                        setInviteMode('new');
                        setCandidateInviteError('');
                      }}
                      className={`min-h-[42px] px-2 py-2 rounded-xl text-xs font-semibold ${
                        inviteMode === 'new' ? 'bg-white text-[#0B192C] shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      + Yeni Daire Bilgisi Gir
                    </button>
                  </div>
                ) : null}

                {hasVacantProperties && inviteMode === 'existing' ? (
                    <div className="relative">
                      <label htmlFor="candidate-empty-property" className="sr-only">
                        Boş Mülk Seçin
                      </label>
                      <select
                        id="candidate-empty-property"
                        value={selectedEmptyPropId}
                        onChange={(e) => {
                          setSelectedEmptyPropId(e.target.value);
                          setCandidateInviteError('');
                        }}
                        className="w-full min-h-[46px] pl-3.5 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-[#0B192C] appearance-none cursor-pointer focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      >
                        {vacantProperties.map((prop) => (
                          <option key={prop.id} value={prop.id}>
                            {prop.nickname} ({prop.officialLocation})
                          </option>
                        ))}
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
                        value={newPropertyTitle}
                        onChange={(e) => setNewPropertyTitle(e.target.value)}
                        placeholder="Örn. Moda Sahil Dairesi 2+1"
                        className="w-full min-h-[46px] px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-[#0B192C] focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
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
                        value={newPropertyDistrict}
                        onChange={(e) => setNewPropertyDistrict(e.target.value)}
                        placeholder="Örn. Kadıköy / Caferağa Mah."
                        className="w-full min-h-[46px] px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-[#0B192C] focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                  </div>
                )}

                <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3 flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-bold text-[#0B192C]">Davet gönderildiğinde</p>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                      Kiracıya mülkünüzün bilgileriyle bir eşleşme daveti gönderilir. Kiracı daveti
                      kabul ettiğinde eşleşme tamamlanır ve dijital teslim tutanağı ile kira ödeme
                      kayıtları bu kiracılık için açılır.
                    </p>
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
                    disabled={inviteSending}
                    className="flex-1 min-h-[46px] px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70 text-white font-semibold text-sm rounded-xl transition-colors inline-flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>{inviteSending ? 'İletiliyor…' : 'Kiracılık Daveti Gönder'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInviteCandidateModalOpen(false)}
                    className="min-h-[46px] px-4 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl"
                  >
                    Vazgeç
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
