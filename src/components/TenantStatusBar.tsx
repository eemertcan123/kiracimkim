import { Clock, CheckCircle2, ArrowLeft } from 'lucide-react';
import { ScreenId } from '../types/kiracimkim';

interface TenantStatusBarProps {
  status: 'pending' | 'active';
  matchDismissed: boolean;
  hasVerifiedHistory: boolean;
  officialLocation: string;
  landlordName: string;
  activeScreen: ScreenId;
  onGoToTrustCard: () => void;
}

export function TenantStatusBar({
  status,
  matchDismissed,
  hasVerifiedHistory,
  officialLocation,
  landlordName,
  activeScreen,
  onGoToTrustCard,
}: TenantStatusBarProps) {
  return (
    <div className="bg-white border-b border-slate-200/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
          {status === 'active' ? (
            <>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Aktif Kiracı</span>
              </span>
              <span className="text-xs sm:text-sm font-semibold text-[#0B192C] truncate">
                Aktif Kiralama: {officialLocation} • Ev Sahibi: {landlordName}
              </span>
            </>
          ) : matchDismissed && !hasVerifiedHistory ? (
            <span className="text-xs sm:text-sm font-semibold text-[#0B192C] leading-relaxed">
              Kiracılık Durumum: İlk Kiralama Adayı — Davet kodu girdiğinizde tutanak ve ödeme
              sekmeleri aktif olur.
            </span>
          ) : matchDismissed ? (
            <>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border bg-emerald-50 border-emerald-200 text-xs font-semibold text-emerald-800 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Kiracılık Durumum: Geçmiş Referans Mevcut</span>
              </span>
              <span className="text-xs sm:text-sm text-slate-600 truncate">
                Aktif kira sözleşmeniz bulunmuyor, önceki kiracılık geçmişiniz doğrulanmış durumda.
              </span>
            </>
          ) : (
            <>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border bg-amber-50 border-amber-200 text-xs font-semibold text-amber-800 shrink-0">
                <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Kiralama Kaydı Onayı Bekliyor</span>
              </span>
              <span className="text-xs sm:text-sm text-slate-600 truncate">
                {officialLocation} • Ev Sahibi: {landlordName}
              </span>
              {activeScreen !== 'trust-card' && (
                <button
                  type="button"
                  onClick={onGoToTrustCard}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1 underline underline-offset-2 shrink-0"
                >
                  <ArrowLeft className="w-3 h-3 shrink-0" aria-hidden="true" />
                  <span>Güven Karneme Dön</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
