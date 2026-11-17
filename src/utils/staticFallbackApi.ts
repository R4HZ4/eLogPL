import type {
  AnalyticsOverview,
  BreakdownMetric,
  ComplianceSummaryRow,
  CsvImportAuditStats,
  DepartmentSummary,
  PlCourseCode,
  StaffAccount,
  StaffTnaRecord,
  TrainingCategory,
  TrainingLogEntry,
  UserRole,
  VerificationStatus,
} from '../types/training';
import { computeLiveAnomalies, parsePerbadananLabuanCsv } from './plCsvParser';
import {
  PL_COURSE_CODES,
  calculateDurationHours,
  computeStaffCompliance,
  emptyPlCodeBreakdown,
  isValidNoKp,
  normalizeJabatanUnit,
  normalizeNoKp,
  normalizeTarafJawatan,
  stripNoKp,
} from './trainingRules';

interface StaticUser extends StaffAccount {
  password: string;
}

interface StaticDatabase {
  users: StaticUser[];
  logs: TrainingLogEntry[];
  tnaRecords: StaffTnaRecord[];
  auditStats: CsvImportAuditStats;
}

interface StaticSession {
  userId: string;
  noKp: string;
  peranan: UserRole;
  exp: number;
}

const STATIC_DB_STORAGE_KEY = 'elogpl_static_db_v1';
const SEED_CSV_URL = '/assets/aistudio/REKOD_KURSUS_TAHUN_2026_b9d2805c.csv';

let memoryDb: StaticDatabase | null = null;
let initPromise: Promise<StaticDatabase> | null = null;

function sanitizeUser(user: StaticUser): StaffAccount {
  const { password: _ignored, ...safe } = user;
  return safe;
}

function createAdminUser(now: string): StaticUser {
  return {
    id: 'usr-admin-root',
    noFail: 'ADMIN',
    noKp: '000000-00-0000',
    icValid: true,
    nama: 'Pentadbir Sistem (Admin)',
    jawatan: 'Pentadbir Sistem eLogPL',
    klasifikasi: 'ADM',
    gred: 'ADMIN',
    tempatBertugas: 'Pentadbiran Sistem eLogPL',
    jabatanInduk: 'Pentadbiran Sistem eLogPL',
    tarafJawatan: 'Tetap',
    kategoriPerkhidmatan: 'Pengurusan Tertinggi',
    gender: '',
    peranan: 'admin',
    bulanBerkhidmat: 12,
    sasaranTahun: 4,
    status: 'aktif',
    password: 'admin2026',
    createdAt: now,
    updatedAt: now,
  };
}

function saveStaticDb(db: StaticDatabase): void {
  memoryDb = db;
  try {
    window.localStorage.setItem(STATIC_DB_STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Abaikan jika kuota localStorage penuh; kekalkan dalam memori
  }
}

async function createSeedDatabase(): Promise<StaticDatabase> {
  const now = new Date().toISOString();
  try {
    const res = await fetch(SEED_CSV_URL);
    if (res.ok) {
      const csvText = await res.text();
      if (csvText.trim() && !csvText.trimStart().startsWith('<')) {
        const parsed = parsePerbadananLabuanCsv(csvText, 'REKOD KURSUS TAHUN 2026.csv');
        const users: StaticUser[] = [
          createAdminUser(now),
          ...parsed.users.map((u) => ({
            ...u,
            password: u.peranan === 'plb' ? 'plb2026' : 'elogpl2026',
          })),
        ];
        return reinstateElevenDigitIcs({
          users,
          logs: parsed.logs,
          tnaRecords: [],
          auditStats: parsed.auditStats,
        });
      }
    }
  } catch {
    // Guna rekod asas jika CSV gagal dimuat
  }

  return {
    users: [
      createAdminUser(now),
      {
        id: 'usr-plb-default',
        noFail: '1222',
        noKp: '691018-12-5115',
        icValid: true,
        nama: 'Mazalan Bin Hassin',
        jawatan: 'PP',
        klasifikasi: 'N',
        gred: '9',
        tempatBertugas: 'Pengurusan Sumber Manusia',
        jabatanInduk: 'Pengurusan Sumber Manusia',
        tarafJawatan: 'Tetap',
        kategoriPerkhidmatan: 'P & P',
        gender: 'L',
        peranan: 'plb',
        bulanBerkhidmat: 12,
        sasaranTahun: 4,
        status: 'aktif',
        password: 'plb2026',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'usr-staff-default',
        noFail: '1001',
        noKp: '680807-12-5341',
        icValid: true,
        nama: 'A. Majalan Bin Awang',
        jawatan: 'Pembantu Tadbir',
        klasifikasi: 'N',
        gred: 'N1',
        tempatBertugas: 'Jabatan Pengurusan Sumber Manusia',
        jabatanInduk: 'Jabatan Pengurusan Sumber Manusia',
        tarafJawatan: 'Tetap',
        kategoriPerkhidmatan: 'Sok II',
        gender: 'L',
        peranan: 'pegawai',
        bulanBerkhidmat: 12,
        sasaranTahun: 4,
        status: 'aktif',
        password: 'elogpl2026',
        createdAt: now,
        updatedAt: now,
      },
    ],
    logs: [],
    tnaRecords: [],
    auditStats: {
      sourceFileName: 'Data Asas eLogPL',
      importedAt: now,
      totalRowsParsed: 3,
      totalCoursesImported: 0,
      excelFormulaRefRowsFixed: 0,
      excelBlankSummaryRowsFixed: 0,
      departmentVariantsNormalized: 0,
      dateTyposFixed: 0,
      shiftedColumnsRecovered: 0,
    },
  };
}

function reinstateElevenDigitIcs(db: StaticDatabase): StaticDatabase {
  let count = 0;
  for (const u of db.users) {
    if (stripNoKp(u.noKp).length === 11) {
      const fixedKp = normalizeNoKp(u.noKp, true);
      u.noKp = fixedKp;
      u.icValid = true;
      u.updatedAt = new Date().toISOString();
      count++;
      for (const l of db.logs) {
        if (l.staffId === u.id) l.staffNoKp = fixedKp;
      }
    }
  }
  if (count > 0) {
    db.auditStats.leadingZeroIcsReinstated =
      (db.auditStats.leadingZeroIcsReinstated ?? 0) + count;
  }
  return db;
}

async function getStaticDb(): Promise<StaticDatabase> {
  if (memoryDb) return memoryDb;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const stored = window.localStorage.getItem(STATIC_DB_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as StaticDatabase;
        if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.logs)) {
          if (!parsed.users.some((u) => u.peranan === 'admin')) {
            parsed.users.unshift(createAdminUser(new Date().toISOString()));
          }
          memoryDb = reinstateElevenDigitIcs(parsed);
          return memoryDb;
        }
      }
    } catch {
      // Bina semula daripada CSV
    }

    const seeded = await createSeedDatabase();
    saveStaticDb(seeded);
    return seeded;
  })();

  try {
    return await initPromise;
  } finally {
    initPromise = null;
  }
}

