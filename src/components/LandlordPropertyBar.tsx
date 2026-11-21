import { useEffect, useRef, useState } from 'react';
import {
  Building2,
  Plus,
  X,
  ChevronDown,
  FileCheck2,
  Upload,
  KeyRound,
  CheckCircle2,
  Bell,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { ActivityEvent, LandlordProperty, TR_LOCATION_TREE } from '../types/kiracimkim';

export interface AddPropertyPayload {
  nickname: string;
  officialLocation: string;
  verificationMethod: 'document' | 'mutual_otp';
  verificationDocName?: string;
}

interface LandlordPropertyBarProps {
  properties: LandlordProperty[];
  selectedPropertyId: string; // 'all' | 'empty-demo' | property.id
  activities: ActivityEvent[];
  addModalOpen?: boolean;
  onAddModalOpenChange?: (open: boolean) => void;
  onSelectProperty: (id: string) => void;
  onAddProperty: (payload: AddPropertyPayload) => void;
  onActivityAction: (event: ActivityEvent) => void;
  onNotify: (message: string) => void;
}

const PROVINCES = Object.keys(TR_LOCATION_TREE);

export function LandlordPropertyBar({
  properties,
  selectedPropertyId,
  activities,
  addModalOpen,
  onAddModalOpenChange,
  onSelectProperty,
  onAddProperty,
  onActivityAction,
  onNotify,
}: LandlordPropertyBarProps) {
  const [internalModalOpen, setInternalModalOpen] = useState(false);
  const modalOpen = addModalOpen ?? internalModalOpen;
  const setModalOpen = (open: boolean) => {
    setInternalModalOpen(open);
    onAddModalOpenChange?.(open);
  };

  const [activityMenuOpen, setActivityMenuOpen] = useState(false);
  const activityPopoverRef = useRef<HTMLDivElement | null>(null);
  const [nickname, setNickname] = useState('');

  const defaultProvince = PROVINCES[0];
  const defaultDistrict =
    Object.keys(TR_LOCATION_TREE[defaultProvince])[1] ??
    Object.keys(TR_LOCATION_TREE[defaultProvince])[0];
  const defaultNeighborhood = TR_LOCATION_TREE[defaultProvince][defaultDistrict][0];

  const [province, setProvince] = useState(defaultProvince);
  const [district, setDistrict] = useState(defaultDistrict);
  const [neighborhood, setNeighborhood] = useState(defaultNeighborhood);

  const [verificationMethod, setVerificationMethod] = useState<'document' | 'mutual_otp'>('document');
  const [verificationDocName, setVerificationDocName] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (modalOpen) setFormError('');
  }, [modalOpen]);

  const visibleActivities =
    selectedPropertyId === 'all'
      ? activities
      : selectedPropertyId === 'empty-demo'
      ? []
      : activities.filter((act) => act.propertyId === selectedPropertyId);

  useEffect(() => {
    if (!activityMenuOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActivityMenuOpen(false);
      }
    };

    const handlePointerDown = (e: MouseEvent) => {
      if (
        activityPopoverRef.current &&
        !activityPopoverRef.current.contains(e.target as Node)
      ) {
        setActivityMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [activityMenuOpen]);

  const districtsForProvince = Object.keys(TR_LOCATION_TREE[province] ?? {});
  const neighborhoodsForDistrict = TR_LOCATION_TREE[province]?.[district] ?? [];

  const handleProvinceChange = (nextProvince: string) => {
    setProvince(nextProvince);
    const nextDistricts = Object.keys(TR_LOCATION_TREE[nextProvince] ?? {});
    const firstDistrict = nextDistricts[0] ?? '';
    setDistrict(firstDistrict);
    const firstNeighborhood = TR_LOCATION_TREE[nextProvince]?.[firstDistrict]?.[0] ?? '';
    setNeighborhood(firstNeighborhood);
  };

  const handleDistrictChange = (nextDistrict: string) => {
    setDistrict(nextDistrict);
    const firstNeighborhood = TR_LOCATION_TREE[province]?.[nextDistrict]?.[0] ?? '';
    setNeighborhood(firstNeighborhood);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVerificationDocName(file.name);
      setFormError('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!nickname.trim()) {
      setFormError('Lütfen daire adını (takma adını) girin.');
      return;
    }
    if (!province || !district || !neighborhood) {
      setFormError('Lütfen İl, İlçe ve Mahalle seçimini tamamlayın.');
      return;
    }
    if (verificationMethod === 'document' && !verificationDocName.trim()) {
      setFormError(
        'Hızlı doğrulama için Tapu, DASK veya abonelik faturası yükleyin ya da karşılıklı OTP onayını seçin.'
      );
      return;
    }
    setFormError('');
    const officialLocation = `${district} / ${neighborhood}`;

    onAddProperty({
      nickname: nickname.trim(),
      officialLocation,
      verificationMethod,
      verificationDocName:
        verificationMethod === 'document' ? verificationDocName.trim() : undefined,
    });

    setNickname('');
    setVerificationDocName('');
    setVerificationMethod('document');
    setModalOpen(false);
  };

  return (
    <>
      <div className="bg-white border-b border-slate-200/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-2.5">
          {/* Property / Tenant Selector */}
          <div className="relative flex-1 min-w-0">
            <Building2
              className="w-4 h-4 text-emerald-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <select
              id="landlord-property-selector"
              aria-label="Daire veya kiracı filtresi"
              value={selectedPropertyId}
              onChange={(e) => {
                const nextVal = e.target.value;
                onSelectProperty(nextVal);
                if (nextVal === 'empty-demo') {
                  onNotify('Boş hesap görünümü (0 Daire) test moduna geçildi.');
                  return;
                }
                const found = properties.find((p) => p.id === nextVal);
                onNotify(
                  found
                    ? `${found.nickname} (${found.officialLocation}) seçildi.`
                    : `Tüm Daireler / Kiracılar (${properties.length}) görüntüleniyor.`
                );
              }}
              className="w-full min-h-[44px] pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-[#0B192C] appearance-none cursor-pointer focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 truncate"
            >
              <option value="all">Tüm Daireler / Kiracılar ({properties.length})</option>
              {properties.map((prop) => {
                const tenantText = prop.tenantName
                  ? `Kiracı: ${prop.tenantName}${
                      prop.tenantTransparencyPledged === true
                        ? ' • Şeffaflık Taahhüdü Onaylandı'
                        : prop.tenantTransparencyPledged === false
                          ? ' • Taahhüt Onaylanmadan Devam Edildi'
                          : ''
                    }`
                  : prop.pendingInvite
                  ? `Kiracı Onayı Bekleniyor (${prop.pendingInvite.maskedPhone})`
                  : prop.verificationStatus === 'verified'
                  ? 'Kiracı Adayı Bekliyor'
                  : 'Taslak · Doğrulama Bekliyor';
                return (
                  <option key={prop.id} value={prop.id}>
                    {prop.nickname} ({prop.officialLocation}) • {tenantText}
                  </option>
                );
              })}
              <option value="empty-demo">Boş Hesap Görünümü (0 Daire)</option>
            </select>
            <ChevronDown
              className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
          </div>

          {/* Right Actions: + Yeni Mülk Ekle & Compact Bell (N) */}
          <div className="flex items-center gap-2 shrink-0" ref={activityPopoverRef}>
            <button
              type="button"
              onClick={() => {
                setFormError('');
                setActivityMenuOpen(false);
                setModalOpen(true);
              }}
              className="min-h-[44px] px-3.5 sm:px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-600"
            >
              <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Yeni Mülk Ekle</span>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setActivityMenuOpen((prev) => !prev)}
                aria-expanded={activityMenuOpen}
                aria-haspopup="true"
                aria-label={`Son Hareketler (${visibleActivities.length})`}
                title={`Son Hareketler (${visibleActivities.length})`}
                className={`min-h-[44px] px-3 py-2 border text-xs sm:text-sm font-semibold rounded-xl transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-600 ${
                  activityMenuOpen
                    ? 'bg-[#0B192C] border-[#0B192C] text-white'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-[#0B192C]'
                }`}
              >
                <Bell
                  className={`w-4 h-4 shrink-0 ${
                    activityMenuOpen ? 'text-emerald-400' : 'text-emerald-600'
                  }`}
                  aria-hidden="true"
                />
                <span className="font-mono-tabular">{visibleActivities.length}</span>
              </button>

              {activityMenuOpen && (
                <div
                  role="region"
                  aria-label="Son Hareketler"
                  className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-[430px] max-w-[430px] bg-white border border-slate-200 rounded-2xl shadow-xl z-40 overflow-hidden"
                >
                  <div className="bg-[#0B192C] text-white px-4 py-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
                      <span className="text-xs sm:text-sm font-display font-bold">
                        Son Hareketler
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono-tabular text-slate-300">
                        {visibleActivities.length} Kayıt
                      </span>
                      <button
                        type="button"
                        onClick={() => setActivityMenuOpen(false)}
                        aria-label="Son hareketler menüsünü kapat"
                        className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-slate-300 hover:text-white"
                      >
                        <X className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {visibleActivities.length === 0 ? (
                    <div className="p-5 text-xs text-slate-500 text-center">
                      Seçili mülk için henüz zaman damgalı hareket kaydı bulunmuyor.
                    </div>
                  ) : (
                    <ul className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                      {visibleActivities.map((act) => (
                        <li
                          key={act.id}
                          className="p-4 hover:bg-slate-50/70 transition-colors space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs text-slate-700 leading-relaxed">
                              <span className="font-mono-tabular font-semibold text-emerald-700">
                                {act.timestamp}
                              </span>{' '}
                              <span className="text-slate-400" aria-hidden="true">
                                •
                              </span>{' '}
                              <strong className="font-semibold text-[#0B192C]">
                                {act.actorName}
                              </strong>{' '}
                              <span className="text-slate-500">({act.propertyNickname})</span>{' '}
                              {act.description}
                            </p>
                          </div>

                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                setActivityMenuOpen(false);
                                onActivityAction(act);
                              }}
                              className="min-h-[34px] px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1"
                            >
                              <span>{act.actionLabel}</span>
                              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Yeni Mülk Ekle modalı */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#0B192C]/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Yeni Mülk Ekle"
        >
          <div className="w-full max-w-lg max-h-[92vh] bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-2xl my-auto flex flex-col">
            <div className="bg-[#0B192C] text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div>
                <p className="text-xs text-emerald-400 font-medium">Daire Kaydı</p>
                <h3 className="text-base sm:text-lg font-display font-bold mt-0.5">
                  Yeni Mülk Ekle
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Kapat"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-white/10"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
                  {/* Field 1: Private Landlord Nickname */}
                  <div>
                    <label
                      htmlFor="prop-nickname"
                      className="block text-xs font-semibold text-[#0B192C] mb-1.5"
                    >
                      Daire Adı (Sadece sizin panelinizde görünür)
                    </label>
                    <input
                      id="prop-nickname"
                      type="text"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder="Örn: Köşebaşı Daire 2+1"
                      className="w-full min-h-[46px] px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-[#0B192C] placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>

                  {/* Field 2: Official Cascading Dropdowns (İl / İlçe / Mahalle) */}
                  <div>
                    <span className="block text-xs font-semibold text-[#0B192C] mb-1.5">
                      Resmi İl / İlçe / Mahalle (Kiracı karnesinde ve kayıtlarda görünür)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {/* İl */}
                      <div className="relative">
                        <label htmlFor="prop-province" className="sr-only">
                          İl
                        </label>
                        <select
                          id="prop-province"
                          value={province}
                          onChange={(e) => handleProvinceChange(e.target.value)}
                          className="w-full min-h-[46px] pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-[#0B192C] appearance-none cursor-pointer focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                        >
                          {PROVINCES.map((prov) => (
                            <option key={prov} value={prov}>
                              {prov}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                          aria-hidden="true"
                        />
                      </div>

                      {/* İlçe */}
                      <div className="relative">
                        <label htmlFor="prop-district" className="sr-only">
                          İlçe
                        </label>
                        <select
                          id="prop-district"
                          value={district}
                          onChange={(e) => handleDistrictChange(e.target.value)}
                          className="w-full min-h-[46px] pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-[#0B192C] appearance-none cursor-pointer focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                        >
                          {districtsForProvince.map((dist) => (
                            <option key={dist} value={dist}>
                              {dist}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                          aria-hidden="true"
                        />
                      </div>

                      {/* Mahalle */}
                      <div className="relative">
                        <label htmlFor="prop-neighborhood" className="sr-only">
                          Mahalle
                        </label>
                        <select
                          id="prop-neighborhood"
                          value={neighborhood}
                          onChange={(e) => setNeighborhood(e.target.value)}
                          className="w-full min-h-[46px] pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-[#0B192C] appearance-none cursor-pointer focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                        >
                          {neighborhoodsForDistrict.map((neigh) => (
                            <option key={neigh} value={neigh}>
                              {neigh}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Field 3: Ownership / Authority Verification */}
                  <div>
                    <span className="block text-xs font-semibold text-[#0B192C] mb-2">
                      Mülkiyet / Yetki Doğrulama
                    </span>

                    <div className="space-y-2.5">
                      {/* Option 1: Document Upload */}
                      <div
                        className={`rounded-2xl border p-3.5 transition-colors ${
                          verificationMethod === 'document'
                            ? 'border-emerald-600 bg-emerald-50/40'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="radio"
                            name="verificationMethod"
                            checked={verificationMethod === 'document'}
                            onChange={() => {
                              setVerificationMethod('document');
                              setFormError('');
                            }}
                            className="mt-0.5 accent-emerald-600 w-4 h-4 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-xs sm:text-sm font-semibold text-[#0B192C] flex items-center gap-1.5">
                              <FileCheck2
                                className="w-4 h-4 text-emerald-600 shrink-0"
                                aria-hidden="true"
                              />
                              <span>Tapu / DASK / Abonelik Faturası Yükle (Hızlı Doğrulama)</span>
                            </span>
                          </div>
                        </label>

                        {verificationMethod === 'document' && (
                          <div className="mt-3 pl-6 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <label className="min-h-[40px] px-3.5 py-2 bg-white border border-slate-200 hover:border-emerald-600 rounded-xl text-xs font-semibold text-[#0B192C] cursor-pointer inline-flex items-center gap-1.5 transition-colors">
                                <Upload
                                  className="w-3.5 h-3.5 text-emerald-600"
                                  aria-hidden="true"
                                />
                                <span>Belge Seç (PDF / Görsel)</span>
                                <input
                                  type="file"
                                  accept=".pdf,image/*"
                                  onChange={handleFileChange}
                                  className="sr-only"
                                />
                              </label>

                              <button
                                type="button"
                                onClick={() => {
                                  setVerificationDocName('tapu_dask_dogrulama.pdf');
                                  setFormError('');
                                }}
                                className="min-h-[40px] px-3 py-2 text-xs font-medium text-emerald-700 hover:text-emerald-800 underline underline-offset-2"
                              >
                                Örnek Tapu/DASK Ekle
                              </button>
                            </div>

                            {verificationDocName && (
                              <p className="text-xs text-emerald-700 font-mono-tabular flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                <span className="truncate">{verificationDocName}</span>
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Option 2: Mutual OTP Verification */}
                      <div
                        className={`rounded-2xl border p-3.5 transition-colors ${
                          verificationMethod === 'mutual_otp'
                            ? 'border-emerald-600 bg-emerald-50/40'
                            : 'border-slate-200 bg-white'
                        }`}
                      >
                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="radio"
                            name="verificationMethod"
                            checked={verificationMethod === 'mutual_otp'}
                            onChange={() => {
                              setVerificationMethod('mutual_otp');
                              setFormError('');
                            }}
                            className="mt-0.5 accent-emerald-600 w-4 h-4 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-xs sm:text-sm font-semibold text-[#0B192C] flex items-center gap-1.5">
                              <KeyRound
                                className="w-4 h-4 text-[#0B192C] shrink-0"
                                aria-hidden="true"
                              />
                              <span>
                                Kiracı Karşılıklı OTP Onayı ile Doğrula (Kiracı daveti kabul
                                ettiğinde aktifleşir)
                              </span>
                            </span>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>


              {formError && (
                <p
                  role="alert"
                  className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5"
                >
                  {formError}
                </p>
              )}

              <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                <button
                  type="submit"
                  className="flex-1 min-h-[46px] px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl transition-colors"
                >
                  Yeni Daireyi Oluştur
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="min-h-[46px] px-4 border border-slate-200 text-slate-600 font-medium text-sm rounded-xl"
                >
                  Vazgeç
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
