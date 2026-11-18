import {
  BarChart3,
  BookOpen,
  ClipboardCheck,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminDashboardView } from './components/AdminDashboardView';
import { LogEntryModal } from './components/LogEntryModal';
import { LoginView } from './components/LoginView';
import { MyLogbookView } from './components/MyLogbookView';
import { PlbAnalyticsView } from './components/PlbAnalyticsView';
import { PlbAuditAndVerifyView } from './components/PlbAuditAndVerifyView';
import { PlbDirectoryView } from './components/PlbDirectoryView';
import { PolicyGuideView } from './components/PolicyGuideView';
import { TnaAndCertificateView } from './components/TnaAndCertificateView';
import { AuthProvider, useAuth } from './context/AuthContext';
import type {
  AnalyticsOverview,
  ComplianceSummaryRow,
  PlCourseCode,
  StaffAccount,
  StaffTnaRecord,
  TrainingLogEntry,
  UserRole,
  VerificationStatus,
} from './types/training';
import { buildStaticExportCsv } from './utils/staticFallbackApi';
import { computeStaffCompliance, stripNoKp } from './utils/trainingRules';

type AppView =
  | 'admin_dashboard'
  | 'analytics'
  | 'directory'
  | 'audit'
  | 'logbook'
  | 'tna'
  | 'guide';

