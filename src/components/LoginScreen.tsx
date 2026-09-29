import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Lock,
  Mail,
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff,
  Train,
  ArrowRight,
  LogIn,
  KeyRound,
} from 'lucide-react';

interface LoginScreenProps {
  onSuccessToast?: (msg: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onSuccessToast }) => {
  const { login } = useAuth();

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Shared UI states
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) {
      setError({ message: 'Lütfen e-posta adresinizi ve şifrenizi giriniz.' });
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await login(loginEmail.trim(), loginPassword);
      onSuccessToast?.('Hoş geldiniz! Demiryolu KM Harita Sistemi yüklendi.');
    } catch (err: any) {
      setError({
        message: err.message || 'Giriş yapılamadı. Lütfen e-posta veya şifrenizi kontrol edin.',
        code: err.code,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden font-sans select-none text-slate-100">
      {/* Ambient background decoration */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-sky-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 shadow-xl shadow-sky-600/30 border border-sky-400/30 mb-1">
            <Train className="w-9 h-9 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center justify-center gap-2">
              <span>TCDD KM TAKİP</span>
            </h1>
            <p className="text-xs font-semibold text-sky-400 tracking-wider uppercase mt-0.5">
              Demiryolu Kilometre ve Tesis Yönetim Portalı
            </p>
          </div>
          <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
            Sisteme erişebilmek için yetkili kullanıcı e-postanız ve şifrenizle giriş yapınız.
          </p>
        </div>

        {/* Card Box */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-5 sm:p-6 relative">
          {/* Header Title Badge */}
          <div className="flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold rounded-xl bg-slate-950/90 border border-slate-800 text-sky-400 mb-5">
            <LogIn className="w-4 h-4 text-sky-400" />
            <span>Yetkili Personel Girişi</span>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-4 p-3 bg-red-950/80 border border-red-800 rounded-xl flex items-start gap-2.5 text-red-200 text-xs animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 leading-snug">{error.message}</div>
            </div>
          )}

          {/* LOGIN FORM */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                E-posta Adresi
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="login-email-input"
                  type="email"
                  required
                  autoFocus
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="ornek@tcdd.gov.tr veya mailiniz"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Şifre
                </label>
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  <KeyRound className="w-3 h-3 text-slate-500" />
                  <span>Şifreli Giriş</span>
                </span>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="login-password-input"
                  type={showLoginPassword ? 'text' : 'password'}
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1 cursor-pointer"
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-500 hover:to-sky-400 text-white font-bold text-sm py-2.5 px-4 rounded-xl shadow-lg shadow-sky-600/30 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Haritaya Giriş Yap</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Admin Notice */}
          <div className="mt-4 p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-xl text-center">
            <p className="text-[11px] text-slate-400">
              Yeni kullanıcı hesapları güvenlik gerekçesiyle yalnızca <strong className="text-amber-400 font-semibold">Sistem Yöneticileri</strong> tarafından oluşturulabilir.
            </p>
          </div>

          {/* Security Banner Note & Developer Signature */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                TCDD Demiryolu hat koordinatları ve saha kayıtları güvenli şifreleme altındadır.
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/50">
              <span className="font-semibold text-slate-400">Geliştirici: <strong className="text-sky-400">712 Şefliği</strong></span>
              <span className="text-slate-500">v2.5 Özel Kurumsal Sürüm</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
