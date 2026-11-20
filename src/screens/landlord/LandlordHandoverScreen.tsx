import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Clock,
  KeyRound,
  MessageSquareWarning,
  X,
  ZoomIn,
  Key,
  FileCheck2,
  ArrowLeft,
  ArrowRight,
  Building2,
  Bell,
  Trash2,
  FileSignature,
} from 'lucide-react';
import { ResilientImage } from '../../components/ResilientImage';
import { WriteTenantReferenceModal } from '../../components/WriteTenantReferenceModal';
import { HandoverPhoto, LandlordProperty, LandlordReference } from '../../types/kiracimkim';

const OBJECTION_TEMPLATES = [
  'Sayaç endeks fotoğrafları eksik veya okunmuyor',
  'Oda fotoğrafları yeterince net değil',
  'Dairedeki mevcut bir kusur eksik girilmiş',
  'Anahtar adedi uyuşmuyor',
] as const;

interface LandlordHandoverScreenProps {
  properties: LandlordProperty[];
  selectedPropertyId: string;
  currentLandlordName: string;
  onSelectProperty?: (id: string) => void;
  onRemindInvite: (propertyId: string) => void;
  onCancelInvite: (propertyId: string) => void;
  onDeleteProperty: (propertyId: string) => void;
  onApproveProtocol: (propertyId: string) => void;
  onObjectProtocol: (propertyId: string, note: string) => void;
  onSignReference: (propertyId: string, next: LandlordReference) => void;
  onOpenPayments: (propertyId: string) => void;
  onNotify: (message: string) => void;
}

function TenantReferenceButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-[42px] px-4 py-2 bg-white border border-emerald-300 hover:bg-emerald-50 text-emerald-800 text-xs sm:text-sm font-semibold rounded-xl transition-colors inline-flex items-center gap-2 whitespace-nowrap"
    >
      <FileSignature className="w-4 h-4 shrink-0" aria-hidden="true" />
      <span>Kiracıma Referans Yaz</span>
    </button>
  );
}

