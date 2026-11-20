import { ShieldCheck, ArrowLeftRight, Lock } from 'lucide-react';
import { ScreenId, UserRole } from '../types/kiracimkim';

interface TopNavProps {
  activeScreen: ScreenId;
  role: UserRole;
  lockedScreens?: ScreenId[];
  onNavigate: (screen: ScreenId) => void;
  onSwitchRole: (nextRole: UserRole) => void;
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
  onSwitchRole,
  onLogout,
}: TopNavProps) {
  const navItems = role === 'landlord' ? LANDLORD_NAV_ITEMS : TENANT_NAV_ITEMS;
  const currentMobileTitle =
    activeScreen === 'login'
      ? 'Güvenli Giriş'
      : navItems.find((item) => item.id === activeScreen)?.mobileTitle ?? 'Kiracımkim';

  const handleToggleRole = () => {
    onSwitchRole(role === 'tenant' ? 'landlord' : 'tenant');
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Mobile Compact Top App Bar (52px) */}
        <div className="flex lg:hidden items-center justify-between h-[52px] gap-2">
          <button
            type="button"
            onClick={() => onNavigate('login')}
            className="flex items-center gap-1.5 text-[#0B192C] font-display font-bold text-base tracking-tight whitespace-nowrap shrink-0 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded-lg px-1"
          >
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden="true" />
            <span>Kiracımkim</span>
          </button>

          <span className="text-xs sm:text-sm font-semibold text-slate-700 truncate">
            {currentMobileTitle}
          </span>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="min-h-[44px] px-2 text-xs font-semibold text-slate-600 hover:text-[#0B192C] whitespace-nowrap shrink-0"
            >
              Çıkış
            </button>
          )}
          <button
            type="button"
            onClick={handleToggleRole}
            aria-label="Rol Değiştir (Kiracı / Ev Sahibi)"
            className="min-h-[44px] px-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B192C] bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
            <span>{role === 'tenant' ? 'Ev Sahibi' : 'Kiracı'}</span>
          </button>
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

          {/* Zone 3: Test Role Switcher (Kiracı / Ev Sahibi) */}
          <div className="shrink-0 flex items-center gap-2">
            <span className="text-[11px] font-medium text-slate-500 whitespace-nowrap">
              Rol Değiştir
            </span>
            <div
              className="inline-flex items-center p-1 bg-slate-100 border border-slate-200/80 rounded-xl"
              role="group"
              aria-label="Rol Değiştir (Kiracı / Ev Sahibi)"
            >
              <button
                type="button"
                onClick={() => onSwitchRole('tenant')}
                aria-pressed={role === 'tenant'}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  role === 'tenant'
                    ? 'bg-[#0B192C] text-white shadow-sm'
                    : 'text-slate-600 hover:text-[#0B192C]'
                }`}
              >
                Kiracı
              </button>
              <button
                type="button"
                onClick={() => onSwitchRole('landlord')}
                aria-pressed={role === 'landlord'}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  role === 'landlord'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-[#0B192C]'
                }`}
              >
                Ev Sahibi
              </button>
            </div>
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
