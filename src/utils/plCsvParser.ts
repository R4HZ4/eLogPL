import type {
  AnomalyItem,
  CsvImportAuditStats,
  PlCourseCode,
  StaffAccount,
  TrainingLogEntry,
} from '../types/training.ts';
import {
  PL_COURSE_CODES,
  isValidNoKp,
  normalizeJabatanUnit,
  normalizeNoKp,
  normalizeTarafJawatan,
  stripNoKp,
} from './trainingRules.ts';

export interface ParsedPlCsvResult {
  users: StaffAccount[];
  logs: TrainingLogEntry[];
  auditStats: CsvImportAuditStats;
}

export function parseCsvRows(text: string): string[][] {
  const cleanText = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let val = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const ch = cleanText[i];
    if (inQuotes) {
      if (ch === '"' && cleanText[i + 1] === '"') {
        val += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        val += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(val);
      val = '';
    } else if (ch === '\n') {
      row.push(val);
      rows.push(row);
      row = [];
      val = '';
    } else if (ch !== '\r') {
      val += ch;
    }
  }
  if (val.length > 0 || row.length > 0) {
    row.push(val);
    rows.push(row);
  }
  return rows;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function fixYear(rawYear: string): { year: number; hadTypo: boolean } {
  const trimmed = rawYear.trim();
  if (trimmed === '226' || trimmed === '202' || trimmed === '26') {
    return { year: 2026, hadTypo: true };
  }
  const num = Number(trimmed);
  if (num >= 2000 && num <= 2099) {
    return { year: num, hadTypo: false };
  }
  return { year: 2026, hadTypo: true };
}

export function parseMalaysianCourseDate(raw: string): {
  tarikhMula: string;
  tarikhTamat: string;
  tahun: number;
  tarikhAsal?: string;
  hadTypo: boolean;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {
      tarikhMula: '2026-01-01',
      tarikhTamat: '2026-01-01',
      tahun: 2026,
      hadTypo: false,
    };
  }

  // DD.MM.YYYY or D.M.YYYY or typo like 08.01.226
  const singleMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (singleMatch) {
    const d = Number(singleMatch[1]);
    const m = Number(singleMatch[2]);
    const { year, hadTypo } = fixYear(singleMatch[3]);
    const iso = `${year}-${pad2(m)}-${pad2(d)}`;
    return {
      tarikhMula: iso,
      tarikhTamat: iso,
      tahun: year,
      tarikhAsal: hadTypo ? trimmed : undefined,
      hadTypo,
    };
  }

  // Range: DD-DD.MM.YYYY
  const rangeMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (rangeMatch) {
    const d1 = Number(rangeMatch[1]);
    const d2 = Number(rangeMatch[2]);
    const m = Number(rangeMatch[3]);
    const { year, hadTypo } = fixYear(rangeMatch[4]);
    return {
      tarikhMula: `${year}-${pad2(m)}-${pad2(d1)}`,
      tarikhTamat: `${year}-${pad2(m)}-${pad2(d2)}`,
      tahun: year,
      tarikhAsal: hadTypo ? trimmed : undefined,
      hadTypo,
    };
  }

  // Typo range: DD-DD-MM.YYYY (e.g. 11-15-05.2026)
  const dashMonthMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{1,2})\.(\d{4})$/);
  if (dashMonthMatch) {
    const d1 = Number(dashMonthMatch[1]);
    const d2 = Number(dashMonthMatch[2]);
    const m = Number(dashMonthMatch[3]);
    const year = Number(dashMonthMatch[4]);
    return {
      tarikhMula: `${year}-${pad2(m)}-${pad2(d1)}`,
      tarikhTamat: `${year}-${pad2(m)}-${pad2(d2)}`,
      tahun: year,
      tarikhAsal: trimmed,
      hadTypo: true,
    };
  }

  // Multi-part range e.g. 04-13.05.2026 01-04.07.2026
  const multiMatch = trimmed.match(
    /^(\d{1,2})-(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2})-(\d{1,2})\.(\d{1,2})\.(\d{4})$/
  );
  if (multiMatch) {
    const d1 = Number(multiMatch[1]);
    const m1 = Number(multiMatch[3]);
    const y1 = Number(multiMatch[4]);
    const d2 = Number(multiMatch[6]);
    const m2 = Number(multiMatch[7]);
    const y2 = Number(multiMatch[8]);
    return {
      tarikhMula: `${y1}-${pad2(m1)}-${pad2(d1)}`,
      tarikhTamat: `${y2}-${pad2(m2)}-${pad2(d2)}`,
      tahun: y1,
      tarikhAsal: trimmed,
      hadTypo: false,
    };
  }

  // ISO already
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return {
      tarikhMula: trimmed,
      tarikhTamat: trimmed,
      tahun: Number(trimmed.slice(0, 4)) || 2026,
      hadTypo: false,
    };
  }

  return {
    tarikhMula: '2026-01-01',
    tarikhTamat: '2026-01-01',
    tahun: 2026,
    tarikhAsal: trimmed,
    hadTypo: true,
  };
}

