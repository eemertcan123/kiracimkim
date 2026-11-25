import { useEffect, useState } from 'react';
import { PhoneField } from './PhoneContact';
import { formatTurkishMobileDisplay, parseTurkishMobile } from '../lib/phone';

interface TenantInviteDockProps {
  profilePhone: string;
  onSubmitCode: (code: string, phone: string) => void;
  hideCodeForm?: boolean;
}

export function TenantInviteDock({
  profilePhone,
  onSubmitCode,
  hideCodeForm = false,
}: TenantInviteDockProps) {
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState(() =>
    profilePhone ? formatTurkishMobileDisplay(profilePhone) : ''
  );
  const [phoneError, setPhoneError] = useState('');

  useEffect(() => {
    if (!profilePhone) return;
    setPhone((current) => (current.trim() ? current : formatTurkishMobileDisplay(profilePhone)));
  }, [profilePhone]);

  if (hideCodeForm) return null;

  return (
    <div className="bg-white border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const parsed = parseTurkishMobile(phone);
            if (!parsed.ok) {
              setPhoneError(parsed.message);
              return;
            }
            if (code.trim().length < 6) return;
            setPhoneError('');
            onSubmitCode(code, parsed.value.national);
            setCode('');
          }}
          className="flex flex-col gap-3 lg:flex-row lg:items-end"
        >
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <PhoneField
              id="tenant-invite-phone"
              value={phone}
              onChange={(value) => {
                setPhone(value);
                setPhoneError('');
              }}
              error={phoneError}
              hint={profilePhone ? 'Profilinizde kayıtlı numara. Kabul ederken kaydedilir.' : undefined}
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0">
                <label htmlFor="tenant-invite-code" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Davet kodu
                </label>
                <input
                  id="tenant-invite-code"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6 haneli kod"
                  className="w-full min-h-[48px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono-tabular tracking-[0.2em] text-[#0B192C] focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 sm:w-40"
                />
              </div>
              <button
                type="submit"
                disabled={code.length !== 6}
                className="min-h-[48px] whitespace-nowrap rounded-xl bg-[#0B192C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#132946] disabled:opacity-50"
              >
                Kodu Onayla
              </button>
            </div>
          </div>
          <p className="text-xs leading-relaxed text-slate-600 sm:text-sm lg:max-w-sm">
            Ev sahibiniz sizi mülküne kiracı olarak eklediğinde size ileteceği 6 haneli davet kodunu
            buraya girerek kiralama ve teslim tutanağı sürecini başlatın.
          </p>
        </form>
      </div>
    </div>
  );
}
