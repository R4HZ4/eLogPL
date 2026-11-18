import { Printer, Save } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import type {
  ComplianceBreakdown,
  StaffAccount,
  StaffTnaRecord,
} from '../types/training';

interface TnaAndCertificateViewProps {
  user: StaffAccount;
  tahun: number;
  compliance: ComplianceBreakdown;
  tna: StaffTnaRecord;
  onSaveTna: (payload: {
    tahun: number;
    sebabTidakMemenuhi: [string, string, string];
    kursusDiperlukan: [string, string, string, string, string];
  }) => Promise<void>;
}

export function TnaAndCertificateView({
  user,
  tahun,
  compliance,
  tna,
  onSaveTna,
}: TnaAndCertificateViewProps) {
  const [reasons, setReasons] = useState<[string, string, string]>(
    tna.sebabTidakMemenuhi
  );
  const [courses, setCourses] = useState<[string, string, string, string, string]>(
    tna.kursusDiperlukan
  );
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    setReasons(tna.sebabTidakMemenuhi);
    setCourses(tna.kursusDiperlukan);
  }, [tna]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedMessage(null);
    try {
      await onSaveTna({
        tahun,
        sebabTidakMemenuhi: reasons,
        kursusDiperlukan: courses,
      });
      setSavedMessage('Rekod TNA dan catatan telah disimpan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Penyata Pengesahan Kehadiran Kursus &amp; Latihan ({tahun})
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Ringkasan rasmi berdasarkan catatan kursus dan perhimpunan yang disahkan oleh Unit Latihan, JPSM.
            </p>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap print:hidden"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Cetak Penyata</span>
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-slate-300 text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs font-semibold text-slate-700">
                  <th className="border border-slate-300 px-4 py-2.5 w-16 text-center">
                    Bil
                  </th>
                  <th className="border border-slate-300 px-4 py-2.5 text-left">
                    Komponen Program Latihan
                  </th>
                  <th className="border border-slate-300 px-4 py-2.5 w-40 text-right">
                    Bilangan Hari
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-slate-300 px-4 py-2.5 text-center font-mono tabular-nums">
                    1
                  </td>
                  <td className="border border-slate-300 px-4 py-2.5">
                    Kursus, Seminar, Bengkel, Ceramah &amp; Taklimat (CDL / TDL / SDL / KDL / KL / SL / BL)
                  </td>
                  <td className="border border-slate-300 px-4 py-2.5 text-right font-mono tabular-nums">
                    {compliance.kursusSahajaHari}
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-300 px-4 py-2.5 text-center font-mono tabular-nums">
                    2
                  </td>
                  <td className="border border-slate-300 px-4 py-2.5">
                    Perhimpunan Pagi &amp; Program Dalaman PL (PDL)
                  </td>
                  <td className="border border-slate-300 px-4 py-2.5 text-right font-mono tabular-nums">
                    {compliance.perhimpunanHari}
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-300 px-4 py-2.5 text-center font-mono tabular-nums">
                    3
                  </td>
                  <td className="border border-slate-300 px-4 py-2.5">
                    Pembelajaran Kendiri / EPSA ({compliance.kendiriBilangan} pembentangan)
                  </td>
                  <td className="border border-slate-300 px-4 py-2.5 text-right font-mono tabular-nums">
                    {compliance.kendiriHariDikira}
                  </td>
                </tr>
                <tr className="bg-slate-50 font-semibold">
                  <td
                    colSpan={2}
                    className="border border-slate-300 px-4 py-2.5 text-right"
                  >
                    Jumlah Keseluruhan (Sasaran Tahunan: {compliance.sasaranHari} hari)
                  </td>
                  <td className="border border-slate-300 px-4 py-2.5 text-right font-mono tabular-nums text-slate-900">
                    {compliance.jumlahKeseluruhanHari} hari
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50 p-5 text-sm leading-relaxed text-slate-800">
            Disahkan bahawa{' '}
            <strong className="font-semibold text-slate-900">{user.nama}</strong>, No. K/P:{' '}
            <strong className="font-mono font-semibold tabular-nums text-slate-900">
              {user.noKp}
            </strong>
            {user.noFail ? (
              <>
                , No. Pekerja:{' '}
                <strong className="font-mono font-semibold tabular-nums text-slate-900">
                  #{user.noFail}
                </strong>
              </>
            ) : null}
            , Gred:{' '}
            <strong className="font-mono font-semibold text-slate-900">
              {user.klasifikasi ? `${user.klasifikasi} ` : ''}
              {user.gred}
            </strong>
            , Jabatan / Unit:{' '}
            <strong className="font-semibold text-slate-900">
              {user.tempatBertugas}
            </strong>{' '}
            telah menghadiri{' '}
            <strong className="font-mono font-semibold tabular-nums text-slate-900">
              {compliance.jumlahKeseluruhanHari} hari
            </strong>{' '}
            kursus dan program latihan yang disahkan pada tahun{' '}
            <strong className="font-mono font-semibold tabular-nums">{tahun}</strong>.
          </div>
        </div>
      </section>

      <form
        onSubmit={handleSave}
        className="rounded-lg border border-slate-200 bg-white overflow-hidden"
      >
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Analisis Keperluan Latihan (TNA) &amp; Catatan Pematuhan
          </h2>
          <p className="mt-0.5 text-xs text-slate-600">
            Diisi oleh pegawai sebagai panduan perancangan kursus tahun berikutnya.
          </p>
        </div>

        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Senarai Kursus Yang Diperlukan (TNA)
            </h3>
            {courses.map((val, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <span className="w-6 text-right font-mono text-xs tabular-nums text-slate-500">
                  {idx + 1}.
                </span>
                <input
                  type="text"
                  value={val}
                  onChange={(e) => {
                    const next = [...courses] as [string, string, string, string, string];
                    next[idx] = e.target.value;
                    setCourses(next);
                  }}
                  placeholder={`Cadangan kursus #${idx + 1}`}
                  className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0B1736] focus:outline-none"
                />
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Sebab Jika Tidak Memenuhi Sasaran {compliance.sasaranHari} Hari Berkursus
            </h3>
            {(['a', 'b', 'c'] as const).map((letter, idx) => (
              <div key={letter} className="flex items-center gap-3">
                <span className="w-6 text-right font-mono text-xs text-slate-500">
                  {letter})
                </span>
                <input
                  type="text"
                  value={reasons[idx]}
                  onChange={(e) => {
                    const next = [...reasons] as [string, string, string];
                    next[idx] = e.target.value;
                    setReasons(next);
                  }}
                  placeholder={`Sebab ${letter} (jika berkaitan)`}
                  className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0B1736] focus:outline-none"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <div className="text-xs text-emerald-700 font-medium">
            {savedMessage ?? ''}
          </div>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-md bg-[#0B1736] px-4 py-2 text-xs font-medium text-white hover:bg-[#132554] disabled:opacity-50 whitespace-nowrap"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{saving ? 'Menyimpan...' : 'Simpan TNA & Catatan'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
