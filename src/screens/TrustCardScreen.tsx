import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, Camera, CircleHelp, Clock, Copy, KeyRound, Landmark, RefreshCw, Share2, ShieldCheck } from 'lucide-react';
import { ensureProfileShareCode, type PendingMatch, type TenantHistory } from '../lib/account';
import { supabase } from '../lib/supabase';
import type { LandlordProperty, UserSession } from '../types/kiracimkim';

interface TrustCardScreenProps {
  session: UserSession;
  activeRental: LandlordProperty | null;
  hasActiveRental: boolean;
  pendingMatch: PendingMatch | null;
  history: TenantHistory | null;
  historyRefreshFailed: boolean;
  onSubmitInviteCode: (code: string) => void;
  onNavigate: (screen: 'handover' | 'receipts') => void;
  onNotify: (message: string) => void;
  onOpenGuide: () => void;
  onRefreshInvites: () => Promise<void> | void;
  transparencyPledged?: boolean;
}

const primaryButton =
  'inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3.5 py-2 text-sm font-semibold text-white transition-all duration-300 hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-95 disabled:opacity-50 sm:w-auto';

const secondaryButton =
  'inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-current/30 px-3.5 py-2 text-sm font-semibold transition-all duration-300 hover:bg-current/5 focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-95 disabled:opacity-50 sm:w-auto';

const currency = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' });

function getDashboardAction(
  hasActiveRental: boolean,
  rental: LandlordProperty | null,
  invite: PendingMatch | null,
) {
  if (!hasActiveRental) {
    return invite
      ? {
          kind: 'invite',
          icon: KeyRound,
          title: 'Gelen Kiracılık Davetini Onaylayın',
          propertyTitle: invite.propertyTitle,
          officialLocation: invite.officialLocation,
        } as const
      : {
          kind: 'share',
          icon: Share2,
          title: 'Güven Karneni paylaş',
          description: 'Ev sahibin bu kodla Güven Karneni inceleyebilir.',
        } as const;
  }

  if (rental?.checklist.landlordStatus === 'approved' && rental.landlordUserId) {
    return {
      kind: 'payments',
      icon: Landmark,
      title: 'Kira ödemelerine geçin',
      description: 'Ev sahibiniz teslim tutanağını onayladı. Dekontunuzu yükleyebilir ve ödeme kayıtlarınızı inceleyebilirsiniz.',
    } as const;
  }

  if (rental?.checklist.landlordStatus === 'objected') {
    return {
      kind: 'objection',
      icon: Camera,
      title: 'Teslim tutanağını inceleyin',
      description: 'Ev sahibiniz tutanağa itiraz etti. Ayrıntıları teslim tutanağı ekranında görebilirsiniz.',
    } as const;
  }

  if (rental?.checklist.landlordStatus === 'pending') {
    if (rental.tenantSubmitted === true) {
      return {
        kind: 'review',
        icon: Clock,
        title: 'Ev sahibinin incelemesi bekleniyor',
        description: 'Teslim tutanağınız ev sahibine gönderildi. Onaydan sonra kira dekontu yükleyebilirsiniz.',
      } as const;
    }

    if (rental.tenantSubmitted === false && !rental.checklist.sealed) {
      return {
        kind: 'handover',
        icon: Camera,
        title: 'Teslim tutanağını hazırlayın',
        description: 'Evin durumunu kayda almak için oda fotoğraflarını, sayaç bilgilerini ve anahtar adedini ekleyin.',
      } as const;
    }
  }

  return {
    kind: 'unknown',
    icon: Clock,
    title: 'Kiralama durumu henüz net değil',
    description: 'Sıradaki işlemi belirlemek için gereken bilgiler şu anda görüntülenemiyor.',
  } as const;
}

function formatMaskedPersonName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  const last = parts.pop();
  return parts.length && last ? `${parts.join(' ')} ${last.charAt(0).toLocaleUpperCase('tr-TR')}.` : fullName;
}

