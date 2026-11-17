import type {
  ComplianceBreakdown,
  PlCodeBreakdown,
  PlCourseCode,
  TrainingCategory,
  TrainingLogEntry,
} from '../types/training.ts';

export const CATEGORY_LABELS: Record<TrainingCategory, string> = {
  latihan_bermodul: 'Latihan Bermodul / Kursus',
  pembelajaran_bersemuka: 'Sesi Pembelajaran Bersemuka / Ceramah / Perhimpunan',
  pembelajaran_tidak_bersemuka: 'Sesi Pembelajaran Tidak Bersemuka',
  pembelajaran_kendiri: 'Pembelajaran Kendiri',
};

export interface PlCodeMeta {
  code: PlCourseCode;
  label: string;
  skop: 'Dalaman PL' | 'Dalaman-Luaran' | 'Luaran';
  jenisAktiviti: string;
  kategori: TrainingCategory;
  isAssembly: boolean;
}

export const PL_COURSE_CODES: Record<PlCourseCode, PlCodeMeta> = {
  CDL: {
    code: 'CDL',
    label: 'Ceramah Dalaman-Luaran',
    skop: 'Dalaman-Luaran',
    jenisAktiviti: 'Sesi Pembelajaran / Ceramah',
    kategori: 'pembelajaran_bersemuka',
    isAssembly: false,
  },
  TDL: {
    code: 'TDL',
    label: 'Taklimat Dalaman-Luaran',
    skop: 'Dalaman-Luaran',
    jenisAktiviti: 'Taklimat / Sesi Penerangan',
    kategori: 'pembelajaran_bersemuka',
    isAssembly: false,
  },
  SDL: {
    code: 'SDL',
    label: 'Seminar Dalaman-Luaran',
    skop: 'Dalaman-Luaran',
    jenisAktiviti: 'Seminar',
    kategori: 'latihan_bermodul',
    isAssembly: false,
  },
  KDL: {
    code: 'KDL',
    label: 'Kursus Dalaman-Luaran',
    skop: 'Dalaman-Luaran',
    jenisAktiviti: 'Kursus',
    kategori: 'latihan_bermodul',
    isAssembly: false,
  },
  PDL: {
    code: 'PDL',
    label: 'Perhimpunan / Program Dalaman',
    skop: 'Dalaman-Luaran',
    jenisAktiviti: 'Perhimpunan Bulanan / Program Dalaman PL',
    kategori: 'pembelajaran_bersemuka',
    isAssembly: true,
  },
  KL: {
    code: 'KL',
    label: 'Kursus Luaran',
    skop: 'Luaran',
    jenisAktiviti: 'Kursus',
    kategori: 'latihan_bermodul',
    isAssembly: false,
  },
  SL: {
    code: 'SL',
    label: 'Seminar Luaran',
    skop: 'Luaran',
    jenisAktiviti: 'Seminar',
    kategori: 'latihan_bermodul',
    isAssembly: false,
  },
  BL: {
    code: 'BL',
    label: 'Bengkel Luaran',
    skop: 'Luaran',
    jenisAktiviti: 'Bengkel',
    kategori: 'latihan_bermodul',
    isAssembly: false,
  },
  CD: {
    code: 'CD',
    label: 'Ceramah Dalaman PL',
    skop: 'Dalaman PL',
    jenisAktiviti: 'Sesi Pembelajaran / Ceramah',
    kategori: 'pembelajaran_bersemuka',
    isAssembly: false,
  },
  TD: {
    code: 'TD',
    label: 'Taklimat Dalaman PL',
    skop: 'Dalaman PL',
    jenisAktiviti: 'Taklimat / Sesi Penerangan',
    kategori: 'pembelajaran_bersemuka',
    isAssembly: false,
  },
  SD: {
    code: 'SD',
    label: 'Seminar Dalaman PL',
    skop: 'Dalaman PL',
    jenisAktiviti: 'Seminar',
    kategori: 'latihan_bermodul',
    isAssembly: false,
  },
  KD: {
    code: 'KD',
    label: 'Kursus Dalaman PL',
    skop: 'Dalaman PL',
    jenisAktiviti: 'Kursus',
    kategori: 'latihan_bermodul',
    isAssembly: false,
  },
  CL: {
    code: 'CL',
    label: 'Ceramah Luaran',
    skop: 'Luaran',
    jenisAktiviti: 'Sesi Pembelajaran / Ceramah',
    kategori: 'pembelajaran_bersemuka',
    isAssembly: false,
  },
  TL: {
    code: 'TL',
    label: 'Taklimat Luaran',
    skop: 'Luaran',
    jenisAktiviti: 'Taklimat / Sesi Penerangan',
    kategori: 'pembelajaran_bersemuka',
    isAssembly: false,
  },
};