function mapPlCodeToLogFields(
  rawCode: string,
  tajuk: string,
  anjuran: string
): {
  kodKursusPL: PlCourseCode | '';
  kategori: TrainingLogEntry['kategori'];
  jenisAktiviti: string;
  lokasiSkop?: 'dalam_negara' | 'luar_negara';
  isAssembly: boolean;
} {
  const upper = rawCode.trim().toUpperCase() as PlCourseCode;
  if (upper && upper in PL_COURSE_CODES) {
    const meta = PL_COURSE_CODES[upper];
    return {
      kodKursusPL: upper,
      kategori: meta.kategori,
      jenisAktiviti: `${meta.label} (${upper})`,
      lokasiSkop: meta.kategori === 'latihan_bermodul' ? 'dalam_negara' : undefined,
      isAssembly: meta.isAssembly,
    };
  }

  // Fallback for missing code: infer category heuristically without fabricating code
  const lowerTitle = `${tajuk} ${anjuran}`.toLowerCase();
  if (lowerTitle.includes('taklimat') || lowerTitle.includes('townhall') || lowerTitle.includes('wacana')) {
    return {
      kodKursusPL: '',
      kategori: 'pembelajaran_bersemuka',
      jenisAktiviti: 'Kod Kursus Belum Ditetapkan',
      isAssembly: false,
    };
  }
  return {
    kodKursusPL: '',
    kategori: 'latihan_bermodul',
    jenisAktiviti: 'Kod Kursus Belum Ditetapkan',
    lokasiSkop: 'dalam_negara',
    isAssembly: false,
  };
}