export function TrustCardScreen({
  session,
  activeRental,
  hasActiveRental,
  pendingMatch,
  history,
  historyRefreshFailed,
  onSubmitInviteCode,
  onNavigate,
  onNotify,
  onOpenGuide,
  onRefreshInvites,
  transparencyPledged = false,
}: TrustCardScreenProps) {
  const [copied, setCopied] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [profileShareCode, setProfileShareCode] = useState(session.carnetCode);
  const [checkingInvites, setCheckingInvites] = useState(false);

  const action = getDashboardAction(hasActiveRental, activeRental, pendingMatch);
  const ActionIcon = action.icon;
  const activeShareCode = profileShareCode || session.carnetCode;
  const hasHistory = history && (
    history.rentals.length > 0 || history.references.length > 0 || history.payments.length > 0
  );

  useEffect(() => {
    if (!session.userId) return;
    let active = true;
    void ensureProfileShareCode(session.userId)
      .then((code) => {
        if (active) setProfileShareCode(code);
      })
      .catch((error: unknown) => {
        if (active) {
          onNotify(error instanceof Error ? error.message : 'Paylaşım kodu oluşturulamadı.');
        }
      });
    return () => {
      active = false;
    };
  }, [onNotify, session.userId]);

  useEffect(() => {
    if (!session.userId || hasActiveRental) return;
    let active = true;
    const lookForInvite = () => {
      if (!active || document.visibilityState === 'hidden') return;
      void onRefreshInvites();
    };
    const channel = supabase
      .channel(`tenant-invites-${session.userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rentals',
          filter: `tenant_id=eq.${session.userId}`,
        },
        lookForInvite
      )
      .subscribe();
    const timer = window.setInterval(lookForInvite, 10000);
    return () => {
      active = false;
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [hasActiveRental, onRefreshInvites, session.userId]);

  const refreshInvites = async () => {
    if (checkingInvites) return;
    setCheckingInvites(true);
    try {
      await onRefreshInvites();
    } finally {
      setCheckingInvites(false);
    }
  };

  const approvedPayments = history?.approvedPaymentCount ?? 0;
  const handoverStarted = Boolean(
    activeRental && (activeRental.checklist.sealed || activeRental.tenantSubmitted)
  );
  const scorecard = [
    {
      label: 'Kira Ödemeleri',
      value: approvedPayments > 0 ? `${approvedPayments} Onaylı Dekont` : '0 Onaylı Dekont',
      detail: approvedPayments > 0 ? 'Ev sahibi onaylı ödemeler' : 'İlk kiralamanla birlikte burada birikir',
    },
    {
      label: 'Teslim Tutanağı',
      value: handoverStarted ? 'Oluşturuldu' : 'Henüz oluşturulmadı',
      detail: handoverStarted ? 'Ev sahibi incelemesine açık' : 'Ev sahibi daveti onaylandığında açılır',
    },
    {
      label: 'Şeffaflık Taahhüdü',
      value: transparencyPledged ? 'Onaylandı' : 'Bekleniyor',
      detail: transparencyPledged ? 'Taahhüt kayıtlı' : 'Davet kabulünde onaylanır',
    },
  ];

  const copyShareCode = async () => {
    try {
      await navigator.clipboard.writeText(activeShareCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      onNotify('Kod kopyalanamadı. Paylaşım kodunu seçerek kopyalayabilirsiniz.');
    }
  };

  const shareOnWhatsApp = () => {
    const message = `Merhaba, KiracımKim Güven Karnemi bu paylaşım koduyla inceleyebilirsiniz: ${activeShareCode}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  const submitInvite = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inviteCode.length === 6) onSubmitInviteCode(inviteCode);
  };

  const inviteForm = (primary: boolean) => (
    <form onSubmit={submitInvite} className="max-w-lg space-y-2">
      <label htmlFor="tenant-dashboard-invite" className="block text-sm font-semibold">
        Ev sahibinizin verdiği 6 haneli davet kodu
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="tenant-dashboard-invite"
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={inviteCode}
          onChange={(event) => setInviteCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          className="min-h-[44px] w-full min-w-0 rounded-xl border border-slate-300 bg-white px-4 text-center text-base font-mono-tabular tracking-[0.25em] text-[#0B192C] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 sm:w-32"
        />
        <button type="submit" disabled={inviteCode.length !== 6} className={primary ? primaryButton : secondaryButton}>
          Daveti kabul et
        </button>
      </div>
    </form>
  );

  const shareControls = (primary: boolean) => (
    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="w-full sm:w-auto">
        <p className="mb-1 text-xs font-semibold">Ev sahibiyle paylaşılacak kod</p>
        <span className="flex min-h-[44px] w-full select-all items-center justify-center gap-2 break-all rounded-xl border border-emerald-200 bg-emerald-50 px-3 font-mono-tabular font-bold text-emerald-800 sm:inline-flex sm:w-auto sm:justify-start">
          {primary && activeShareCode && (
            <span className="size-2 shrink-0 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" />
          )}
          {activeShareCode || 'Kod henüz hazır değil'}
        </span>
      </div>
      <div className="flex w-full gap-2 sm:w-auto">
        {primary && (
          <button
            type="button"
            disabled={!activeShareCode}
            onClick={shareOnWhatsApp}
            className={`${primaryButton} w-auto! min-w-0 flex-1 whitespace-nowrap sm:flex-none`}
          >
            <Share2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            WhatsApp ile paylaş
          </button>
        )}
        <button
          type="button"
          disabled={!activeShareCode}
          onClick={() => void copyShareCode()}
          className={`${secondaryButton} w-auto! shrink-0 whitespace-nowrap`}
        >
          <Copy className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span aria-live="polite">{copied ? 'Kopyalandı' : 'Kopyala'}</span>
        </button>
        {!primary && (
          <button
            type="button"
            disabled={!activeShareCode}
            onClick={shareOnWhatsApp}
            className={`${secondaryButton} w-auto! min-w-0 flex-1 whitespace-nowrap sm:flex-none`}
          >
            <Share2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            WhatsApp ile paylaş
          </button>
        )}
      </div>
    </div>
  );

  return (
    <section className="mx-auto max-w-5xl space-y-4 px-4 py-5 sm:px-6 sm:py-8">
      <section aria-labelledby="tenant-next-action" className="relative rounded-3xl bg-[#0B192C] p-4 text-white shadow-sm sm:px-6 sm:py-5">
        {!hasActiveRental && (
          <button
            type="button"
            onClick={() => void refreshInvites()}
            disabled={checkingInvites}
            aria-label="Davetleri kontrol et"
            title="Davetleri kontrol et"
            className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 disabled:opacity-60"
          >
            <RefreshCw className={`size-4 ${checkingInvites ? 'animate-spin' : ''}`} aria-hidden="true" />
          </button>
        )}
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className={`flex min-w-0 items-start gap-3 ${hasActiveRental ? '' : 'pr-10 sm:pr-0'}`}>
            <span className="shrink-0 rounded-xl bg-emerald-400/15 p-2 text-emerald-300">
              <ActionIcon className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 id="tenant-next-action" className="break-words text-lg font-bold sm:text-xl">{action.title}</h1>
              <p className="mt-1 break-words text-sm leading-relaxed text-slate-200">
                {action.kind === 'invite' ? (
                  <>
                    <strong className="font-semibold text-white">{action.propertyTitle}</strong>{' '}
                    <strong className="font-semibold text-emerald-200">({action.officialLocation})</strong>{' '}
                    mülkü için kiracılık daveti aldınız. Ev sahibinizin ilettiği 6 haneli kodu girerek eşleşmeyi tamamlayabilir ve teslim tutanağını başlatabilirsiniz.
                  </>
                ) : action.description}
              </p>
              {activeRental && (
                <p className="mt-1 break-words text-xs text-emerald-200">Aktif kiralama · {activeRental.nickname}</p>
              )}
            </div>
          </div>

          {action.kind === 'share' && shareControls(true)}
          {action.kind === 'invite' && inviteForm(true)}
          {action.kind === 'handover' && (
            <button type="button" className={primaryButton} onClick={() => onNavigate('handover')}>
              Teslim tutanağına git <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
            </button>
          )}
          {(action.kind === 'review' || action.kind === 'objection') && (
            <button type="button" className={secondaryButton} onClick={() => onNavigate('handover')}>
              Teslim tutanağını görüntüle
            </button>
          )}
          {action.kind === 'payments' && (
            <button type="button" className={primaryButton} onClick={() => onNavigate('receipts')}>
              Kira ödemelerine git <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
            </button>
          )}
        </div>

        {action.kind === 'share' && (
          <details className="mt-3 border-t border-white/20 pt-1 open:pb-2">
            <summary className="min-h-[44px] cursor-pointer py-3 text-sm font-semibold text-emerald-200">Ev sahibinden davet kodu aldım</summary>
            {inviteForm(false)}
          </details>
        )}
      </section>
      <button
        type="button"
        onClick={onOpenGuide}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-emerald-800 underline underline-offset-4 transition-all duration-300 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 active:scale-95"
      >
        <CircleHelp className="size-4 shrink-0" aria-hidden="true" />
        Nasıl çalışır?
      </button>
      <section aria-labelledby="tenant-trust-summary" className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:px-6 sm:py-5">
        <div className="flex min-w-0 items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden="true" />
          <div className="min-w-0">
            <h2 id="tenant-trust-summary" className="text-lg font-bold text-[#0B192C]">Güven Karnem</h2>
            <p className="mt-1 break-words text-sm leading-relaxed text-slate-600">
              Ev sahibin KMK kodunu sorguladığında aşağıdaki karne özetini görür.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
          {scorecard.map((item) => (
            <div key={item.label} className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] font-semibold tracking-wide text-slate-500">{item.label}</p>
              <p className="mt-1.5 text-sm font-bold leading-snug text-slate-700">{item.value}</p>
              <p className="mt-1 text-xs leading-snug text-slate-500">{item.detail}</p>
            </div>
          ))}
        </div>

        {(!history || historyRefreshFailed) && (
          <p role="status" className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {history
              ? 'Geçmiş kayıtlar şu anda güncellenemiyor. Son yüklenen bilgiler gösteriliyor.'
              : 'Geçmiş kayıtlar şu anda yüklenemiyor.'}
          </p>
        )}

        {history && hasHistory && (
          <div className="mt-4 grid divide-y divide-slate-200 border-t border-slate-200 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
            <section className="min-w-0 py-4 lg:pr-4">
              <h3 className="text-sm font-bold">Kiracılık geçmişiniz</h3>
              {history.rentals.length > 0 ? (
                <ul className="mt-2 space-y-2 text-sm">
                  {history.rentals.map((rental) => (
                    <li key={rental.id} className="break-words">
                      <p className="font-semibold">{rental.title}</p>
                      <p className="text-xs text-slate-600">{rental.active ? 'Aktif kiralama' : 'Geçmiş kiralama kaydı'}</p>
                    </li>
                  ))}
                </ul>
              ) : !historyRefreshFailed && (
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  Henüz kayıtlı bir kiracılığınız bulunmuyor. İlk kiracılığınız başladığında bilgileriniz burada görünecek.
                </p>
              )}
            </section>

            <section className="min-w-0 py-4 lg:px-4">
              <h3 className="text-sm font-bold">Ev sahibi referanslarınız</h3>
              {history.references.length > 0 ? (
                <>
                  <p className="mt-1 text-sm font-semibold text-emerald-800">{history.references.length} referans</p>
                  <ul className="mt-2 divide-y divide-slate-100 text-sm">
                    {history.references.map((reference) => (
                      <li key={reference.id} className="space-y-1 break-words py-2">
                        <p className="font-semibold">{formatMaskedPersonName(reference.landlordName)}</p>
                        {reference.comment && <blockquote className="text-slate-700">{reference.comment}</blockquote>}
                        {reference.signedAt && <p className="text-xs text-slate-600">{reference.signedAt}</p>}
                      </li>
                    ))}
                  </ul>
                </>
              ) : !historyRefreshFailed && (
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  Henüz referansınız yok. Ev sahipleriniz değerlendirme ekledikçe burada görüntüleyebilirsiniz.
                </p>
              )}
            </section>

            <section className="min-w-0 py-4 lg:pl-4">
              <h3 className="text-sm font-bold">Ödeme geçmişiniz</h3>
              {history.payments.length > 0 ? (
                <>
                  {history.approvedPaymentCount > 0 && (
                    <p className="mt-1 text-sm font-semibold text-emerald-800">{history.approvedPaymentCount} onaylı ödeme</p>
                  )}
                  <ul className="mt-2 divide-y divide-slate-100">
                    {history.payments.map((payment) => (
                      <li key={payment.id} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 break-words py-2 text-sm">
                        <div className="min-w-0">
                          <p className="font-semibold">{payment.monthLabel}</p>
                          <p className="text-xs leading-relaxed text-slate-600">
                            {payment.propertyNickname && `${payment.propertyNickname} · `}{payment.status}
                          </p>
                        </div>
                        <span className="font-mono-tabular">{currency.format(payment.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : !historyRefreshFailed && (
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  Henüz kayıtlı ödemeniz bulunmuyor. Ödeme kayıtlarınız burada listelenecek.
                </p>
              )}
            </section>
          </div>
        )}
      </section>

      {action.kind !== 'share' && (
        <details className="rounded-2xl border border-slate-200 bg-white px-4">
          <summary className="min-h-[44px] cursor-pointer break-words py-3 text-sm font-semibold">
            Güven Karneni Paylaş
            {activeShareCode && <span className="ml-1 font-mono-tabular text-emerald-800">({activeShareCode})</span>}
          </summary>
          <p className="mb-3 text-sm text-slate-600">Ev sahibin bu kodla Güven Karneni inceleyebilir.</p>
          <div className="pb-4">{shareControls(false)}</div>
        </details>
      )}
    </section>
  );
}
