import { ArrowUpRight, Download } from 'lucide-react';
import { useState } from 'react';
import type { AnalyticsOverview } from '../types/training';
import { PL_COURSE_CODES, PRIMARY_PL_CODES } from '../utils/trainingRules';

interface PlbAnalyticsViewProps {
  analytics: AnalyticsOverview;
  onJumpToDepartment: (jabatan: string) => void;
  onJumpToAudit: () => void;
  onExportNormalized: () => Promise<void>;
}

export function PlbAnalyticsView({
  analytics,
  onJumpToDepartment,
  onJumpToAudit,
  onExportNormalized,
}: PlbAnalyticsViewProps) {
  const [exporting, setExporting] = useState(false);
  const [deptSort, setDeptSort] = useState<'staff' | 'rate' | 'avg'>('staff');

  const pct = (count: number, total: number) =>
    total === 0 ? '0.0%' : `${((count / total) * 100).toFixed(1)}%`;

  const sortedDepts = [...analytics.byDepartment].sort((a, b) => {
    if (deptSort === 'rate') return b.complianceRate - a.complianceRate;
    if (deptSort === 'avg') return b.avgDays - a.avgDays;
    return b.totalStaff - a.totalStaff;
  });

  const maxCodeDays = Math.max(
    1,
    ...PRIMARY_PL_CODES.map((code) => analytics.codeTotals[code]),
    analytics.codeTotals.TIADA_KOD
  );

  const distBuckets = [
    {
      label: 'Memenuhi Sasaran (>= 4 Hari)',
      count: analytics.distribution.fourPlusDays,
      barColor: 'bg-emerald-600',
      textColor: 'text-emerald-700',
    },
    {
      label: '3 Hari (Kurang 1 Hari)',
      count: analytics.distribution.threeDays,
      barColor: 'bg-[#0B1736]',
      textColor: 'text-slate-900',
    },
    {
      label: '2 Hari (Kurang 2 Hari)',
      count: analytics.distribution.twoDays,
      barColor: 'bg-slate-600',
      textColor: 'text-slate-800',
    },
    {
      label: '1 Hari (Kurang 3 Hari)',
      count: analytics.distribution.oneDay,
      barColor: 'bg-amber-600',
      textColor: 'text-amber-700',
    },
    {
      label: '0 Hari (Belum Berkursus)',
      count: analytics.distribution.zeroDays,
      barColor: 'bg-red-600',
      textColor: 'text-red-700',
    },
  ];

  const handleExport = async () => {
    setExporting(true);
    try {
      await onExportNormalized();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-slate-900">
            Analitik Pematuhan Kursus &amp; Latihan ({analytics.tahun})
          </h1>
          <p className="mt-0.5 text-xs text-slate-600">
            Pengiraan automatik bebas ralat <span className="font-mono">#REF!</span> daripada {analytics.totalStaff} rekod kakitangan dan {analytics.totalCourses.toLocaleString()} catatan kursus.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {analytics.anomalies.length > 0 && (
            <button
              type="button"
              onClick={onJumpToAudit}
              className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 hover:bg-amber-100 transition-colors whitespace-nowrap"
            >
              <span>{analytics.anomalies.length} Anomali Data</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            disabled={exporting}
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{exporting ? 'Menjana CSV...' : 'Eksport Laporan Ternormal (CSV)'}</span>
          </button>
        </div>
      </div>

      <section
        aria-label="Metrik Utama Organisasi"
        className="grid grid-cols-2 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 rounded-lg border border-slate-200 bg-white"
      >
        <div className="px-5 py-4">
          <div className="text-xs font-medium text-slate-500">Jumlah Kakitangan Aktif</div>
          <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-slate-900">
            {analytics.totalStaff}
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            {analytics.byDepartment.length} jabatan induk
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="text-xs font-medium text-slate-500">Patuh Sasaran (&ge;4 Hari)</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold tabular-nums text-emerald-700">
              {analytics.compliantCount}
            </span>
            <span className="font-mono text-xs tabular-nums text-emerald-700">
              ({analytics.complianceRate}%)
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            {analytics.totalStaff - analytics.compliantCount} pegawai belum mencapai 4 hari
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="text-xs font-medium text-slate-500">Jumlah Hari Berkursus</div>
          <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-slate-900">
            {analytics.totalTrainingDays.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            Purata {analytics.avgDaysPerStaff} hari / pegawai
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="text-xs font-medium text-slate-500">Kursus vs Perhimpunan (PDL)</div>
          <div className="mt-1 flex items-baseline gap-2 font-mono tabular-nums">
            <span className="text-2xl font-semibold text-slate-900">
              {analytics.totalCourseOnlyDays.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500">kursus</span>
            <span className="text-slate-300">·</span>
            <span className="text-lg font-semibold text-slate-700">
              {analytics.totalAssemblyDays.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500">PDL</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Pemisahan automatik kod PDL
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="text-xs font-medium text-slate-500">Pemulihan Formula Excel</div>
          <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#0B1736]">
            {analytics.auditStats.excelFormulaRefRowsFixed}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Baris ralat #REF!/#N/A dipulihkan
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-6 rounded-lg border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Taburan Pencapaian Hari Berkursus
              </h2>
              <p className="text-xs text-slate-500">
                Menggantikan lajur ringkasan 0 hari, 1 hari, 2 hari, 3 hari, dan &ge; 4 hari
              </p>
            </div>
            <span className="font-mono text-xs tabular-nums text-slate-500">
              n = {analytics.totalStaff}
            </span>
          </div>

          <div className="space-y-3.5">
            {distBuckets.map((b) => {
              const widthPct =
                analytics.totalStaff > 0
                  ? Math.max(2, (b.count / analytics.totalStaff) * 100)
                  : 0;
              return (
                <div key={b.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{b.label}</span>
                    <span className={`font-mono font-semibold tabular-nums ${b.textColor}`}>
                      {b.count} pegawai ({pct(b.count, analytics.totalStaff)})
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-sm bg-slate-100">
                    <div
                      className={`h-full ${b.barColor}`}
                      style={{ width: `${b.count === 0 ? 0 : widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="lg:col-span-6 rounded-lg border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Pecahan Hari Mengikut Kod Jenis Kursus
              </h2>
              <p className="text-xs text-slate-500">
                Agregasi tepat kod <span className="font-mono">CDL · TDL · SDL · KDL · PDL · KL · SL · BL</span>
              </p>
            </div>
            {analytics.codeTotals.TIADA_KOD > 0 && (
              <span className="font-mono text-xs tabular-nums text-amber-700">
                {analytics.codeTotals.TIADA_KOD} tanpa kod
              </span>
            )}
          </div>

          <div className="space-y-2.5">
            {PRIMARY_PL_CODES.map((code) => {
              const val = analytics.codeTotals[code];
              const meta = PL_COURSE_CODES[code];
              const widthPct = Math.round((val / maxCodeDays) * 100);
              return (
                <div key={code} className="grid grid-cols-12 items-center gap-3 text-xs">
                  <div className="col-span-2 font-mono font-semibold text-slate-900">
                    {code}
                  </div>
                  <div className="col-span-4 truncate text-slate-600" title={meta.label}>
                    {meta.label}
                  </div>
                  <div className="col-span-4 h-2 overflow-hidden rounded-sm bg-slate-100">
                    <div
                      className="h-full bg-[#0B1736]"
                      style={{ width: `${val === 0 ? 0 : Math.max(3, widthPct)}%` }}
                    />
                  </div>
                  <div className="col-span-2 text-right font-mono tabular-nums text-slate-900">
                    {val.toLocaleString()} h
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Mengikut Kategori Kakitangan</h3>
          </div>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="px-4 py-2 text-left font-medium">Kategori</th>
                <th className="px-4 py-2 text-right font-medium">Staf</th>
                <th className="px-4 py-2 text-right font-medium">Purata</th>
                <th className="px-4 py-2 text-right font-medium">Patuh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {analytics.byKategori.map((m) => (
                <tr key={m.label}>
                  <td className="px-4 py-2.5 font-medium text-slate-900">{m.label}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700">
                    {m.totalStaff}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700">
                    {m.avgDays}h
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-emerald-700">
                    {m.complianceRate}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Mengikut Taraf Jawatan</h3>
          </div>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="px-4 py-2 text-left font-medium">Taraf Jawatan</th>
                <th className="px-4 py-2 text-right font-medium">Staf</th>
                <th className="px-4 py-2 text-right font-medium">Purata</th>
                <th className="px-4 py-2 text-right font-medium">Patuh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {analytics.byTarafJawatan.map((m) => (
                <tr key={m.label}>
                  <td className="px-4 py-2.5 font-medium text-slate-900">{m.label}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700">
                    {m.totalStaff}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700">
                    {m.avgDays}h
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-emerald-700">
                    {m.complianceRate}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Mengikut Jantina</h3>
          </div>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="px-4 py-2 text-left font-medium">Jantina</th>
                <th className="px-4 py-2 text-right font-medium">Staf</th>
                <th className="px-4 py-2 text-right font-medium">Purata</th>
                <th className="px-4 py-2 text-right font-medium">Patuh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {analytics.byGender.map((m) => (
                <tr key={m.label}>
                  <td className="px-4 py-2.5 font-medium text-slate-900">{m.label}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700">
                    {m.totalStaff}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700">
                    {m.avgDays}h
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-emerald-700">
                    {m.complianceRate}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Jadual Pematuhan Mengikut Jabatan Induk (Nama Jabatan Diseragamkan)
            </h2>
            <p className="text-xs text-slate-500">
              Klik mana-mana jabatan untuk menyaring kakitangan jabatan tersebut dalam direktori.
            </p>
          </div>
          <div className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 p-0.5">
            {(
              [
                { id: 'staff', label: 'Bilangan Staf' },
                { id: 'rate', label: 'Kadar Patuh' },
                { id: 'avg', label: 'Purata Hari' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDeptSort(opt.id)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  deptSort === opt.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-medium text-slate-600">
                <th className="px-4 py-2.5">Jabatan Induk</th>
                <th className="px-4 py-2.5 text-right">Staf</th>
                <th className="px-4 py-2.5 text-right">0h</th>
                <th className="px-4 py-2.5 text-right">1h</th>
                <th className="px-4 py-2.5 text-right">2h</th>
                <th className="px-4 py-2.5 text-right">3h</th>
                <th className="px-4 py-2.5 text-right text-emerald-700">&ge;4h (Patuh)</th>
                <th className="px-4 py-2.5 text-right">Purata</th>
                <th className="px-4 py-2.5 text-right">Pematuhan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sortedDepts.map((dept) => (
                <tr
                  key={dept.jabatan}
                  onClick={() => onJumpToDepartment(dept.jabatan)}
                  className="cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <td className="px-4 py-2.5 font-medium text-slate-900">
                    {dept.jabatan}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700">
                    {dept.totalStaff}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-red-700">
                    {dept.zeroDays}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-600">
                    {dept.oneDay}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-600">
                    {dept.twoDays}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700">
                    {dept.threeDays}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-emerald-700">
                    {dept.fourPlusDays}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700">
                    {dept.avgDays}h
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-slate-900">
                    {dept.complianceRate}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-slate-900">
            Program &amp; Kursus Penyertaan Tertinggi ({analytics.tahun})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-medium text-slate-600">
                <th className="px-4 py-2.5 w-12 text-center">#</th>
                <th className="px-4 py-2.5">Tajuk Program / Kursus</th>
                <th className="px-4 py-2.5 whitespace-nowrap">Kod</th>
                <th className="px-4 py-2.5 whitespace-nowrap">Anjuran</th>
                <th className="px-4 py-2.5 text-right whitespace-nowrap">Peserta</th>
                <th className="px-4 py-2.5 text-right whitespace-nowrap">Jumlah Hari Terkumpul</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {analytics.topCourses.map((c, idx) => (
                <tr key={c.tajuk + idx} className="hover:bg-slate-50/70">
                  <td className="px-4 py-2.5 text-center font-mono tabular-nums text-slate-500">
                    {idx + 1}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-slate-900">{c.tajuk}</td>
                  <td className="px-4 py-2.5 font-mono font-semibold text-slate-800">
                    {c.kod}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{c.anjuran}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-slate-900">
                    {c.peserta}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700">
                    {c.jumlahHari} hari
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