function signStaticToken(session: StaticSession): string {
  const json = JSON.stringify(session);
  const encoded = btoa(unescape(encodeURIComponent(json)));
  return `static.${encoded}`;
}

function parseStaticToken(token: string | null): StaticSession | null {
  if (!token || !token.startsWith('static.')) return null;
  try {
    const json = decodeURIComponent(escape(atob(token.slice(7))));
    const parsed = JSON.parse(json) as StaticSession;
    if (!parsed.exp || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isPrivilegedRole(role?: UserRole): boolean {
  return role === 'admin' || role === 'plb';
}

function buildComplianceData(db: StaticDatabase, tahun: number) {
  const logsByStaffId = new Map<string, TrainingLogEntry[]>();
  const logsByKp = new Map<string, TrainingLogEntry[]>();

  for (const log of db.logs) {
    if (log.tahun !== tahun) continue;
    if (log.staffId) {
      const list = logsByStaffId.get(log.staffId) ?? [];
      list.push(log);
      logsByStaffId.set(log.staffId, list);
    } else {
      const digits = stripNoKp(log.staffNoKp);
      const list = logsByKp.get(digits) ?? [];
      list.push(log);
      logsByKp.set(digits, list);
    }
  }

  const activeUsers = db.users.filter(
    (u) => u.status === 'aktif' && u.peranan !== 'admin'
  );
  const rows: ComplianceSummaryRow[] = activeUsers.map((u) => {
    const byId = logsByStaffId.get(u.id) ?? [];
    const byKp = logsByKp.get(stripNoKp(u.noKp)) ?? [];
    const staffLogs = byId.length > 0 || byKp.length === 0 ? byId : byKp;
    const compliance = computeStaffCompliance(
      staffLogs,
      u.bulanBerkhidmat,
      tahun,
      u.sasaranTahun ?? (tahun >= 2026 ? 4 : 3)
    );
    const pendingLogsCount = staffLogs.filter(
      (l) => l.statusPengesahan === 'menunggu'
    ).length;
    const anomalyCount =
      (!isValidNoKp(u.noKp) ? 1 : 0) +
      staffLogs.filter((l) => l.kodKursusPL === '' || l.anomalyFlag === 'shifted_column')
        .length;

    return {
      staff: sanitizeUser(u),
      compliance,
      pendingLogsCount,
      anomalyCount,
    };
  });

  return { rows };
}

function buildAnalyticsOverview(db: StaticDatabase, tahun: number): AnalyticsOverview {
  const { rows } = buildComplianceData(db, tahun);
  const yearLogs = db.logs.filter((l) => l.tahun === tahun);

  let zeroDays = 0;
  let oneDay = 0;
  let twoDays = 0;
  let threeDays = 0;
  let fourPlusDays = 0;
  let totalTrainingDays = 0;
  let totalCourseOnlyDays = 0;
  let totalAssemblyDays = 0;
  let compliantCount = 0;
  let pendingVerificationCount = 0;

  const codeTotals = emptyPlCodeBreakdown();
  const deptMap = new Map<
    string,
    {
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
    }
  >();

  const makeMetricMap = () =>
    new Map<string, { totalStaff: number; compliantCount: number; totalDays: number }>();
  const kategoriMap = makeMetricMap();
  const tarafMap = makeMetricMap();
  const genderMap = makeMetricMap();

  const updateMetric = (
    map: Map<string, { totalStaff: number; compliantCount: number; totalDays: number }>,
    key: string,
    days: number,
    compliant: boolean
  ) => {
    const cur = map.get(key) ?? { totalStaff: 0, compliantCount: 0, totalDays: 0 };
    cur.totalStaff += 1;
    if (compliant) cur.compliantCount += 1;
    cur.totalDays += days;
    map.set(key, cur);
  };

  for (const row of rows) {
    const days = row.compliance.jumlahKeseluruhanHari;
    const compliant = row.compliance.patuhSepenuhnya;
    if (compliant) compliantCount += 1;
    pendingVerificationCount += row.pendingLogsCount;

    totalTrainingDays += days;
    totalCourseOnlyDays += row.compliance.kursusSahajaHari;
    totalAssemblyDays += row.compliance.perhimpunanHari;

    if (days === 0) zeroDays += 1;
    else if (days === 1) oneDay += 1;
    else if (days === 2) twoDays += 1;
    else if (days === 3) threeDays += 1;
    else fourPlusDays += 1;

    (Object.keys(codeTotals) as Array<keyof typeof codeTotals>).forEach((k) => {
      codeTotals[k] += row.compliance.kodBreakdown[k];
    });

    const deptName = row.staff.jabatanInduk || row.staff.tempatBertugas;
    const dStat = deptMap.get(deptName) ?? {
      totalStaff: 0,
      compliantCount: 0,
      zeroDays: 0,
      oneDay: 0,
      twoDays: 0,
      threeDays: 0,
      fourPlusDays: 0,
      totalTrainingDays: 0,
      totalCourseDays: 0,
      totalAssemblyDays: 0,
    };
    dStat.totalStaff += 1;
    if (compliant) dStat.compliantCount += 1;
    if (days === 0) dStat.zeroDays += 1;
    else if (days === 1) dStat.oneDay += 1;
    else if (days === 2) dStat.twoDays += 1;
    else if (days === 3) dStat.threeDays += 1;
    else dStat.fourPlusDays += 1;
    dStat.totalTrainingDays += days;
    dStat.totalCourseDays += row.compliance.kursusSahajaHari;
    dStat.totalAssemblyDays += row.compliance.perhimpunanHari;
    deptMap.set(deptName, dStat);

    updateMetric(
      kategoriMap,
      row.staff.kategoriPerkhidmatan || 'Tidak Dinyatakan',
      days,
      compliant
    );
    updateMetric(
      tarafMap,
      row.staff.tarafJawatan || 'Tidak Dinyatakan',
      days,
      compliant
    );
    updateMetric(
      genderMap,
      row.staff.gender === 'L'
        ? 'Lelaki'
        : row.staff.gender === 'P'
        ? 'Perempuan'
        : 'Tidak Dinyatakan',
      days,
      compliant
    );
  }

  const byDepartment: DepartmentSummary[] = [...deptMap.entries()]
    .map(([jabatan, s]) => ({
      jabatan,
      ...s,
      avgDays: s.totalStaff ? Math.round((s.totalTrainingDays / s.totalStaff) * 10) / 10 : 0,
      complianceRate: s.totalStaff
        ? Math.round((s.compliantCount / s.totalStaff) * 1000) / 10
        : 0,
    }))
    .sort((a, b) => b.totalStaff - a.totalStaff);

  const toBreakdownList = (
    map: Map<string, { totalStaff: number; compliantCount: number; totalDays: number }>
  ): BreakdownMetric[] =>
    [...map.entries()]
      .map(([label, v]) => ({
        label,
        totalStaff: v.totalStaff,
        compliantCount: v.compliantCount,
        complianceRate: v.totalStaff
          ? Math.round((v.compliantCount / v.totalStaff) * 1000) / 10
          : 0,
        avgDays: v.totalStaff ? Math.round((v.totalDays / v.totalStaff) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.totalStaff - a.totalStaff);

  const courseGroupMap = new Map<
    string,
    { tajuk: string; kod: string; anjuran: string; peserta: number; jumlahHari: number }
  >();
  for (const log of yearLogs) {
    if (log.statusPengesahan === 'ditolak') continue;
    const key = log.tajuk.trim().toLowerCase();
    const cur = courseGroupMap.get(key) ?? {
      tajuk: log.tajuk.trim(),
      kod: log.kodKursusPL || '-',
      anjuran: log.anjuran || 'PL',
      peserta: 0,
      jumlahHari: 0,
    };
    cur.peserta += 1;
    cur.jumlahHari += log.bilanganHari || 1;
    if (cur.kod === '-' && log.kodKursusPL) cur.kod = log.kodKursusPL;
    courseGroupMap.set(key, cur);
  }

  const topCourses = [...courseGroupMap.values()]
    .sort((a, b) => b.peserta - a.peserta)
    .slice(0, 12);

  const totalStaff = rows.length;
  const anomalies = computeLiveAnomalies(
    db.users.filter((u) => u.peranan !== 'admin').map(sanitizeUser),
    db.logs
  );

  return {
    tahun,
    totalStaff,
    totalCourses: yearLogs.length,
    totalTrainingDays,
    totalCourseOnlyDays,
    totalAssemblyDays,
    avgDaysPerStaff: totalStaff ? Math.round((totalTrainingDays / totalStaff) * 10) / 10 : 0,
    compliantCount,
    complianceRate: totalStaff ? Math.round((compliantCount / totalStaff) * 1000) / 10 : 0,
    pendingVerificationCount,
    distribution: {
      zeroDays,
      oneDay,
      twoDays,
      threeDays,
      fourPlusDays,
    },
    codeTotals,
    byDepartment,
    byKategori: toBreakdownList(kategoriMap),
    byTarafJawatan: toBreakdownList(tarafMap),
    byGender: toBreakdownList(genderMap),
    topCourses,
    auditStats: db.auditStats,
    anomalies,
  };
}

function genId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function buildStaticExportCsv(tahun: number): Promise<string> {
  const db = await getStaticDb();
  const { rows } = buildComplianceData(db, tahun);
  const header = [
    'No_Pekerja',
    'No_KP',
    'Nama_Pegawai',
    'Jabatan_Induk',
    'Unit_Bertugas',
    'Klasifikasi',
    'Gred',
    'Jawatan',
    'Taraf_Jawatan',
    'Kategori_Perkhidmatan',
    'Jantina',
    'CDL',
    'TDL',
    'SDL',
    'KDL',
    'KL',
    'SL',
    'BL',
    'PDL_Perhimpunan',
    'Hari_Kursus_Sahaja',
    'Hari_Perhimpunan',
    'Jumlah_Hari_Keseluruhan',
    'Sasaran_Hari',
    'Status_Pematuhan',
  ];

  const escape = (v: string | number | undefined) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lines = rows.map((row) =>
    [
      row.staff.noFail ?? '',
      row.staff.noKp,
      row.staff.nama,
      row.staff.jabatanInduk ?? row.staff.tempatBertugas,
      row.staff.tempatBertugas,
      row.staff.klasifikasi ?? '',
      row.staff.gred,
      row.staff.jawatan,
      row.staff.tarafJawatan ?? '',
      row.staff.kategoriPerkhidmatan ?? '',
      row.staff.gender ?? '',
      row.compliance.kodBreakdown.CDL,
      row.compliance.kodBreakdown.TDL,
      row.compliance.kodBreakdown.SDL,
      row.compliance.kodBreakdown.KDL,
      row.compliance.kodBreakdown.KL,
      row.compliance.kodBreakdown.SL,
      row.compliance.kodBreakdown.BL,
      row.compliance.kodBreakdown.PDL,
      row.compliance.kursusSahajaHari,
      row.compliance.perhimpunanHari,
      row.compliance.jumlahKeseluruhanHari,
      row.compliance.sasaranHari,
      row.compliance.patuhSepenuhnya ? 'Patuh (>=4 Hari)' : 'Kurang Sasaran',
    ]
      .map(escape)
      .join(',')
  );

  return `\uFEFF${[header.join(','), ...lines].join('\n')}`;
}

export async function handleStaticApiRequest<T>(
  rawUrl: string,
  init: RequestInit = {},
  token: string | null = null
): Promise<T> {
  const parsedUrl = new URL(rawUrl, window.location.origin);
  const pathname = parsedUrl.pathname;
  const method = (init.method ?? 'GET').toUpperCase();
  const body =
    typeof init.body === 'string' && init.body.trim()
      ? (JSON.parse(init.body) as Record<string, unknown>)
      : {};

  const db = await getStaticDb();

  if (pathname === '/api/auth/login' && method === 'POST') {
    const rawNoKp = String(body.noKp ?? '').trim();
    const password = String(body.password ?? '');
    const roleMode = body.roleMode === 'admin' ? 'admin' : 'staff';

    if (!rawNoKp || !password) {
      throw new Error('Sila masukkan No. Kad Pengenalan dan kata laluan yang sah.');
    }

    const targetDigits = stripNoKp(rawNoKp);
    const isAdminShortcut = rawNoKp === '0' || rawNoKp.toLowerCase() === 'admin';
    const candidates = db.users.filter(
      (u) =>
        (isAdminShortcut && u.peranan === 'admin') ||
        (targetDigits && stripNoKp(u.noKp) === targetDigits) ||
        u.noKp.trim().toUpperCase() === rawNoKp.toUpperCase()
    );

    const user = candidates.find((u) => u.password === password) ?? null;
    if (!user) {
      throw new Error('No. K/P atau kata laluan tidak sah.');
    }
    if (roleMode === 'admin' && user.peranan !== 'admin') {
      throw new Error(
        'Akaun ini bukan Pentadbir Sistem. Sila gunakan tab Log Masuk Kakitangan.'
      );
    }
    if (user.status !== 'aktif') {
      throw new Error('Akaun kakitangan ini tidak aktif. Sila hubungi PLB / BPSM.');
    }

    const nextToken = signStaticToken({
      userId: user.id,
      noKp: user.noKp,
      peranan: user.peranan,
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
    });

    return { token: nextToken, user: sanitizeUser(user) } as T;
  }

  const auth = parseStaticToken(token);
  if (!auth) {
    throw new Error('Sesi log masuk diperlukan. Sila log masuk menggunakan No. K/P.');
  }

  if (pathname === '/api/auth/me' && method === 'GET') {
    const user = db.users.find((u) => u.id === auth.userId);
    if (!user) throw new Error('Profil kakitangan tidak ditemui.');
    return { user: sanitizeUser(user) } as T;
  }

  if (pathname === '/api/staff' && method === 'GET') {
    if (isPrivilegedRole(auth.peranan)) {
      return {
        staff: db.users.filter((u) => u.peranan !== 'admin').map(sanitizeUser),
      } as T;
    }
    const self = db.users.find((u) => u.id === auth.userId);
    return { staff: self ? [sanitizeUser(self)] : [] } as T;
  }

  if (pathname === '/api/staff' && method === 'POST') {
    if (!isPrivilegedRole(auth.peranan)) {
      throw new Error('Akses terhad kepada Pentadbir Sistem (Admin) atau PLB.');
    }
    const rawNoKp = String(body.noKp ?? '');
    const nama = String(body.nama ?? '').trim();
    const jawatan = String(body.jawatan ?? '').trim();
    const gred = String(body.gred ?? '').trim().toUpperCase();
    const tempatBertugas = String(body.tempatBertugas ?? '').trim();
    const password = String(body.password ?? 'elogpl2026');

    if (!isValidNoKp(rawNoKp) || nama.length < 2 || !jawatan || !gred || !tempatBertugas) {
      throw new Error(
        'No. K/P (12 digit), Nama, Jawatan, Gred, dan Jabatan/Unit wajib diisi.'
      );
    }
    if (password.length < 6) {
      throw new Error('Kata laluan minimum 6 aksara.');
    }

    const targetDigits = stripNoKp(rawNoKp);
    if (db.users.some((u) => stripNoKp(u.noKp) === targetDigits)) {
      throw new Error(`No. K/P ${normalizeNoKp(rawNoKp)} sudah wujud dalam direktori.`);
    }

    const dept = normalizeJabatanUnit(tempatBertugas);
    const now = new Date().toISOString();
    const peranan: UserRole =
      body.peranan === 'admin' && auth.peranan === 'admin'
        ? 'admin'
        : body.peranan === 'plb'
        ? 'plb'
        : 'pegawai';

    const created: StaticUser = {
      id: genId('usr'),
      noFail: body.noFail ? String(body.noFail).trim() : undefined,
      noKp: normalizeNoKp(rawNoKp),
      icValid: true,
      nama,
      jawatan,
      klasifikasi: body.klasifikasi
        ? String(body.klasifikasi).trim().toUpperCase()
        : undefined,
      gred,
      tempatBertugas: dept.tempatBertugas,
      jabatanInduk: dept.jabatanInduk,
      tarafJawatan: normalizeTarafJawatan(String(body.tarafJawatan ?? 'Tetap')),
      kategoriPerkhidmatan: String(body.kategoriPerkhidmatan ?? 'Sok I').trim(),
      gender:
        body.gender === 'L' || body.gender === 'P' || body.gender === ''
          ? body.gender
          : '',
      peranan,
      bulanBerkhidmat: Math.max(1, Math.min(12, Number(body.bulanBerkhidmat) || 12)),
      sasaranTahun: 4,
      status: 'aktif',
      password,
      createdAt: now,
      updatedAt: now,
    };
    db.users.push(created);
    saveStaticDb(db);
    return { staff: sanitizeUser(created) } as T;
  }

  if (pathname === '/api/staff/reset-database' && method === 'POST') {
    if (auth.peranan !== 'admin') {
      throw new Error('Hanya Admin boleh menetapkan semula pangkalan data.');
    }
    if (body.action === 'clear_all') {
      db.users = db.users.filter((u) => u.peranan === 'admin');
      db.logs = [];
      db.tnaRecords = [];
      saveStaticDb(db);
      return { ok: true, totalStaff: 0, totalLogs: 0 } as T;
    }
    const fresh = await createSeedDatabase();
    saveStaticDb(fresh);
    return {
      ok: true,
      totalStaff: fresh.users.filter((u) => u.peranan !== 'admin').length,
      totalLogs: fresh.logs.length,
    } as T;
  }

  if (pathname === '/api/staff/import-csv' && method === 'POST') {
    if (!isPrivilegedRole(auth.peranan)) {
      throw new Error('Akses terhad kepada Pentadbir Sistem (Admin) atau PLB.');
    }
    const csvText = String(body.csvText ?? '');
    const fileName = String(body.fileName ?? 'rekod-kursus-import.csv');
    const mode = body.mode === 'replace' ? 'replace' : 'merge';
    if (!csvText.trim()) throw new Error('Fail CSV kosong.');

    const parsed = parsePerbadananLabuanCsv(csvText, fileName);
    if (parsed.users.length === 0) {
      throw new Error(
        'Tiada baris rekod kakitangan sah ditemui dalam format CSV Perbadanan Labuan.'
      );
    }

    if (mode === 'replace') {
      const admins = db.users.filter((u) => u.peranan === 'admin');
      const prevPwd = new Map(db.users.map((u) => [stripNoKp(u.noKp), u.password]));
      db.users = [
        ...admins,
        ...parsed.users.map((u) => ({
          ...u,
          password:
            prevPwd.get(stripNoKp(u.noKp)) ??
            (u.peranan === 'plb' ? 'plb2026' : 'elogpl2026'),
        })),
      ];
      db.logs = parsed.logs;
      db.auditStats = parsed.auditStats;
      saveStaticDb(db);
      return {
        ok: true,
        importedStaff: db.users.length,
        importedLogs: db.logs.length,
        auditStats: db.auditStats,
      } as T;
    }

    let addedStaff = 0;
    let addedLogs = 0;
    const existingByKp = new Map(db.users.map((u) => [stripNoKp(u.noKp), u]));
    const parsedIdToTarget = new Map<string, StaticUser>();
    for (const u of parsed.users) {
      const key = stripNoKp(u.noKp);
      const existing = existingByKp.get(key);
      if (existing) {
        parsedIdToTarget.set(u.id, existing);
      } else {
        const created: StaticUser = {
          ...u,
          password: u.peranan === 'plb' ? 'plb2026' : 'elogpl2026',
        };
        db.users.push(created);
        existingByKp.set(key, created);
        parsedIdToTarget.set(u.id, created);
        addedStaff++;
      }
    }
    const sigs = new Set(
      db.logs.map((l) => `${l.staffId || stripNoKp(l.staffNoKp)}|${l.tajuk.toLowerCase()}|${l.tarikhMula}`)
    );
    for (const l of parsed.logs) {
      const target = l.staffId ? parsedIdToTarget.get(l.staffId) : undefined;
      const targetId = target?.id ?? l.staffId;
      const sig = `${targetId || stripNoKp(l.staffNoKp)}|${l.tajuk.toLowerCase()}|${l.tarikhMula}`;
      if (!sigs.has(sig)) {
        db.logs.push({ ...l, id: genId('log-imp'), staffId: targetId });
        sigs.add(sig);
        addedLogs++;
      }
    }
    saveStaticDb(db);
    return {
      ok: true,
      importedStaff: addedStaff,
      importedLogs: addedLogs,
      auditStats: db.auditStats,
    } as T;
  }

  if (pathname.startsWith('/api/staff/')) {
    const staffId = pathname.slice('/api/staff/'.length);
    const idx = db.users.findIndex((u) => u.id === staffId);
    if (idx === -1) throw new Error('Rekod kakitangan tidak ditemui.');

    if (method === 'PATCH') {
      const target = db.users[idx];
      const isSelf = auth.userId === target.id;
      const isPlb = isPrivilegedRole(auth.peranan);
      if (!isPlb && !isSelf) {
        throw new Error('Anda tidak dibenarkan mengemas kini profil kakitangan lain.');
      }

      let nextNoKp = target.noKp;
      let nextIcValid = target.icValid ?? isValidNoKp(target.noKp);
      if (isPlb && body.noKp !== undefined) {
        const candidate = normalizeNoKp(String(body.noKp).trim(), true);
        if (!isValidNoKp(candidate)) {
          throw new Error('No. K/P baharu mestilah 12 digit yang sah.');
        }
        nextNoKp = candidate;
        nextIcValid = true;
        for (const l of db.logs) {
          if (l.staffId === target.id) l.staffNoKp = nextNoKp;
        }
      }

      const nextDept = body.tempatBertugas
        ? normalizeJabatanUnit(String(body.tempatBertugas))
        : null;

      const updated: StaticUser = {
        ...target,
        noKp: nextNoKp,
        icValid: nextIcValid,
        noFail:
          isPlb && body.noFail !== undefined
            ? String(body.noFail).trim() || undefined
            : target.noFail,
        nama: body.nama ? String(body.nama).trim() : target.nama,
        jawatan: body.jawatan ? String(body.jawatan).trim() : target.jawatan,
        klasifikasi:
          body.klasifikasi !== undefined
            ? String(body.klasifikasi).trim().toUpperCase() || undefined
            : target.klasifikasi,
        gred: body.gred ? String(body.gred).trim().toUpperCase() : target.gred,
        tempatBertugas: nextDept ? nextDept.tempatBertugas : target.tempatBertugas,
        jabatanInduk: nextDept ? nextDept.jabatanInduk : target.jabatanInduk,
        tarafJawatan: body.tarafJawatan
          ? normalizeTarafJawatan(String(body.tarafJawatan))
          : target.tarafJawatan,
        kategoriPerkhidmatan: body.kategoriPerkhidmatan
          ? String(body.kategoriPerkhidmatan).trim()
          : target.kategoriPerkhidmatan,
        gender:
          body.gender === 'L' || body.gender === 'P' || body.gender === ''
            ? body.gender
            : target.gender,
        bulanBerkhidmat:
          body.bulanBerkhidmat !== undefined
            ? Math.max(1, Math.min(12, Number(body.bulanBerkhidmat) || target.bulanBerkhidmat))
            : target.bulanBerkhidmat,
        sasaranTahun:
          isPlb && body.sasaranTahun !== undefined
            ? Math.max(1, Math.min(30, Number(body.sasaranTahun) || 4))
            : target.sasaranTahun,
        peranan:
          isPlb && (body.peranan === 'plb' || body.peranan === 'pegawai')
            ? body.peranan
            : target.peranan,
        status:
          isPlb && (body.status === 'aktif' || body.status === 'tidak_aktif')
            ? body.status
            : target.status,
        password:
          isPlb && body.password && String(body.password).trim().length >= 6
            ? String(body.password).trim()
            : target.password,
        updatedAt: new Date().toISOString(),
      };
      db.users[idx] = updated;
      saveStaticDb(db);
      return { staff: sanitizeUser(updated) } as T;
    }

    if (method === 'DELETE') {
      if (!isPrivilegedRole(auth.peranan)) {
        throw new Error('Akses terhad kepada Pentadbir Sistem (Admin) atau PLB.');
      }
      const target = db.users[idx];
      if (target.id === auth.userId || target.peranan === 'admin') {
        throw new Error('Akaun Pentadbir Sistem aktif tidak boleh dipadam.');
      }
      db.users.splice(idx, 1);
      const before = db.logs.length;
      const targetDigits = stripNoKp(target.noKp);
      const kpStillUsed = db.users.some((u) => stripNoKp(u.noKp) === targetDigits);
      db.logs = db.logs.filter((l) => {
        if (l.staffId) return l.staffId !== target.id;
        return kpStillUsed ? true : stripNoKp(l.staffNoKp) !== targetDigits;
      });
      if (!kpStillUsed) {
        db.tnaRecords = db.tnaRecords.filter(
          (t) => stripNoKp(t.staffNoKp) !== targetDigits
        );
      }
      saveStaticDb(db);
      return { ok: true, deletedLogsCount: before - db.logs.length } as T;
    }
  }

  if (pathname === '/api/training-logs' && method === 'GET') {
    const tahunParam = parsedUrl.searchParams.get('tahun') ?? '2026';
    const tahunFilter = tahunParam === 'all' ? null : Number(tahunParam) || 2026;
    const isPlb = isPrivilegedRole(auth.peranan);
    const currentUser = db.users.find((u) => u.id === auth.userId);
    const statusFilter = parsedUrl.searchParams.get('status');
    const filterStaffId = parsedUrl.searchParams.get('staffId');
    const filterKp = parsedUrl.searchParams.get('noKp')
      ? stripNoKp(parsedUrl.searchParams.get('noKp') ?? '')
      : null;

    const logs = db.logs
      .filter((log) => {
        if (tahunFilter !== null && log.tahun !== tahunFilter) return false;
        if (statusFilter && log.statusPengesahan !== statusFilter) return false;
        if (isPlb) {
          if (filterStaffId) return log.staffId === filterStaffId;
          if (filterKp) return stripNoKp(log.staffNoKp) === filterKp;
          return true;
        }
        if (currentUser && log.staffId) return log.staffId === currentUser.id;
        return stripNoKp(log.staffNoKp) === stripNoKp(auth.noKp);
      })
      .sort((a, b) => b.tarikhMula.localeCompare(a.tarikhMula));

    return { logs } as T;
  }

  if (pathname === '/api/training-logs' && method === 'POST') {
    const isPlb = isPrivilegedRole(auth.peranan);
    const owner =
      isPlb && body.staffId
        ? db.users.find((u) => u.id === String(body.staffId))
        : isPlb && body.staffNoKp
        ? db.users.find((u) => stripNoKp(u.noKp) === stripNoKp(String(body.staffNoKp)))
        : db.users.find((u) => u.id === auth.userId);

    if (!owner) throw new Error('Pegawai bagi rekod latihan tidak ditemui.');

    const rawKod = body.kodKursusPL
      ? (String(body.kodKursusPL).trim().toUpperCase() as PlCourseCode)
      : undefined;
    const kodMeta = rawKod && rawKod in PL_COURSE_CODES ? PL_COURSE_CODES[rawKod] : null;
    const kategori = (kodMeta?.kategori ??
      String(body.kategori ?? 'latihan_bermodul')) as TrainingCategory;
    const tajuk = String(body.tajuk ?? '').trim();
    const jenisAktiviti =
      String(body.jenisAktiviti ?? '').trim() ||
      (kodMeta ? `${kodMeta.label} (${kodMeta.code})` : '');
    const tarikhMula = String(body.tarikhMula ?? '').trim();
    const tarikhTamat = String(body.tarikhTamat ?? tarikhMula).trim();
    const tempat = String(body.tempat ?? '').trim();
    const anjuran = String(body.anjuran ?? '').trim();
    const tahun = Number(body.tahun) || Number(tarikhMula.slice(0, 4)) || 2026;

    if (!tajuk || !jenisAktiviti || !tarikhMula || !tempat) {
      throw new Error('Tajuk, Jenis Aktiviti, Tarikh, dan Tempat wajib diisi.');
    }

    let bilanganHari = 0;
    let jumlahJam = 0;
    const masaMula = body.masaMula ? String(body.masaMula).trim() : undefined;
    const masaTamat = body.masaTamat ? String(body.masaTamat).trim() : undefined;
    if (kodMeta || kategori === 'latihan_bermodul') {
      bilanganHari = Math.max(1, Number(body.bilanganHari) || 1);
      jumlahJam = Number(body.jumlahJam) || bilanganHari * 6;
    } else if (kategori === 'pembelajaran_kendiri') {
      bilanganHari = 1;
      jumlahJam = 6;
    } else {
      const calc = calculateDurationHours(masaMula, masaTamat);
      jumlahJam = Number(body.jumlahJam) || calc;
      if (jumlahJam <= 0 || jumlahJam >= 6) {
        throw new Error(
          'Sesi pembelajaran (< 6 jam) memerlukan tempoh jam sah antara 0.5 hingga 5.9 jam.'
        );
      }
    }

    const now = new Date().toISOString();
    const entry: TrainingLogEntry = {
      id: genId('log'),
      staffId: owner.id,
      staffNoKp: owner.noKp,
      tahun,
      kategori,
      kodKursusPL: kodMeta?.code,
      jenisAktiviti,
      tajuk,
      lokasiSkop:
        kategori === 'latihan_bermodul'
          ? body.lokasiSkop === 'luar_negara'
            ? 'luar_negara'
            : 'dalam_negara'
          : undefined,
      tarikhMula,
      tarikhTamat,
      masaMula,
      masaTamat,
      bilanganHari,
      jumlahJam,
      tempat,
      anjuran: anjuran || 'PL',
      sumber: body.sumber ? String(body.sumber).trim() : undefined,
      pegawaiPenyelia: body.pegawaiPenyelia
        ? String(body.pegawaiPenyelia).trim()
        : undefined,
      keterangan: body.keterangan ? String(body.keterangan).trim() : undefined,
      isAssembly: kodMeta?.isAssembly ?? false,
      statusPengesahan: isPlb && body.autoVerify ? 'disahkan' : 'menunggu',
      disahkanOleh:
        isPlb && body.autoVerify
          ? db.users.find((u) => u.id === auth.userId)?.nama ?? 'PLB'
          : undefined,
      tarikhPengesahan: isPlb && body.autoVerify ? now.slice(0, 10) : undefined,
      createdAt: now,
      updatedAt: now,
    };
    db.logs.unshift(entry);
    saveStaticDb(db);
    return { log: entry } as T;
  }

  if (pathname.startsWith('/api/training-logs/')) {
    const logId = pathname.slice('/api/training-logs/'.length);
    const idx = db.logs.findIndex((l) => l.id === logId);
    if (idx === -1) throw new Error('Rekod latihan tidak ditemui.');

    const existing = db.logs[idx];
    const isPlb = isPrivilegedRole(auth.peranan);
    const isOwner =
      existing.staffId === auth.userId ||
      stripNoKp(existing.staffNoKp) === stripNoKp(auth.noKp);
    if (!isPlb && !isOwner) throw new Error('Akses ditolak.');

    if (method === 'PATCH') {
      let next: TrainingLogEntry = { ...existing };
      if (body.statusPengesahan !== undefined) {
        if (!isPlb) throw new Error('Hanya PLB/Admin boleh mengesahkan log latihan.');
        const nextStatus = body.statusPengesahan as VerificationStatus;
        const verifier = db.users.find((u) => u.id === auth.userId);
        next = {
          ...next,
          statusPengesahan: nextStatus,
          disahkanOleh:
            nextStatus === 'menunggu'
              ? undefined
              : verifier?.nama ?? 'Pegawai Latihan Bahagian',
          jawatanPengesah:
            nextStatus === 'menunggu' ? undefined : verifier?.jawatan ?? 'PLB',
          tarikhPengesahan:
            nextStatus === 'menunggu' ? undefined : new Date().toISOString().slice(0, 10),
          catatanPengesah: body.catatanPengesah
            ? String(body.catatanPengesah).trim()
            : next.catatanPengesah,
        };
      }
      if (isPlb && body.kodKursusPL !== undefined) {
        const code = String(body.kodKursusPL).trim().toUpperCase() as PlCourseCode;
        if (!(code in PL_COURSE_CODES)) throw new Error(`Kod kursus '${code}' tidak sah.`);
        const meta = PL_COURSE_CODES[code];
        next = {
          ...next,
          kodKursusPL: code,
          kategori: meta.kategori,
          jenisAktiviti: `${meta.label} (${code})`,
          isAssembly: meta.isAssembly,
          anomalyFlag:
            next.anomalyFlag === 'missing_course_code' ? undefined : next.anomalyFlag,
        };
      }
      next.updatedAt = new Date().toISOString();
      db.logs[idx] = next;
      saveStaticDb(db);
      return { log: next } as T;
    }

    if (method === 'DELETE') {
      if (!isPlb && existing.statusPengesahan === 'disahkan') {
        throw new Error('Rekod yang sudah disahkan tidak boleh dipadam.');
      }
      db.logs.splice(idx, 1);
      saveStaticDb(db);
      return { ok: true } as T;
    }
  }

  if (pathname === '/api/tna' && method === 'GET') {
    const tahun = Number(parsedUrl.searchParams.get('tahun')) || 2026;
    const targetNoKp =
      isPrivilegedRole(auth.peranan) && parsedUrl.searchParams.get('noKp')
        ? normalizeNoKp(String(parsedUrl.searchParams.get('noKp')))
        : normalizeNoKp(auth.noKp);
    const record = db.tnaRecords.find(
      (r) => r.tahun === tahun && stripNoKp(r.staffNoKp) === stripNoKp(targetNoKp)
    );
    return {
      tna: record ?? {
        staffNoKp: targetNoKp,
        tahun,
        sebabTidakMemenuhi: ['', '', ''],
        kursusDiperlukan: ['', '', '', '', ''],
        updatedAt: new Date().toISOString(),
      },
    } as T;
  }

  if (pathname === '/api/tna' && method === 'PUT') {
    const tahun = Number(body.tahun) || 2026;
    const staffNoKp = normalizeNoKp(auth.noKp);
    const rawReasons = Array.isArray(body.sebabTidakMemenuhi)
      ? body.sebabTidakMemenuhi
      : [];
    const rawCourses = Array.isArray(body.kursusDiperlukan)
      ? body.kursusDiperlukan
      : [];
    const record: StaffTnaRecord = {
      staffNoKp,
      tahun,
      sebabTidakMemenuhi: [
        String(rawReasons[0] ?? '').trim(),
        String(rawReasons[1] ?? '').trim(),
        String(rawReasons[2] ?? '').trim(),
      ],
      kursusDiperlukan: [
        String(rawCourses[0] ?? '').trim(),
        String(rawCourses[1] ?? '').trim(),
        String(rawCourses[2] ?? '').trim(),
        String(rawCourses[3] ?? '').trim(),
        String(rawCourses[4] ?? '').trim(),
      ],
      updatedAt: new Date().toISOString(),
    };
    const idx = db.tnaRecords.findIndex(
      (r) => r.tahun === tahun && stripNoKp(r.staffNoKp) === stripNoKp(staffNoKp)
    );
    if (idx === -1) db.tnaRecords.push(record);
    else db.tnaRecords[idx] = record;
    saveStaticDb(db);
    return { tna: record } as T;
  }

  if (pathname === '/api/reports/compliance' && method === 'GET') {
    if (!isPrivilegedRole(auth.peranan)) throw new Error('Akses terhad.');
    const tahun = Number(parsedUrl.searchParams.get('tahun')) || 2026;
    const { rows } = buildComplianceData(db, tahun);
    return {
      tahun,
      summary: {
        totalStaff: rows.length,
        metTarget: rows.filter((r) => r.compliance.patuhSepenuhnya).length,
        threeDays: rows.filter((r) => r.compliance.jumlahKeseluruhanHari === 3).length,
        twoDays: rows.filter((r) => r.compliance.jumlahKeseluruhanHari === 2).length,
        oneDay: rows.filter((r) => r.compliance.jumlahKeseluruhanHari === 1).length,
        zeroDays: rows.filter((r) => r.compliance.jumlahKeseluruhanHari === 0).length,
      },
      rows,
    } as T;
  }

  if (pathname === '/api/analytics/overview' && method === 'GET') {
    if (!isPrivilegedRole(auth.peranan)) throw new Error('Akses terhad.');
    const tahun = Number(parsedUrl.searchParams.get('tahun')) || 2026;
    return buildAnalyticsOverview(db, tahun) as T;
  }

  throw new Error(`Endpoint ${pathname} tidak disokong dalam mod statik.`);
}