export const PRIMARY_PL_CODES: PlCourseCode[] = [
  'CDL',
  'TDL',
  'SDL',
  'KDL',
  'PDL',
  'KL',
  'SL',
  'BL',
];

export const ACTIVITY_TYPES_BY_CATEGORY: Record<TrainingCategory, string[]> = {
  latihan_bermodul: [
    'Kursus',
    'Seminar',
    'Konvensyen',
    'Bengkel',
    'Forum',
    'Simposium / Persidangan',
  ],
  pembelajaran_bersemuka: [
    'Sesi Pembelajaran / Ceramah',
    'Perhimpunan Bulanan / Program Dalaman PL',
    'Taklimat / Sesi Penerangan',
    'Program Penerapan Nilai-Nilai Murni & Ceramah Khas',
    'Program Pementoran (6 bulan = 4 hari)',
    'Lawatan Kerja',
    'On-the-job training',
    'Latihan Sangkutan',
    'Simulasi',
  ],
  pembelajaran_tidak_bersemuka: [
    'Kajian kes',
    'Tayangan filem',
    'Under study',
  ],
  pembelajaran_kendiri: [
    'Portal e-Pembelajaran Sektor Awam (EPSA)',
    'Portal e-pembelajaran diiktiraf Jabatan / Kementerian',
    'Book Review',
  ],
};

export const QUARTERLY_REPORTING_DATES = [
  { suku: 'Suku Pertama', tarikh: 'Setiap 10hb April' },
  { suku: 'Suku Kedua', tarikh: 'Setiap 10hb Julai' },
  { suku: 'Suku Ketiga', tarikh: 'Setiap 10hb Oktober' },
  { suku: 'Suku Keempat (1)', tarikh: 'Setiap 10hb November' },
  { suku: 'Suku Keempat (2)', tarikh: 'Setiap 20hb Disember' },
] as const;

export function emptyPlCodeBreakdown(): PlCodeBreakdown {
  return {
    CDL: 0,
    TDL: 0,
    SDL: 0,
    KDL: 0,
    PDL: 0,
    KL: 0,
    SL: 0,
    BL: 0,
    CD: 0,
    TD: 0,
    SD: 0,
    KD: 0,
    CL: 0,
    TL: 0,
    TIADA_KOD: 0,
  };
}

export function normalizeNoKp(raw: string, padLeadingZero = false): string {
  let digits = raw.replace(/\D/g, '');
  if (padLeadingZero && digits.length === 11) {
    digits = `0${digits}`;
  }
  if (digits.length === 12) {
    return `${digits.slice(0, 6)}-${digits.slice(6, 8)}-${digits.slice(8, 12)}`;
  }
  return raw.trim().toUpperCase();
}

