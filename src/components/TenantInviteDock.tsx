import { useState } from 'react';

interface TenantInviteDockProps {
  onSubmitCode: (code: string) => void;
  hideCodeForm?: boolean;
}

export function TenantInviteDock({
  onSubmitCode,
  hideCodeForm = false,
}: TenantInviteDockProps) {
  const [code, setCode] = useState('');

  if (hideCodeForm) return null;

  return (
    <div className="bg-white border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (code.trim().length < 6) return;
            onSubmitCode(code);
            setCode('');
          }}
          className="flex flex-col lg:flex-row lg:items-center gap-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 shrink-0">
            <label htmlFor="tenant-invite-code" className="text-xs font-semibold text-[#0B192C] shrink-0">
              Davet Kodu Gir
            </label>
            <input
              id="tenant-invite-code"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6 haneli kod"
              className="w-full sm:w-40 min-h-[42px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono-tabular tracking-[0.2em] text-[#0B192C] focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
            <button
              type="submit"
              disabled={code.length !== 6}
              className="min-h-[42px] px-4 py-2 bg-[#0B192C] hover:bg-[#132946] disabled:opacity-50 text-white text-sm font-semibold rounded-xl whitespace-nowrap"
            >
              Kodu Onayla
            </button>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Ev sahibiniz sizi mülküne kiracı olarak eklediğinde size ileteceği 6 haneli davet kodunu
            buraya girerek kiralama ve teslim tutanağı sürecini başlatın.
          </p>
        </form>
      </div>
    </div>
  );
}