function AuthenticatedWorkspace() {
  const { user, token, logout, apiFetch } = useAuth();
  const isAdmin = user?.peranan === 'admin';
  const isPrivileged = user?.peranan === 'admin' || user?.peranan === 'plb';

  const [tahun, setTahun] = useState<number>(2026);
  const [activeView, setActiveView] = useState<AppView>(() =>
    user?.peranan === 'admin'
      ? 'admin_dashboard'
      : user?.peranan === 'plb'
      ? 'analytics'
      : 'logbook'
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [modalTargetStaff, setModalTargetStaff] = useState<StaffAccount | null>(null);
  const [directoryDeptFilter, setDirectoryDeptFilter] = useState<string>('ALL');
  const [openAddStaffSignal, setOpenAddStaffSignal] = useState(0);

  const [personalLogs, setPersonalLogs] = useState<TrainingLogEntry[]>([]);
  const [pendingLogs, setPendingLogs] = useState<TrainingLogEntry[]>([]);
  const [tna, setTna] = useState<StaffTnaRecord>({
    staffNoKp: user?.noKp ?? '',
    tahun: 2026,
    sebabTidakMemenuhi: ['', '', ''],
    kursusDiperlukan: ['', '', '', '', ''],
    updatedAt: '',
  });
  const [staffList, setStaffList] = useState<StaffAccount[]>([]);
  const [complianceRows, setComplianceRows] = useState<ComplianceSummaryRow[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setActiveView((prev) => {
        const admin = user.peranan === 'admin';
        const priv = user.peranan === 'admin' || user.peranan === 'plb';
        if (!priv && (prev === 'admin_dashboard' || prev === 'analytics' || prev === 'directory' || prev === 'audit')) {
          return 'logbook';
        }
        if (!admin && prev === 'admin_dashboard') {
          return 'analytics';
        }
        return prev;
      });
    }
  }, [user]);

  const loadWorkspaceData = useCallback(async () => {
    if (!user) return;
    setLoadingData(true);
    setError(null);
    try {
      const [myLogsRes, tnaRes] = await Promise.all([
        apiFetch<{ logs: TrainingLogEntry[] }>(
          `/api/training-logs?tahun=${tahun}&staffId=${encodeURIComponent(user.id)}`
        ),
        apiFetch<{ tna: StaffTnaRecord }>(`/api/tna?tahun=${tahun}`),
      ]);
      setPersonalLogs(myLogsRes.logs);
      setTna(tnaRes.tna);

      if (user.peranan === 'admin' || user.peranan === 'plb') {
        const [staffRes, reportRes, analyticsRes, pendingRes] = await Promise.all([
          apiFetch<{ staff: StaffAccount[] }>('/api/staff'),
          apiFetch<{ rows: ComplianceSummaryRow[] }>(
            `/api/reports/compliance?tahun=${tahun}`
          ),
          apiFetch<AnalyticsOverview>(`/api/analytics/overview?tahun=${tahun}`),
          apiFetch<{ logs: TrainingLogEntry[] }>(
            `/api/training-logs?tahun=all&status=menunggu`
          ),
        ]);
        setStaffList(staffRes.staff);
        setComplianceRows(reportRes.rows);
        setAnalytics(analyticsRes);
        setPendingLogs(pendingRes.logs);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Gagal memuatkan data eLogPL.'
      );
    } finally {
      setLoadingData(false);
    }
  }, [user, tahun, apiFetch]);

  useEffect(() => {
    loadWorkspaceData();
  }, [loadWorkspaceData]);

  const personalCompliance = useMemo(() => {
    if (!user) {
      return computeStaffCompliance([], 12, tahun, 4);
    }
    const matchedLogs = personalLogs.filter(
      (l) =>
        (l.staffId ? l.staffId === user.id : stripNoKp(l.staffNoKp) === stripNoKp(user.noKp)) &&
        l.tahun === tahun
    );
    return computeStaffCompliance(
      matchedLogs,
      user.bulanBerkhidmat,
      tahun,
      user.sasaranTahun ?? 4
    );
  }, [personalLogs, user, tahun]);

  if (!user) return null;

  const handleDeleteLog = async (id: string) => {
    await apiFetch(`/api/training-logs/${id}`, { method: 'DELETE' });
    await loadWorkspaceData();
  };

  const handleSaveTna = async (payload: {
    tahun: number;
    sebabTidakMemenuhi: [string, string, string];
    kursusDiperlukan: [string, string, string, string, string];
  }) => {
    const res = await apiFetch<{ tna: StaffTnaRecord }>('/api/tna', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    setTna(res.tna);
  };

  const handleVerifyLog = async (
    logId: string,
    status: VerificationStatus,
    catatan?: string
  ) => {
    await apiFetch(`/api/training-logs/${logId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        statusPengesahan: status,
        catatanPengesah: catatan,
      }),
    });
    await loadWorkspaceData();
  };

  const handleFixLogCode = async (logId: string, code: PlCourseCode) => {
    await apiFetch(`/api/training-logs/${logId}`, {
      method: 'PATCH',
      body: JSON.stringify({ kodKursusPL: code }),
    });
    await loadWorkspaceData();
  };

  const handleFixStaffIc = async (staffId: string, newNoKp: string) => {
    await apiFetch(`/api/staff/${staffId}`, {
      method: 'PATCH',
      body: JSON.stringify({ noKp: newNoKp }),
    });
    await loadWorkspaceData();
  };

  const handleCreateStaff = async (payload: {
    noFail?: string;
    noKp: string;
    nama: string;
    jawatan: string;
    klasifikasi?: string;
    gred: string;
    tempatBertugas: string;
    tarafJawatan?: string;
    kategoriPerkhidmatan?: string;
    peranan: UserRole;
    bulanBerkhidmat: number;
    password: string;
  }) => {
    await apiFetch('/api/staff', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await loadWorkspaceData();
  };

  const handleUpdateStaff = async (
    staffId: string,
    payload: {
      noFail?: string;
      noKp?: string;
      nama?: string;
      jawatan?: string;
      klasifikasi?: string;
      gred?: string;
      tempatBertugas?: string;
      tarafJawatan?: string;
      kategoriPerkhidmatan?: string;
      gender?: 'L' | 'P' | '';
      bulanBerkhidmat?: number;
      sasaranTahun?: number;
      peranan?: UserRole;
      status?: 'aktif' | 'tidak_aktif';
      password?: string;
    }
  ) => {
    await apiFetch(`/api/staff/${staffId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    await loadWorkspaceData();
  };

  const handleDeleteStaff = async (staffId: string) => {
    await apiFetch(`/api/staff/${staffId}`, { method: 'DELETE' });
    await loadWorkspaceData();
  };

  const handleResetDatabase = async (action: 'reseed' | 'clear_all') => {
    await apiFetch('/api/staff/reset-database', {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
    await loadWorkspaceData();
  };

  const handleImportCsv = async (payload: {
    csvText: string;
    fileName: string;
    mode: 'merge' | 'replace';
  }) => {
    const res = await apiFetch<{ importedStaff: number; importedLogs: number }>(
      '/api/staff/import-csv',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    await loadWorkspaceData();
    return res;
  };

  const handleExportNormalized = async () => {
    const activeToken = token ?? window.localStorage.getItem('motac_logbook_token_v1');
    let blob: Blob | null = null;
    if (!activeToken?.startsWith('static.')) {
      const res = await fetch(`/api/reports/export-normalized?tahun=${tahun}`, {
        headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
      }).catch(() => null);
      if (res && res.ok && (res.headers.get('content-type') ?? '').includes('text/csv')) {
        blob = await res.blob();
      } else if (res && !res.ok && (res.headers.get('content-type') ?? '').includes('application/json')) {
        throw new Error('Gagal mengeksport laporan ternormal.');
      }
    }
    if (!blob) {
      const csvText = await buildStaticExportCsv(tahun);
      blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `elogpl-laporan-ternormal-${tahun}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const navItems: Array<{
    id: AppView;
    label: string;
    icon: typeof BookOpen;
    plbOnly?: boolean;
    adminOnly?: boolean;
  }> = [
    { id: 'admin_dashboard', label: 'Dashboard Pentadbir', icon: LayoutDashboard, adminOnly: true },
    { id: 'analytics', label: 'Analitik Organisasi', icon: BarChart3, plbOnly: true },
    { id: 'directory', label: 'Direktori Kakitangan', icon: Users, plbOnly: true },
    { id: 'audit', label: 'Audit & Pengesahan', icon: ShieldAlert, plbOnly: true },
    { id: 'logbook', label: 'Rekod Latihan Saya', icon: BookOpen },
    { id: 'tna', label: 'Pengesahan & TNA', icon: FileSpreadsheet },
    { id: 'guide', label: 'Panduan & Kod Kursus', icon: ClipboardCheck },
  ];

  const viewTitle: Record<AppView, string> = {
    admin_dashboard: 'Dashboard Pentadbir Sistem',
    analytics: 'Analitik Pematuhan Kursus & Latihan',
    directory: 'Direktori & Rekod Latihan Kakitangan',
    audit: 'Audit Kualiti Data & Semakan Pengesahan Unit Latihan PL',
    logbook: 'Rekod Latihan Saya',
    tna: 'Penyata Pengesahan & TNA',
    guide: 'Panduan Kod Kursus & Dokumen Rujukan',
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#0B1736] text-slate-100 border-r border-[#16254D]">
      <div className="flex h-16 items-center justify-between px-5 border-b border-white/10">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white p-1 shadow-xs">
            <img
              src="/assets/aistudio/perbadanan-labuan-seeklogo_75dabda4.png"
              alt="Logo Perbadanan Labuan"
              className="h-full w-full object-contain"
            />
          </div>
          <span className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0">
            eLogPL
          </span>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Tutup menu"
          className="lg:hidden rounded-md p-2 text-slate-300 hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav aria-label="Menu Utama" className="flex-1 px-3 py-5 space-y-1">
        {navItems
          .filter(
            (item) =>
              (!item.adminOnly || isAdmin) && (!item.plbOnly || isPrivileged)
          )
          .map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveView(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium tracking-[0.01em] transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-white/15 text-white'
                    : 'text-slate-300 hover:bg-white/8 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
      </nav>

      <div className="border-t border-white/10 p-4 space-y-3">
        <div>
          <div className="text-xs font-semibold text-white truncate tracking-[0.01em]">
            {user.nama}
          </div>
          <div className="mt-0.5 font-mono text-xs tabular-nums text-slate-300">
            {user.noKp}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-400">
            {user.peranan === 'admin'
              ? 'Pentadbir Sistem (Admin)'
              : user.peranan === 'plb'
              ? 'PLB / PSM'
              : 'Pegawai'}{' '}
            · {user.gred}
            {user.noFail ? ` · #${user.noFail}` : ''}
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-slate-100 hover:bg-white/10 transition-colors whitespace-nowrap"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Log Keluar</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside className="hidden lg:block w-64 shrink-0 print:hidden">
        {sidebarContent}
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden print:hidden">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-50 w-64 max-w-[80vw] h-full">
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 print:hidden">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Buka menu"
              className="lg:hidden rounded-md p-2 text-slate-600 hover:bg-slate-100"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="text-slate-500">eLogPL</span>
              <span className="text-slate-300" aria-hidden="true">/</span>
              <span className="font-semibold text-slate-900">
                {viewTitle[activeView]}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <select
              aria-label="Pilih tahun buku log"
              value={tahun}
              onChange={(e) => setTahun(Number(e.target.value))}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs tabular-nums text-slate-800 focus:border-[#0B1736] focus:outline-none"
            >
              {[2026, 2025, 2024].map((yr) => (
                <option key={yr} value={yr}>
                  Tahun {yr}
                </option>
              ))}
            </select>
          </div>
        </header>

        <main className="flex-1 px-6 py-6 max-w-[1280px] w-full mx-auto space-y-6">
          {error && (
            <div
              role="alert"
              className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                className="rounded p-1 hover:bg-red-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {loadingData ? (
            <div className="space-y-4">
              <div className="h-24 rounded-lg border border-slate-200 bg-white animate-pulse" />
              <div className="h-64 rounded-lg border border-slate-200 bg-white animate-pulse" />
            </div>
          ) : (
            <>
              {activeView === 'admin_dashboard' && isAdmin && analytics && (
                <AdminDashboardView
                  tahun={tahun}
                  analytics={analytics}
                  staffList={staffList}
                  complianceRows={complianceRows}
                  pendingLogs={pendingLogs}
                  onVerifyLog={handleVerifyLog}
                  onDeleteStaff={handleDeleteStaff}
                  onExportNormalized={handleExportNormalized}
                  onOpenAddLogForStaff={(staff) => {
                    setModalTargetStaff(staff);
                    setLogModalOpen(true);
                  }}
                  onJumpToDirectory={(opts) => {
                    if (opts?.department) {
                      setDirectoryDeptFilter(opts.department);
                    } else {
                      setDirectoryDeptFilter('ALL');
                    }
                    if (opts?.openAddStaff) {
                      setOpenAddStaffSignal((n) => n + 1);
                    }
                    setActiveView('directory');
                  }}
                  onJumpToView={(view) => setActiveView(view)}
                />
              )}

              {activeView === 'analytics' && isPrivileged && analytics && (
                <PlbAnalyticsView
                  analytics={analytics}
                  onJumpToDepartment={(jabatan) => {
                    setDirectoryDeptFilter(jabatan);
                    setActiveView('directory');
                  }}
                  onJumpToAudit={() => setActiveView('audit')}
                  onExportNormalized={handleExportNormalized}
                />
              )}

              {activeView === 'directory' && isPrivileged && (
                <PlbDirectoryView
                  tahun={tahun}
                  isAdmin={user.peranan === 'admin'}
                  complianceRows={complianceRows}
                  initialDepartmentFilter={directoryDeptFilter}
                  openAddStaffSignal={openAddStaffSignal}
                  onCreateStaff={handleCreateStaff}
                  onUpdateStaff={handleUpdateStaff}
                  onDeleteStaff={handleDeleteStaff}
                  onResetDatabase={handleResetDatabase}
                  onImportCsv={handleImportCsv}
                  onOpenAddLogForStaff={(staff) => {
                    setModalTargetStaff(staff);
                    setLogModalOpen(true);
                  }}
                  onDataChanged={loadWorkspaceData}
                  apiFetch={apiFetch}
                />
              )}

              {activeView === 'audit' && isPrivileged && analytics && (
                <PlbAuditAndVerifyView
                  analytics={analytics}
                  pendingLogs={pendingLogs}
                  staffList={staffList}
                  onVerifyLog={handleVerifyLog}
                  onFixLogCode={handleFixLogCode}
                  onFixStaffIc={handleFixStaffIc}
                />
              )}

              {activeView === 'logbook' && (
                <MyLogbookView
                  user={user}
                  tahun={tahun}
                  logs={personalLogs}
                  compliance={personalCompliance}
                  onAddLog={() => {
                    setModalTargetStaff(null);
                    setLogModalOpen(true);
                  }}
                  onDeleteLog={handleDeleteLog}
                />
              )}

              {activeView === 'tna' && (
                <TnaAndCertificateView
                  user={user}
                  tahun={tahun}
                  compliance={personalCompliance}
                  tna={tna}
                  onSaveTna={handleSaveTna}
                />
              )}

              {activeView === 'guide' && <PolicyGuideView />}
            </>
          )}
        </main>
      </div>

      <LogEntryModal
        isOpen={logModalOpen}
        tahun={tahun}
        targetStaffId={modalTargetStaff?.id}
        targetStaffName={modalTargetStaff?.nama}
        onClose={() => {
          setLogModalOpen(false);
          setModalTargetStaff(null);
        }}
        onCreated={() => {
          void loadWorkspaceData();
        }}
        apiFetch={apiFetch}
      />
    </div>
  );
}

function RootRouter() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-600">
        Memuatkan sesi eLogPL...
      </div>
    );
  }

  return user ? <AuthenticatedWorkspace /> : <LoginView />;
}

export default function App() {
  return (
    <AuthProvider>
      <RootRouter />
    </AuthProvider>
  );
}
