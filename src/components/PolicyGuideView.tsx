import { FileSpreadsheet } from 'lucide-react';
import {
  PL_COURSE_CODES,
  PRIMARY_PL_CODES,
} from '../utils/trainingRules';

export function PolicyGuideView() {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Panduan Kod Kursus
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href="/assets/aistudio/REKOD_KURSUS_TAHUN_2026_b9d2805c.csv"
              download="REKOD_KURSUS_TAHUN_2026.csv"
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Muat Turun CSV 2026</span>
            </a>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-3">
              Jadual Kod Aktiviti Latihan Perbadanan Labuan (Rekod Kursus 2026)
            </h3>
            <div className="overflow-hidden rounded-md border border-slate-200">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 font-medium text-slate-600">
                    <th className="px-4 py-2.5 w-20">Kod</th>
                    <th className="px-4 py-2.5">Keterangan Jenis Aktiviti</th>
                    <th className="px-4 py-2.5">Skop Penganjuran</th>
                    <th className="px-4 py-2.5">Pengiraan Dalam Sistem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {PRIMARY_PL_CODES.map((code) => {
                    const meta = PL_COURSE_CODES[code];
                    return (
                      <tr key={code}>
                        <td className="px-4 py-2.5 font-mono font-semibold text-slate-900">
                          {meta.code}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-slate-800">
                          {meta.label}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">{meta.skop}</td>
                        <td className="px-4 py-2.5 text-slate-600">
                          {meta.isAssembly
                            ? 'Dikira sebagai Perhimpunan / Program Dalaman & Jumlah Tahunan'
                            : 'Dikira sebagai Hari Kursus & Jumlah Tahunan'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3 text-sm text-slate-700">
            <h3 className="font-semibold text-slate-900">
              Sasaran Tahunan &amp; Kaedah Prorate
            </h3>
            <p className="text-xs leading-relaxed">
              Bagi rekod latihan Tahun 2026, pencapaian kakitangan dipantau berdasarkan sasaran <strong>4 hari berkursus setahun</strong> (dipecahkan kepada kumpulan 0 hari, 1 hari, 2 hari, 3 hari, dan &ge; 4 hari). Bagi kakitangan lantikan baharu (&lt; 11 bulan berkhidmat), sasaran dikira secara prorate:
            </p>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800">
              Sasaran Prorate = (Bulan Berkhidmat / 12) &times; 4 hari (penggenapan)
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
