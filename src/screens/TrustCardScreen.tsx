import { useEffect, useState, type ReactNode } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Copy,
  Share2,
  Camera,
  Landmark,
  KeyRound,
  type LucideIcon,
} from 'lucide-react';
import { ensureProfileShareCode } from '../lib/account';
import { HandoverChecklistState, UserSession } from '../types/kiracimkim';

const PASSPORT_BENEFITS: Array<{ icon: LucideIcon; title: string; body: string }> = [
  {
    icon: Camera,
    title: 'Depozito Güvencesi (Teslim Tutanağı)',
    body: 'Eve girerken çektiğiniz oda fotoğrafları ve demirbaş durumu karşılıklı onaylanarak kayıt altına alınır; çıkarken haksız depozito kesintisi yaşamazsınız.',
  },
  {
    icon: Landmark,
    title: 'Resmi Kira Sicili (Banka Dekontları)',
    body: "Her ay yüklediğiniz banka dekontları doğrulanarak bir sonraki ev görüşmenizde size güçlü bir 'Güvenilir Kiracı' referansı oluşturur.",
  },
  {
    icon: KeyRound,
    title: 'Tek Kodla Hızlı Onay',
    body: 'Ev sahiplerine tek tek belge veya kefil anlatmak yerine sadece KMK- kodunuzu paylaşarak güven profilinizi tek tıkla sunarsınız.',
  },
];

const PASSPORT_STEPS = [
  'Kodu Paylaş',
  'Eşleşme Davetini Onayla',
  'Tutanak & Dekontları Yönet',
];

