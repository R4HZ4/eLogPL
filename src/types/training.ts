export type UserRole = 'pegawai' | 'plb' | 'admin';

export type TrainingCategory =
  | 'latihan_bermodul'
  | 'pembelajaran_bersemuka'
  | 'pembelajaran_tidak_bersemuka'
  | 'pembelajaran_kendiri';

export type TrainingLocationScope = 'dalam_negara' | 'luar_negara';

export type VerificationStatus = 'menunggu' | 'disahkan' | 'ditolak';

export type PlCourseCode =
  | 'CDL'
  | 'TDL'
  | 'SDL'
  | 'KDL'
  | 'PDL'
  | 'KL'
  | 'SL'
  | 'BL'
  | 'CD'
  | 'TD'
  | 'SD'
  | 'KD'
  | 'CL'
  | 'TL';

export interface StaffAccount {
  id: string;
  noFail?: string;
  noKp: string;
  icValid?: boolean;
  nama: string;
  jawatan: string;
  klasifikasi?: string;
  gred: string;
  tempatBertugas: string;
  jabatanInduk?: string;
  jabatanAsal?: string;
  tarafJawatan?: string;
  kategoriPerkhidmatan?: string;
  gender?: 'L' | 'P' | '';
  catatan?: string;
  tarikhLantikan?: string;
  peranan: UserRole;
  bulanBerkhidmat: number;
  sasaranTahun?: number;
  status: 'aktif' | 'tidak_aktif';
  createdAt: string;
  updatedAt: string;
}

export interface TrainingLogEntry {
  id: string;
  staffId?: string;
  staffNoKp: string;
  tahun: number;
  kategori: TrainingCategory;
  kodKursusPL?: PlCourseCode | '';
  jenisAktiviti: string;
  tajuk: string;
  lokasiSkop?: TrainingLocationScope;
  tarikhMula: string;
  tarikhTamat: string;
  tarikhAsal?: string;
  masaMula?: string;
  masaTamat?: string;
  bilanganHari: number;
  jumlahJam: number;
  tempat: string;
  anjuran: string;
  sumber?: string;
  pegawaiPenyelia?: string;
  keterangan?: string;
  isAssembly?: boolean;
  anomalyFlag?: string;
  statusPengesahan: VerificationStatus;
  disahkanOleh?: string;
  jawatanPengesah?: string;
  tarikhPengesahan?: string;
  catatanPengesah?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StaffTnaRecord {
  staffNoKp: string;
  tahun: number;
  sebabTidakMemenuhi: [string, string, string];
  kursusDiperlukan: [string, string, string, string, string];
  updatedAt: string;
}

export interface PlCodeBreakdown {
  CDL: number;
  TDL: number;
  SDL: number;
  KDL: number;
  PDL: number;
  KL: number;
  SL: number;
  BL: number;
  CD: number;
  TD: number;
  SD: number;
  KD: number;
  CL: number;
  TL: number;
  TIADA_KOD: number;
}

export interface ComplianceBreakdown {
  tahun: number;
  bulanBerkhidmat: number;
  sasaranHari: number;
  wajibBermodulHari: number;
  dalamNegaraHari: number;
  luarNegaraHari: number;
  latihanBermodulHari: number;
  bersemukaJam: number;
  bersemukaHariDikira: number;
  tidakBersemukaJam: number;
  tidakBersemukaHariDikira: number;
  kendiriBilangan: number;
  kendiriHariDikira: number;
  kursusSahajaHari: number;
  perhimpunanHari: number;
  bilanganRekodKursus: number;
  kodBreakdown: PlCodeBreakdown;
  jumlahHariDisahkan: number;
  jumlahHariMenunggu: number;
  jumlahKeseluruhanHari: number;
  memenuhiSasaranJumlah: boolean;
  memenuhiWajibBermodul: boolean;
  patuhSepenuhnya: boolean;
}

export interface ComplianceSummaryRow {
  staff: StaffAccount;
  compliance: ComplianceBreakdown;
  pendingLogsCount: number;
  anomalyCount: number;
}

export interface DepartmentSummary {
  jabatan: string;
  totalStaff: number;
  compliantCount: number;
  zeroDays: number;
  oneDay: number;
  twoDays: number;
  threeDays: number;
  fourPlusDays: number;
  totalTrainingDays: number;
  totalCourseDays: number;
  totalAssemblyDays: number;
  avgDays: number;
  complianceRate: number;
}

export interface BreakdownMetric {
  label: string;
  totalStaff: number;
  compliantCount: number;
  complianceRate: number;
  avgDays: number;
}

export interface AnomalyItem {
  id: string;
  type:
    | 'missing_course_code'
    | 'invalid_ic'
    | 'duplicate_ic'
    | 'duplicate_fail_no'
    | 'date_typo'
    | 'shifted_column';
  severity: 'tinggi' | 'sederhana' | 'maklumat';
  staffId: string;
  staffNama: string;
  staffNoKp: string;
  staffNoFail?: string;
  jabatan: string;
  logId?: string;
  tajukKursus?: string;
  rawValue: string;
  suggestedValue?: string;
  description: string;
}

export interface CsvImportAuditStats {
  sourceFileName: string;
  importedAt: string;
  totalRowsParsed: number;
  totalCoursesImported: number;
  excelFormulaRefRowsFixed: number;
  excelBlankSummaryRowsFixed: number;
  departmentVariantsNormalized: number;
  dateTyposFixed: number;
  shiftedColumnsRecovered: number;
  leadingZeroIcsReinstated?: number;
}

export interface AnalyticsOverview {
  tahun: number;
  totalStaff: number;
  totalCourses: number;
  totalTrainingDays: number;
  totalCourseOnlyDays: number;
  totalAssemblyDays: number;
  avgDaysPerStaff: number;
  compliantCount: number;
  complianceRate: number;
  pendingVerificationCount: number;
  distribution: {
    zeroDays: number;
    oneDay: number;
    twoDays: number;
    threeDays: number;
    fourPlusDays: number;
  };
  codeTotals: PlCodeBreakdown;
  byDepartment: DepartmentSummary[];
  byKategori: BreakdownMetric[];
  byTarafJawatan: BreakdownMetric[];
  byGender: BreakdownMetric[];
  topCourses: Array<{
    tajuk: string;
    kod: string;
    anjuran: string;
    peserta: number;
    jumlahHari: number;
  }>;
  auditStats: CsvImportAuditStats;
  anomalies: AnomalyItem[];
}
