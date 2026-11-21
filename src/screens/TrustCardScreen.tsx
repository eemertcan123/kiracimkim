import { useEffect, useState } from 'react';
import { ShieldCheck, CheckCircle2, Copy, Share2, Lock } from 'lucide-react';
import { ensureProfileShareCode } from '../lib/account';
import { HandoverChecklistState, UserSession } from '../types/kiracimkim';

interface TrustCardScreenProps {
  session: UserSession;
  checklist: HandoverChecklistState;
  approvedPaymentCount: number;
  references: Array<{
    id: string;
    landlordName: string;
    comment: string;
    signedAt: string;
  }>;
  pendingMatch?: {
    landlordName: string;
    propertyTitle: string;
  } | null;
  hasActiveRental?: boolean;
  transparentEntryPledged?: boolean;
  onAcceptPledge?: () => void;
  onSubmitInviteCode?: (code: string) => void;
  onNotify: (message: string) => void;
}

function formatMaskedPersonName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return fullName;
  const last = parts[parts.length - 1];
  const first = parts.slice(0, -1).join(' ');
  return `${first} ${last.charAt(0).toUpperCase()}.`;
}

export function TrustCardScreen({
  session,
  checklist,
  approvedPaymentCount,
  references,
  pendingMatch = null,
  hasActiveRental = false,
  transparentEntryPledged = false,
  onAcceptPledge,
  onSubmitInviteCode,
  onNotify,
}: TrustCardScreenProps) {
  const [copied, setCopied] = useState(false);
  const [whatsappCopied, setWhatsappCopied] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [profileShareCode, setProfileShareCode] = useState('');
  const [shareCodeLoaded, setShareCodeLoaded] = useState(false);
  const [pledgeChecked, setPledgeChecked] = useState(false);
  const [pledgeSaving, setPledgeSaving] = useState(false);

  const referenceCount = references.length;
  const hasVerifiedHistory = approvedPaymentCount > 0 || referenceCount > 0;
  const latestReference = references[0] ?? null;
  const handoverProtocolCount = checklist.sealed ? 1 : 0;
  const activeShareCode = profileShareCode;
  const activeShareUrl = `kiracimkim.com/karne/${activeShareCode}`;
  const codeLocked =
    shareCodeLoaded &&
    activeShareCode.startsWith('KMK-') &&
    !hasVerifiedHistory &&
    !transparentEntryPledged;
  const isShareUnlocked = Boolean(activeShareCode) && !codeLocked;
  const maskedLandlordName = latestReference
    ? formatMaskedPersonName(latestReference.landlordName)
    : '';

  useEffect(() => {
    if (!session.userId) return;
    let active = true;
    setShareCodeLoaded(false);
    void ensureProfileShareCode(session.userId)
      .then((code) => {
        if (active) setProfileShareCode(code);
      })
      .catch((error: unknown) => {
        console.error(error);
        if (active) setProfileShareCode('');
        onNotify(error instanceof Error ? error.message : 'Paylaşım kodu oluşturulamadı.');
      })
      .finally(() => {
        if (active) setShareCodeLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [onNotify, session.userId]);

  const submitWizardInvite = (event: React.FormEvent) => {
    event.preventDefault();
    if (inviteCode.length !== 6 || !onSubmitInviteCode) return;
    onSubmitInviteCode(inviteCode);
    setInviteCode('');
  };

  const handleCopyShareCode = async () => {
    if (!isShareUnlocked) return;
    try {
      await navigator.clipboard.writeText(activeShareCode);
    } catch {
      // Clipboard fallback ignored
    }
    setCopied(true);
    onNotify(`Paylaşım kodunuz kopyalandı: ${activeShareCode}`);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShareWhatsapp = () => {
    if (!isShareUnlocked) return;
    const whatsappMessage = `Merhaba, Kiracımkim Güven Karnemi inceleyebilirsiniz: https://${activeShareUrl} (Paylaşım Kodu: ${activeShareCode})`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`,
      '_blank',
      'noopener,noreferrer'
    );
    setWhatsappCopied(true);
    onNotify(`WhatsApp paylaşım mesajı hazırlandı (${activeShareCode}).`);
    setTimeout(() => setWhatsappCopied(false), 2500);
  };

  const confirmPledge = () => {
    if (!pledgeChecked || pledgeSaving) return;
    setPledgeSaving(true);
    onAcceptPledge?.();
    setPledgeChecked(false);
    setPledgeSaving(false);
  };

  if (!hasActiveRental && pendingMatch) {
    return (
      <section className="max-w-xl mx-auto px-4 sm:px-6 py-8 sm:py-14">
        <div className="bg-emerald-50 border border-emerald-300 rounded-3xl shadow-sm p-6 sm:p-8 space-y-5 text-center">
          <p className="text-base sm:text-lg font-display font-bold text-[#0B192C] leading-snug">
            <span className="font-sans" aria-hidden="true">
              🎉{' '}
            </span>
            Ev Sahibi {pendingMatch.landlordName} sizi {pendingMatch.propertyTitle} mülkü için
            onayladı! Ev sahibinizin sizinle paylaştığı 6 haneli kodu aşağıya girerek süreci
            başlatın.
          </p>
          <form onSubmit={submitWizardInvite} className="flex flex-col sm:flex-row gap-2">
            <label htmlFor="pending-invite-code" className="sr-only">
              6 haneli onay kodu
            </label>
            <input
              id="pending-invite-code"
              inputMode="numeric"
              maxLength={6}
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6 haneli kod"
              className="w-full min-h-[48px] px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-center text-lg font-mono-tabular tracking-[0.28em] text-[#0B192C] focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
            <button
              type="submit"
              disabled={inviteCode.length !== 6}
              className="min-h-[48px] px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl whitespace-nowrap"
            >
              Kodu Doğrula ve Başla
            </button>
          </form>
        </div>
      </section>
    );
  }

  if (!hasActiveRental) {
    return (
      <section className="max-w-xl mx-auto px-4 sm:px-6 py-8 sm:py-14">
        <div className="bg-white border border-slate-200/90 rounded-3xl shadow-sm p-6 sm:p-8 space-y-6">
          <div className="space-y-4 text-center">
            <h2 className="text-lg sm:text-xl font-display font-bold text-[#0B192C]">
              1. Adım: Kiracı Pasaportunuzu Paylaşın
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Ev görüşmelerinde bu kodu ev sahibine iletin; kimlik ve güven profilinizi tek tıkla
              görsün
            </p>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-4 py-2 text-emerald-800">
                  {codeLocked ? (
                    <Lock className="w-4 h-4 shrink-0 text-slate-400" aria-hidden="true" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  )}
                  <span
                    className={`font-mono-tabular text-sm sm:text-base font-bold whitespace-nowrap ${
                      codeLocked ? 'blur-sm select-none text-slate-400' : ''
                    }`}
                  >
                    {!shareCodeLoaded || !activeShareCode ? '…' : activeShareCode}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={!isShareUnlocked}
                  onClick={() => void handleCopyShareCode()}
                  className="shrink-0 min-h-[40px] px-3 py-2 bg-[#0B192C] hover:bg-[#132946] disabled:opacity-50 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Copy className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{copied ? 'Kopyalandı' : 'Kopyala'}</span>
                </button>
                <button
                  type="button"
                  disabled={!isShareUnlocked}
                  onClick={handleShareWhatsapp}
                  className="shrink-0 min-h-[40px] px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Share2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{whatsappCopied ? 'Hazır' : 'WhatsApp ile Gönder'}</span>
                </button>
              </div>
              {codeLocked && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left space-y-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pledgeChecked}
                      onChange={(event) => setPledgeChecked(event.target.checked)}
                      className="mt-1 h-4 w-4 shrink-0 accent-emerald-600"
                    />
                    <span className="text-sm text-[#0B192C] leading-relaxed">
                      Şeffaflık Taahhüdünü Onaylıyorum
                    </span>
                  </label>
                  <button
                    type="button"
                    disabled={!pledgeChecked || pledgeSaving}
                    onClick={confirmPledge}
                    className="min-h-[40px] px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl"
                  >
                    Onayla
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-200" />
            <p className="text-xs text-slate-500 whitespace-nowrap">
              ↓ Ev sahibiniz sizi aday olarak seçtiğinde
            </p>
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="space-y-4 text-center">
            <h2 className="text-lg sm:text-xl font-display font-bold text-[#0B192C]">
              2. Adım: 6 Haneli Davet Kodunu Onaylayın
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Ev sahibinizin ilettiği 6 haneli kodu girin. Onayladığınız anda Teslim Tutanağı ve
              Kira Ödemeleri sekmeleri açılır
            </p>
            <form onSubmit={submitWizardInvite} className="flex flex-col sm:flex-row gap-2">
              <label htmlFor="home-invite-code" className="sr-only">
                6 haneli davet kodu
              </label>
              <input
                id="home-invite-code"
                inputMode="numeric"
                maxLength={6}
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6 haneli kod"
                className="w-full min-h-[48px] px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-center text-lg font-mono-tabular tracking-[0.28em] text-[#0B192C] focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <button
                type="submit"
                disabled={inviteCode.length !== 6}
                className="min-h-[48px] px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl whitespace-nowrap"
              >
                Daveti Onayla
              </button>
            </form>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
      {/* BLOK 3: TEK BİR SADE "GÜVEN KARNESİ" KARTI */}
      <div className="bg-white border border-slate-200/90 rounded-3xl overflow-hidden shadow-xs">
        {/* Üstte Sadece Maskeli İsim • Kimliği Doğrulanmış Kiracı */}
        <div className="bg-[#0B192C] text-white px-6 sm:px-8 py-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" aria-hidden="true" />
            <h1 className="text-lg sm:text-2xl font-display font-bold text-white">
              {session.maskedName} <span className="text-slate-400 font-normal">•</span>{' '}
              Kimliği Doğrulanmış Kiracı
            </h1>
          </div>

        </div>

        {/* Kart Gövdesi */}
        {!hasVerifiedHistory ? (
          <div className="p-6 sm:p-8">
            <p className="text-sm sm:text-base text-[#0B192C] leading-relaxed">
              <strong className="font-semibold">İlk Kiralama</strong>
              {' • '}
              Henüz doğrulanmış geçmiş kayıt bulunmuyor. İlk onaylı kira ödemenizle birlikte güven
              karneniz oluşmaya başlayacaktır.
            </p>
          </div>
        ) : (
          <div className="p-6 sm:p-8 space-y-6">
            {/* Ortada 3 Sade Rakam */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 text-center">
                <p className="text-2xl sm:text-3xl font-display font-bold font-mono-tabular text-emerald-700">
                  {approvedPaymentCount}/{approvedPaymentCount}
                </p>
                <p className="mt-1.5 text-sm font-semibold text-[#0B192C]">Onaylı Ödeme</p>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 text-center">
                <p className="text-2xl sm:text-3xl font-display font-bold font-mono-tabular text-[#0B192C]">
                  {handoverProtocolCount}
                </p>
                <p className="mt-1.5 text-sm font-semibold text-[#0B192C]">Teslim Tutanağı</p>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 text-center">
                <p className="text-2xl sm:text-3xl font-display font-bold font-mono-tabular text-[#0B192C]">
                  {referenceCount}
                </p>
                <p className="mt-1.5 text-sm font-semibold text-[#0B192C]">
                  Ev Sahibi Referansı
                </p>
              </div>
            </div>

            {/* Altta Künyeli Ev Sahibi Referansı Kutusu */}
            {latestReference && (
              <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-display font-bold text-[#0B192C]">
                    Ev Sahibi Referansı
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>Doğrulanmış</span>
                  </span>
                </div>

                <p className="text-xs sm:text-sm font-semibold text-slate-700">
                  {maskedLandlordName} • Önceki Ev Sahibi
                </p>

                {latestReference.comment && (
                  <blockquote className="text-sm sm:text-base text-[#0B192C] leading-relaxed">
                    &ldquo;{latestReference.comment}&rdquo;
                  </blockquote>
                )}

                {latestReference.signedAt && (
                  <p className="text-xs text-slate-500 pt-1">
                    Referans Tarihi: {latestReference.signedAt}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
