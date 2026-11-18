import {
  ChevronLeft,
  ChevronRight,
  Database,
  Edit2,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import type {
  ComplianceSummaryRow,
  PlCourseCode,
  StaffAccount,
  TrainingLogEntry,
  UserRole,
} from '../types/training';
import { PRIMARY_PL_CODES, normalizeNoKp } from '../utils/trainingRules';

interface PlbDirectoryViewProps {
  tahun: number;
  isAdmin: boolean;
  complianceRows: ComplianceSummaryRow[];
  initialDepartmentFilter?: string;
  openAddStaffSignal?: number;
  onCreateStaff: (payload: {
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
  }) => Promise<void>;
  onUpdateStaff: (
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
  ) => Promise<void>;
  onDeleteStaff: (staffId: string) => Promise<void>;
  onResetDatabase: (action: 'reseed' | 'clear_all') => Promise<void>;
  onImportCsv: (payload: {
    csvText: string;
    fileName: string;
    mode: 'merge' | 'replace';
  }) => Promise<{ importedStaff: number; importedLogs: number }>;
  onOpenAddLogForStaff: (staff: StaffAccount) => void;
  onDataChanged: () => Promise<void>;
  allLogs?: TrainingLogEntry[];
  onUpdateCourseLog?: (
    logId: string,
    payload: {
      kodKursusPL?: PlCourseCode;
      tajuk: string;
      tarikhMula: string;
      tarikhTamat: string;
      bilanganHari: number;
      tempat: string;
      anjuran: string;
    }
  ) => Promise<void>;
  onDeleteCourseLog?: (logId: string) => Promise<void>;
  apiFetch: <T>(url: string, init?: RequestInit) => Promise<T>;
}

const PAGE_SIZE = 25;

export function PlbDirectoryView({
  tahun,
  isAdmin,
  complianceRows,
  initialDepartmentFilter = 'ALL',
  openAddStaffSignal = 0,
  onCreateStaff,
  onUpdateStaff,
  onDeleteStaff,
  onResetDatabase,
  onImportCsv,
  onOpenAddLogForStaff,
  onDataChanged,
  allLogs,
  onUpdateCourseLog,
  onDeleteCourseLog,
  apiFetch,
}: PlbDirectoryViewProps) {
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState(initialDepartmentFilter);
  const [kategoriFilter, setKategoriFilter] = useState('ALL');
  const [tarafFilter, setTarafFilter] = useState('ALL');
  const [bucketFilter, setBucketFilter] = useState<'ALL' | '0' | '1-3' | '4+'>('ALL');
  const [page, setPage] = useState(1);

  const [selectedRow, setSelectedRow] = useState<ComplianceSummaryRow | null>(null);
  const [staffLogs, setStaffLogs] = useState<TrainingLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Add staff form
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [newNoFail, setNewNoFail] = useState('');
  const [newNoKp, setNewNoKp] = useState('');
  const [newNama, setNewNama] = useState('');
  const [newJawatan, setNewJawatan] = useState('');
  const [newKlasifikasi, setNewKlasifikasi] = useState('N');
  const [newGred, setNewGred] = useState('5');
  const [newTempat, setNewTempat] = useState('');
  const [newTaraf, setNewTaraf] = useState('Tetap');
  const [newKategori, setNewKategori] = useState('Sok I');
  const [newPeranan, setNewPeranan] = useState<UserRole>('pegawai');
  const [newPassword, setNewPassword] = useState('elogpl2026');
  const [staffError, setStaffError] = useState<string | null>(null);
  const [creatingStaff, setCreatingStaff] = useState(false);

  // Edit staff modal
  const [editingStaff, setEditingStaff] = useState<StaffAccount | null>(null);
  const [editNoFail, setEditNoFail] = useState('');
  const [editNoKp, setEditNoKp] = useState('');
  const [editNama, setEditNama] = useState('');
  const [editJawatan, setEditJawatan] = useState('');
  const [editKlasifikasi, setEditKlasifikasi] = useState('');
  const [editGred, setEditGred] = useState('');
  const [editTempat, setEditTempat] = useState('');
  const [editTaraf, setEditTaraf] = useState('Tetap');
  const [editKategori, setEditKategori] = useState('Sok I');
  const [editGender, setEditGender] = useState<'L' | 'P' | ''>('');
  const [editBulan, setEditBulan] = useState(12);
  const [editSasaran, setEditSasaran] = useState(4);
  const [editPeranan, setEditPeranan] = useState<UserRole>('pegawai');
  const [editStatus, setEditStatus] = useState<'aktif' | 'tidak_aktif'>('aktif');
  const [editPassword, setEditPassword] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete staff inline confirm
  const [confirmDeleteStaffId, setConfirmDeleteStaffId] = useState<string | null>(null);
  const [deletingStaffId, setDeletingStaffId] = useState<string | null>(null);

  // Edit course log inside drawer
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [logDraft, setLogDraft] = useState<{
    kodKursusPL: PlCourseCode | '';
    tajuk: string;
    tarikhMula: string;
    tarikhTamat: string;
    bilanganHari: number;
    tempat: string;
    anjuran: string;
  }>({
    kodKursusPL: 'KDL',
    tajuk: '',
    tarikhMula: '',
    tarikhTamat: '',
    bilanganHari: 1,
    tempat: '',
    anjuran: '',
  });
  const [savingLogId, setSavingLogId] = useState<string | null>(null);

  // Import CSV & Admin DB panel
  const [showImportCsv, setShowImportCsv] = useState(false);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const [showDbTools, setShowDbTools] = useState(false);
  const [confirmClearDb, setConfirmClearDb] = useState(false);
  const [dbBusy, setDbBusy] = useState(false);

  useEffect(() => {
    setDeptFilter(initialDepartmentFilter);
    setPage(1);
  }, [initialDepartmentFilter]);

  useEffect(() => {
    if (openAddStaffSignal > 0) {
      setShowAddStaff(true);
    }
  }, [openAddStaffSignal]);

  useEffect(() => {
    if (!selectedRow) return;
    const latest = complianceRows.find((r) => r.staff.id === selectedRow.staff.id);
    if (latest) {
      setSelectedRow(latest);
    } else {
      setSelectedRow(null);
    }
  }, [complianceRows, selectedRow]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const r of complianceRows) {
      set.add(r.staff.jabatanInduk || r.staff.tempatBertugas);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [complianceRows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return complianceRows.filter((row) => {
      if (deptFilter !== 'ALL') {
        const dept = row.staff.jabatanInduk || row.staff.tempatBertugas;
        if (dept !== deptFilter) return false;
      }
      if (kategoriFilter !== 'ALL' && row.staff.kategoriPerkhidmatan !== kategoriFilter) {
        return false;
      }
      if (tarafFilter !== 'ALL' && row.staff.tarafJawatan !== tarafFilter) {
        return false;
      }
      const d = row.compliance.jumlahKeseluruhanHari;
      if (bucketFilter === '0' && d !== 0) return false;
      if (bucketFilter === '1-3' && (d < 1 || d > 3)) return false;
      if (bucketFilter === '4+' && d < 4) return false;

      if (q) {
        const hay = `${row.staff.nama} ${row.staff.noKp} ${row.staff.noFail ?? ''} ${row.staff.tempatBertugas} ${row.staff.jawatan}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [complianceRows, search, deptFilter, kategoriFilter, tarafFilter, bucketFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = filteredRows.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const loadDrawerLogs = async (staffId: string) => {
    if (allLogs) {
      const matched = allLogs
        .filter((l) => l.staffId === staffId)
        .sort((a, b) => b.tarikhMula.localeCompare(a.tarikhMula));
      setStaffLogs(matched);
      return;
    }
    setLoadingLogs(true);
    try {
      const res = await apiFetch<{ logs: TrainingLogEntry[] }>(
        `/api/training-logs?staffId=${encodeURIComponent(staffId)}&tahun=all`
      );
      setStaffLogs(res.logs);
    } catch {
      setStaffLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (allLogs && selectedRow) {
      setStaffLogs(
        allLogs
          .filter((l) => l.staffId === selectedRow.staff.id)
          .sort((a, b) => b.tarikhMula.localeCompare(a.tarikhMula))
      );
    }
  }, [allLogs, selectedRow]);

  const openStaffDrawer = async (row: ComplianceSummaryRow) => {
    setSelectedRow(row);
    setEditingLogId(null);
    await loadDrawerLogs(row.staff.id);
  };

  const openEditStaffModal = (staff: StaffAccount) => {
    setEditingStaff(staff);
    setEditNoFail(staff.noFail ?? '');
    setEditNoKp(staff.noKp);
    setEditNama(staff.nama);
    setEditJawatan(staff.jawatan);
    setEditKlasifikasi(staff.klasifikasi ?? '');
    setEditGred(staff.gred);
    setEditTempat(staff.tempatBertugas);
    setEditTaraf(staff.tarafJawatan ?? 'Tetap');
    setEditKategori(staff.kategoriPerkhidmatan ?? 'Sok I');
    setEditGender(staff.gender ?? '');
    setEditBulan(staff.bulanBerkhidmat);
    setEditSasaran(staff.sasaranTahun ?? 4);
    setEditPeranan(staff.peranan === 'admin' ? 'admin' : 'pegawai');
    setEditStatus(staff.status);
    setEditPassword('');
    setEditError(null);
  };

  const handleSaveEditStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    setEditError(null);
    setSavingEdit(true);
    try {
      await onUpdateStaff(editingStaff.id, {
        noFail: editNoFail.trim(),
        noKp: normalizeNoKp(editNoKp, true),
        nama: editNama.trim(),
        jawatan: editJawatan.trim(),
        klasifikasi: editKlasifikasi.trim(),
        gred: editGred.trim(),
        tempatBertugas: editTempat.trim(),
        tarafJawatan: editTaraf,
        kategoriPerkhidmatan: editKategori,
        gender: editGender,
        bulanBerkhidmat: editBulan,
        sasaranTahun: editSasaran,
        peranan: editPeranan,
        status: editStatus,
        password: editPassword.trim() ? editPassword.trim() : undefined,
      });
      setEditingStaff(null);
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : 'Gagal mengemas kini rekod kakitangan.'
      );
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteStaffConfirm = async (staffId: string) => {
    setDeletingStaffId(staffId);
    try {
      await onDeleteStaff(staffId);
      setConfirmDeleteStaffId(null);
      if (selectedRow?.staff.id === staffId) {
        setSelectedRow(null);
      }
    } finally {
      setDeletingStaffId(null);
    }
  };

  const handleSaveEditedLog = async (logId: string) => {
    setSavingLogId(logId);
    try {
      if (onUpdateCourseLog) {
        await onUpdateCourseLog(logId, {
          ...(logDraft.kodKursusPL ? { kodKursusPL: logDraft.kodKursusPL } : {}),
          tajuk: logDraft.tajuk,
          tarikhMula: logDraft.tarikhMula,
          tarikhTamat: logDraft.tarikhTamat,
          bilanganHari: logDraft.bilanganHari,
          tempat: logDraft.tempat,
          anjuran: logDraft.anjuran,
        });
      } else {
        await apiFetch(`/api/training-logs/${logId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            ...(logDraft.kodKursusPL ? { kodKursusPL: logDraft.kodKursusPL } : {}),
            tajuk: logDraft.tajuk,
            tarikhMula: logDraft.tarikhMula,
            tarikhTamat: logDraft.tarikhTamat,
            bilanganHari: logDraft.bilanganHari,
            tempat: logDraft.tempat,
            anjuran: logDraft.anjuran,
            clearAnomaly: true,
          }),
        });
        if (selectedRow) {
          await loadDrawerLogs(selectedRow.staff.id);
        }
        await onDataChanged();
      }
      setEditingLogId(null);
    } finally {
      setSavingLogId(null);
    }
  };

  const handleDeleteCourseLog = async (logId: string) => {
    setSavingLogId(logId);
    try {
      if (onDeleteCourseLog) {
        await onDeleteCourseLog(logId);
      } else {
        await apiFetch(`/api/training-logs/${logId}`, { method: 'DELETE' });
        if (selectedRow) {
          await loadDrawerLogs(selectedRow.staff.id);
        }
        await onDataChanged();
      }
    } finally {
      setSavingLogId(null);
    }
  };

  const handleAddStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffError(null);
    setCreatingStaff(true);
    try {
      await onCreateStaff({
        noFail: newNoFail.trim() || undefined,
        noKp: normalizeNoKp(newNoKp, true),
        nama: newNama,
        jawatan: newJawatan,
        klasifikasi: newKlasifikasi,
        gred: newGred,
        tempatBertugas: newTempat,
        tarafJawatan: newTaraf,
        kategoriPerkhidmatan: newKategori,
        peranan: newPeranan,
        bulanBerkhidmat: 12,
        password: newPassword,
      });
      setNewNoFail('');
      setNewNoKp('');
      setNewNama('');
      setNewJawatan('');
      setNewTempat('');
      setShowAddStaff(false);
    } catch (err) {
      setStaffError(
        err instanceof Error ? err.message : 'Gagal mendaftarkan kakitangan.'
      );
    } finally {
      setCreatingStaff(false);
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setImportStatus(null);
    setImporting(true);
    try {
      const text = await file.text();
      const res = await onImportCsv({
        csvText: text,
        fileName: file.name,
        mode: importMode,
      });
      setImportStatus(
        `Berjaya memproses "${file.name}": ${res.importedStaff} staf & ${res.importedLogs} rekod kursus dikemas kini.`
      );
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Gagal mengimport fail CSV.');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-slate-900">
            Direktori Kakitangan &amp; Pengurusan Rekod ({tahun})
          </h1>
          <p className="mt-0.5 text-xs text-slate-600 font-mono tabular-nums">
            Menunjukkan {filteredRows.length} daripada {complianceRows.length} kakitangan aktif. Klik baris untuk melihat/mengurus kursus, atau sunting/padam terus.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowDbTools((p) => !p)}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Database className="h-3.5 w-3.5" />
              <span>Pengurusan DB</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowImportCsv((p) => !p)}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Import CSV</span>
          </button>
          <button
            type="button"
            onClick={() => setShowAddStaff((p) => !p)}
            className="inline-flex items-center gap-2 rounded-md bg-[#0B1736] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#132554] whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{showAddStaff ? 'Tutup Borang' : 'Tambah Pegawai'}</span>
          </button>
        </div>
      </div>

      {isAdmin && showDbTools && (
        <div className="rounded-lg border border-slate-200 bg-white p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Kawalan Pangkalan Data Keseluruhan (Admin)
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Pulihkan data asal daripada CSV Tahun 2026 atau kosongkan semua rekod kakitangan (akaun Admin dikekalkan).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={dbBusy}
              onClick={async () => {
                setDbBusy(true);
                try {
                  await onResetDatabase('reseed');
                  setConfirmClearDb(false);
                } finally {
                  setDbBusy(false);
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Pulihkan Data Asal CSV 2026</span>
            </button>

            {!confirmClearDb ? (
              <button
                type="button"
                disabled={dbBusy}
                onClick={() => setConfirmClearDb(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Padam Semua Rekod Staf</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs">
                <span className="font-medium text-red-800">Sahkan padam semua?</span>
                <button
                  type="button"
                  disabled={dbBusy}
                  onClick={async () => {
                    setDbBusy(true);
                    try {
                      await onResetDatabase('clear_all');
                      setConfirmClearDb(false);
                    } finally {
                      setDbBusy(false);
                    }
                  }}
                  className="rounded bg-red-700 px-2.5 py-1 font-medium text-white hover:bg-red-800"
                >
                  Ya, Padam Semua
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClearDb(false)}
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-slate-700"
                >
                  Batal
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showImportCsv && (
        <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Import &amp; Normalisasi CSV Rekod Kursus Perbadanan Labuan
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Menyokong fail CSV hamparan asal 195-lajur untuk mengemas kini atau menggantikan rekod secara pukal tanpa ralat formula.
              </p>
            </div>
            <div className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setImportMode('merge')}
                className={`rounded px-2.5 py-1 font-medium ${
                  importMode === 'merge' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Gabung Rekod Baharu
              </button>
              <button
                type="button"
                onClick={() => setImportMode('replace')}
                className={`rounded px-2.5 py-1 font-medium ${
                  importMode === 'replace' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Ganti Penuh
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <input
              type="file"
              accept=".csv,text/csv"
              disabled={importing}
              onChange={handleFileImport}
              className="block text-xs text-slate-600 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-slate-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-800 hover:file:bg-slate-100"
            />
            {importing && <span className="text-xs text-slate-600">Sedang memproses CSV...</span>}
          </div>

          {importStatus && (
            <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              {importStatus}
            </div>
          )}
          {importError && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              {importError}
            </div>
          )}
        </div>
      )}

      {showAddStaff && (
        <form
          onSubmit={handleAddStaffSubmit}
          className="rounded-lg border border-slate-200 bg-white p-5 space-y-4"
        >
          {staffError && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              {staffError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                No. Pekerja / Fail
              </label>
              <input
                type="text"
                value={newNoFail}
                onChange={(e) => setNewNoFail(e.target.value)}
                placeholder="2115"
                className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                No. K/P (12 digit) *
              </label>
              <input
                type="text"
                required
                value={newNoKp}
                onChange={(e) => setNewNoKp(e.target.value)}
                placeholder="900112-10-5521"
                className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Nama Penuh *
              </label>
              <input
                type="text"
                required
                value={newNama}
                onChange={(e) => setNewNama(e.target.value)}
                placeholder="Nama penuh pegawai"
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Jawatan *
              </label>
              <input
                type="text"
                required
                value={newJawatan}
                onChange={(e) => setNewJawatan(e.target.value)}
                placeholder="PPT / PT(P/O) / PKA"
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Klasifikasi &amp; Gred *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newKlasifikasi}
                  onChange={(e) => setNewKlasifikasi(e.target.value)}
                  placeholder="N"
                  className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm uppercase"
                />
                <input
                  type="text"
                  required
                  value={newGred}
                  onChange={(e) => setNewGred(e.target.value)}
                  placeholder="5"
                  className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm uppercase"
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Jabatan / Unit Bertugas *
              </label>
              <input
                type="text"
                required
                value={newTempat}
                onChange={(e) => setNewTempat(e.target.value)}
                placeholder="Khidmat Pengurusan"
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Taraf Jawatan
              </label>
              <select
                value={newTaraf}
                onChange={(e) => setNewTaraf(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="Tetap">Tetap</option>
                <option value="Kontrak">Kontrak</option>
                <option value="Tetap (Interim)">Tetap (Interim)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Kategori
              </label>
              <select
                value={newKategori}
                onChange={(e) => setNewKategori(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="Sok I">Sok I</option>
                <option value="Sok II">Sok II</option>
                <option value="P & P">P &amp; P</option>
                <option value="Pengurusan Tertinggi">Pengurusan Tertinggi</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Peranan Sistem
              </label>
              <select
                value={newPeranan}
                onChange={(e) => setNewPeranan(e.target.value as UserRole)}
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="pegawai">Pegawai</option>
                <option value="admin">Pentadbir Sistem</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Kata Laluan Awal *
              </label>
              <input
                type="text"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={creatingStaff}
              className="rounded-md bg-[#0B1736] px-4 py-2 text-xs font-medium text-white hover:bg-[#132554] disabled:opacity-50"
            >
              {creatingStaff ? 'Mendaftar...' : 'Simpan Akaun Kakitangan'}
            </button>
          </div>
        </form>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="relative lg:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Cari nama, No. K/P, atau No. Pekerja..."
            className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-[#0B1736] focus:outline-none"
          />
        </div>

        <select
          aria-label="Tapis Jabatan"
          value={deptFilter}
          onChange={(e) => {
            setDeptFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#0B1736] focus:outline-none"
        >
          <option value="ALL">Semua Jabatan ({departments.length})</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>

        <select
          aria-label="Tapis Kategori & Taraf"
          value={`${kategoriFilter}|${tarafFilter}`}
          onChange={(e) => {
            const [k, t] = e.target.value.split('|');
            setKategoriFilter(k);
            setTarafFilter(t);
            setPage(1);
          }}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#0B1736] focus:outline-none"
        >
          <option value="ALL|ALL">Semua Kategori &amp; Taraf</option>
          <optgroup label="Kategori Perkhidmatan">
            <option value="Sok I|ALL">Kategori: Sok I</option>
            <option value="Sok II|ALL">Kategori: Sok II</option>
            <option value="P & P|ALL">Kategori: P &amp; P</option>
            <option value="Pengurusan Tertinggi|ALL">Kategori: Pengurusan Tertinggi</option>
          </optgroup>
          <optgroup label="Taraf Jawatan">
            <option value="ALL|Tetap">Taraf: Tetap</option>
            <option value="ALL|Kontrak">Taraf: Kontrak</option>
            <option value="ALL|Tetap (Interim)">Taraf: Tetap (Interim)</option>
          </optgroup>
        </select>

        <select
          aria-label="Tapis Status Hari"
          value={bucketFilter}
          onChange={(e) => {
            setBucketFilter(e.target.value as typeof bucketFilter);
            setPage(1);
          }}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#0B1736] focus:outline-none"
        >
          <option value="ALL">Semua Tahap Pematuhan</option>
          <option value="4+">Patuh (&ge; 4 Hari)</option>
          <option value="1-3">Separa (1 – 3 Hari)</option>
          <option value="0">Belum Berkursus (0 Hari)</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-medium text-slate-600">
                <th className="px-4 py-2.5 whitespace-nowrap">No. Fail</th>
                <th className="px-4 py-2.5">Nama &amp; No. K/P</th>
                <th className="px-4 py-2.5">Jabatan / Unit</th>
                <th className="px-4 py-2.5 whitespace-nowrap">Jawatan &amp; Gred</th>
                <th className="px-4 py-2.5 text-right whitespace-nowrap">Kursus</th>
                <th className="px-4 py-2.5 text-right whitespace-nowrap">PDL</th>
                <th className="px-4 py-2.5 text-right whitespace-nowrap">Jumlah</th>
                <th className="px-4 py-2.5 whitespace-nowrap">Status 4 Hari</th>
                <th className="px-4 py-2.5 text-right whitespace-nowrap">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {pagedRows.map((row) => {
                const days = row.compliance.jumlahKeseluruhanHari;
                const met = row.compliance.patuhSepenuhnya;
                const isConfirming = confirmDeleteStaffId === row.staff.id;
                return (
                  <tr
                    key={row.staff.id}
                    onClick={() => openStaffDrawer(row)}
                    className="cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-4 py-2.5 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                      {row.staff.noFail ?? '-'}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-slate-900">{row.staff.nama}</div>
                      <div className="font-mono tabular-nums text-slate-500">
                        {row.staff.noKp}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">
                      <div>{row.staff.tempatBertugas}</div>
                      <div className="text-[11px] text-slate-500">
                        {row.staff.tarafJawatan} · {row.staff.kategoriPerkhidmatan}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap">
                      {row.staff.jawatan}{' '}
                      <span className="font-mono text-slate-500">
                        ({row.staff.klasifikasi ? `${row.staff.klasifikasi} ` : ''}
                        {row.staff.gred})
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700">
                      {row.compliance.kursusSahajaHari}h
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-600">
                      {row.compliance.perhimpunanHari}h
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {days} / {row.compliance.sasaranHari}h
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <span
                        className={`font-semibold ${
                          met
                            ? 'text-emerald-700'
                            : days > 0
                            ? 'text-amber-700'
                            : 'text-red-700'
                        }`}
                      >
                        {met
                          ? 'Patuh'
                          : days === 0
                          ? '0 Hari'
                          : `Kurang ${row.compliance.sasaranHari - days}h`}
                      </span>
                    </td>
                    <td
                      className="px-4 py-2.5 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isConfirming ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            disabled={deletingStaffId === row.staff.id}
                            onClick={() => handleDeleteStaffConfirm(row.staff.id)}
                            className="rounded bg-red-700 px-2 py-1 text-[11px] font-medium text-white hover:bg-red-800"
                          >
                            Padam
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteStaffId(null)}
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-700"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            title="Sunting maklumat pegawai"
                            aria-label={`Sunting ${row.staff.nama}`}
                            onClick={() => openEditStaffModal(row.staff)}
                            className="rounded p-1.5 text-slate-500 hover:bg-slate-200/70 hover:text-slate-900"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Padam rekod pegawai"
                            aria-label={`Padam ${row.staff.nama}`}
                            onClick={() => setConfirmDeleteStaffId(row.staff.id)}
                            className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {pagedRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                    Tiada rekod kakitangan sepadan dengan penapis carian ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          <div className="font-mono tabular-nums">
            Halaman {safePage} / {totalPages} ({filteredRows.length} rekod)
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Sebelum</span>
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              <span>Seterusnya</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {editingStaff && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-staff-title"
        >
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 id="edit-staff-title" className="text-base font-semibold text-slate-900">
                  Sunting Rekod Kakitangan
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 font-mono">
                  ID: {editingStaff.id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                aria-label="Tutup modal sunting"
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditStaff} className="p-6 space-y-4 text-xs">
              {editError && (
                <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-red-800">
                  {editError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    No. Pekerja / Fail
                  </label>
                  <input
                    type="text"
                    value={editNoFail}
                    onChange={(e) => setEditNoFail(e.target.value)}
                    className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    No. K/P (12 digit) *
                  </label>
                  <input
                    type="text"
                    required
                    value={editNoKp}
                    onChange={(e) => setEditNoKp(e.target.value)}
                    className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">
                    Nama Penuh *
                  </label>
                  <input
                    type="text"
                    required
                    value={editNama}
                    onChange={(e) => setEditNama(e.target.value)}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Jawatan *
                  </label>
                  <input
                    type="text"
                    required
                    value={editJawatan}
                    onChange={(e) => setEditJawatan(e.target.value)}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Klasifikasi &amp; Gred *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={editKlasifikasi}
                      onChange={(e) => setEditKlasifikasi(e.target.value)}
                      className="w-full rounded border border-slate-300 px-2.5 py-2 font-mono text-sm uppercase"
                    />
                    <input
                      type="text"
                      required
                      value={editGred}
                      onChange={(e) => setEditGred(e.target.value)}
                      className="w-full rounded border border-slate-300 px-2.5 py-2 font-mono text-sm uppercase"
                    />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">
                    Jabatan / Unit Bertugas *
                  </label>
                  <input
                    type="text"
                    required
                    value={editTempat}
                    onChange={(e) => setEditTempat(e.target.value)}
                    className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Taraf Jawatan
                  </label>
                  <select
                    value={editTaraf}
                    onChange={(e) => setEditTaraf(e.target.value)}
                    className="w-full rounded border border-slate-300 px-2.5 py-2 text-sm bg-white"
                  >
                    <option value="Tetap">Tetap</option>
                    <option value="Kontrak">Kontrak</option>
                    <option value="Tetap (Interim)">Tetap (Interim)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Kategori
                  </label>
                  <select
                    value={editKategori}
                    onChange={(e) => setEditKategori(e.target.value)}
                    className="w-full rounded border border-slate-300 px-2.5 py-2 text-sm bg-white"
                  >
                    <option value="Sok I">Sok I</option>
                    <option value="Sok II">Sok II</option>
                    <option value="P & P">P &amp; P</option>
                    <option value="Pengurusan Tertinggi">Pengurusan Tertinggi</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Jantina
                  </label>
                  <select
                    value={editGender}
                    onChange={(e) => setEditGender(e.target.value as 'L' | 'P' | '')}
                    className="w-full rounded border border-slate-300 px-2.5 py-2 text-sm bg-white"
                  >
                    <option value="L">Lelaki (L)</option>
                    <option value="P">Perempuan (P)</option>
                    <option value="">Tidak Dinyatakan</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Bulan Khidmat / Sasaran
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={editBulan}
                      onChange={(e) => setEditBulan(Number(e.target.value) || 12)}
                      title="Bulan berkhidmat"
                      className="w-full rounded border border-slate-300 px-2.5 py-2 font-mono text-sm"
                    />
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={editSasaran}
                      onChange={(e) => setEditSasaran(Number(e.target.value) || 4)}
                      title="Sasaran hari tahunan"
                      className="w-full rounded border border-slate-300 px-2.5 py-2 font-mono text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Peranan Sistem
                  </label>
                  <select
                    value={editPeranan}
                    onChange={(e) => setEditPeranan(e.target.value as UserRole)}
                    className="w-full rounded border border-slate-300 px-2.5 py-2 text-sm bg-white"
                  >
                    <option value="pegawai">Pegawai</option>
                    <option value="admin">Pentadbir Sistem</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Status Akaun
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) =>
                      setEditStatus(e.target.value as 'aktif' | 'tidak_aktif')
                    }
                    className="w-full rounded border border-slate-300 px-2.5 py-2 text-sm bg-white"
                  >
                    <option value="aktif">Aktif</option>
                    <option value="tidak_aktif">Tidak Aktif</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">
                    Tetapkan Kata Laluan Baharu (pilihan, min. 6 aksara)
                  </label>
                  <input
                    type="text"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Biarkan kosong jika tidak mahu ubah"
                    className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="rounded-md bg-[#0B1736] px-4 py-2 text-xs font-medium text-white hover:bg-[#132554] disabled:opacity-50"
                >
                  {savingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedRow && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/45"
          role="dialog"
          aria-modal="true"
          aria-labelledby="drawer-staff-name"
        >
          <div className="w-full max-w-2xl bg-white h-full overflow-y-auto shadow-xl flex flex-col">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
              <div>
                <h2
                  id="drawer-staff-name"
                  className="text-base font-bold text-slate-900"
                >
                  {selectedRow.staff.nama}
                </h2>
                <p className="mt-0.5 font-mono text-xs tabular-nums text-slate-600">
                  {selectedRow.staff.noKp} · Fail #{selectedRow.staff.noFail ?? '-'} ·{' '}
                  {selectedRow.staff.tempatBertugas}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEditStaffModal(selectedRow.staff)}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  <span>Sunting Staf</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRow(null)}
                  aria-label="Tutup panel"
                  className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5 flex-1">
              <div className="grid grid-cols-3 divide-x divide-slate-200 rounded-lg border border-slate-200 bg-slate-50 text-center">
                <div className="py-3 px-2">
                  <div className="text-[11px] text-slate-500">Jumlah Hari</div>
                  <div className="font-mono text-lg font-bold tabular-nums text-slate-900">
                    {selectedRow.compliance.jumlahKeseluruhanHari} /{' '}
                    {selectedRow.compliance.sasaranHari}
                  </div>
                </div>
                <div className="py-3 px-2">
                  <div className="text-[11px] text-slate-500">Hari Kursus</div>
                  <div className="font-mono text-lg font-bold tabular-nums text-slate-900">
                    {selectedRow.compliance.kursusSahajaHari}
                  </div>
                </div>
                <div className="py-3 px-2">
                  <div className="text-[11px] text-slate-500">Perhimpunan (PDL)</div>
                  <div className="font-mono text-lg font-bold tabular-nums text-slate-900">
                    {selectedRow.compliance.perhimpunanHari}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">
                  Senarai Rekod Kursus ({staffLogs.length})
                </h3>
                <button
                  type="button"
                  onClick={() => onOpenAddLogForStaff(selectedRow.staff)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#0B1736] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#132554]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Tambah Kursus Pegawai Ini</span>
                </button>
              </div>

              {loadingLogs ? (
                <div className="py-10 text-center text-xs text-slate-500">
                  Memuatkan rekod kursus...
                </div>
              ) : staffLogs.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 py-10 text-center text-xs text-slate-600">
                  Tiada rekod kursus dicatatkan bagi pegawai ini.
                </div>
              ) : (
                <div className="divide-y divide-slate-200 rounded-lg border border-slate-200">
                  {staffLogs.map((l) => (
                    <div key={l.id} className="p-4 text-xs space-y-2">
                      {editingLogId === l.id ? (
                        <div className="space-y-2.5">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <select
                              value={logDraft.kodKursusPL}
                              onChange={(e) =>
                                setLogDraft((d) => ({
                                  ...d,
                                  kodKursusPL: e.target.value as PlCourseCode | '',
                                }))
                              }
                              className="rounded border border-slate-300 px-2 py-1 font-mono text-xs bg-white"
                            >
                              <option value="">Tiada Kod</option>
                              {PRIMARY_PL_CODES.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                            <input
                              type="date"
                              value={logDraft.tarikhMula}
                              onChange={(e) =>
                                setLogDraft((d) => ({ ...d, tarikhMula: e.target.value }))
                              }
                              className="rounded border border-slate-300 px-2 py-1 font-mono text-xs"
                            />
                            <input
                              type="number"
                              min={1}
                              max={60}
                              value={logDraft.bilanganHari}
                              onChange={(e) =>
                                setLogDraft((d) => ({
                                  ...d,
                                  bilanganHari: Number(e.target.value) || 1,
                                }))
                              }
                              className="rounded border border-slate-300 px-2 py-1 font-mono text-xs"
                            />
                          </div>
                          <input
                            type="text"
                            value={logDraft.tajuk}
                            onChange={(e) =>
                              setLogDraft((d) => ({ ...d, tajuk: e.target.value }))
                            }
                            className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={logDraft.tempat}
                              onChange={(e) =>
                                setLogDraft((d) => ({ ...d, tempat: e.target.value }))
                              }
                              placeholder="Tempat"
                              className="rounded border border-slate-300 px-2.5 py-1 text-xs"
                            />
                            <input
                              type="text"
                              value={logDraft.anjuran}
                              onChange={(e) =>
                                setLogDraft((d) => ({ ...d, anjuran: e.target.value }))
                              }
                              placeholder="Anjuran"
                              className="rounded border border-slate-300 px-2.5 py-1 text-xs"
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingLogId(null)}
                              className="rounded border border-slate-300 px-2.5 py-1 text-slate-700"
                            >
                              Batal
                            </button>
                            <button
                              type="button"
                              disabled={savingLogId === l.id}
                              onClick={() => handleSaveEditedLog(l.id)}
                              className="rounded bg-[#0B1736] px-3 py-1 font-medium text-white hover:bg-[#132554]"
                            >
                              Simpan Kursus
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-3">
                            <div className="font-semibold text-slate-900">{l.tajuk}</div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-mono font-semibold text-slate-800 whitespace-nowrap">
                                {l.kodKursusPL || 'TIADA KOD'} · {l.bilanganHari}h
                              </span>
                              <button
                                type="button"
                                title="Sunting kursus"
                                onClick={() => {
                                  setEditingLogId(l.id);
                                  setLogDraft({
                                    kodKursusPL: l.kodKursusPL ?? '',
                                    tajuk: l.tajuk,
                                    tarikhMula: l.tarikhMula,
                                    tarikhTamat: l.tarikhTamat,
                                    bilanganHari: l.bilanganHari || 1,
                                    tempat: l.tempat,
                                    anjuran: l.anjuran,
                                  });
                                }}
                                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-900"
                              >
                                <Edit2 className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                title="Padam kursus"
                                disabled={savingLogId === l.id}
                                onClick={() => handleDeleteCourseLog(l.id)}
                                className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-700"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                          <div className="text-slate-600">
                            <span className="font-mono tabular-nums">{l.tarikhMula}</span>
                            {l.tarikhTamat !== l.tarikhMula ? ` – ${l.tarikhTamat}` : ''} ·{' '}
                            {l.tempat} · {l.anjuran}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
