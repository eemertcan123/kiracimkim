import { ShieldCheck, Lock, LogOut } from 'lucide-react';
import { ScreenId, UserRole } from '../types/kiracimkim';

interface TopNavProps {
  activeScreen: ScreenId;
  role: UserRole;
  lockedScreens?: ScreenId[];
  onNavigate: (screen: ScreenId) => void;
  onLogout?: () => void;
}

const TENANT_NAV_ITEMS: { id: ScreenId; label: string; mobileTitle: string }[] = [
  { id: 'handover', label: 'Teslim Tutanağı', mobileTitle: 'Teslim Tutanağı' },
  { id: 'receipts', label: 'Kira Ödemeleri', mobileTitle: 'Kira Ödemeleri' },
  { id: 'trust-card', label: 'Güven Karnem', mobileTitle: 'Güven Karnem' },
];

const LANDLORD_NAV_ITEMS: { id: ScreenId; label: string; mobileTitle: string }[] = [
  { id: 'landlord-candidates', label: 'Aday & Referans', mobileTitle: 'Aday & Referans' },
  { id: 'landlord-handover', label: 'Mülk & Tutanak', mobileTitle: 'Mülk & Tutanak' },
  { id: 'landlord-payments', label: 'Ödemeler', mobileTitle: 'Ödemeler' },
];

export function TopNav({
  activeScreen,
  role,
  lockedScreens = [],
  onNavigate,
  onLogout,
}: TopNavProps) {
  const navItems = role === 'landlord' ? LANDLORD_NAV_ITEMS : TENANT_NAV_ITEMS;
  const currentMobileTitle =
    activeScreen === 'login'
      ? 'Güvenli Giriş'
      : navItems.find((item) => item.id === activeScreen)?.mobileTitle ?? 'Kiracımkim';

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Mobile Compact Top App Bar (52px). Screen title stays in the bottom nav below md. */}
        <div className="flex lg:hidden items-center justify-between h-[52px] gap-2">
          <button
            type="button"
            onClick={() => onNavigate('login')}
            className="flex items-center gap-1.5 text-[#0B192C] font-display font-bold text-base tracking-tight whitespace-nowrap shrink-0 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded-lg px-1"
          >
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden="true" />
            <span>Kiracımkim</span>
          </button>

          <span className="hidden md:block min-w-0 text-sm font-semibold text-slate-700 truncate text-center">
            {currentMobileTitle}
          </span>

          <div className="flex items-center gap-1 shrink-0">
            {onLogout && (
              <>
                <button
                  type="button"
                  onClick={onLogout}
                  aria-label="Çıkış"
                  className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-[#0B192C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                >
                  <LogOut className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={onLogout}
                  className="hidden md:inline-flex min-h-[44px] px-2 text-xs font-semibold text-slate-600 hover:text-[#0B192C] whitespace-nowrap"
                >
                  Çıkış
                </button>
              </>
            )}
          </div>
        </div>

        {/* Desktop 3-Zone Top Bar Contract */}
        <div className="hidden lg:flex items-center justify-between gap-8 h-16">
          {/* Zone 1: Brand Wordmark */}
          <button
            type="button"
            onClick={() => onNavigate('login')}
            className="flex items-center gap-2.5 text-[#0B192C] font-display font-bold text-xl tracking-tight whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded-lg py-1"
          >
            <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" aria-hidden="true" />
            <span>Kiracımkim</span>
          </button>

          {/* Zone 2: Single-Line Screen Navigation Links */}
          <nav className="flex items-center gap-7" aria-label="Ana ekranlar">
            {navItems.map((item) => {
              const isLocked = lockedScreens.includes(item.id);
              const isActive = activeScreen === item.id && !isLocked;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={isLocked}
                  onClick={() => {
                    if (!isLocked) onNavigate(item.id);
                  }}
                  title={
                    isLocked
                      ? 'Önce Güven Karnem sayfasındaki kiralama kaydını onaylamalısınız'
                      : undefined
                  }
                  aria-current={isActive ? 'page' : undefined}
                  aria-disabled={isLocked}
                  className={`relative py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded-md ${
                    isLocked
                      ? 'text-slate-400 cursor-not-allowed select-none opacity-75'
                      : isActive
                      ? 'text-[#0B192C] font-semibold'
                      : 'text-slate-600 hover:text-[#0B192C]'
                  }`}
                >
                  {isLocked && (
                    <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                  )}
                  <span>{item.label}</span>
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-full"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="shrink-0 flex items-center">
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="min-h-[36px] px-3 text-xs font-semibold text-slate-600 hover:text-[#0B192C] whitespace-nowrap"
              >
                Çıkış
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