export function parsePerbadananLabuanCsv(
  csvText: string,
  sourceFileName = 'REKOD_KURSUS_TAHUN_2026.csv'
): ParsedPlCsvResult {
  const rows = parseCsvRows(csvText);
  const now = '2026-08-15T08:00:00.000Z';
  const users: StaffAccount[] = [];
  const logs: TrainingLogEntry[] = [];

  let excelFormulaRefRowsFixed = 0;
  let excelBlankSummaryRowsFixed = 0;
  let departmentVariantsNormalized = 0;
  let dateTyposFixed = 0;
  let shiftedColumnsRecovered = 0;
  let leadingZeroIcsReinstated = 0;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length < 10) continue;

    const noFail = (row[1] ?? '').trim();
    const nama = (row[2] ?? '').trim();
    const rawIc = (row[3] ?? '').trim();
    const rawJab = (row[4] ?? '').trim();
    const klasifikasi = (row[5] ?? '').trim().toUpperCase();
    const gred = (row[6] ?? '').trim().toUpperCase();
    const jawatan = (row[7] ?? '').trim();
    const rawTaraf = (row[8] ?? '').trim();
    const kategoriPerkhidmatan = (row[9] ?? '').trim();

    if (!nama && !rawIc) continue;

    const rawDigits = stripNoKp(rawIc);
    const wasElevenDigit = rawDigits.length === 11;
    if (wasElevenDigit) leadingZeroIcsReinstated++;
    const noKp = normalizeNoKp(rawIc, true);
    const icValid = isValidNoKp(noKp);
    const dept = normalizeJabatanUnit(rawJab);
    if (dept.changed) departmentVariantsNormalized++;

    const tarafJawatan = normalizeTarafJawatan(rawTaraf);
    const genderRaw = (row[188] ?? '').trim().toUpperCase();
    const gender: 'L' | 'P' | '' =
      genderRaw === 'L' || genderRaw === 'P' ? genderRaw : '';
    const catatan = (row[189] ?? '').trim();
    const tarikhLantikan = (row[190] ?? '').trim();

    const staffId = `usr-pl-${noFail || r}-${r}`;

    const staff: StaffAccount = {
      id: staffId,
      noFail: noFail || undefined,
      noKp,
      icValid,
      nama,
      jawatan: jawatan || '-',
      klasifikasi: klasifikasi || undefined,
      gred: gred || '-',
      tempatBertugas: dept.tempatBertugas,
      jabatanInduk: dept.jabatanInduk,
      jabatanAsal: dept.changed ? rawJab : undefined,
      tarafJawatan,
      kategoriPerkhidmatan: kategoriPerkhidmatan || 'Sok I',
      gender,
      catatan: catatan || undefined,
      tarikhLantikan: tarikhLantikan || undefined,
      peranan: 'pegawai',
      bulanBerkhidmat: 12,
      sasaranTahun: 4,
      status: 'aktif',
      createdAt: now,
      updatedAt: now,
    };
    users.push(staff);

    // Track broken Excel formulas in cols 162..187
    const summarySlice = row.slice(162, 188);
    if (summarySlice.some((cell) => /#REF!|#N\/A|#VALUE!/i.test(cell ?? ''))) {
      excelFormulaRefRowsFixed++;
    }
    if (!(row[165] ?? '').trim() && !(row[180] ?? '').trim()) {
      excelBlankSummaryRowsFixed++;
    }

    // Parse PHIMPUNAN 1..8 (cols 10..41) if ever populated
    for (let p = 0; p < 8; p++) {
      const base = 10 + p * 4;
      const pTajuk = (row[base] ?? '').trim();
      const pTempat = (row[base + 1] ?? '').trim();
      const pTarikh = (row[base + 2] ?? '').trim();
      const pHari = Number((row[base + 3] ?? '').trim()) || 1;
      if (pTajuk) {
        const parsedDate = parseMalaysianCourseDate(pTarikh);
        if (parsedDate.hadTypo) dateTyposFixed++;
        logs.push({
          id: `log-pl-${r}-p${p + 1}`,
          staffId,
          staffNoKp: noKp,
          tahun: parsedDate.tahun,
          kategori: 'pembelajaran_bersemuka',
          kodKursusPL: 'PDL',
          jenisAktiviti: `${PL_COURSE_CODES.PDL.label} (PDL)`,
          tajuk: pTajuk,
          tarikhMula: parsedDate.tarikhMula,
          tarikhTamat: parsedDate.tarikhTamat,
          tarikhAsal: parsedDate.tarikhAsal,
          bilanganHari: pHari,
          jumlahJam: pHari * 6,
          tempat: pTempat || 'Perkarangan PL',
          anjuran: 'PL',
          isAssembly: true,
          anomalyFlag: parsedDate.hadTypo ? 'date_typo' : undefined,
          statusPengesahan: 'disahkan',
          disahkanOleh: 'Rekod Rasmi BPSM PL 2026',
          jawatanPengesah: 'Unit Latihan, JPSM',
          tarikhPengesahan: parsedDate.tarikhTamat,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // Parse Kursus 1..20 (cols 42..161)
    for (let s = 0; s < 20; s++) {
      const base = 42 + s * 6;
      const tajuk = (row[base] ?? '').trim();
      const tempat = (row[base + 1] ?? '').trim();
      const anjuran = (row[base + 2] ?? '').trim();
      const rawTarikh = (row[base + 3] ?? '').trim();
      const rawBilHari = (row[base + 4] ?? '').trim();
      const rawJenis = (row[base + 5] ?? '').trim();

      if (!tajuk && !tempat && !anjuran && !rawTarikh && !rawJenis) {
        continue;
      }

      const parsedDate = parseMalaysianCourseDate(rawTarikh);
      if (parsedDate.hadTypo) dateTyposFixed++;
      const bilanganHari = Math.max(1, Number(rawBilHari) || 1);
      const mapped = mapPlCodeToLogFields(rawJenis, tajuk, anjuran);

      let anomalyFlag: string | undefined;
      if (!mapped.kodKursusPL) anomalyFlag = 'missing_course_code';
      else if (parsedDate.hadTypo) anomalyFlag = 'date_typo';

      logs.push({
        id: `log-pl-${r}-c${s + 1}`,
        staffId,
        staffNoKp: noKp,
        tahun: parsedDate.tahun,
        kategori: mapped.kategori,
        kodKursusPL: mapped.kodKursusPL,
        jenisAktiviti: mapped.jenisAktiviti,
        tajuk: tajuk || 'Kursus Tanpa Tajuk',
        lokasiSkop: mapped.lokasiSkop,
        tarikhMula: parsedDate.tarikhMula,
        tarikhTamat: parsedDate.tarikhTamat,
        tarikhAsal: parsedDate.tarikhAsal,
        bilanganHari,
        jumlahJam: bilanganHari * 6,
        tempat: tempat || '-',
        anjuran: anjuran || 'PL',
        isAssembly: mapped.isAssembly,
        anomalyFlag,
        statusPengesahan: 'disahkan',
        disahkanOleh: 'Rekod Rasmi BPSM PL 2026',
        jawatanPengesah: 'Unit Latihan, JPSM',
        tarikhPengesahan: parsedDate.tarikhTamat,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Detect shifted/leaked course entry in summary columns 162..167 (e.g. row 41 Andy Asri)
    const leakTempat = (row[163] ?? '').trim();
    const leakAnjuran = (row[164] ?? '').trim();
    const leakTarikh = (row[165] ?? '').trim();
    const leakHari = (row[166] ?? '').trim();
    const leakKod = (row[167] ?? '').trim();
    if (
      leakKod &&
      leakKod.toUpperCase() in PL_COURSE_CODES &&
      Number.isNaN(Number(leakTempat)) &&
      leakTempat.length > 2
    ) {
      shiftedColumnsRecovered++;
      const parsedDate = parseMalaysianCourseDate(leakTarikh);
      const mapped = mapPlCodeToLogFields(leakKod, 'Rekod Teranjak CSV', leakAnjuran);
      const bilanganHari = Math.max(1, Number(leakHari) || 1);
      logs.push({
        id: `log-pl-${r}-leaked`,
        staffId,
        staffNoKp: noKp,
        tahun: parsedDate.tahun,
        kategori: mapped.kategori,
        kodKursusPL: mapped.kodKursusPL,
        jenisAktiviti: mapped.jenisAktiviti,
        tajuk: `[Rekod Teranjak Lajur 163–168] Aktiviti ${leakAnjuran || 'PL'} (${leakTarikh})`,
        lokasiSkop: mapped.lokasiSkop,
        tarikhMula: parsedDate.tarikhMula,
        tarikhTamat: parsedDate.tarikhTamat,
        tarikhAsal: leakTarikh,
        bilanganHari,
        jumlahJam: bilanganHari * 6,
        tempat: leakTempat,
        anjuran: leakAnjuran || 'PL',
        isAssembly: mapped.isAssembly,
        anomalyFlag: 'shifted_column',
        keterangan:
          'Data ditemui teranjak ke lajur ringkasan Excel (163–168) tanpa tajuk dalam CSV asal.',
        statusPengesahan: 'menunggu',
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  return {
    users,
    logs,
    auditStats: {
      sourceFileName,
      importedAt: new Date().toISOString(),
      totalRowsParsed: users.length,
      totalCoursesImported: logs.length,
      excelFormulaRefRowsFixed,
      excelBlankSummaryRowsFixed,
      departmentVariantsNormalized,
      dateTyposFixed,
      shiftedColumnsRecovered,
      leadingZeroIcsReinstated,
    },
  };
}

export function computeLiveAnomalies(
  users: StaffAccount[],
  logs: TrainingLogEntry[]
): AnomalyItem[] {
  const anomalies: AnomalyItem[] = [];
  const staffById = new Map(users.map((u) => [u.id, u]));
  const staffByKp = new Map<string, StaffAccount[]>();
  const staffByFail = new Map<string, StaffAccount[]>();

  for (const u of users) {
    if (!isValidNoKp(u.noKp)) {
      anomalies.push({
        id: `anom-ic-${u.id}`,
        type: 'invalid_ic',
        severity: 'tinggi',
        staffId: u.id,
        staffNama: u.nama,
        staffNoKp: u.noKp,
        staffNoFail: u.noFail,
        jabatan: u.tempatBertugas,
        rawValue: u.noKp,
        suggestedValue:
          stripNoKp(u.noKp).length === 11
            ? `0${stripNoKp(u.noKp)}`
            : undefined,
        description: `No. K/P hanya mempunyai ${stripNoKp(u.noKp).length} digit (sepatutnya 12 digit, kemungkinan angka '0' di hadapan gugur dalam Excel).`,
      });
    }

    const digits = stripNoKp(u.noKp);
    if (digits) {
      const list = staffByKp.get(digits) ?? [];
      list.push(u);
      staffByKp.set(digits, list);
    }

    if (u.noFail) {
      const fList = staffByFail.get(u.noFail) ?? [];
      fList.push(u);
      staffByFail.set(u.noFail, fList);
    }
  }

  for (const [digits, list] of staffByKp.entries()) {
    if (list.length > 1) {
      for (const u of list) {
        anomalies.push({
          id: `anom-dupic-${u.id}`,
          type: 'duplicate_ic',
          severity: 'tinggi',
          staffId: u.id,
          staffNama: u.nama,
          staffNoKp: u.noKp,
          staffNoFail: u.noFail,
          jabatan: u.tempatBertugas,
          rawValue: digits,
          description: `No. K/P ${u.noKp} dikongsi oleh ${list.length} pegawai berbeza (${list.map((x) => x.nama).join(' & ')}).`,
        });
      }
    }
  }

  for (const [failNo, list] of staffByFail.entries()) {
    if (list.length > 1) {
      for (const u of list) {
        anomalies.push({
          id: `anom-dupfail-${u.id}`,
          type: 'duplicate_fail_no',
          severity: 'sederhana',
          staffId: u.id,
          staffNama: u.nama,
          staffNoKp: u.noKp,
          staffNoFail: u.noFail,
          jabatan: u.tempatBertugas,
          rawValue: failNo,
          description: `No. Pekerja / Fail '${failNo}' digunakan berulang oleh ${list.map((x) => x.nama).join(' & ')}.`,
        });
      }
    }
  }

  for (const log of logs) {
    const owner = log.staffId
      ? staffById.get(log.staffId)
      : users.find((u) => stripNoKp(u.noKp) === stripNoKp(log.staffNoKp));
    if (!owner) continue;

    if (log.kodKursusPL === '') {
      anomalies.push({
        id: `anom-code-${log.id}`,
        type: 'missing_course_code',
        severity: 'sederhana',
        staffId: owner.id,
        staffNama: owner.nama,
        staffNoKp: owner.noKp,
        staffNoFail: owner.noFail,
        jabatan: owner.tempatBertugas,
        logId: log.id,
        tajukKursus: log.tajuk,
        rawValue: 'Kosong',
        suggestedValue: /wacana/i.test(log.tajuk)
          ? 'CDL'
          : /taklimat|townhall/i.test(log.tajuk)
          ? 'TDL'
          : 'KDL',
        description: `Kod 'JENIS KURSUS' tertinggal bagi kursus "${log.tajuk}" (${log.tarikhMula}).`,
      });
    }

    if (log.anomalyFlag === 'shifted_column') {
      anomalies.push({
        id: `anom-shift-${log.id}`,
        type: 'shifted_column',
        severity: 'tinggi',
        staffId: owner.id,
        staffNama: owner.nama,
        staffNoKp: owner.noKp,
        staffNoFail: owner.noFail,
        jabatan: owner.tempatBertugas,
        logId: log.id,
        tajukKursus: log.tajuk,
        rawValue: log.tarikhAsal ?? log.tarikhMula,
        description: `Data kursus teranjak ke lajur ringkasan Excel (163–168) dan perlu semakan tajuk/tahun.`,
      });
    } else if (log.anomalyFlag === 'date_typo' && log.tarikhAsal) {
      anomalies.push({
        id: `anom-date-${log.id}`,
        type: 'date_typo',
        severity: 'maklumat',
        staffId: owner.id,
        staffNama: owner.nama,
        staffNoKp: owner.noKp,
        staffNoFail: owner.noFail,
        jabatan: owner.tempatBertugas,
        logId: log.id,
        tajukKursus: log.tajuk,
        rawValue: log.tarikhAsal,
        suggestedValue: log.tarikhMula,
        description: `Format tarikh asal "${log.tarikhAsal}" telah dibetulkan secara automatik kepada ${log.tarikhMula}.`,
      });
    }
  }

  return anomalies;
}
