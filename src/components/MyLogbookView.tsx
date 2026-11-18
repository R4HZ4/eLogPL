import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type {
  ComplianceBreakdown,
  PlCourseCode,
  StaffAccount,
  TrainingLogEntry,
} from '../types/training';
import { CATEGORY_LABELS, PRIMARY_PL_CODES } from '../utils/trainingRules';

interface MyLogbookViewProps {
  user: StaffAccount;
  tahun: number;
  logs: TrainingLogEntry[];
  compliance: ComplianceBreakdown;
  onAddLog: () => void;
  onDeleteLog: (id: string) => Promise<void>;
}

const VERIFICATION_LABEL: Record<TrainingLogEntry['statusPengesahan'], string> = {
  disahkan: 'Disahkan',
  menunggu: 'Menunggu Pengesahan',
  ditolak: 'Ditolak',
};

const VERIFICATION_COLOR: Record<TrainingLogEntry['statusPengesahan'], string> = {
  disahkan: 'text-emerald-700',
  menunggu: 'text-amber-700',
  ditolak: 'text-red-700',
};

export function MyLogbookView({
  user,
  tahun,
  logs,
  compliance,
  onAddLog,
  onDeleteLog,
}: MyLogbookViewProps) {
  const [codeFilter, setCodeFilter] = useState<'all' | 'PERHIMPUNAN' | 'KURSUS' | PlCourseCode>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const visibleLogs = logs.filter((l) => {
    if (codeFilter === 'all') return true;
    if (codeFilter === 'PERHIMPUNAN') return Boolean(l.isAssembly || l.kodKursusPL === 'PDL');
    if (codeFilter === 'KURSUS') return !l.isAssembly && l.kodKursusPL !== 'PDL';
    return l.kodKursusPL === codeFilter;
  });

  const activeCodes = PRIMARY_PL_CODES.filter(
    (code) => compliance.kodBreakdown[code] > 0
  );

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 text-sm">
          <div className="lg:col-span-2">
            <div className="text-xs font-medium text-slate-500">Nama Pegawai</div>
            <div className="mt-0.5 font-semibold text-slate-900">{user.nama}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">No. K/P &amp; No. Pekerja</div>
            <div className="mt-0.5 font-mono text-xs tabular-nums text-slate-900">
              {user.noKp}
              {user.noFail ? ` · #${user.noFail}` : ''}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Jawatan · Klasifikasi/Gred</div>
            <div className="mt-0.5 text-slate-900">
              {user.jawatan}{' '}
              <span className="font-mono text-xs text-slate-600">
                ({user.klasifikasi ? `${user.klasifikasi} ` : ''}{user.gred})
              </span>
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Jabatan / Unit</div>
            <div className="mt-0.5 text-slate-900">{user.tempatBertugas}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500">Taraf &amp; Kategori</div>
            <div className="mt-0.5 text-slate-900">
              {user.tarafJawatan ?? 'Tetap'} · {user.kategoriPerkhidmatan ?? 'Sok I'}
            </div>
          </div>
        </div>
      </section>

      <section
        aria-label="Ringkasan pematuhan latihan"
        className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 rounded-lg border border-slate-200 bg-white"
      >
        <div className="px-5 py-4">
          <div className="text-xs font-medium text-slate-500">
            Jumlah Hari / Sasaran ({tahun})
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={`font-mono text-2xl font-semibold tabular-nums ${
                compliance.memenuhiSasaranJumlah ? 'text-emerald-700' : 'text-slate-900'
              }`}
            >
              {compliance.jumlahKeseluruhanHari}
            </span>
            <span className="font-mono text-sm tabular-nums text-slate-500">
              / {compliance.sasaranHari} hari
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {compliance.patuhSepenuhnya
              ? 'Memenuhi sasaran tahunan'
              : `Kurang ${Math.max(0, compliance.sasaranHari - compliance.jumlahKeseluruhanHari)} hari lagi`}
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="text-xs font-medium text-slate-500">
            Kursus &amp; Latihan (Bukan PDL)
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold tabular-nums text-slate-900">
              {compliance.kursusSahajaHari}
            </span>
            <span className="font-mono text-sm tabular-nums text-slate-500">hari</span>
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            CDL {compliance.kodBreakdown.CDL} · KDL {compliance.kodBreakdown.KDL} · KL {compliance.kodBreakdown.KL}
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="text-xs font-medium text-slate-500">
            Perhimpunan &amp; Program (PDL)
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold tabular-nums text-slate-900">
              {compliance.perhimpunanHari}
            </span>
            <span className="font-mono text-sm tabular-nums text-slate-500">hari</span>
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            {compliance.bilanganRekodKursus} rekod disahkan keseluruhan
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="text-xs font-medium text-slate-500">
            Menunggu Pengesahan
          </div>
          <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-amber-700">
            {logs.filter((l) => l.statusPengesahan === 'menunggu').length}
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            Anggaran {compliance.jumlahHariMenunggu} hari menunggu
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Tapis mengikut jenis aktiviti"
          className="inline-flex flex-wrap items-center rounded-md border border-slate-200 bg-slate-100 p-0.5"
        >
          {(
            [
              { id: 'all', label: `Semua (${logs.length})` },
              { id: 'KURSUS', label: 'Kursus & Ceramah' },
              { id: 'PERHIMPUNAN', label: 'Perhimpunan (PDL)' },
              ...activeCodes.map((c) => ({ id: c, label: c })),
            ] as Array<{ id: typeof codeFilter; label: string }>
          ).map((tab) => {
            const active = codeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCodeFilter(tab.id)}
                className={`rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onAddLog}
          className="inline-flex items-center gap-2 rounded-md bg-[#0B1736] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#132554] transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Catat Kehadiran Latihan</span>
        </button>
      </div>

      {visibleLogs.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white px-6 py-14 text-center">
          <h3 className="text-base font-semibold text-slate-900">
            Tiada catatan latihan ditemui
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            Klik butang di bawah untuk merekod kehadiran kursus, ceramah, taklimat, perhimpunan, atau pembelajaran kendiri anda.
          </p>
          <div className="mt-5">
            <button
              type="button"
              onClick={onAddLog}
              className="rounded-md bg-[#0B1736] px-4 py-2 text-sm font-medium text-white hover:bg-[#132554] whitespace-nowrap"
            >
              Catat Latihan Pertama
            </button>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                  <th className="px-4 py-2.5 whitespace-nowrap">Tarikh</th>
                  <th className="px-4 py-2.5">Tajuk &amp; Aktiviti</th>
                  <th className="px-4 py-2.5 whitespace-nowrap">Kod / Kategori</th>
                  <th className="px-4 py-2.5">Tempat &amp; Anjuran</th>
                  <th className="px-4 py-2.5 text-right whitespace-nowrap">Tempoh</th>
                  <th className="px-4 py-2.5 whitespace-nowrap">Pengesahan</th>
                  <th className="px-4 py-2.5 text-right whitespace-nowrap">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {visibleLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs tabular-nums text-slate-700 whitespace-nowrap align-top">
                      <div>{log.tarikhMula}</div>
                      {log.tarikhTamat !== log.tarikhMula && (
                        <div className="text-slate-400">hingga {log.tarikhTamat}</div>
                      )}
                      {log.tarikhAsal && (
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Asal CSV: {log.tarikhAsal}
                        </div>
                      )}
                      {log.masaMula && log.masaTamat && (
                        <div className="text-slate-500 mt-0.5">
                          {log.masaMula}–{log.masaTamat}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 align-top max-w-sm">
                      <div className="font-medium text-slate-900">{log.tajuk}</div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {log.jenisAktiviti}
                      </div>
                      {log.pegawaiPenyelia && (
                        <div className="mt-0.5 text-xs text-slate-500">
                          Penyelia: {log.pegawaiPenyelia}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-xs text-slate-700 whitespace-nowrap align-top">
                      <div className="font-mono font-semibold text-slate-900">
                        {log.kodKursusPL || (log.kodKursusPL === '' ? 'TIADA KOD' : '-')}
                      </div>
                      <div className="text-slate-500 mt-0.5">
                        {CATEGORY_LABELS[log.kategori]}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-xs text-slate-600 align-top max-w-[220px]">
                      <div className="text-slate-800">{log.tempat}</div>
                      <div className="text-slate-500 mt-0.5">{log.anjuran}</div>
                    </td>

                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-slate-900 whitespace-nowrap align-top">
                      {log.bilanganHari > 0
                        ? `${log.bilanganHari} hari`
                        : `${log.jumlahJam} jam`}
                    </td>

                    <td className="px-4 py-3 align-top whitespace-nowrap">
                      <div
                        className={`text-xs font-semibold ${
                          VERIFICATION_COLOR[log.statusPengesahan]
                        }`}
                      >
                        {VERIFICATION_LABEL[log.statusPengesahan]}
                      </div>
                      {log.disahkanOleh && (
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          {log.disahkanOleh} · {log.tarikhPengesahan}
                        </div>
                      )}
                      {log.catatanPengesah && (
                        <div className="mt-0.5 text-[11px] text-slate-500 max-w-[180px] truncate">
                          Catatan: {log.catatanPengesah}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right whitespace-nowrap align-top">
                      {log.statusPengesahan !== 'disahkan' && (
                        <button
                          type="button"
                          disabled={deletingId === log.id}
                          onClick={async () => {
                            setDeletingId(log.id);
                            try {
                              await onDeleteLog(log.id);
                            } finally {
                              setDeletingId(null);
                            }
                          }}
                          title="Padam catatan ini"
                          aria-label={`Padam ${log.tajuk}`}
                          className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700 disabled:opacity-40 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
