export interface TurkishMobile {
  national: string;
  e164: string;
  whatsapp: string;
}

const INVALID_PHONE = 'Geçerli bir cep telefonu girin. Örnek: 05XX XXX XX XX';

export function parseTurkishMobile(
  input: string
): { ok: true; value: TurkishMobile } | { ok: false; message: string } {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, message: 'Telefon numarası gerekli.' };

  let digits = trimmed.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (digits.startsWith('00')) digits = digits.slice(2);
  digits = digits.replace(/\D/g, '');

  let national = '';
  if (digits.length === 12 && digits.startsWith('90')) national = `0${digits.slice(2)}`;
  else if (digits.length === 11 && digits.startsWith('0')) national = digits;
  else if (digits.length === 10 && digits.startsWith('5')) national = `0${digits}`;

  if (!/^05\d{9}$/.test(national)) return { ok: false, message: INVALID_PHONE };

  const subscriber = national.slice(1);
  return {
    ok: true,
    value: {
      national,
      e164: `+90${subscriber}`,
      whatsapp: `90${subscriber}`,
    },
  };
}

export function formatTurkishMobileDisplay(input: string): string {
  const parsed = parseTurkishMobile(input);
  if (!parsed.ok) return input.trim();
  const national = parsed.value.national;
  return `${national.slice(0, 4)} ${national.slice(4, 7)} ${national.slice(7, 9)} ${national.slice(9, 11)}`;
}

export function telHref(input: string): string | null {
  const parsed = parseTurkishMobile(input);
  return parsed.ok ? `tel:${parsed.value.e164}` : null;
}

export function whatsappHref(input: string): string | null {
  const parsed = parseTurkishMobile(input);
  return parsed.ok ? `https://wa.me/${parsed.value.whatsapp}` : null;
}
