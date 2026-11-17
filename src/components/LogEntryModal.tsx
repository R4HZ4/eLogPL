import { X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import type {
  PlCourseCode,
  TrainingCategory,
  TrainingLocationScope,
  TrainingLogEntry,
} from '../types/training';
import {
  ACTIVITY_TYPES_BY_CATEGORY,
  CATEGORY_LABELS,
  PL_COURSE_CODES,
  PRIMARY_PL_CODES,
  calculateDurationHours,
} from '../utils/trainingRules';

interface LogEntryModalProps {
  isOpen: boolean;
  tahun: number;
  targetStaffId?: string;
  targetStaffName?: string;
  onClose: () => void;
  onCreated: (entry: TrainingLogEntry) => void;
  onSubmitLog?: (payload: Record<string, unknown>) => Promise<TrainingLogEntry>;
  apiFetch: <T>(url: string, init?: RequestInit) => Promise<T>;
}

export function LogEntryModal({
  isOpen,
  tahun,
  targetStaffId,
  targetStaffName,
  onClose,
  onCreated,
  onSubmitLog,
  apiFetch,
}: LogEntryModalProps) {
  const [entryMode, setEntryMode] = useState<'pl_code' | 'hourly'>('pl_code');
  const [kodKursusPL, setKodKursusPL] = useState<PlCourseCode>('KDL');
  const [kategori, setKategori] = useState<TrainingCategory>('latihan_bermodul');
  const [jenisAktiviti, setJenisAktiviti] = useState(
    ACTIVITY_TYPES_BY_CATEGORY.latihan_bermodul[0]
  );
  const [lokasiSkop, setLokasiSkop] = useState<TrainingLocationScope>('dalam_negara');
  const [tajuk, setTajuk] = useState('');
  const [tarikhMula, setTarikhMula] = useState(`${tahun}-05-15`);
  const [tarikhTamat, setTarikhTamat] = useState(`${tahun}-05-15`);
  const [bilanganHari, setBilanganHari] = useState(1);
  const [masaMula, setMasaMula] = useState('09:00');
  const [masaTamat, setMasaTamat] = useState('12:00');
  const [tempat, setTempat] = useState('');
  const [anjuran, setAnjuran] = useState('PL');
  const [sumber, setSumber] = useState('');
  const [pegawaiPenyelia, setPegawaiPenyelia] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setJenisAktiviti(ACTIVITY_TYPES_BY_CATEGORY[kategori][0]);
  }, [kategori]);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const computedHours = calculateDurationHours(masaMula, masaTamat);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload =
        entryMode === 'pl_code'
          ? {
              staffId: targetStaffId,
              tahun,
              kodKursusPL,
              kategori: PL_COURSE_CODES[kodKursusPL].kategori,
              jenisAktiviti: `${PL_COURSE_CODES[kodKursusPL].label} (${kodKursusPL})`,
              tajuk,
              tarikhMula,
              tarikhTamat,
              bilanganHari,
              tempat,
              anjuran,
              keterangan,
              autoVerify: Boolean(targetStaffId),
            }
          : {
              staffId: targetStaffId,
              tahun,
              kategori,
              jenisAktiviti,
              lokasiSkop: kategori === 'latihan_bermodul' ? lokasiSkop : undefined,
              tajuk,
              tarikhMula,
              tarikhTamat: kategori === 'latihan_bermodul' ? tarikhTamat : tarikhMula,
              bilanganHari: kategori === 'latihan_bermodul' ? bilanganHari : 1,
              masaMula:
                kategori === 'pembelajaran_bersemuka' ||
                kategori === 'pembelajaran_tidak_bersemuka'
                  ? masaMula
                  : undefined,
              masaTamat:
                kategori === 'pembelajaran_bersemuka' ||
                kategori === 'pembelajaran_tidak_bersemuka'
                  ? masaTamat
                  : undefined,
              jumlahJam:
                kategori === 'pembelajaran_bersemuka' ||
                kategori === 'pembelajaran_tidak_bersemuka'
                  ? computedHours
                  : undefined,
              tempat,
              anjuran,
              sumber: kategori === 'pembelajaran_kendiri' ? sumber : undefined,
              pegawaiPenyelia:
                kategori === 'pembelajaran_kendiri' ? pegawaiPenyelia : undefined,
              keterangan,
              autoVerify: Boolean(targetStaffId),
            };

      const createdLog = onSubmitLog
        ? await onSubmitLog(payload)
        : (
            await apiFetch<{ log: TrainingLogEntry }>('/api/training-logs', {
              method: 'POST',
              body: JSON.stringify(payload),
            })
          ).log;
      setTajuk('');
      setTempat('');
      setAnjuran('PL');
      setSumber('');
      setPegawaiPenyelia('');
      setKeterangan('');
      onCreated(createdLog);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan rekod latihan.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="log-modal-title"
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2
              id="log-modal-title"
              className="text-base font-semibold text-slate-900"
            >
              Rekod Kehadiran Aktiviti Latihan ({tahun})
            </h2>
            {targetStaffName && (
              <p className="text-xs text-slate-500 mt-0.5">
                Pegawai: {targetStaffName}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup borang"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800"
            >
              {error}
            </div>
          )}

          <div
            role="tablist"
            aria-label="Jenis pengelasan rekod"
            className="grid grid-cols-2 rounded-md border border-slate-200 bg-slate-100 p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={entryMode === 'pl_code'}
              onClick={() => setEntryMode('pl_code')}
              className={`rounded py-1.5 text-xs font-medium transition-colors ${
                entryMode === 'pl_code'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Kod Rasmi Kursus PL (CDL/KDL/PDL/KL)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={entryMode === 'hourly'}
              onClick={() => setEntryMode('hourly')}
              className={`rounded py-1.5 text-xs font-medium transition-colors ${
                entryMode === 'hourly'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sesi Berjam (&lt;6j) / Kendiri EPSA
            </button>
          </div>

          {entryMode === 'pl_code' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="log-pl-code"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Kod Jenis Kursus (JENIS KURSUS) *
                </label>
                <select
                  id="log-pl-code"
                  value={kodKursusPL}
                  onChange={(e) => setKodKursusPL(e.target.value as PlCourseCode)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0B1736] focus:outline-none"
                >
                  {PRIMARY_PL_CODES.map((code) => (
                    <option key={code} value={code}>
                      {code} — {PL_COURSE_CODES[code].label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="log-hari-pl"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Bilangan Hari *
                </label>
                <input
                  id="log-hari-pl"
                  type="number"
                  min={1}
                  max={60}
                  required
                  value={bilanganHari}
                  onChange={(e) => setBilanganHari(Number(e.target.value) || 1)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm tabular-nums text-slate-900 focus:border-[#0B1736] focus:outline-none"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="log-kategori"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Kategori Program Latihan *
                </label>
                <select
                  id="log-kategori"
                  value={kategori}
                  onChange={(e) => setKategori(e.target.value as TrainingCategory)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0B1736] focus:outline-none"
                >
                  {(Object.keys(CATEGORY_LABELS) as TrainingCategory[]).map((key) => (
                    <option key={key} value={key}>
                      {CATEGORY_LABELS[key]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="log-jenis"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Jenis Aktiviti *
                </label>
                <select
                  id="log-jenis"
                  value={jenisAktiviti}
                  onChange={(e) => setJenisAktiviti(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0B1736] focus:outline-none"
                >
                  {ACTIVITY_TYPES_BY_CATEGORY[kategori].map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="log-tajuk"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Tajuk Kursus / Program *
            </label>
            <input
              id="log-tajuk"
              type="text"
              required
              value={tajuk}
              onChange={(e) => setTajuk(e.target.value)}
              placeholder="cth. Kursus Tatacara Pengurusan Aset dan Stor 2026"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0B1736] focus:outline-none"
            />
          </div>

          {entryMode === 'pl_code' || kategori === 'latihan_bermodul' ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {entryMode === 'hourly' && (
                <div>
                  <label
                    htmlFor="log-skop"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    Lokasi Kursus *
                  </label>
                  <select
                    id="log-skop"
                    value={lokasiSkop}
                    onChange={(e) =>
                      setLokasiSkop(e.target.value as TrainingLocationScope)
                    }
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0B1736] focus:outline-none"
                  >
                    <option value="dalam_negara">Dalam Negara</option>
                    <option value="luar_negara">Luar Negara</option>
                  </select>
                </div>
              )}
              <div>
                <label
                  htmlFor="log-mula"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Tarikh Mula *
                </label>
                <input
                  id="log-mula"
                  type="date"
                  required
                  value={tarikhMula}
                  onChange={(e) => setTarikhMula(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-[#0B1736] focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="log-tamat"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Tarikh Tamat *
                </label>
                <input
                  id="log-tamat"
                  type="date"
                  required
                  value={tarikhTamat}
                  onChange={(e) => setTarikhTamat(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-[#0B1736] focus:outline-none"
                />
              </div>
              {entryMode === 'hourly' && (
                <div>
                  <label
                    htmlFor="log-hari"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    Bilangan Hari *
                  </label>
                  <input
                    id="log-hari"
                    type="number"
                    min={1}
                    max={90}
                    required
                    value={bilanganHari}
                    onChange={(e) => setBilanganHari(Number(e.target.value) || 1)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm tabular-nums text-slate-900 focus:border-[#0B1736] focus:outline-none"
                  />
                </div>
              )}
            </div>
          ) : null}

          {entryMode === 'hourly' &&
            (kategori === 'pembelajaran_bersemuka' ||
              kategori === 'pembelajaran_tidak_bersemuka') && (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label
                    htmlFor="log-tarikh-sesi"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    Tarikh *
                  </label>
                  <input
                    id="log-tarikh-sesi"
                    type="date"
                    required
                    value={tarikhMula}
                    onChange={(e) => setTarikhMula(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-[#0B1736] focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="log-masa-mula"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    Masa Mula *
                  </label>
                  <input
                    id="log-masa-mula"
                    type="time"
                    required
                    value={masaMula}
                    onChange={(e) => setMasaMula(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-[#0B1736] focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="log-masa-tamat"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    Masa Tamat *
                  </label>
                  <input
                    id="log-masa-tamat"
                    type="time"
                    required
                    value={masaTamat}
                    onChange={(e) => setMasaTamat(e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-[#0B1736] focus:outline-none"
                  />
                </div>
                <div>
                  <div className="block text-xs font-medium text-slate-700 mb-1.5">
                    Jumlah Jam (&lt; 6 jam)
                  </div>
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm tabular-nums text-slate-900">
                    {computedHours} jam
                  </div>
                </div>
              </div>
            )}

          {entryMode === 'hourly' && kategori === 'pembelajaran_kendiri' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="log-sumber"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Sumber (EPSA / Portal / Buku) *
                </label>
                <input
                  id="log-sumber"
                  type="text"
                  required
                  value={sumber}
                  onChange={(e) => setSumber(e.target.value)}
                  placeholder="Portal EPSA"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0B1736] focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="log-tarikh-bentang"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Tarikh Pembentangan *
                </label>
                <input
                  id="log-tarikh-bentang"
                  type="date"
                  required
                  value={tarikhMula}
                  onChange={(e) => setTarikhMula(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-[#0B1736] focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="log-penyelia"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Pegawai Penyelia *
                </label>
                <input
                  id="log-penyelia"
                  type="text"
                  required
                  value={pegawaiPenyelia}
                  onChange={(e) => setPegawaiPenyelia(e.target.value)}
                  placeholder="Nama Pegawai Penyelia"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0B1736] focus:outline-none"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="log-tempat"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Tempat *
              </label>
              <input
                id="log-tempat"
                type="text"
                required
                value={tempat}
                onChange={(e) => setTempat(e.target.value)}
                placeholder="cth. Bilik Cemerlang, Wisma PL"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0B1736] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="log-anjuran"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Anjuran
              </label>
              <input
                id="log-anjuran"
                type="text"
                value={anjuran}
                onChange={(e) => setAnjuran(e.target.value)}
                placeholder="cth. PL / INTAN / CIDB"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0B1736] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="log-keterangan"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Keterangan / Catatan Tambahan
            </label>
            <textarea
              id="log-keterangan"
              rows={2}
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              placeholder="Maklumat ringkas sijil, surat jemputan, atau catatan..."
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0B1736] focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-[#0B1736] px-4 py-2 text-sm font-medium text-white hover:bg-[#132554] disabled:opacity-50 whitespace-nowrap"
            >
              {submitting ? 'Menyimpan...' : 'Simpan Rekod Latihan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