export function stripNoKp(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function isValidNoKp(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  return digits.length === 12;
}

const DEPARTMENT_CANONICAL_MAP: Record<string, string> = {
  'pembangunan dan kejuruteraan': 'Pembangunan & Kejuruteraan',
  'pembangunan & kejuruteraan': 'Pembangunan & Kejuruteraan',
  'pelancongan, kebudayaan dan kesenian': 'Pelancongan, Kebudayaan & Kesenian',
  'unit penyelarasan, pemantauan, penilaian impak':
    'Unit Penyelarasan, Pemantauan & Penilaian Impak',
  'unit penyelarasan, pemantauan dan penilaian impak':
    'Unit Penyelarasan, Pemantauan & Penilaian Impak',
  'perkhidmatan perbandaran (pulau buah)': 'Perkhidmatan Perbandaran (Pulau Buah)',
  'perkhidmatan perbandaran (kebersihan bandar)':
    'Perkhidmatan Perbandaran (Kebersihan Bandar)',
};

export function normalizeJabatanUnit(raw: string): {
  tempatBertugas: string;
  jabatanInduk: string;
  changed: boolean;
} {
  const cleaned = raw.trim().replace(/\s+/g, ' ');
  if (!cleaned) {
    return {
      tempatBertugas: 'Tidak Dinyatakan',
      jabatanInduk: 'Tidak Dinyatakan',
      changed: raw !== '',
    };
  }
  const lower = cleaned.toLowerCase();
  const canonicalUnit =
    DEPARTMENT_CANONICAL_MAP[lower] ??
    cleaned
      .replace(/\(pulau buah\)/i, '(Pulau Buah)')
      .replace(/\(kebersihan bandar\)/i, '(Kebersihan Bandar)')
      .replace(/\bDan\b/g, '&');

  const withoutParen = canonicalUnit.replace(/\s*\([^)]*\)\s*/g, '').trim();
  const parentLower = withoutParen.toLowerCase();
  const jabatanInduk = DEPARTMENT_CANONICAL_MAP[parentLower] ?? withoutParen;

  return {
    tempatBertugas: canonicalUnit,
    jabatanInduk,
    changed: canonicalUnit !== raw,
  };
}

export function normalizeTarafJawatan(raw: string): string {
  const v = raw.trim().toLowerCase();
  if (v === 'tetap') return 'Tetap';
  if (v === 'kontrak') return 'Kontrak';
  if (v.includes('interim')) return 'Tetap (Interim)';
  return raw.trim() || 'Tetap';
}

/**
 * Pengiraan sasaran hari berkursus tahunan.
 * Untuk Perbadanan Labuan 2026 (baseTarget = 4 hari) dan kaedah prorate Seksyen 8.
 */
export function calculateTargetDays(
  bulanBerkhidmat: number,
  baseTarget = 4
): number {
  const clamped = Math.max(0, Math.min(12, Math.floor(bulanBerkhidmat)));
  if (clamped === 0) return 0;
  if (clamped >= 11) return baseTarget;
  return Math.round((clamped / 12) * baseTarget);
}

/**
 * Kira tempoh jam antara HH:mm mula dan tamat.
 */
export function calculateDurationHours(masaMula?: string, masaTamat?: string): number {
  if (!masaMula || !masaTamat) return 0;
  const [h1, m1] = masaMula.split(':').map(Number);
  const [h2, m2] = masaTamat.split(':').map(Number);
  if ([h1, m1, h2, m2].some((n) => Number.isNaN(n))) return 0;
  const diffMinutes = h2 * 60 + m2 - (h1 * 60 + m1);
  if (diffMinutes <= 0) return 0;
  return Math.round((diffMinutes / 60) * 100) / 100;
}

/**
 * Kira pematuhan keseluruhan bagi seorang pegawai untuk tahun tertentu.
 * Menyokong log berhari penuh (Rekod PL 2026 CDL/TDL/SDL/KDL/PDL/KL/SL/BL)
 * serta sesi berjam (< 6 jam) dan pembelajaran kendiri (EPSA).
 */
