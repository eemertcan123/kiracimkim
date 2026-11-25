import { MessageCircle, Phone } from 'lucide-react';
import { formatTurkishMobileDisplay, parseTurkishMobile, telHref, whatsappHref } from '../lib/phone';

interface PhoneFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  hint?: string;
  error?: string;
  tone?: 'light' | 'onDark';
  required?: boolean;
}

export function PhoneField({
  id,
  value,
  onChange,
  label = 'Cep telefonu',
  hint = 'Numaranız yalnızca kiralama onaylandıktan sonra karşı tarafa görünür.',
  error,
  tone = 'light',
  required = true,
}: PhoneFieldProps) {
  const onDark = tone === 'onDark';
  return (
    <div>
      <label
        htmlFor={id}
        className={`mb-1.5 block text-sm font-medium ${onDark ? 'text-white' : 'text-slate-700'}`}
      >
        {label}
      </label>
      <div className="relative">
        <Phone
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="05XX XXX XX XX"
          className="w-full min-h-[48px] rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3.5 text-sm text-[#0B192C] placeholder:text-slate-400 transition-colors focus:border-transparent focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
        />
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs font-medium text-rose-200">
          <span className={onDark ? '' : 'text-rose-700'}>{error}</span>
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className={`mt-1.5 text-xs leading-relaxed ${onDark ? 'text-slate-300' : 'text-slate-500'}`}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}

interface ContactActionsProps {
  phone: string;
  tone?: 'light' | 'dark';
}

export function ContactActions({ phone, tone = 'light' }: ContactActionsProps) {
  const parsed = parseTurkishMobile(phone);
  const call = telHref(phone);
  const whatsapp = whatsappHref(phone);
  if (!parsed.ok || !call || !whatsapp) return null;

  const display = formatTurkishMobileDisplay(parsed.value.national);
  const linkClass =
    'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 sm:text-sm';
  const callClass =
    tone === 'dark'
      ? 'border-white/25 bg-white/10 text-white hover:bg-white/15'
      : 'border-slate-200 bg-white text-[#0B192C] hover:bg-slate-50';
  const whatsappClass =
    tone === 'dark'
      ? 'border-emerald-300/40 bg-emerald-400/15 text-emerald-50 hover:bg-emerald-400/25'
      : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={`font-mono-tabular text-sm font-semibold ${tone === 'dark' ? 'text-white' : 'text-[#0B192C]'}`}
      >
        {display}
      </span>
      <a href={call} className={`${linkClass} ${callClass}`} aria-label={`${display} numarasını ara`}>
        <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
        Ara
      </a>
      <a
        href={whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        className={`${linkClass} ${whatsappClass}`}
        aria-label={`${display} numarasına WhatsApp mesajı gönder`}
      >
        <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
        WhatsApp
      </a>
    </div>
  );
}
