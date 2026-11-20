import { useEffect, useState } from 'react';
import { FileSignature, Key, Lock, UserCheck, X } from 'lucide-react';
import { LandlordProperty, LandlordReference, ReferenceCriteriaRatings } from '../types/kiracimkim';

interface WriteTenantReferenceModalProps {
  property: LandlordProperty | null;
  currentLandlordName: string;
  onClose: () => void;
  onSignReference: (propertyId: string, next: LandlordReference) => void;
  onNotify: (message: string) => void;
}

const DEFAULT_COMMENT =
  'Sözleşme süresince ödemeler düzenli yapıldı ve mülk teslim tutanağına uygun korundu.';

export function WriteTenantReferenceModal({
  property,
  currentLandlordName,
  onClose,
  onSignReference,
  onNotify,
}: WriteTenantReferenceModalProps) {
  const [criteria, setCriteria] = useState<
    Pick<ReferenceCriteriaRatings, 'propertyCondition' | 'communication' | 'contractCompliance'>
  >({
    propertyCondition: 'Hasarsız & Temiz',
    communication: 'Şeffaf & Ulaşılabilir',
    contractCompliance: 'Sözleşmeye Tam Uyum',
  });
  const [commentInput, setCommentInput] = useState(DEFAULT_COMMENT);
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState('729410');

  useEffect(() => {
    if (!property) return;
    setOtpStep(false);
    setOtpCode('729410');
    if (property.reference) {
      setCriteria({
        propertyCondition: property.reference.criteria.propertyCondition,
        communication: property.reference.criteria.communication,
        contractCompliance: property.reference.criteria.contractCompliance,
      });
      setCommentInput(property.reference.comment);
    } else {
      setCriteria({
        propertyCondition: 'Hasarsız & Temiz',
        communication: 'Şeffaf & Ulaşılabilir',
        contractCompliance: 'Sözleşmeye Tam Uyum',
      });
      setCommentInput(DEFAULT_COMMENT);
    }
  }, [property]);

  if (!property) return null;

  const approvedReceiptsCount = property.receipts.filter((r) => r.status === 'Onaylandı').length;
  const baseHistoricalApproved = property.id === 'prop-moda' ? 15 : 0;
  const totalSystemApproved = baseHistoricalApproved + approvedReceiptsCount;
  const systemPaymentBadgeText =
    totalSystemApproved > 0
      ? `Sistem Kaydı: ${totalSystemApproved}/${totalSystemApproved} Zamanında Ödeme`
      : 'Sistem Kaydı: Onaylı Ödeme Bekleniyor';

  const handleOpenPublishOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (property.verificationStatus !== 'verified') {
      onNotify(
        'Doğrulanmamış mülkler üzerinden referans yayınlanamaz ve kiracı karnesine veri işlenemez.'
      );
      return;
    }
    if (!commentInput.trim()) {
      onNotify('Lütfen kiracı hakkında kısa bir değerlendirme yorumu yazın.');
      return;
    }
    setOtpStep(true);
  };

  const handleConfirmPublishWithOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.trim().length < 6) {
      onNotify('Lütfen 6 haneli SMS (OTP) kodunu girin.');
      return;
    }

    const now = new Date();
    const formatted = `${String(now.getDate()).padStart(2, '0')}.${String(
      now.getMonth() + 1
    ).padStart(2, '0')}.${now.getFullYear()}`;
    const hash = `KMK-OTP-${Math.random().toString(16).substring(2, 7).toUpperCase()}`;

    onSignReference(property.id, {
      landlordName: currentLandlordName || 'Selim Karahan',
      districtLabel: `Mülk Sahibi · ${property.officialLocation}`,
      criteria: {
        paymentDiscipline: 'Eksiksiz & Zamanında',
        propertyCondition: criteria.propertyCondition,
        communication: criteria.communication,
        contractCompliance: criteria.contractCompliance,
      },
      comment: commentInput.trim(),
      signedAt: formatted,
      signatureHash: hash,
      verified: true,
      tenantReply: property.reference?.tenantReply,
      tenantRepliedAt: property.reference?.tenantRepliedAt,
    });
    onNotify(
      `Referans SMS (OTP) onayıyla yayınlandı (${property.officialLocation} — KVKK kurallarına uygun).`
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0B192C]/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Kiracıma Referans Yaz"
    >
      <div className="w-full max-w-2xl max-h-[92vh] bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-2xl my-auto flex flex-col">
        <div className="bg-[#0B192C] text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <p className="text-xs text-emerald-400 font-medium">Ev Sahibi Referansı</p>
            <h3 className="text-base sm:text-lg font-display font-bold mt-0.5 truncate">
              Kiracıma Referans Yaz
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-white/10"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {otpStep ? (
          <form onSubmit={handleConfirmPublishWithOtp} className="p-6 space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              Telefonunuza gönderilen 6 haneli doğrulama kodunu girerek referansı kiracının Güven
              Karnesinde yayınlayın. (Demo kodu: 729410)
            </p>
            <div className="relative">
              <Key
                className="w-4 h-4 text-emerald-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                aria-label="6 haneli SMS doğrulama kodu"
                className="w-full min-h-[48px] pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-center text-lg font-mono-tabular tracking-[0.3em] text-[#0B192C] focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
            <div className="flex gap-2.5">
              <button
                type="submit"
                className="flex-1 min-h-[48px] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl transition-colors"
              >
                Onayla ve Referansı Yayınla
              </button>
              <button
                type="button"
                onClick={() => setOtpStep(false)}
                className="min-h-[48px] px-4 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl"
              >
                Geri
              </button>
            </div>
          </form>
        ) : (
          <form
            onSubmit={handleOpenPublishOtp}
            className="p-5 sm:p-6 space-y-5 overflow-y-auto"
          >
            <div className="space-y-1.5 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
                <UserCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="truncate">
                  Kiracı: {property.tenantMaskedName ?? property.tenantName} ·{' '}
                  {property.nickname} ({property.officialLocation})
                </span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
                <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
                <span className="font-mono-tabular">{systemPaymentBadgeText}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <span className="block text-xs font-semibold text-[#0B192C] mb-1.5">
                  1. Evin Teslim Durumu
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(
                    ['Hasarsız & Temiz', 'Olağan Kullanım İzi', 'Onarım Gerektirdi'] as const
                  ).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setCriteria((prev) => ({ ...prev, propertyCondition: opt }))}
                      className={`min-h-[42px] px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                        criteria.propertyCondition === opt
                          ? 'bg-[#0B192C] border-[#0B192C] text-white font-semibold'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-xs font-semibold text-[#0B192C] mb-1.5">
                  2. İletişim
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(['Şeffaf & Ulaşılabilir', 'Orta Düzey', 'Zor İletişim'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setCriteria((prev) => ({ ...prev, communication: opt }))}
                      className={`min-h-[42px] px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                        criteria.communication === opt
                          ? 'bg-[#0B192C] border-[#0B192C] text-white font-semibold'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-xs font-semibold text-[#0B192C] mb-1.5">
                  3. Sözleşme Uyumu
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(['Sözleşmeye Tam Uyum', 'Küçük İhlaller', 'Uyumsuz'] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setCriteria((prev) => ({ ...prev, contractCompliance: opt }))}
                      className={`min-h-[42px] px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                        criteria.contractCompliance === opt
                          ? 'bg-[#0B192C] border-[#0B192C] text-white font-semibold'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label
                htmlFor="landlord-ref-comment"
                className="block text-xs font-semibold text-[#0B192C] mb-1.5"
              >
                Serbest Değerlendirme Yorumu
              </label>
              <textarea
                id="landlord-ref-comment"
                rows={2}
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                placeholder="Kiracının sözleşme sürecindeki ödeme düzeni ve mülk bakımı hakkındaki gözlemlerinizi yazın..."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-[#0B192C] focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 leading-relaxed"
              />
            </div>

            <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <p className="text-xs text-slate-500 leading-relaxed">
                <strong className="text-[#0B192C]">KVKK &amp; İtiraz Güvencesi:</strong> Karne
                üzerinde yalnızca{' '}
                <strong className="text-[#0B192C]">{property.officialLocation}</strong> bölgesi
                gösterilir; kiracının 14 gün içinde yanıt veya itiraz hakkı vardır.
              </p>
              <button
                type="submit"
                className="min-h-[46px] px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
              >
                <FileSignature className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>SMS (OTP) Onayı ile Yayınla</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
