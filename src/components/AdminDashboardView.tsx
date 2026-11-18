import {
  ArrowRight,
  Check,
  Download,
  Plus,
  Search,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type {
  AnalyticsOverview,
  ComplianceSummaryRow,
  StaffAccount,
  TrainingLogEntry,
  VerificationStatus,
} from '../types/training';

interface AdminDashboardViewProps {
  tahun: number;
  analytics: AnalyticsOverview;
  staffList: StaffAccount[];
  complianceRows: ComplianceSummaryRow[];
  pendingLogs: TrainingLogEntry[];
  onVerifyLog: (
    logId: string,
    status: VerificationStatus,
    catatan?: string
  ) => Promise<void>;
  onDeleteStaff: (staffId: string) => Promise<void>;
  onExportNormalized: () => Promise<void>;
  onOpenAddLogForStaff: (staff: StaffAccount) => void;
  onJumpToDirectory: (opts?: { department?: string; openAddStaff?: boolean }) => void;
  onJumpToView: (view: 'analytics' | 'directory' | 'audit' | 'guide') => void;
}

export function AdminDashboardView({
  tahun,
  analytics,
  staffList,
  complianceRows,
  pendingLogs,
  onVerifyLog,
  onDeleteStaff,
  onExportNormalized,
  onOpenAddLogForStaff,
  onJumpToDirectory,
  onJumpToView,
}: AdminDashboardViewProps) {
  const [quickQuery, setQuickQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [verifyingLogId, setVerifyingLogId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [deptOrder, setDeptOrder] = useState<'staff' | 'lowest_rate'>('staff');

  const roleCounts = useMemo(() => {
    let aktif = 0;
    let tidakAktif = 0;
    let pegawai = 0;
    for (const s of staffList) {
      if (s.status === 'aktif') aktif += 1;
      else tidakAktif += 1;
      if (s.peranan === 'pegawai') pegawai += 1;
    }
    return { aktif, tidakAktif, pegawai };
  }, [staffList]);

  const staffById = useMemo(
    () => new Map(staffList.map((s) => [s.id, s])),
    [staffList]
  );

  const complianceById = useMemo(
    () => new Map(complianceRows.map((r) => [r.staff.id, r])),
    [complianceRows]
  );

  const quickResults = useMemo(() => {
    const q = quickQuery.trim().toLowerCase();
    if (!q) {
      const zeroOrInactive = staffList
        .filter((s) => {
          if (s.status !== 'aktif') return true;
          const comp = complianceById.get(s.id);
          return comp ? comp.compliance.jumlahKeseluruhanHari === 0 : false;
        })
        .slice(0, 7);
      return zeroOrInactive;
    }
    return staffList
      .filter(
        (s) =>
          s.nama.toLowerCase().includes(q) ||
          s.noKp.toLowerCase().includes(q) ||
          (s.noFail && s.noFail.toLowerCase().includes(q)) ||
          s.tempatBertugas.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [quickQuery, staffList, complianceById]);

  const displayedDepts = useMemo(() => {
    const list = [...analytics.byDepartment];
    if (deptOrder === 'lowest_rate') {
      list.sort((a, b) => a.complianceRate - b.complianceRate);
    } else {
      list.sort((a, b) => b.totalStaff - a.totalStaff);
    }
    return list.slice(0, 10);
  }, [analytics.byDepartment, deptOrder]);

  const handleExport = async () => {
    setExporting(true);
    setActionError(null);
    try {
      await onExportNormalized();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal mengeksport CSV.');
    } finally {
      setExporting(false);
    }
  };

  const handleQuickDelete = async (id: string) => {
    setDeletingId(id);
    setActionError(null);
    setActionMsg(null);
    try {
      await onDeleteStaff(id);
      setConfirmDeleteId(null);
      setActionMsg('Rekod kakitangan dan log kursus berkaitan telah dipadam.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal memadam rekod.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleVerify = async (logId: string, status: VerificationStatus) => {
    setVerifyingLogId(logId);
    setActionError(null);
    try {
      await onVerifyLog(logId, status);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Gagal mengemas kini pengesahan.');
    } finally {
      setVerifyingLogId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-slate-900">
            Dashboard Pentadbir Sistem
          </h1>
          <p className="mt-0.5 text-xs text-slate-600">
            Kawalan berpusat pangkalan data eLogPL · Tahun{' '}
            <span className="font-mono tabular-nums">{tahun}</span> ·{' '}
            <span className="font-mono tabular-nums">{staffList.length}</span> rekod kakitangan ·{' '}
            <span className="font-mono tabular-nums">
              {analytics.totalCourses.toLocaleString()}
            </span>{' '}
            catatan kursus
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onJumpToDirectory({ openAddStaff: true })}
            className="inline-flex items-center gap-2 rounded-md bg-[#0B1736] px-4 py-2 text-xs font-medium text-white hover:bg-[#132554] transition-colors whitespace-nowrap shrink-0"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Tambah Kakitangan</span>
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{exporting ? 'Menjana CSV...' : 'Eksport Sandaran CSV'}</span>
          </button>
        </div>
      </div>

      {actionMsg && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">
          <span>{actionMsg}</span>
          <button
            type="button"
            onClick={() => setActionMsg(null)}
            className="rounded p-1 hover:bg-emerald-100"
            aria-label="Tutup mesej"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800"
        >
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="rounded p-1 hover:bg-red-100"
            aria-label="Tutup ralat"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <section
        aria-label="Ringkasan Pentadbir Sistem"
        className="grid grid-cols-2 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 rounded-lg border border-slate-200 bg-white"
      >
        <div className="px-5 py-4">
          <div className="text-xs font-medium text-slate-500">Jumlah Rekod Staf</div>
          <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-slate-900">
            {staffList.length}
          </div>
          <div className="mt-1 font-mono text-xs tabular-nums text-slate-500">
            {roleCounts.aktif} aktif · {roleCounts.tidakAktif} tidak aktif
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="text-xs font-medium text-slate-500">Pengagihan Peranan</div>
          <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-slate-900">
            1 Pentadbir
          </div>
          <div className="mt-1 font-mono text-xs tabular-nums text-slate-500">
            {roleCounts.pegawai} pegawai berdaftar
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="text-xs font-medium text-slate-500">Log Kursus ({tahun})</div>
          <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-slate-900">
            {analytics.totalCourses.toLocaleString()}
          </div>
          <div className="mt-1 font-mono text-xs tabular-nums text-slate-500">
            {analytics.totalTrainingDays.toLocaleString()} jumlah hari latihan
          </div>
        </div>

        <button
          type="button"
          onClick={() => onJumpToView('audit')}
          className="px-5 py-4 text-left hover:bg-slate-50 transition-colors"
        >
          <div className="text-xs font-medium text-slate-500">Menunggu Pengesahan</div>
          <div
            className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${
              pendingLogs.length > 0 ? 'text-amber-700' : 'text-emerald-700'
            }`}
          >
            {pendingLogs.length}
          </div>
          <div className="mt-1 text-xs text-slate-600">
            {pendingLogs.length > 0 ? 'Klik untuk semak pengesahan' : 'Semua log disahkan'}
          </div>
        </button>

        <div className="px-5 py-4">
          <div className="text-xs font-medium text-slate-500">Pematuhan &amp; Integriti</div>
          <div className="mt-1 flex items-baseline gap-2 font-mono tabular-nums">
            <span className="text-2xl font-semibold text-emerald-700">
              {analytics.complianceRate}%
            </span>
            <span className="text-xs text-slate-500">patuh &ge;4h</span>
          </div>
          <div className="mt-1 font-mono text-xs tabular-nums text-slate-500">
            {analytics.anomalies.length} anomali · {analytics.auditStats.leadingZeroIcsReinstated ?? 0} IC &lsquo;0&rsquo; pulih
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-6">
          <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Carian &amp; Tindakan Pantas Rekod Kakitangan
                </h2>
                <p className="text-xs text-slate-500">
                  {quickQuery.trim()
                    ? `Menunjukkan padanan carian daripada ${staffList.length} rekod staf.`
                    : 'Memaparkan kakitangan 0 hari berkursus atau tidak aktif sebagai keutamaan.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onJumpToDirectory()}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B1736] hover:underline whitespace-nowrap shrink-0"
              >
                <span>Direktori Penuh</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="border-b border-slate-200 px-5 py-3 bg-slate-50/70">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={quickQuery}
                  onChange={(e) => setQuickQuery(e.target.value)}
                  placeholder="Cari Nama, No. K/P (12 digit), No. Fail, atau Jabatan..."
                  aria-label="Carian pantas kakitangan"
                  className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-[#0B1736] focus:outline-none"
                />
              </div>
            </div>

            {quickResults.length === 0 ? (
              <div className="px-5 py-10 text-center text-xs text-slate-500">
                {staffList.length === 0
                  ? 'Tiada rekod kakitangan dalam pangkalan data. Gunakan Tambah Kakitangan atau Pulihkan Data Asal CSV.'
                  : 'Tiada kakitangan ditemui untuk carian semasa.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 font-medium text-slate-600">
                      <th className="px-4 py-2.5 whitespace-nowrap">No. Fail</th>
                      <th className="px-4 py-2.5">Kakitangan &amp; No. K/P</th>
                      <th className="px-4 py-2.5">Jabatan</th>
                      <th className="px-4 py-2.5 text-right whitespace-nowrap">Hari</th>
                      <th className="px-4 py-2.5 text-right whitespace-nowrap">Tindakan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {quickResults.map((s) => {
                      const comp = complianceById.get(s.id);
                      const days = comp?.compliance.jumlahKeseluruhanHari ?? 0;
                      const isConfirming = confirmDeleteId === s.id;
                      return (
                        <tr key={s.id} className="hover:bg-slate-50/70">
                          <td className="px-4 py-2.5 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                            {s.noFail || '-'}
                          </td>
                          <td className="px-4 py-2.5 min-w-[200px]">
                            <div className="font-medium text-slate-900">{s.nama}</div>
                            <div className="mt-0.5 font-mono text-[11px] tabular-nums text-slate-500">
                              {s.noKp} · {s.peranan.toUpperCase()}
                              {s.status !== 'aktif' ? ' · TIDAK AKTIF' : ''}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-slate-600 max-w-[180px] truncate" title={s.tempatBertugas}>
                            {s.jabatanInduk || s.tempatBertugas}
                          </td>
                          <td
                            className={`px-4 py-2.5 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                              days >= 4
                                ? 'text-emerald-700'
                                : days === 0
                                ? 'text-red-700'
                                : 'text-slate-800'
                            }`}
                          >
                            {days}h
                          </td>
                          <td className="px-4 py-2.5 text-right whitespace-nowrap">
                            {isConfirming ? (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={deletingId === s.id}
                                  onClick={() => handleQuickDelete(s.id)}
                                  className="rounded bg-red-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-red-700 disabled:opacity-50"
                                >
                                  {deletingId === s.id ? 'Padam...' : 'Sahkan'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
                                >
                                  Batal
                                </button>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => onOpenAddLogForStaff(s)}
                                  title="Tambah log kursus"
                                  className="rounded border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onJumpToDirectory({
                                      department: s.jabatanInduk || s.tempatBertugas,
                                    })
                                  }
                                  className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                                >
                                  Urus
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(s.id)}
                                  title="Padam staf"
                                  className="rounded border border-slate-200 bg-white p-1.5 text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Baris Gilir Pengesahan Log Latihan
                </h2>
                <p className="text-xs text-slate-500">
                  Sahkan atau tolak rekod latihan baharu yang dihantar kakitangan.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onJumpToView('audit')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B1736] hover:underline whitespace-nowrap shrink-0"
              >
                <span>Semua ({pendingLogs.length})</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {pendingLogs.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-slate-500">
                Tiada log latihan yang menunggu pengesahan pada masa ini.
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {pendingLogs.slice(0, 5).map((log) => {
                  const owner = log.staffId ? staffById.get(log.staffId) : undefined;
                  const busy = verifyingLogId === log.id;
                  return (
                    <div
                      key={log.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-50/70"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-slate-900 truncate">
                          {log.tajuk}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-600">
                          {owner?.nama ?? log.staffNoKp} ·{' '}
                          <span className="font-mono tabular-nums">{log.tarikhMula}</span> ·{' '}
                          <span className="font-mono tabular-nums">
                            {log.bilanganHari} hari ({log.kodKursusPL || log.kategori})
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleVerify(log.id, 'disahkan')}
                          className="inline-flex items-center gap-1 rounded bg-emerald-700 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-800 disabled:opacity-50 whitespace-nowrap"
                        >
                          <Check className="h-3 w-3" />
                          <span>Sahkan</span>
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleVerify(log.id, 'ditolak')}
                          className="inline-flex items-center gap-1 rounded border border-red-300 bg-white px-2.5 py-1.5 text-[11px] font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 whitespace-nowrap"
                        >
                          <X className="h-3 w-3" />
                          <span>Tolak</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <h2 className="text-sm font-semibold text-slate-900">
                Audit Sumber Dataset &amp; Kualiti Data
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Ringkasan penormalan hamparan Perbadanan Labuan.
              </p>
            </div>

            <dl className="divide-y divide-slate-200 text-xs">
              <div className="flex items-center justify-between py-2.5 gap-3">
                <dt className="text-slate-600">Fail Sumber Utama</dt>
                <dd className="font-mono text-slate-900 truncate max-w-[220px]" title={analytics.auditStats.sourceFileName}>
                  {analytics.auditStats.sourceFileName}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5 gap-3">
                <dt className="text-slate-600">Baris Staf Dihurai</dt>
                <dd className="font-mono tabular-nums font-semibold text-slate-900">
                  {analytics.auditStats.totalRowsParsed}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5 gap-3">
                <dt className="text-slate-600">Formula #REF! / #N/A Dipulihkan</dt>
                <dd className="font-mono tabular-nums font-semibold text-[#0B1736]">
                  {analytics.auditStats.excelFormulaRefRowsFixed}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5 gap-3">
                <dt className="text-slate-600">No. K/P 11 Digit Dipulihkan (&lsquo;0&rsquo;)</dt>
                <dd className="font-mono tabular-nums font-semibold text-emerald-700">
                  {analytics.auditStats.leadingZeroIcsReinstated ?? 0}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5 gap-3">
                <dt className="text-slate-600">Lajur Teralih &amp; Ralat Tarikh</dt>
                <dd className="font-mono tabular-nums text-slate-900">
                  {analytics.auditStats.shiftedColumnsRecovered} alih ·{' '}
                  {analytics.auditStats.dateTyposFixed} tarikh
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5 gap-3">
                <dt className="text-slate-600">Anomali Aktif Semasa</dt>
                <dd className="font-mono tabular-nums font-semibold text-amber-700">
                  {analytics.anomalies.length}
                </dd>
              </div>
            </dl>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => onJumpToView('audit')}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap"
              >
                Audit &amp; Pengesahan
              </button>
              <button
                type="button"
                onClick={() => onJumpToView('analytics')}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap"
              >
                Analitik Penuh
              </button>
            </div>
          </section>
        </div>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Ringkasan Jabatan Induk ({tahun})
            </h2>
            <p className="text-xs text-slate-500">
              Klik mana-mana jabatan untuk mengurus rekod kakitangan jabatan tersebut.
            </p>
          </div>
          <div className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 p-0.5">
            <button
              type="button"
              onClick={() => setDeptOrder('staff')}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                deptOrder === 'staff'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Bilangan Staf Terbanyak
            </button>
            <button
              type="button"
              onClick={() => setDeptOrder('lowest_rate')}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                deptOrder === 'lowest_rate'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pematuhan Terendah
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-medium text-slate-600">
                <th className="px-4 py-2.5">Jabatan Induk</th>
                <th className="px-4 py-2.5 text-right whitespace-nowrap">Jumlah Staf</th>
                <th className="px-4 py-2.5 text-right whitespace-nowrap">0 Hari</th>
                <th className="px-4 py-2.5 text-right whitespace-nowrap">Patuh &ge;4h</th>
                <th className="px-4 py-2.5 text-right whitespace-nowrap">Purata</th>
                <th className="px-4 py-2.5 text-right whitespace-nowrap">Kadar Patuh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {displayedDepts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Tiada data jabatan untuk dipaparkan.
                  </td>
                </tr>
              ) : (
                displayedDepts.map((d) => (
                  <tr
                    key={d.jabatan}
                    onClick={() => onJumpToDirectory({ department: d.jabatan })}
                    className="cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-4 py-2.5 font-medium text-slate-900">{d.jabatan}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700">
                      {d.totalStaff}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-red-700">
                      {d.zeroDays}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-emerald-700">
                      {d.fourPlusDays}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700">
                      {d.avgDays}h
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {d.complianceRate}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
