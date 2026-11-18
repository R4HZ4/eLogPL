import { Check, Save, X } from 'lucide-react';
import { useState } from 'react';
import type {
  AnalyticsOverview,
  AnomalyItem,
  PlCourseCode,
  StaffAccount,
  TrainingLogEntry,
  VerificationStatus,
} from '../types/training';
import { PRIMARY_PL_CODES, normalizeNoKp } from '../utils/trainingRules';

interface PlbAuditAndVerifyViewProps {
  analytics: AnalyticsOverview;
  pendingLogs: TrainingLogEntry[];
  staffList: StaffAccount[];
  onVerifyLog: (
    logId: string,
    status: VerificationStatus,
    catatan?: string
  ) => Promise<void>;
  onFixLogCode: (logId: string, code: PlCourseCode) => Promise<void>;
  onFixStaffIc: (staffId: string, newNoKp: string) => Promise<void>;
}

const ANOMALY_TYPE_LABEL: Record<AnomalyItem['type'], string> = {
  missing_course_code: 'Kod Kursus Kosong',
  invalid_ic: 'No. K/P Tidak Sah',
  duplicate_ic: 'No. K/P Pendua',
  duplicate_fail_no: 'No. Pekerja Pendua',
  shifted_column: 'Lajur CSV Teranjak',
  date_typo: 'Ralat Taip Tarikh (Dipulihkan)',
};

