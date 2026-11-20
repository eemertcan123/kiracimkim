import {
  Camera,
  FileCheck2,
  Award,
  Building2,
  ReceiptText,
  UserSearch,
  Lock,
} from 'lucide-react';
import { ScreenId, UserRole } from '../types/kiracimkim';

interface MobileTabBarProps {
  activeScreen: ScreenId;
  role: UserRole;
  lockedScreens?: ScreenId[];
  onNavigate: (screen: ScreenId) => void;
}

const TENANT_TABS: { id: ScreenId; label: string; icon: typeof Camera }[] = [
  { id: 'handover', label: 'Teslim Tutanağı', icon: Camera },
  { id: 'receipts', label: 'Kira Ödemeleri', icon: FileCheck2 },
  { id: 'trust-card', label: 'Güven Karnem', icon: Award },
];

const LANDLORD_TABS: { id: ScreenId; label: string; icon: typeof Building2 }[] = [
  { id: 'landlord-candidates', label: 'Aday & Ref.', icon: UserSearch },
  { id: 'landlord-handover', label: 'Mülk & Tutanak', icon: Building2 },
  { id: 'landlord-payments', label: 'Ödemeler', icon: ReceiptText },
];

export function MobileTabBar({
  activeScreen,
  role,
  lockedScreens = [],
  onNavigate,
}: MobileTabBarProps) {
  const tabs = role === 'landlord' ? LANDLORD_TABS : TENANT_TABS;

  return (
    <nav
      aria-label="Mobil ekran navigasyonu"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 pb-safe"
    >
      <div className="grid grid-cols-3 items-center h-16">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isLocked = lockedScreens.includes(tab.id);
          const isActive = activeScreen === tab.id && !isLocked;
          return (
            <button
              key={tab.id}
              type="button"
              disabled={isLocked}
              onClick={() => {
                if (!isLocked) onNavigate(tab.id);
              }}
              aria-current={isActive ? 'page' : undefined}
              aria-disabled={isLocked}
              className={`relative flex flex-col items-center justify-center min-h-[44px] h-full px-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600 ${
                isLocked
                  ? 'text-slate-300 cursor-not-allowed opacity-70'
                  : isActive
                  ? 'text-emerald-700'
                  : 'text-slate-500 hover:text-[#0B192C]'
              }`}
            >
              {isActive && (
                <span
                  className="absolute top-0 w-8 h-0.5 bg-emerald-600 rounded-b-full"
                  aria-hidden="true"
                />
              )}
              <div className="relative">
                <Icon
                  className={`w-[22px] h-[22px] shrink-0 ${
                    isLocked
                      ? 'text-slate-300 stroke-[1.75]'
                      : isActive
                      ? 'text-emerald-600 stroke-[2.25]'
                      : 'stroke-[1.75]'
                  }`}
                  aria-hidden="true"
                />
                {isLocked && (
                  <Lock
                    className="w-3 h-3 text-slate-400 absolute -top-1 -right-1.5 bg-white rounded-full p-0.5"
                    aria-hidden="true"
                  />
                )}
              </div>
              <span
                className={`text-[11px] tracking-tight mt-1 whitespace-nowrap ${
                  isLocked
                    ? 'font-medium text-slate-400'
                    : isActive
                    ? 'font-semibold text-[#0B192C]'
                    : 'font-medium'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
