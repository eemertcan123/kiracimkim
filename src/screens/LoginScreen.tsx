import { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Building2,
  UserCheck,
  Lock,
  Mail,
  KeyRound,
  User,
} from 'lucide-react';
import { ResilientImage } from '../components/ResilientImage';
import { UserRole, UserSession } from '../types/kiracimkim';

interface LoginScreenProps {
  session: UserSession;
  onLogin: (email: string, password: string, role: UserRole) => Promise<void>;
  onRegister: (input: {
    fullName: string;
    email: string;
    password: string;
    role: UserRole;
  }) => Promise<void>;
  onContinue: () => void;
}

export function LoginScreen({
  session,
  onLogin,
  onRegister,
  onContinue,
}: LoginScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<UserRole>('tenant');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (mode === 'register' && fullName.trim().length < 3) {
      setErrorMsg('Lütfen ad soyad bilginizi girin.');
      return;
    }
    if (!email.includes('@') || !email.includes('.')) {
      setErrorMsg('Lütfen geçerli bir e-posta adresi girin.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Şifre en az 6 karakter olmalıdır.');
      return;
    }
    setErrorMsg('');
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await onLogin(email, password, role);
      } else {
        await onRegister({ fullName, email, password, role });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'İşlem tamamlanamadı.';
      setErrorMsg(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
        {/* Left Column: Deep Navy Trust & Authority Anchor */}
        <div className="lg:col-span-6 bg-[#0B192C] text-white rounded-2xl lg:rounded-3xl overflow-hidden flex flex-col justify-between p-6 sm:p-8 lg:p-10">
          <div>
            <p className="text-xs sm:text-sm font-medium text-emerald-400 tracking-wide">
              Doğrulanmış Kira İlişkisi Platformu
            </p>

            <h1 className="mt-3 text-2xl sm:text-4xl font-display font-bold leading-[1.18] tracking-tight text-white [text-wrap:balance]">
              Kira İlişkinizi Şeffaf Belgelerle Güvenceye Alın
            </h1>

            <p className="mt-4 text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl">
              Teslim anındaki oda fotoğraflarını zaman damgasıyla mühürleyin, aylık kira
              dekontlarınızı OCR ve hash özetiyle doğrulayın ve doğrulanmış Güven Karnenizi
              oluşturun.
            </p>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-white/10">
              <div>
                <p className="text-xs text-slate-400">Zaman Damgası</p>
                <p className="mt-1 text-sm font-semibold text-white">Fotoğraflı Tutanak</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">OCR &amp; Hash Özeti</p>
                <p className="mt-1 text-sm font-semibold text-white">Ev Sahibi Onaylı Dekont</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Taşınabilir İtibar</p>
                <p className="mt-1 text-sm font-semibold text-emerald-400">Güven Karnesi</p>
              </div>
            </div>
          </div>

          <div className="relative mt-8 rounded-2xl overflow-hidden aspect-[16/9] border border-white/10">
            <ResilientImage
              src="/src/assets/images/hero_trust_residence_1794831351232.jpg"
              alt="İstanbul'da modern, gün ışığı alan daire iç mekanı"
              fallbackLabel="Doğrulanmış Konut Kaydı"
              className="w-full h-full object-cover"
            />
            <div
              className="absolute inset-0 bg-gradient-to-t from-[#0B192C]/90 via-[#0B192C]/35 to-transparent"
              aria-hidden="true"
            />
            <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-200">
              <span className="font-medium text-white">
                Kadıköy / Moda · Örnek Mülk Dosyası
              </span>
              <span className="font-mono-tabular text-emerald-300">
                KVKK Maskeli · OTP Mühürlü
              </span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 bg-white border border-slate-200/90 rounded-2xl lg:rounded-3xl p-6 sm:p-8 lg:p-10 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-display font-bold text-[#0B192C]">
                  {mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {mode === 'login'
                    ? 'E-posta ve şifrenizle hesabınıza girin.'
                    : 'Ad soyad, e-posta ve şifre ile hesabınızı oluşturun.'}
                </p>
              </div>
              {session.authenticated && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                  <span>Oturum Açık</span>
                </span>
              )}
            </div>

            <div
              className="mt-6 grid grid-cols-2 gap-1.5 p-1.5 bg-slate-100 rounded-xl"
              role="tablist"
              aria-label="Giriş veya kayıt"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'login'}
                onClick={() => {
                  setMode('login');
                  setErrorMsg('');
                }}
                className={`min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                  mode === 'login'
                    ? 'bg-[#0B192C] text-white shadow-sm'
                    : 'text-slate-600 hover:text-[#0B192C]'
                }`}
              >
                Giriş Yap
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'register'}
                onClick={() => {
                  setMode('register');
                  setErrorMsg('');
                }}
                className={`min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                  mode === 'register'
                    ? 'bg-[#0B192C] text-white shadow-sm'
                    : 'text-slate-600 hover:text-[#0B192C]'
                }`}
              >
                Kayıt Ol
              </button>
            </div>

            {mode === 'register' && (
              <div
                className="mt-4 grid grid-cols-2 gap-1.5 p-1.5 bg-slate-100 rounded-xl"
                role="tablist"
                aria-label="Kullanıcı rolü"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={role === 'tenant'}
                  onClick={() => setRole('tenant')}
                  className={`min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                    role === 'tenant'
                      ? 'bg-[#0B192C] text-white shadow-sm'
                      : 'text-slate-600 hover:text-[#0B192C]'
                  }`}
                >
                  <UserCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Kiracı</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={role === 'landlord'}
                  onClick={() => setRole('landlord')}
                  className={`min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                    role === 'landlord'
                      ? 'bg-[#0B192C] text-white shadow-sm'
                      : 'text-slate-600 hover:text-[#0B192C]'
                  }`}
                >
                  <Building2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>Ev Sahibi</span>
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {mode === 'register' && (
                <div>
                  <label
                    htmlFor="register-name"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Ad Soyad
                  </label>
                  <div className="relative">
                    <User
                      className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      id="register-name"
                      type="text"
                      autoComplete="name"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      placeholder="Ad Soyad"
                      className="w-full min-h-[48px] pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-[#0B192C] placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-colors"
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="auth-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                  E-posta
                </label>
                <div className="relative">
                  <Mail
                    className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="ornek@posta.com"
                    className="w-full min-h-[48px] pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-[#0B192C] placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-colors"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="auth-password"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Şifre
                </label>
                <div className="relative">
                  <KeyRound
                    className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="auth-password"
                    type="password"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="En az 6 karakter"
                    className="w-full min-h-[48px] pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-[#0B192C] placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-colors"
                  />
                </div>
              </div>

              {errorMsg && (
                <p
                  role="alert"
                  className="text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5"
                >
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[48px] px-5 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70 active:scale-[0.99] text-white font-semibold text-sm rounded-xl transition-all flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-emerald-600"
              >
                <span>
                  {submitting
                    ? mode === 'login'
                      ? 'Giriş yapılıyor…'
                      : 'Kaydediliyor…'
                    : mode === 'login'
                    ? 'Giriş Yap'
                    : 'Kayıt Ol'}
                </span>
                <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              </button>

              {session.authenticated && (
                <button
                  type="button"
                  onClick={onContinue}
                  className="w-full min-h-[46px] px-4 py-2.5 bg-[#0B192C] hover:bg-[#132946] text-white font-medium text-sm rounded-xl transition-colors"
                >
                  Panele Dön
                </button>
              )}
            </form>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-100 flex items-start gap-2.5 text-xs text-slate-500 leading-relaxed">
            <Lock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              Verileriniz 6698 sayılı KVKK kapsamında şifrelenerek saklanır. Ad soyad ve açık adres
              bilgileriniz profilinizdeki gizlilik anahtarıyla maskelenebilir.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