export function PlbAuditAndVerifyView({
  analytics,
  pendingLogs,
  staffList,
  onVerifyLog,
  onFixLogCode,
  onFixStaffIc,
}: PlbAuditAndVerifyViewProps) {
  const [subTab, setSubTab] = useState<'audit' | 'semakan'>('audit');
  const [anomalyFilter, setAnomalyFilter] = useState<'actionable' | AnomalyItem['type'] | 'all'>('actionable');
  const [selectedCodeByLog, setSelectedCodeByLog] = useState<Record<string, PlCourseCode>>({});
  const [icDraftByStaff, setIcDraftByStaff] = useState<Record<string, string>>({});
  const [remarksById, setRemarksById] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const staffMap = new Map(staffList.map((s) => [s.id, s]));

  const actionableAnomalies = analytics.anomalies.filter(
    (a) => a.type !== 'date_typo'
  );

  const visibleAnomalies = analytics.anomalies.filter((a) => {
    if (anomalyFilter === 'actionable') return a.type !== 'date_typo';
    if (anomalyFilter === 'all') return true;
    return a.type === anomalyFilter;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-slate-900">
            Audit Kualiti Data &amp; Semakan Pengesahan Unit Latihan PL
          </h1>
          <p className="mt-0.5 text-xs text-slate-600">
            Mengesan dan membetulkan ralat integriti daripada hamparan CSV asal serta mengesahkan rekod baharu kakitangan.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Submodul Semakan dan Audit"
          className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 p-0.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'audit'}
            onClick={() => setSubTab('audit')}
            className={`rounded px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              subTab === 'audit'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Audit Kualiti Data ({actionableAnomalies.length} Perlu Tindakan)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'semakan'}
            onClick={() => setSubTab('semakan')}
            className={`rounded px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              subTab === 'semakan'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Semakan Pengesahan Log ({pendingLogs.length})
          </button>
        </div>
      </div>

      {actionError && (
        <div
          role="alert"
          className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800"
        >
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="rounded p-1 hover:bg-red-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {subTab === 'audit' && (
        <div className="space-y-5">
          <section className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 rounded-lg border border-slate-200 bg-white">
            <div className="px-5 py-4">
              <div className="text-xs font-medium text-slate-500">Baris Ralat #REF! / #N/A Excel</div>
              <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-emerald-700">
                {analytics.auditStats.excelFormulaRefRowsFixed}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Dipulihkan dengan pengiraan pangkalan data
              </div>
            </div>
            <div className="px-5 py-4">
              <div className="text-xs font-medium text-slate-500">Baris Ringkasan Kosong CSV</div>
              <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-slate-900">
                {analytics.auditStats.excelBlankSummaryRowsFixed}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Pegawai interim/baharu dikira semula
              </div>
            </div>
            <div className="px-5 py-4">
              <div className="text-xs font-medium text-slate-500">Varian Jabatan &amp; IC Dipulihkan</div>
              <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-slate-900">
                {analytics.auditStats.departmentVariantsNormalized}
                {(analytics.auditStats.leadingZeroIcsReinstated ?? 0) > 0 && (
                  <span className="ml-2 text-sm text-emerald-700">
                    (+{analytics.auditStats.leadingZeroIcsReinstated} IC &lsquo;0&rsquo;)
                  </span>
                )}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Jabatan seragam &amp; 2 No. K/P 11-digit dipulihkan dengan angka &lsquo;0&rsquo;
              </div>
            </div>
            <div className="px-5 py-4">
              <div className="text-xs font-medium text-slate-500">Isu Aktif Menunggu Tindakan</div>
              <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-amber-700">
                {actionableAnomalies.length}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Kod kosong, IC tidak sah/pendua, lanjak
              </div>
            </div>
          </section>

          <div className="inline-flex flex-wrap items-center rounded-md border border-slate-200 bg-slate-100 p-0.5 text-xs">
            {(
              [
                { id: 'actionable', label: `Perlu Tindakan (${actionableAnomalies.length})` },
                {
                  id: 'missing_course_code',
                  label: `Kod Kursus Kosong (${analytics.anomalies.filter((a) => a.type === 'missing_course_code').length})`,
                },
                {
                  id: 'invalid_ic',
                  label: `No. K/P Tidak Sah (${analytics.anomalies.filter((a) => a.type === 'invalid_ic').length})`,
                },
                {
                  id: 'duplicate_ic',
                  label: `No. K/P Pendua (${analytics.anomalies.filter((a) => a.type === 'duplicate_ic').length})`,
                },
                {
                  id: 'duplicate_fail_no',
                  label: `No. Pekerja Pendua (${analytics.anomalies.filter((a) => a.type === 'duplicate_fail_no').length})`,
                },
                {
                  id: 'date_typo',
                  label: `Tarikh Dipulihkan (${analytics.anomalies.filter((a) => a.type === 'date_typo').length})`,
                },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setAnomalyFilter(opt.id)}
                className={`rounded px-3 py-1.5 font-medium transition-colors whitespace-nowrap ${
                  anomalyFilter === opt.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 font-medium text-slate-600">
                    <th className="px-4 py-2.5 whitespace-nowrap">Jenis Isu</th>
                    <th className="px-4 py-2.5">Pegawai &amp; Jabatan</th>
                    <th className="px-4 py-2.5">Keterangan &amp; Nilai Asal</th>
                    <th className="px-4 py-2.5">Pembetulan Pantas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {visibleAnomalies.map((anom) => (
                    <tr key={anom.id} className="align-top hover:bg-slate-50/70">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div
                          className={`font-semibold ${
                            anom.severity === 'tinggi'
                              ? 'text-red-700'
                              : anom.severity === 'sederhana'
                              ? 'text-amber-700'
                              : 'text-emerald-700'
                          }`}
                        >
                          {ANOMALY_TYPE_LABEL[anom.type]}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Tahap: {anom.severity}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{anom.staffNama}</div>
                        <div className="font-mono tabular-nums text-slate-500">
                          {anom.staffNoKp}
                          {anom.staffNoFail ? ` · Fail #${anom.staffNoFail}` : ''}
                        </div>
                        <div className="text-slate-500 mt-0.5">{anom.jabatan}</div>
                      </td>

                      <td className="px-4 py-3 max-w-md text-slate-700">
                        <div>{anom.description}</div>
                        <div className="mt-1 font-mono text-[11px] text-slate-500">
                          Nilai asal: {anom.rawValue}
                        </div>
                      </td>

                      <td className="px-4 py-3 min-w-[230px]">
                        {anom.type === 'missing_course_code' && anom.logId ? (
                          <div className="flex items-center gap-2">
                            <select
                              aria-label={`Pilih kod untuk ${anom.tajukKursus}`}
                              value={
                                selectedCodeByLog[anom.logId] ??
                                (anom.suggestedValue as PlCourseCode) ??
                                'KDL'
                              }
                              onChange={(e) =>
                                setSelectedCodeByLog((prev) => ({
                                  ...prev,
                                  [anom.logId!]: e.target.value as PlCourseCode,
                                }))
                              }
                              className="rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs text-slate-900"
                            >
                              {PRIMARY_PL_CODES.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              disabled={busyId === anom.id}
                              onClick={async () => {
                                setActionError(null);
                                setBusyId(anom.id);
                                try {
                                  const code =
                                    selectedCodeByLog[anom.logId!] ??
                                    (anom.suggestedValue as PlCourseCode) ??
                                    'KDL';
                                  await onFixLogCode(anom.logId!, code);
                                } catch (err) {
                                  setActionError(
                                    err instanceof Error
                                      ? err.message
                                      : 'Gagal mengemas kini kod kursus.'
                                  );
                                } finally {
                                  setBusyId(null);
                                }
                              }}
                              className="inline-flex items-center gap-1 rounded bg-[#0B1736] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#132554] disabled:opacity-50"
                            >
                              <Save className="h-3 w-3" />
                              <span>Tetapkan Kod</span>
                            </button>
                          </div>
                        ) : (anom.type === 'invalid_ic' || anom.type === 'duplicate_ic') ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={
                                icDraftByStaff[anom.staffId] ??
                                (anom.suggestedValue
                                  ? normalizeNoKp(anom.suggestedValue)
                                  : anom.staffNoKp)
                              }
                              onChange={(e) =>
                                setIcDraftByStaff((prev) => ({
                                  ...prev,
                                  [anom.staffId]: e.target.value,
                                }))
                              }
                              placeholder="XXXXXX-XX-XXXX"
                              className="w-36 rounded border border-slate-300 px-2 py-1 font-mono text-xs text-slate-900"
                            />
                            <button
                              type="button"
                              disabled={busyId === anom.id}
                              onClick={async () => {
                                setActionError(null);
                                setBusyId(anom.id);
                                try {
                                  const nextIc =
                                    icDraftByStaff[anom.staffId] ??
                                    anom.suggestedValue ??
                                    anom.staffNoKp;
                                  await onFixStaffIc(anom.staffId, nextIc);
                                } catch (err) {
                                  setActionError(
                                    err instanceof Error
                                      ? err.message
                                      : 'Gagal mengemas kini No. K/P.'
                                  );
                                } finally {
                                  setBusyId(null);
                                }
                              }}
                              className="inline-flex items-center gap-1 rounded bg-[#0B1736] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#132554] disabled:opacity-50"
                            >
                              <Save className="h-3 w-3" />
                              <span>Simpan IC</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-500">
                            {anom.type === 'date_typo'
                              ? `Telah dibetulkan -> ${anom.suggestedValue}`
                              : 'Semak bersama Unit Rekod PSM'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {visibleAnomalies.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                        Tiada anomali ditemui bagi kategori penapis ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {subTab === 'semakan' && (
        <div className="space-y-4">
          {pendingLogs.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-600">
              Tiada rekod latihan baharu yang menunggu pengesahan PLB buat masa ini.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 font-medium text-slate-600">
                      <th className="px-4 py-2.5">Pegawai &amp; No. K/P</th>
                      <th className="px-4 py-2.5">Program &amp; Tarikh</th>
                      <th className="px-4 py-2.5">Kod / Kategori</th>
                      <th className="px-4 py-2.5 text-right">Tempoh</th>
                      <th className="px-4 py-2.5">Tindakan PLB</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {pendingLogs.map((log) => {
                      const owner = log.staffId
                        ? staffMap.get(log.staffId)
                        : staffList.find((s) => s.noKp === log.staffNoKp);
                      return (
                        <tr key={log.id} className="align-top">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="font-semibold text-slate-900">
                              {owner?.nama ?? log.staffNoKp}
                            </div>
                            <div className="font-mono tabular-nums text-slate-500">
                              {log.staffNoKp}
                            </div>
                            {owner && (
                              <div className="text-slate-500">{owner.tempatBertugas}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 max-w-xs">
                            <div className="font-semibold text-slate-900">{log.tajuk}</div>
                            <div className="mt-0.5 font-mono tabular-nums text-slate-500">
                              {log.tarikhMula}
                            </div>
                            <div className="text-slate-600 mt-0.5">
                              {log.tempat} ({log.anjuran})
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="font-mono font-semibold text-slate-900">
                              {log.kodKursusPL || '-'}
                            </div>
                            <div className="text-slate-500">{log.jenisAktiviti}</div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                            {log.bilanganHari > 0
                              ? `${log.bilanganHari} hari`
                              : `${log.jumlahJam} jam`}
                          </td>
                          <td className="px-4 py-3 min-w-[240px] space-y-2">
                            <input
                              type="text"
                              value={remarksById[log.id] ?? ''}
                              onChange={(e) =>
                                setRemarksById((prev) => ({
                                  ...prev,
                                  [log.id]: e.target.value,
                                }))
                              }
                              placeholder="Catatan pengesahan PLB..."
                              className="w-full rounded border border-slate-300 px-2.5 py-1 text-xs"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={busyId === log.id}
                                onClick={async () => {
                                  setBusyId(log.id);
                                  try {
                                    await onVerifyLog(
                                      log.id,
                                      'disahkan',
                                      remarksById[log.id]
                                    );
                                  } finally {
                                    setBusyId(null);
                                  }
                                }}
                                className="inline-flex items-center gap-1 rounded bg-emerald-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
                              >
                                <Check className="h-3 w-3" />
                                <span>Sahkan</span>
                              </button>
                              <button
                                type="button"
                                disabled={busyId === log.id}
                                onClick={async () => {
                                  setBusyId(log.id);
                                  try {
                                    await onVerifyLog(
                                      log.id,
                                      'ditolak',
                                      remarksById[log.id]
                                    );
                                  } finally {
                                    setBusyId(null);
                                  }
                                }}
                                className="inline-flex items-center gap-1 rounded border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                              >
                                <X className="h-3 w-3" />
                                <span>Tolak</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
