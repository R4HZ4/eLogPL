import {
  Activity,
  Clock,
  CreditCard,
  Eye,
  EyeOff,
  Info,
  Lock,
  Shield,
  ShieldCheck,
} from 'lucide-react';
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { normalizeNoKp } from '../utils/trainingRules';

type Language = 'ms' | 'en';

const COPY = {
  ms: {
    eyebrowLeft: 'PORTAL AKSES SISTEM PENGURUSAN LATIHAN',
    orgTitle: 'PERBADANAN LABUAN',
    bullets: [
      'Peringatan: Pastikan log keluar selepas selesai.',
      'Setiap pegawai yang telah menghadiri kursus DIKEHENDAKI memaklumkan secara online kehadiran mereka ke setiap jenis kursus tersebut kepada Unit Latihan, Jabatan Pengurusan Sumber Manusia. Anda boleh menghantar makluman kursus yang telah dihadiri melalui Login ke dalam sistem dan membuat Hantar Makluman.',
      'Semua makluman kursus akan diterima oleh Unit Latihan untuk disahkan. Anda boleh melihat laporan JUMLAH HARI dan JAM bagi setiap jenis kursus yang dihadiri yang DISAHKAN oleh Unit Latihan. Status lain juga boleh dilihat di laporan yang disediakan.',
    ],
    eyebrowRight: 'LOG MASUK SISTEM',
    welcomeTitle: 'Selamat Datang',
    welcomeSubtitle:
      'Masukkan No. Kad Pengenalan serta kata laluan untuk meneruskan akses eLogPL.',
    staffTab: 'Log Masuk Kakitangan',
    adminTab: 'Pentadbir Sistem',
    adminNoticeTitle: 'Akses Pentadbir Sistem',
    adminNoticeBody:
      'Log masuk menggunakan No. K/P 000000-00-0000 (atau taip 0) untuk melihat, menambah, menyunting dan memadam rekod kakitangan serta log kursus.',
    icLabelStaff: 'No. Kad Pengenalan (No. K/P)',
    icLabelAdmin: 'No. K/P Pentadbir Sistem (12 digit atau 0)',
    icPlaceholderStaff: 'cth. 680807-12-5341',
    icPlaceholderAdmin: '000000-00-0000 atau 0',
    passwordLabel: 'Kata Laluan',
    passwordPlaceholderStaff: 'Masukkan kata laluan',
    passwordPlaceholderAdmin: 'Masukkan kata laluan pentadbir',
    showPwd: 'Tunjuk kata laluan',
    hidePwd: 'Sembunyikan kata laluan',
    forgotPwd: 'Lupa Kata Laluan?',
    forgotNotice:
      'Sila hubungi Pentadbir Sistem atau Pegawai Latihan Bahagian (PLB) PSM untuk bantuan tetapan semula kata laluan akaun anda.',
    submitLoading: 'Sedang mengesahkan...',
    submitStaff: 'Log Masuk',
    submitAdmin: 'Log Masuk Pentadbir Sistem',
    quickFillLabel: 'Isi Pantas Akaun Demo',
    demoAdmin: 'Pentadbir Sistem',
    demoPlb: 'PLB / PSM (Mazalan)',
    demoStaff: 'Pegawai (A. Majalan)',
    footer: '© 2026 eLogPL · Perbadanan Labuan. Hak cipta terpelihara.',
    genericError: 'Berlaku ralat semasa log masuk.',
  },
  en: {
    eyebrowLeft: 'TRAINING MANAGEMENT SYSTEM ACCESS PORTAL',
    orgTitle: 'PERBADANAN LABUAN',
    bullets: [
      'Reminder: Please ensure you log out after finishing.',
      'Every officer who has attended a course is REQUIRED to notify their attendance online for each course type to the Training Unit, Human Resource Management Department. You may submit course attendance notifications by logging into the system and selecting Submit Notification.',
      'All course notifications will be received by the Training Unit for verification. You can view the TOTAL DAYS and HOURS report for each attended course type VERIFIED by the Training Unit, along with other status details in the provided reports.',
    ],
    eyebrowRight: 'SYSTEM LOGIN',
    welcomeTitle: 'Welcome Back',
    welcomeSubtitle:
      'Enter your IC Number and password to continue accessing eLogPL.',
    staffTab: 'Staff Login',
    adminTab: 'System Admin',
    adminNoticeTitle: 'System Administrator Access',
    adminNoticeBody:
      'Sign in with IC No. 000000-00-0000 (or type 0) to view, add, edit, and delete staff records and training logs.',
    icLabelStaff: 'Identity Card No. (No. K/P)',
    icLabelAdmin: 'System Admin IC No. (12 digits or 0)',
    icPlaceholderStaff: 'e.g. 680807-12-5341',
    icPlaceholderAdmin: '000000-00-0000 or 0',
    passwordLabel: 'Password',
    passwordPlaceholderStaff: 'Enter your password',
    passwordPlaceholderAdmin: 'Enter administrator password',
    showPwd: 'Show password',
    hidePwd: 'Hide password',
    forgotPwd: 'Forgot Password?',
    forgotNotice:
      'Please contact the System Administrator or HR Training Liaison Officer (PLB) for password reset assistance.',
    submitLoading: 'Verifying...',
    submitStaff: 'Log Masuk / Sign In',
    submitAdmin: 'Sign In as System Admin',
    quickFillLabel: 'Quick-Fill Demo Accounts',
    demoAdmin: 'System Admin',
    demoPlb: 'PLB / HR (Mazalan)',
    demoStaff: 'Officer (A. Majalan)',
    footer: '© 2026 eLogPL · Perbadanan Labuan. All rights reserved.',
    genericError: 'An error occurred during sign in.',
  },
} as const;