export function LandlordHandoverScreen({
  properties,
  selectedPropertyId,
  currentLandlordName,
  onSelectProperty,
  onRemindInvite,
  onCancelInvite,
  onDeleteProperty,
  onApproveProtocol,
  onObjectProtocol,
  onSignReference,
  onOpenPayments,
  onNotify,
}: LandlordHandoverScreenProps) {
  const [detailPropertyId, setDetailPropertyId] = useState<string | null>(null);
  const [objectionOpen, setObjectionOpen] = useState(false);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [objectionText, setObjectionText] = useState('');
  const [objectionError, setObjectionError] = useState('');
  const [deleteTargetProp, setDeleteTargetProp] = useState<LandlordProperty | null>(null);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpInput, setOtpInput] = useState('614920');
  const [lightboxPhoto, setLightboxPhoto] = useState<HandoverPhoto | null>(null);
  const [referencePropertyId, setReferencePropertyId] = useState<string | null>(null);
  const prevSelectedPropertyIdRef = useRef(selectedPropertyId);

  useEffect(() => {
    if (prevSelectedPropertyIdRef.current !== selectedPropertyId) {
      prevSelectedPropertyIdRef.current = selectedPropertyId;
      if (detailPropertyId) {
        if (selectedPropertyId === 'all') {
          setDetailPropertyId(null);
          setObjectionOpen(false);
        } else if (selectedPropertyId !== 'empty-demo') {
          setDetailPropertyId(selectedPropertyId);
          setObjectionOpen(false);
          setSelectedTemplates([]);
          setObjectionText('');
          setObjectionError('');
        }
      }
    }
  }, [selectedPropertyId, detailPropertyId]);

  const sealedProperties = properties.filter(
    (p) => Boolean(p.tenantName) && p.checklist.landlordStatus === 'approved'
  );
  const visibleSealedProperties =
    selectedPropertyId === 'all'
      ? sealedProperties
      : sealedProperties.filter((p) => p.id === selectedPropertyId);
  const referenceProperty = referencePropertyId
    ? properties.find((p) => p.id === referencePropertyId && p.tenantName) ?? null
    : null;

  const visibleListProperties =
    selectedPropertyId === 'all'
      ? properties
      : properties.filter((p) => p.id === selectedPropertyId);

  const actionableListProperties = visibleListProperties.filter(
    (p) => !(Boolean(p.tenantName) && p.checklist.landlordStatus === 'approved')
  );

  const activeProperty = detailPropertyId
    ? properties.find((p) => p.id === detailPropertyId) ?? null
    : null;

  const handleOpenDetail = (propId: string) => {
    setDetailPropertyId(propId);
    onSelectProperty?.(propId);
    setObjectionOpen(false);
    setSelectedTemplates([]);
    setObjectionText('');
    setObjectionError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToList = () => {
    setDetailPropertyId(null);
    setObjectionOpen(false);
    onSelectProperty?.('all');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleConfirmOtpSeal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProperty) return;
    if (otpInput.trim().length < 6) {
      onNotify('Lütfen 6 haneli SMS (OTP) onay kodunu eksiksiz girin.');
      return;
    }
    onApproveProtocol(activeProperty.id);
    setOtpModalOpen(false);
  };

  const handleOpenObjectionModal = () => {
    setSelectedTemplates([]);
    setObjectionText('');
    setObjectionError('');
    setObjectionOpen(true);
  };

  const toggleObjectionTemplate = (template: string) => {
    setObjectionError('');
    setSelectedTemplates((prev) =>
      prev.includes(template) ? prev.filter((item) => item !== template) : [...prev, template]
    );
  };

  const handleObjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProperty) return;
    const trimmedNote = objectionText.trim();
    const combinedNote = [...selectedTemplates, trimmedNote].filter(Boolean).join(' · ');
    if (!combinedNote) {
      setObjectionError('Lütfen en az bir geri bildirim şablonu seçin veya açıklama yazın.');
      return;
    }
    onObjectProtocol(activeProperty.id, combinedNote);
    setSelectedTemplates([]);
    setObjectionText('');
    setObjectionError('');
    setObjectionOpen(false);
  };

  const handleConfirmDelete = () => {
    if (!deleteTargetProp) return;
    if (deleteTargetProp.pendingInvite) {
      onCancelInvite(deleteTargetProp.id);
    } else {
      onDeleteProperty(deleteTargetProp.id);
    }
    setDeleteTargetProp(null);
  };

  // AŞAMA 1: ANA EKRAN (GELEN KUTUSU & MÜLK LİSTESİ)
  if (!activeProperty) {
    const pendingCount = actionableListProperties.filter(
      (p) => p.tenantName && p.tenantSubmitted && p.checklist.landlordStatus === 'pending'
    ).length;

    return (
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="bg-white border border-slate-200/90 rounded-2xl lg:rounded-3xl overflow-hidden shadow-sm">
          {/* Inbox Header */}
          <div className="px-6 py-5 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-display font-bold text-[#0B192C] tracking-tight">
                Onay Bekleyen İşlemler ve Mülk Durumları
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-500">
                Mülklerinize ait teslim tutanaklarını inceleyip onaylayın.
              </p>
            </div>
            <span className="px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-mono-tabular font-semibold text-[#0B192C] whitespace-nowrap self-start sm:self-auto">
              {pendingCount > 0 ? `${pendingCount} Onay Bekliyor` : 'Tüm Tutanaklar Güncel'}
            </span>
          </div>

          {/* Property Inbox List (Only actionable / pending / unassigned properties) */}
          <div className="divide-y divide-slate-100">
            {actionableListProperties.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <p className="text-sm font-semibold text-[#0B192C]">
                  {selectedPropertyId !== 'all' &&
                  sealedProperties.some((p) => p.id === selectedPropertyId)
                    ? 'Seçili mülkün teslim tutanağı karşılıklı mühürlenmiştir.'
                    : 'Şu anda onay veya davet bekleyen bir mülk kaydı bulunmuyor.'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Tamamlanan tutanakları aşağıdaki mühürlenmiş raporlar bağlantısından
                  görüntüleyebilirsiniz.
                </p>
              </div>
            ) : (
              actionableListProperties.map((prop) => {
                const hasTenant = Boolean(prop.tenantName);
                const pendingInvite = prop.pendingInvite;
                const isApproved = prop.checklist.landlordStatus === 'approved';
                const isObjected = prop.checklist.landlordStatus === 'objected';

              let statusText = '';
              let statusColor = '';
              if (!hasTenant && pendingInvite) {
                statusText = `Kiracı Onayı Bekleniyor (${pendingInvite.maskedPhone})`;
                statusColor = 'text-amber-700';
              } else if (!hasTenant) {
                statusText = 'Henüz Kiracı Bağlı Değil';
                statusColor = 'text-slate-500';
              } else if (isApproved) {
                statusText = 'Teslim Tutanağı Karşılıklı Mühürlendi';
                statusColor = 'text-emerald-700';
              } else if (isObjected) {
                statusText = 'Düzeltme / İtiraz Bildirildi';
                statusColor = 'text-amber-700';
              } else if (!prop.tenantSubmitted) {
                statusText = 'Kiracının teslim tutanağını doldurup göndermesi bekleniyor';
                statusColor = 'text-amber-700';
              } else {
                statusText = 'Eve Giriş Teslim Kaydı Onay Bekliyor';
                statusColor = 'text-amber-700';
              }

              return (
                <div
                  key={prop.id}
                  className="px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        !hasTenant && pendingInvite
                          ? 'bg-amber-50 text-amber-700'
                          : !hasTenant
                          ? 'bg-slate-100 text-slate-500'
                          : isApproved
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {!hasTenant && !pendingInvite ? (
                        <Building2 className="w-5 h-5" aria-hidden="true" />
                      ) : hasTenant && isApproved ? (
                        <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                      ) : (
                        <Clock className="w-5 h-5" aria-hidden="true" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <h2 className="text-sm sm:text-base font-bold text-[#0B192C]">
                        {prop.nickname} ({prop.officialLocation})
                        {prop.tenantName && (
                          <>
                            {' '}
                            <span className="text-slate-400 font-normal">•</span>{' '}
                            <span className="font-semibold text-slate-700">
                              Kiracı: {prop.tenantName}
                            </span>
                          </>
                        )}
                      </h2>
                      <p className={`mt-1 text-xs sm:text-sm font-medium ${statusColor}`}>
                        {statusText}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 pl-13 md:pl-0 flex flex-wrap items-center gap-2">
                    {hasTenant && (
                      <TenantReferenceButton onClick={() => setReferencePropertyId(prop.id)} />
                    )}
                    {!hasTenant && pendingInvite ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onRemindInvite(prop.id)}
                          className="min-h-[42px] px-4 py-2 bg-amber-50 border border-amber-300 hover:bg-amber-100 text-amber-900 text-xs sm:text-sm font-semibold rounded-xl transition-colors inline-flex items-center gap-2 whitespace-nowrap"
                        >
                          <Bell className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
                          <span>Davet Bekleniyor • Hatırlat</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTargetProp(prop)}
                          aria-label={`${prop.nickname} davetini iptal et`}
                          title="Daveti İptal Et"
                          className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </>
                    ) : !hasTenant ? (
                      <>
                        <span className="inline-flex items-center px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-medium text-slate-500 whitespace-nowrap">
                          Kiracı Bağlı Değil
                        </span>
                        <button
                          type="button"
                          onClick={() => setDeleteTargetProp(prop)}
                          aria-label={`${prop.nickname} kaydını sil`}
                          title="Mülk Kaydını Sil"
                          className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </>
                    ) : isApproved ? (
                      <button
                        type="button"
                        onClick={() => handleOpenDetail(prop.id)}
                        className="min-h-[42px] px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-[#0B192C] text-xs sm:text-sm font-semibold rounded-xl transition-colors inline-flex items-center gap-2 whitespace-nowrap"
                      >
                        <span>Raporu Görüntüle</span>
                      </button>
                    ) : !prop.tenantSubmitted ? (
                      <span className="inline-flex items-center min-h-[42px] px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-xs sm:text-sm font-semibold text-amber-900 whitespace-nowrap">
                        ⏳ Kiracının teslim tutanağını doldurup göndermesi bekleniyor
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenDetail(prop.id)}
                        className="min-h-[42px] px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors inline-flex items-center gap-2 whitespace-nowrap"
                      >
                        <span>Kiracı Tutanağını Görüntüle ve Onayla →</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
            )}
          </div>

          {visibleSealedProperties.length > 0 && (
            <div className="bg-slate-50/70 border-t border-slate-200/80 divide-y divide-slate-200/80">
              {visibleSealedProperties.map((prop) => (
                <div
                  key={prop.id}
                  className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <h2 className="text-sm sm:text-base font-bold text-[#0B192C]">
                      {prop.nickname} ({prop.officialLocation}){' '}
                      <span className="text-slate-400 font-normal">•</span>{' '}
                      <span className="font-semibold text-slate-700">Kiracı: {prop.tenantName}</span>
                    </h2>
                    <p className="mt-1 text-xs sm:text-sm font-medium text-emerald-700">
                      Teslim Tutanağı Karşılıklı Mühürlendi
                    </p>
                  </div>
                  <div className="shrink-0 flex flex-wrap items-center gap-2">
                    <TenantReferenceButton onClick={() => setReferencePropertyId(prop.id)} />
                    <button
                      type="button"
                      onClick={() => handleOpenDetail(prop.id)}
                      className="min-h-[42px] px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-[#0B192C] text-xs sm:text-sm font-semibold rounded-xl transition-colors inline-flex items-center gap-2 whitespace-nowrap"
                    >
                      <span>Raporu Görüntüle</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Delete / Cancel Confirmation Modal */}
        {deleteTargetProp && (
          <div
            className="fixed inset-0 z-50 bg-[#0B192C]/80 backdrop-blur-sm flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Kayıt veya davet silme onayı"
          >
            <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200">
              <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                    <Trash2 className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      {deleteTargetProp.nickname}
                    </p>
                    <h3 className="text-sm sm:text-base font-display font-bold text-[#0B192C] mt-0.5">
                      Bu kaydı/daveti silmek istediğinize emin misiniz?
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteTargetProp(null)}
                  aria-label="Kapat"
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl text-slate-400 hover:text-[#0B192C] hover:bg-slate-100"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {deleteTargetProp.pendingInvite
                    ? `${deleteTargetProp.pendingInvite.maskedPhone} numaralı kiracıya gönderilen bekleyen davet iptal edilecektir.`
                    : `${deleteTargetProp.officialLocation} konumundaki henüz kiracı bağlı olmayan mülk kaydı kaldırılacaktır.`}
                </p>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setDeleteTargetProp(null)}
                    className="flex-1 min-h-[44px] px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl transition-colors"
                  >
                    Vazgeç
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    className="flex-1 min-h-[44px] px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors"
                  >
                    {deleteTargetProp.pendingInvite ? 'Daveti İptal Et' : 'Kaydı Sil'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <WriteTenantReferenceModal
          property={referenceProperty}
          currentLandlordName={currentLandlordName}
          onClose={() => setReferencePropertyId(null)}
          onSignReference={onSignReference}
          onNotify={onNotify}
        />
      </section>
    );
  }

  // AŞAMA 2: RAPOR DETAY EKRANI (A4 Görünümünde Teslim Tutanağı Raporu)
  const { photos, checklist } = activeProperty;

  const handoverDateLabel =
    checklist.sealedAt?.split(' · ')[0] ||
    photos[0]?.capturedAt?.split(' · ')[0] ||
    activeProperty.contractStartDate ||
    'Teslim Bekleniyor';

  const statusBadge =
    checklist.landlordStatus === 'approved'
      ? {
          label: 'SMS (OTP) ile Mühürlü',
          classes: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
        }
      : checklist.landlordStatus === 'objected'
      ? {
          label: 'Düzeltme / İtiraz Bildirildi',
          classes: 'bg-amber-500/20 text-amber-200 border-amber-400/30',
        }
      : {
          label: 'Ev Sahibi Onayı Bekliyor',
          classes: 'bg-amber-500/20 text-amber-200 border-amber-400/30',
        };

  return (
    <section className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Top-Left Back Button */}
      <div className="mb-4">
        <button
          type="button"
          onClick={handleBackToList}
          className="min-h-[42px] px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-[#0B192C] text-xs sm:text-sm font-semibold rounded-xl transition-colors inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Mülk Listesine Dön</span>
        </button>
      </div>

      {/* Unified A4-Style Document Card: Teslim Tutanağı Raporu */}
      <article className="bg-white border border-slate-200/90 rounded-2xl lg:rounded-3xl overflow-hidden shadow-sm">
        {/* Rapor Başlığı */}
        <header className="bg-[#0B192C] text-white px-6 sm:px-8 py-6 border-b border-white/10">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-emerald-400">
                <FileCheck2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Teslim Tutanağı Raporu</span>
              </div>
              <h1 className="mt-1.5 text-xl sm:text-2xl font-display font-bold text-white tracking-tight">
                {activeProperty.nickname} ({activeProperty.officialLocation})
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start shrink-0">
              {activeProperty.tenantName && (
                <button
                  type="button"
                  onClick={() => setReferencePropertyId(activeProperty.id)}
                  className="min-h-[36px] px-3 py-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/15 text-emerald-200 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap hover:bg-emerald-500/25"
                >
                  <FileSignature className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Kiracıma Referans Yaz</span>
                </button>
              )}
              <span
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap ${statusBadge.classes}`}
              >
                {statusBadge.label}
              </span>
            </div>
          </div>

          <dl className="mt-5 pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <dt className="text-slate-400">Kiracı</dt>
              <dd className="mt-0.5 font-semibold text-white">
                {activeProperty.tenantName ??
                  (activeProperty.pendingInvite
                    ? `Kiracı Onayı Bekleniyor (${activeProperty.pendingInvite.maskedPhone})`
                    : 'Kiracı Daveti Bekleniyor')}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Teslim Tarihi</dt>
              <dd className="mt-0.5 font-mono-tabular font-semibold text-white">
                {handoverDateLabel}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Mülkiyet Durumu</dt>
              <dd className="mt-0.5 font-semibold text-emerald-300">
                {activeProperty.verificationStatus === 'verified'
                  ? 'Mülkiyet Doğrulandı'
                  : 'Taslak · OTP Bekliyor'}
              </dd>
            </div>
          </dl>
        </header>

        <div className="p-6 sm:p-8 space-y-8">
          {/* Bölüm 1: Oda Tespitleri */}
          <section aria-labelledby="section-room-inspections">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <h2
                id="section-room-inspections"
                className="text-base sm:text-lg font-display font-bold text-[#0B192C]"
              >
                Bölüm 1 · Oda Tespitleri ({photos.length})
              </h2>
              <span className="text-xs font-mono-tabular text-slate-500">
                {photos.filter((p) => p.condition === 'kusurlu').length} Kusur Bildirimi
              </span>
            </div>

            {photos.length === 0 ? (
              <div className="mt-4 bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-8 text-center">
                <p className="text-sm font-semibold text-[#0B192C]">
                  Bu mülk için henüz oda tespit fotoğrafı yüklenmemiş
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Kiracı teslim fotoğraflarını eklediğinde tüm oda tespitleri burada listelenir.
                </p>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="border border-slate-200/90 rounded-2xl overflow-hidden flex flex-col bg-white"
                  >
                    <button
                      type="button"
                      onClick={() => setLightboxPhoto(photo)}
                      className="group relative aspect-[4/3] bg-slate-100 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                      aria-label={`${photo.roomLabel} fotoğrafını büyüt`}
                    >
                      <ResilientImage
                        src={photo.imageUrl}
                        alt={`${photo.roomLabel} teslim fotoğrafı`}
                        fallbackLabel={photo.roomLabel}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                      <div
                        className="absolute inset-0 bg-gradient-to-t from-[#0B192C]/85 via-transparent to-transparent"
                        aria-hidden="true"
                      />
                      <span className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-[#0B192C]/70 text-white flex items-center justify-center opacity-90 group-hover:opacity-100">
                        <ZoomIn className="w-4 h-4" aria-hidden="true" />
                      </span>
                      <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between gap-2 text-[11px] text-white font-mono-tabular">
                        <span className="inline-flex items-center gap-1 truncate">
                          <Clock className="w-3 h-3 text-emerald-400 shrink-0" aria-hidden="true" />
                          {photo.capturedAt}
                        </span>
                        <span className="text-emerald-300 shrink-0">{photo.hash}</span>
                      </div>
                    </button>

                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-[#0B192C]">
                            {photo.roomLabel}
                          </span>
                          <span
                            className={`text-xs font-semibold inline-flex items-center gap-1 ${
                              photo.condition === 'hasarsiz'
                                ? 'text-emerald-700'
                                : 'text-amber-700'
                            }`}
                          >
                            {photo.condition === 'hasarsiz' ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Hasarsız</span>
                              </>
                            ) : (
                              <>
                                <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Mevcut Kusur</span>
                              </>
                            )}
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                          {photo.note}
                        </p>

                        {photo.closeUpImageUrl && (
                          <div className="mt-2.5 flex items-center gap-2.5 bg-amber-50/70 border border-amber-200 rounded-xl p-2">
                            <img
                              src={photo.closeUpImageUrl}
                              alt="Yakın plan hasar fotoğrafı"
                              className="w-11 h-10 object-cover rounded-lg shrink-0"
                            />
                            <span className="text-[11px] font-medium text-amber-950">
                              Yakın Plan Hasar Kanıtı
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Bölüm 2: Sayaçlar ve Anahtar (Tek Satırlık Özet Tablosu) */}
          <section aria-labelledby="section-meters-keys">
            <div className="pb-3 border-b border-slate-100">
              <h2
                id="section-meters-keys"
                className="text-base sm:text-lg font-display font-bold text-[#0B192C]"
              >
                Bölüm 2 · Sayaçlar ve Anahtar
              </h2>
            </div>

            <div className="mt-4 overflow-x-auto border border-slate-200/90 rounded-2xl">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-semibold">
                    <th className="py-3 px-4">Elektrik Sayacı</th>
                    <th className="py-3 px-4">Su Sayacı</th>
                    <th className="py-3 px-4">Doğalgaz Sayacı</th>
                    <th className="py-3 px-4">Anahtar Adedi</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-white">
                    <td className="py-3.5 px-4 font-mono-tabular font-bold text-[#0B192C]">
                      {checklist.electricMeterNo || '—'}
                      {checklist.electricMeterPhoto ? (
                        <img
                          src={checklist.electricMeterPhoto}
                          alt="Elektrik sayacı"
                          className="mt-2 h-16 w-24 object-cover rounded-lg"
                        />
                      ) : (
                        <span className="block text-[11px] font-sans font-normal text-slate-500 mt-0.5">
                          Fotoğraf bekleniyor
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono-tabular font-bold text-[#0B192C]">
                      {checklist.waterMeterNo || '—'}
                      {checklist.waterMeterPhoto ? (
                        <img
                          src={checklist.waterMeterPhoto}
                          alt="Su sayacı"
                          className="mt-2 h-16 w-24 object-cover rounded-lg"
                        />
                      ) : (
                        <span className="block text-[11px] font-sans font-normal text-slate-500 mt-0.5">
                          Fotoğraf bekleniyor
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono-tabular font-bold text-[#0B192C]">
                      {checklist.gasMeterNo || '—'}
                      {checklist.gasMeterPhoto ? (
                        <img
                          src={checklist.gasMeterPhoto}
                          alt="Doğalgaz sayacı"
                          className="mt-2 h-16 w-24 object-cover rounded-lg"
                        />
                      ) : (
                        <span className="block text-[11px] font-sans font-normal text-slate-500 mt-0.5">
                          Fotoğraf bekleniyor
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono-tabular font-bold text-emerald-700 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <KeyRound className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span>{checklist.keysCount} Adet</span>
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Rapor Sonu: Karar Alanı */}
          <footer className="pt-6 border-t border-slate-200/90 space-y-4">
            {checklist.landlordStatus === 'approved' && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3 text-xs sm:text-sm text-emerald-950">
                <ShieldCheck
                  className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-bold">Tutanak Karşılıklı SMS (OTP) ile Mühürlendi</p>
                  <p className="mt-0.5 text-xs text-emerald-800 font-mono-tabular">
                    Onay Zamanı: {checklist.landlordReviewedAt} · Mühür Kodu:{' '}
                    {checklist.sealHash ?? 'KMK-TT-2026-9A4F'}
                  </p>
                </div>
              </div>
            )}

            {checklist.landlordStatus === 'approved' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[#0B192C] leading-snug">
                  Teslim süreci tamamlandı! Kiracınız aylık kira dekontlarını yükledikçe Ödemeler
                  sekmesinden görüntüleyip onaylayabilirsiniz.
                </p>
                <button
                  type="button"
                  onClick={() => onOpenPayments(activeProperty.id)}
                  className="shrink-0 min-h-[44px] px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl whitespace-nowrap"
                >
                  Ödemeler Sekmesine Git →
                </button>
              </div>
            )}

            {checklist.landlordStatus === 'objected' && checklist.landlordNote && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-xs sm:text-sm text-amber-950">
                <MessageSquareWarning
                  className="w-5 h-5 text-amber-600 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-bold">
                    Düzeltme / İtiraz Talebi İletildi ({checklist.landlordReviewedAt})
                  </p>
                  <p className="mt-0.5 text-xs text-amber-900">
                    &ldquo;{checklist.landlordNote}&rdquo;
                  </p>
                </div>
              </div>
            )}

            {checklist.landlordStatus !== 'approved' && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <button
                type="button"
                onClick={() => setOtpModalOpen(true)}
                className="flex-1 min-h-[48px] px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl transition-colors inline-flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-600"
              >
                <Key className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Raporu İnceledim, SMS (OTP) ile Onayla ve Mühürle</span>
              </button>

              <button
                type="button"
                onClick={handleOpenObjectionModal}
                className="min-h-[48px] px-5 py-3 bg-white border border-slate-300 hover:bg-slate-50 text-[#0B192C] font-semibold text-sm rounded-xl transition-colors inline-flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 shrink-0"
              >
                <MessageSquareWarning
                  className="w-4 h-4 text-amber-600 shrink-0"
                  aria-hidden="true"
                />
                <span>Düzeltme İste / İtiraz Et</span>
              </button>
            </div>
            )}
          </footer>
        </div>
      </article>

      {/* Objection / Feedback Templates Modal */}
      {objectionOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#0B192C]/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Teslim tutanağı düzeltme talebi"
        >
          <div className="w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200">
            <div className="bg-[#0B192C] text-white px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-amber-300 font-medium">{activeProperty.nickname}</p>
                <h3 className="text-base font-display font-bold mt-0.5">
                  Düzeltme İste / İtiraz Et
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setObjectionOpen(false)}
                aria-label="Kapat"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-white/10"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleObjectSubmit} className="p-6 space-y-4">
              <div>
                <p className="text-xs font-semibold text-[#0B192C] mb-2.5">
                  Hazır Geri Bildirim Şablonları (Tek tıkla seçin)
                </p>
                <div className="space-y-2">
                  {OBJECTION_TEMPLATES.map((template) => {
                    const isSelected = selectedTemplates.includes(template);
                    return (
                      <button
                        key={template}
                        type="button"
                        onClick={() => toggleObjectionTemplate(template)}
                        aria-pressed={isSelected}
                        className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-medium transition-colors flex items-center justify-between gap-2.5 ${
                          isSelected
                            ? 'bg-amber-50 border-amber-400 text-amber-950'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span>{template}</span>
                        <span
                          className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'bg-amber-600 border-amber-600 text-white'
                              : 'bg-white border-slate-300'
                          }`}
                        >
                          {isSelected && <CheckCircle2 className="w-3 h-3" aria-hidden="true" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label
                  htmlFor="landlord-objection-note"
                  className="block text-xs font-semibold text-[#0B192C] mb-1.5"
                >
                  Ek Açıklama (İsteğe Bağlı)
                </label>
                <textarea
                  id="landlord-objection-note"
                  rows={3}
                  value={objectionText}
                  onChange={(e) => {
                    setObjectionText(e.target.value);
                    if (objectionError) setObjectionError('');
                  }}
                  placeholder="İsteğe bağlı olarak eklemek istediğiniz kısa detayı yazabilirsiniz..."
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-[#0B192C] placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              {objectionError && (
                <p className="text-xs font-medium text-rose-600">{objectionError}</p>
              )}

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
                <button
                  type="submit"
                  className="flex-1 min-h-[46px] px-4 py-2.5 bg-[#0B192C] hover:bg-[#132946] text-white font-semibold text-xs sm:text-sm rounded-xl transition-colors"
                >
                  Kiracıya Düzeltme Bildirimi Gönder
                </button>
                <button
                  type="button"
                  onClick={() => setObjectionOpen(false)}
                  className="min-h-[46px] px-4 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs sm:text-sm font-medium rounded-xl"
                >
                  Vazgeç
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SMS OTP Seal Modal */}
      {otpModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#0B192C]/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="SMS OTP ile tutanak mühürleme"
        >
          <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200">
            <div className="bg-[#0B192C] text-white px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-400 font-medium">{activeProperty.nickname}</p>
                <h3 className="text-base font-display font-bold mt-0.5">
                  SMS (OTP) Doğrulaması
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOtpModalOpen(false)}
                aria-label="Kapat"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-white/10"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleConfirmOtpSeal} className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Telefonunuza gönderilen 6 haneli doğrulama kodunu girerek teslim tutanağı raporunu
                kalıcı zaman damgasıyla mühürleyin. (Demo kodu: 614920)
              </p>

              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                aria-label="6 haneli SMS doğrulama kodu"
                className="w-full min-h-[48px] px-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-center text-lg font-mono-tabular tracking-[0.3em] text-[#0B192C] focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />

              <button
                type="submit"
                className="w-full min-h-[48px] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl transition-colors"
              >
                Kodu Doğrula ve Tutanağı Mühürle
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Photo Zoom Lightbox */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 bg-[#0B192C]/85 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Fotoğraf detaylı inceleme"
        >
          <div className="w-full max-w-2xl bg-white rounded-3xl overflow-hidden shadow-2xl">
            <div className="bg-[#0B192C] text-white px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-display font-bold">{lightboxPhoto.roomLabel}</h3>
                <p className="text-xs font-mono-tabular text-emerald-300">
                  {lightboxPhoto.capturedAt} · {lightboxPhoto.hash}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                aria-label="Kapat"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-white/10"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <div className="aspect-[4/3] bg-slate-900">
              <ResilientImage
                src={lightboxPhoto.imageUrl}
                alt={lightboxPhoto.roomLabel}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-5 flex items-center justify-between gap-4">
              <p className="text-sm text-slate-700">{lightboxPhoto.note}</p>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                className="min-h-[44px] px-4 py-2 bg-[#0B192C] text-white text-xs font-semibold rounded-xl shrink-0"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      <WriteTenantReferenceModal
        property={referenceProperty}
        currentLandlordName={currentLandlordName}
        onClose={() => setReferencePropertyId(null)}
        onSignReference={onSignReference}
        onNotify={onNotify}
      />
    </section>
  );
}