function PassportBenefits() {
  return (
    <aside className="min-w-0 h-full">
      <div className="h-full bg-white border border-slate-200/90 rounded-3xl shadow-sm p-6 sm:p-7 flex flex-col">
        <h2 className="text-lg sm:text-xl font-display font-bold text-[#0B192C] leading-snug">
          Kiracı Pasaportu Size Ne Kazandırır?
        </h2>
        <div className="mt-5 space-y-3 flex-1">
          {PASSPORT_BENEFITS.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <article
                key={benefit.title}
                className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
                    <Icon className="w-4 h-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-display font-bold text-[#0B192C] leading-snug">
                      {benefit.title}
                    </h3>
                    <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{benefit.body}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        <p className="mt-5 rounded-2xl bg-[#0B192C] px-4 py-3.5 text-center text-xs sm:text-[13px] font-semibold leading-6 text-white">
          <span className="whitespace-nowrap">1. {PASSPORT_STEPS[0]}</span>
          <span className="whitespace-nowrap">
            <span className="mx-1.5 text-emerald-300" aria-hidden="true">
              →
            </span>
            2. {PASSPORT_STEPS[1]}
          </span>
          <span className="whitespace-nowrap">
            <span className="mx-1.5 text-emerald-300" aria-hidden="true">
              →
            </span>
            3. {PASSPORT_STEPS[2]}
          </span>
        </p>
      </div>
    </aside>
  );
}

function TrustPassportLayout({ children }: { children: ReactNode }) {
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6 items-start lg:items-stretch">
        <div className="min-w-0 flex flex-col gap-5">{children}</div>
        <PassportBenefits />
      </div>
    </section>
  );
}

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
  onSubmitInviteCode,
  onNotify,
}: TrustCardScreenProps) {
  const [copied, setCopied] = useState(false);
  const [whatsappCopied, setWhatsappCopied] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [profileShareCode, setProfileShareCode] = useState(session.carnetCode);

  const referenceCount = references.length;
  const hasVerifiedHistory = approvedPaymentCount > 0 || referenceCount > 0;
  const latestReference = references[0] ?? null;
  const handoverProtocolCount = checklist.sealed ? 1 : 0;
  const activeShareCode = profileShareCode || session.carnetCode;
  const activeShareUrl = `kiracimkim.com/karne/${activeShareCode}`;
  const maskedLandlordName = latestReference
    ? formatMaskedPersonName(latestReference.landlordName)
    : '';

  useEffect(() => {
    if (!session.userId) return;
    let active = true;
    void ensureProfileShareCode(session.userId)
      .then((code) => {
        if (active) setProfileShareCode(code);
      })
      .catch((error: unknown) => {
        console.error(error);
        onNotify(error instanceof Error ? error.message : 'Paylaşım kodu oluşturulamadı.');
      });
    return () => {
      active = false;
    };
  }, [onNotify, session.userId]);

  const finishInvite = (code: string) => {
    onSubmitInviteCode?.(code);
    setInviteCode('');
  };

  const submitWizardInvite = (event: React.FormEvent) => {
    event.preventDefault();
    if (inviteCode.length !== 6 || !onSubmitInviteCode) return;
    finishInvite(inviteCode);
  };

  const handleCopyShareCode = async () => {
    if (!activeShareCode) return;
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
    if (!activeShareCode) return;
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

  const shareCodePanel = (
    <div className="space-y-4 text-center">
      <h2 className="text-lg sm:text-xl font-display font-bold text-[#0B192C]">
        1. Adım: Kiracı Pasaportunuzu Paylaşın
      </h2>
      <p className="text-sm text-slate-600 leading-relaxed">
        Ev görüşmelerinde bu kodu ev sahibine iletin; kimlik ve güven profilinizi tek tıkla görsün
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-4 py-2 text-emerald-800">
          <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" aria-hidden="true" />
          <span className="font-mono-tabular text-sm sm:text-base font-bold whitespace-nowrap">
            {activeShareCode}
          </span>
        </span>
        <button
          type="button"
          onClick={() => void handleCopyShareCode()}
          className="shrink-0 min-h-[40px] px-3 py-2 bg-[#0B192C] hover:bg-[#132946] text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap"
        >
          <Copy className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>{copied ? 'Kopyalandı' : 'Kopyala'}</span>
        </button>
        <button
          type="button"
          onClick={handleShareWhatsapp}
          className="shrink-0 min-h-[40px] px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap"
        >
          <Share2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>{whatsappCopied ? 'Hazır' : 'WhatsApp ile Gönder'}</span>
        </button>
      </div>
    </div>
  );

  if (!hasActiveRental && pendingMatch) {
    return (
      <TrustPassportLayout>
        <div className="bg-white border border-slate-200/90 rounded-3xl shadow-sm p-6 sm:p-8">
          {shareCodePanel}
        </div>
        <div className="bg-emerald-50 border border-emerald-300 rounded-3xl shadow-sm p-6 sm:p-8 space-y-5 text-center">
          <p className="text-base sm:text-lg font-display font-bold text-[#0B192C] leading-snug">
            <span className="font-sans" aria-hidden="true">
              🎉{' '}
            </span>
            Ev Sahibi {pendingMatch.landlordName} sizi {pendingMatch.propertyTitle} mülkü için
            onayladı! Ev sahibinizin sizinle paylaştığı 6 haneli kodu aşağıya girerek süreci
            başlatın.
          </p>
          <form onSubmit={submitWizardInvite} className="flex flex-col gap-2">
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
              className="w-full min-h-[48px] px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl"
            >
              Kodu Doğrula ve Başla
            </button>
          </form>
        </div>
      </TrustPassportLayout>
    );
  }

  if (!hasActiveRental) {
    return (
      <TrustPassportLayout>
        <div className="bg-white border border-slate-200/90 rounded-3xl shadow-sm p-6 sm:p-8 h-full flex flex-col">
          {shareCodePanel}

          <div className="mt-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-200" />
            <p className="text-xs text-slate-500 text-center">
              ↓ Ev sahibiniz sizi aday olarak seçtiğinde
            </p>
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="mt-6 flex-1 flex flex-col gap-4 text-center">
            <h2 className="text-lg sm:text-xl font-display font-bold text-[#0B192C]">
              2. Adım: Ev Sahibi Eşleşme Davetini Onaylayın
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed text-left">
              Ev sahibiniz profilinizi inceleyip sizi aday olarak onayladığında sistem üzerinden
              size özel 6 haneli bir eşleşme kodu iletir. Bu kodu girerek mülk eşleşmesini
              tamamladığınızda; depozitonuzu koruyan Teslim Tutanağı ve resmi sicilinizi oluşturan
              Kira Ödemeleri sekmeleri açılır.
            </p>
            <form onSubmit={submitWizardInvite} className="mt-auto flex flex-col gap-2 pt-2">
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
                className="w-full min-h-[48px] px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl"
              >
                Daveti Onayla
              </button>
            </form>
          </div>
        </div>
      </TrustPassportLayout>
    );
  }

  return (
    <TrustPassportLayout>
      <div className="bg-white border border-slate-200/90 rounded-3xl shadow-sm p-6 sm:p-8">
        {shareCodePanel}
      </div>
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
    </TrustPassportLayout>
  );
}