export function LoginView() {
  const { login } = useAuth();

  const [lang, setLang] = useState<Language>('ms');
  const [mode, setMode] = useState<'staff' | 'admin'>('staff');
  const [noKp, setNoKp] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotHelp, setShowForgotHelp] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = COPY[lang];

  const switchMode = (nextMode: 'staff' | 'admin') => {
    setMode(nextMode);
    setError(null);
    setPassword('');
    setNoKp(nextMode === 'admin' ? '000000-00-0000' : '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(noKp, password, mode);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.genericError);
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemoAccount = (
    targetMode: 'staff' | 'admin',
    demoNoKp: string,
    demoPassword: string
  ) => {
    setMode(targetMode);
    setNoKp(demoNoKp);
    setPassword(demoPassword);
    setError(null);
  };

  return (
    <div className="bg-login-grid min-h-screen flex items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
      <div className="relative w-full max-w-[1040px]">
        {/* Floating BM | EN language switcher */}
        <div
          role="group"
          aria-label="Language selector"
          className="absolute right-4 top-4 z-20 inline-flex items-center rounded-full border border-slate-200/90 bg-white/95 p-1 shadow-[0_8px_20px_-6px_rgba(15,23,42,0.18)] backdrop-blur-sm sm:right-5 sm:top-5 lg:-right-3 lg:-top-3"
        >
          <button
            type="button"
            onClick={() => setLang('ms')}
            aria-pressed={lang === 'ms'}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              lang === 'ms'
                ? 'bg-[#0B3675] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            BM
          </button>
          <button
            type="button"
            onClick={() => setLang('en')}
            aria-pressed={lang === 'en'}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              lang === 'en'
                ? 'bg-[#0B3675] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            EN
          </button>
        </div>

        {/* Main Split Authentication Card */}
        <div className="grid grid-cols-1 overflow-hidden rounded-[28px] bg-white shadow-[0_24px_60px_-15px_rgba(11,39,86,0.18)] ring-1 ring-slate-200/70 lg:grid-cols-12">
          {/* Left Royal/Navy Brand & Security Panel */}
          <section className="relative flex flex-col justify-center overflow-hidden bg-gradient-to-br from-[#134B8E] via-[#0E3F7D] to-[#082E62] p-8 text-white sm:p-11 lg:col-span-6 lg:p-12">
            {/* Decorative translucent concentric ring accent matching reference */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full border-[28px] border-white/[0.06]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-10 -right-10 h-44 w-44 rounded-full border border-white/[0.06]"
            />

            <div className="relative z-10 space-y-8">
              {/* White Crest Badge */}
              <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-white p-2.5 shadow-[0_8px_24px_rgba(4,18,45,0.22)]">
                <img
                  src="/assets/aistudio/perbadanan-labuan-seeklogo_75dabda4.png"
                  alt="Logo Perbadanan Labuan"
                  className="h-full w-full object-contain"
                />
              </div>

              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-200/85">
                  {t.eyebrowLeft}
                </p>
                <h1 className="font-display text-2xl font-extrabold tracking-tight text-white sm:text-[30px]">
                  {t.orgTitle}
                </h1>
              </div>

              <div className="border-t border-white/15 pt-7">
                <ul className="space-y-4 text-[13px] leading-relaxed text-blue-100/90">
                  <li className="flex items-start gap-3">
                    <Shield className="mt-0.5 h-4 w-4 shrink-0 text-blue-200/85" />
                    <span>{t.bullets[0]}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Activity className="mt-0.5 h-4 w-4 shrink-0 text-blue-200/85" />
                    <span>{t.bullets[1]}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-blue-200/85" />
                    <span>{t.bullets[2]}</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Right Form Panel */}
          <section className="flex flex-col justify-center bg-white p-7 sm:p-11 lg:col-span-6 lg:px-12 lg:py-11">
            <div className="mx-auto w-full max-w-md space-y-5">
              {/* Header */}
              <div className="pr-16 sm:pr-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  {t.eyebrowRight}
                </p>
                <h2 className="mt-1 font-display text-[28px] font-bold tracking-tight text-slate-900 sm:text-[32px]">
                  {t.welcomeTitle}
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                  {t.welcomeSubtitle}
                </p>
              </div>

              {/* Staff / System Admin Mode Tabs */}
              <div
                role="tablist"
                aria-label="Mod Akses"
                className="grid grid-cols-2 rounded-xl border border-slate-200 bg-slate-100/80 p-1"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'staff'}
                  onClick={() => switchMode('staff')}
                  className={`rounded-lg py-2 px-3 text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                    mode === 'staff'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.staffTab}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'admin'}
                  onClick={() => switchMode('admin')}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2 px-3 text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                    mode === 'admin'
                      ? 'bg-[#0B3675] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>{t.adminTab}</span>
                </button>
              </div>

              {mode === 'admin' && (
                <div className="rounded-xl border border-blue-200/80 bg-blue-50/70 px-4 py-3 text-xs leading-relaxed text-slate-700">
                  <div className="font-semibold text-[#0B3675]">
                    {t.adminNoticeTitle}
                  </div>
                  <p className="mt-0.5 text-slate-600">{t.adminNoticeBody}</p>
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800"
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="auth-nokp"
                    className="mb-1.5 block text-xs font-semibold text-slate-800"
                  >
                    {mode === 'admin' ? t.icLabelAdmin : t.icLabelStaff}
                  </label>
                  <div className="relative">
                    <CreditCard className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="auth-nokp"
                      type="text"
                      required
                      value={noKp}
                      onChange={(e) => setNoKp(e.target.value)}
                      onBlur={() =>
                        setNoKp((prev) =>
                          prev.trim() === '0'
                            ? '000000-00-0000'
                            : normalizeNoKp(prev, true)
                        )
                      }
                      placeholder={
                        mode === 'admin'
                          ? t.icPlaceholderAdmin
                          : t.icPlaceholderStaff
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 font-mono text-sm tabular-nums text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:border-[#0E3F7D] focus:outline-none focus:ring-2 focus:ring-[#0E3F7D]/15"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="auth-password"
                    className="mb-1.5 block text-xs font-semibold text-slate-800"
                  >
                    {t.passwordLabel}
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={
                        mode === 'admin'
                          ? t.passwordPlaceholderAdmin
                          : t.passwordPlaceholderStaff
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-11 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0E3F7D] focus:outline-none focus:ring-2 focus:ring-[#0E3F7D]/15"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? t.hidePwd : t.showPwd}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-700"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setShowForgotHelp((prev) => !prev)}
                      className="text-xs font-semibold text-[#0B3675] hover:text-[#082552] transition-colors"
                    >
                      {t.forgotPwd}
                    </button>
                  </div>

                  {showForgotHelp && (
                    <div className="mt-2 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs leading-relaxed text-slate-600">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0B3675]" />
                      <span>{t.forgotNotice}</span>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-gradient-to-r from-[#0B2D63] via-[#0B3675] to-[#0C4492] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_10px_24px_-8px_rgba(11,54,117,0.55)] hover:brightness-110 disabled:opacity-50 transition-all whitespace-nowrap"
                >
                  {submitting
                    ? t.submitLoading
                    : mode === 'admin'
                    ? t.submitAdmin
                    : t.submitStaff}
                </button>
              </form>

              {/* Quick-fill Demo Accounts */}
              <div className="border-t border-slate-200/80 pt-4 space-y-2.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {t.quickFillLabel}
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() =>
                      fillDemoAccount('admin', '000000-00-0000', 'admin2026')
                    }
                    className="rounded-xl border border-[#0B3675]/25 bg-blue-50/50 px-3 py-2 text-left hover:bg-blue-50 transition-colors"
                  >
                    <div className="text-[11px] font-semibold text-[#0B3675] truncate">
                      {t.demoAdmin}
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] tabular-nums text-slate-700">
                      000000-00-0000
                    </div>
                    <div className="font-mono text-[10.5px] text-slate-500">
                      admin2026
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      fillDemoAccount('staff', '691018-12-5115', 'plb2026')
                    }
                    className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-left hover:bg-slate-100 transition-colors"
                  >
                    <div className="text-[11px] font-semibold text-slate-900 truncate">
                      {t.demoPlb}
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] tabular-nums text-slate-700">
                      691018-12-5115
                    </div>
                    <div className="font-mono text-[10.5px] text-slate-500">
                      plb2026
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      fillDemoAccount('staff', '680807-12-5341', 'elogpl2026')
                    }
                    className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-left hover:bg-slate-100 transition-colors"
                  >
                    <div className="text-[11px] font-semibold text-slate-900 truncate">
                      {t.demoStaff}
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] tabular-nums text-slate-700">
                      680807-12-5341
                    </div>
                    <div className="font-mono text-[10.5px] text-slate-500">
                      elogpl2026
                    </div>
                  </button>
                </div>
              </div>

              <p className="pt-1 text-center text-xs text-slate-400">
                {t.footer}
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