export function computeStaffCompliance(
  logs: TrainingLogEntry[],
  bulanBerkhidmat: number,
  tahun: number,
  baseTarget?: number,
  includePending = false
): ComplianceBreakdown {
  const targetBase = baseTarget ?? (tahun >= 2026 ? 4 : 3);
  const yearLogs = logs.filter(
    (log) =>
      log.tahun === tahun &&
      log.statusPengesahan !== 'ditolak' &&
      (includePending || log.statusPengesahan === 'disahkan')
  );

  let dalamNegaraHari = 0;
  let luarNegaraHari = 0;
  let bersemukaHariLangsung = 0;
  let bersemukaJam = 0;
  let tidakBersemukaJam = 0;
  let kendiriBilangan = 0;
  let kursusSahajaHari = 0;
  let perhimpunanHari = 0;
  let jumlahHariMenunggu = 0;
  const kodBreakdown = emptyPlCodeBreakdown();

  for (const log of logs) {
    if (log.tahun === tahun && log.statusPengesahan === 'menunggu') {
      if (log.bilanganHari > 0) {
        jumlahHariMenunggu += log.bilanganHari;
      } else if (log.kategori === 'pembelajaran_kendiri') {
        jumlahHariMenunggu += 1;
      } else {
        jumlahHariMenunggu += Math.round((log.jumlahJam / 6) * 10) / 10;
      }
    }
  }

  for (const log of yearLogs) {
    const days = Number(log.bilanganHari) || 0;
    const isAssembly = Boolean(log.isAssembly || log.kodKursusPL === 'PDL');
    const kod = log.kodKursusPL;

    if (kod && kod in kodBreakdown) {
      kodBreakdown[kod] += days > 0 ? days : 1;
    } else if (log.kodKursusPL === '') {
      kodBreakdown.TIADA_KOD += days > 0 ? days : 1;
    }

    if (days > 0) {
      if (isAssembly) {
        perhimpunanHari += days;
      } else {
        kursusSahajaHari += days;
      }
    }

    switch (log.kategori) {
      case 'latihan_bermodul': {
        if (log.lokasiSkop === 'luar_negara') {
          luarNegaraHari += days;
        } else {
          dalamNegaraHari += days;
        }
        break;
      }
      case 'pembelajaran_bersemuka': {
        if (days > 0) {
          bersemukaHariLangsung += days;
        } else {
          bersemukaJam += log.jumlahJam;
        }
        break;
      }
      case 'pembelajaran_tidak_bersemuka': {
        tidakBersemukaJam += log.jumlahJam;
        break;
      }
      case 'pembelajaran_kendiri': {
        kendiriBilangan += 1;
        break;
      }
    }
  }

  const latihanBermodulHari = dalamNegaraHari + luarNegaraHari;
  const bersemukaHariDikira =
    bersemukaHariLangsung + Math.min(5, Math.floor(bersemukaJam / 6));
  const tidakBersemukaHariDikira = Math.min(5, Math.floor(tidakBersemukaJam / 6));
  const kendiriHariDikira = Math.min(3, kendiriBilangan);

  const jumlahKeseluruhanHari =
    latihanBermodulHari +
    bersemukaHariDikira +
    tidakBersemukaHariDikira +
    kendiriHariDikira;

  const sasaranHari = calculateTargetDays(bulanBerkhidmat, targetBase);
  const wajibBermodulHari = tahun >= 2026 ? 0 : Math.min(2, sasaranHari);
  const memenuhiSasaranJumlah = jumlahKeseluruhanHari >= sasaranHari;
  const memenuhiWajibBermodul = latihanBermodulHari >= wajibBermodulHari;

  return {
    tahun,
    bulanBerkhidmat,
    sasaranHari,
    wajibBermodulHari,
    dalamNegaraHari,
    luarNegaraHari,
    latihanBermodulHari,
    bersemukaJam,
    bersemukaHariDikira,
    tidakBersemukaJam,
    tidakBersemukaHariDikira,
    kendiriBilangan,
    kendiriHariDikira,
    kursusSahajaHari,
    perhimpunanHari,
    bilanganRekodKursus: yearLogs.length,
    kodBreakdown,
    jumlahHariDisahkan: includePending ? 0 : jumlahKeseluruhanHari,
    jumlahHariMenunggu: Math.round(jumlahHariMenunggu * 10) / 10,
    jumlahKeseluruhanHari,
    memenuhiSasaranJumlah,
    memenuhiWajibBermodul,
    patuhSepenuhnya: memenuhiSasaranJumlah && memenuhiWajibBermodul,
  };
}
