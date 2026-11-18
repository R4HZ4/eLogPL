import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
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
} from './src/types/training.ts';
import {
  computeLiveAnomalies,
  parsePerbadananLabuanCsv,
} from './src/utils/plCsvParser.ts';
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
} from './src/utils/trainingRules.ts';

interface StoredStaffUser extends StaffAccount {
  passwordHash: string;
}

interface LogbookDatabase {
  users: StoredStaffUser[];
  logs: TrainingLogEntry[];
  tnaRecords: StaffTnaRecord[];
  auditStats: CsvImportAuditStats;
}

interface SessionPayload {
  userId: string;
  noKp: string;
  peranan: UserRole;
  exp: number;
}

interface AuthenticatedRequest extends Request {
  auth?: SessionPayload;
}

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'elogpl_2026_db.json');
const SECRET_PATH = path.join(DATA_DIR, '.session_secret');
const SEED_CSV_PATH = path.resolve(
  process.cwd(),
  'public/assets/aistudio/REKOD_KURSUS_TAHUN_2026_b9d2805c.csv'
);

function getSessionSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
    return process.env.SESSION_SECRET;
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(SECRET_PATH)) {
    return fs.readFileSync(SECRET_PATH, 'utf8').trim();
  }
  const generated = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(SECRET_PATH, generated, 'utf8');
  return generated;
}

const SESSION_SECRET = getSessionSecret();

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const actual = crypto.scryptSync(password, salt, 64);
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

function signToken(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(body)
    .digest('base64url');
  return `${body}.${sig}`;
}

function verifyToken(token: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(body)
    .digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8')
    ) as SessionPayload;
    if (!parsed.exp || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

function sanitizeUser(user: StoredStaffUser): StaffAccount {
  const { passwordHash: _ignored, ...safe } = user;
  return safe;
}

function createAdminAccount(adminHash: string, now: string): StoredStaffUser {
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
    passwordHash: adminHash,
    createdAt: now,
    updatedAt: now,
  };
}

function createSeedDatabase(): LogbookDatabase {
  const defaultStaffHash = hashPassword('elogpl2026');
  const defaultAdminHash = hashPassword('admin2026');
  const now = new Date().toISOString();

  if (fs.existsSync(SEED_CSV_PATH)) {
    const csvText = fs.readFileSync(SEED_CSV_PATH, 'utf8');
    const parsed = parsePerbadananLabuanCsv(csvText, 'REKOD KURSUS TAHUN 2026.csv');
    const users: StoredStaffUser[] = [
      createAdminAccount(defaultAdminHash, now),
      ...parsed.users.map((u) => ({
        ...u,
        peranan: 'pegawai' as UserRole,
        passwordHash: defaultStaffHash,
      })),
    ];

    return {
      users,
      logs: parsed.logs,
      tnaRecords: [],
      auditStats: parsed.auditStats,
    };
  }

  return {
    users: [
      createAdminAccount(defaultAdminHash, now),
      {
        id: 'usr-staff-default',
        noFail: '1001',
        noKp: '680807-12-5341',
        icValid: true,
        nama: 'A. Majalan Bin Awang',
        jawatan: 'Pembantu Tadbir',
        klasifikasi: 'N',
        gred: 'N1',
        tempatBertugas: 'Pengurusan Sumber Manusia',
        jabatanInduk: 'Pengurusan Sumber Manusia',
        tarafJawatan: 'Tetap',
        kategoriPerkhidmatan: 'Sok II',
        gender: 'L',
        peranan: 'pegawai',
        bulanBerkhidmat: 12,
        sasaranTahun: 4,
        status: 'aktif',
        passwordHash: defaultStaffHash,
        createdAt: now,
        updatedAt: now,
      },
    ],
    logs: [],
    tnaRecords: [],
    auditStats: {
      sourceFileName: 'Tiada CSV',
      importedAt: now,
      totalRowsParsed: 1,
      totalCoursesImported: 0,
      excelFormulaRefRowsFixed: 0,
      excelBlankSummaryRowsFixed: 0,
      departmentVariantsNormalized: 0,
      dateTyposFixed: 0,
      shiftedColumnsRecovered: 0,
    },
  };
}

let cachedDb: LogbookDatabase | null = null;

function loadDb(): LogbookDatabase {
  if (cachedDb) return cachedDb;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    const seeded = createSeedDatabase();
    fs.writeFileSync(DB_PATH, JSON.stringify(seeded, null, 2), 'utf8');
    cachedDb = seeded;
    return seeded;
  }
  const raw = fs.readFileSync(DB_PATH, 'utf8');
  const db = JSON.parse(raw) as LogbookDatabase;
  let dirty = false;

  // Ensure dedicated Admin account exists
  if (!db.users.some((u) => u.peranan === 'admin')) {
    db.users.unshift(createAdminAccount(hashPassword('admin2026'), new Date().toISOString()));
    dirty = true;
  }

  // Migrate any legacy non-admin privileged roles to standard pegawai
  for (const u of db.users) {
    if ((u.peranan as string) !== 'admin' && u.peranan !== 'pegawai') {
      u.peranan = 'pegawai';
      u.passwordHash = hashPassword('elogpl2026');
      u.updatedAt = new Date().toISOString();
      dirty = true;
    }
  }

  // Reinstate 11-digit No. K/P values by prepending leading '0' to make valid 12-digit ICs
  let reinstatedCount = 0;
  for (const u of db.users) {
    const digits = stripNoKp(u.noKp);
    if (digits.length === 11) {
      const fixedKp = normalizeNoKp(u.noKp, true);
      u.noKp = fixedKp;
      u.icValid = true;
      u.updatedAt = new Date().toISOString();
      reinstatedCount++;
      for (const l of db.logs) {
        if (l.staffId === u.id) {
          l.staffNoKp = fixedKp;
        }
      }
    }
  }
  if (reinstatedCount > 0) {
    db.auditStats.leadingZeroIcsReinstated =
      (db.auditStats.leadingZeroIcsReinstated ?? 0) + reinstatedCount;
    dirty = true;
  }

  if (dirty) {
    saveDb(db);
  } else {
    cachedDb = db;
  }
  return db;
}

function saveDb(db: LogbookDatabase): void {
  cachedDb = db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmpPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmpPath, DB_PATH);
}

function matchLogsForUser(
  logs: TrainingLogEntry[],
  user: StaffAccount
): TrainingLogEntry[] {
  const kpDigits = stripNoKp(user.noKp);
  return logs.filter((l) => {
    if (l.staffId) return l.staffId === user.id;
    return stripNoKp(l.staffNoKp) === kpDigits;
  });
}

function buildComplianceData(db: LogbookDatabase, tahun: number) {
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

  return { rows, logsByStaffId };
}

function buildAnalyticsOverview(db: LogbookDatabase, tahun: number): AnalyticsOverview {
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

function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }
  if (!token) {
    res.status(401).json({ error: 'Sesi log masuk diperlukan. Sila log masuk menggunakan No. K/P.' });
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Sesi telah tamat tempoh atau tidak sah. Sila log masuk semula.' });
    return;
  }
  req.auth = payload;
  next();
}

function isPrivilegedRole(role?: UserRole): boolean {
  return role === 'admin';
}

function requirePlb(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.auth || !isPrivilegedRole(req.auth.peranan)) {
    res.status(403).json({
      error: 'Akses terhad kepada Pentadbir Sistem (Admin).',
    });
    return;
  }
  next();
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Ensure DB is initialized on startup
  loadDb();

  app.post('/api/auth/login', (req: Request, res: Response) => {
    const rawNoKp = String(req.body?.noKp ?? '').trim();
    const password = String(req.body?.password ?? '');
    const roleMode = req.body?.roleMode === 'admin' ? 'admin' : 'staff';

    if (!rawNoKp || !password) {
      res.status(400).json({
        error: 'Sila masukkan No. Kad Pengenalan dan kata laluan yang sah.',
      });
      return;
    }

    const db = loadDb();
    const targetDigits = stripNoKp(rawNoKp);
    const isAdminShortcut =
      rawNoKp === '0' || rawNoKp.toLowerCase() === 'admin';
    const candidates = db.users.filter(
      (u) =>
        (isAdminShortcut && u.peranan === 'admin') ||
        (targetDigits && stripNoKp(u.noKp) === targetDigits) ||
        u.noKp.trim().toUpperCase() === rawNoKp.toUpperCase()
    );

    const user =
      candidates.find((u) => verifyPassword(password, u.passwordHash)) ?? null;

    if (!user) {
      res.status(401).json({
        error: 'No. K/P atau kata laluan tidak sah.',
      });
      return;
    }

    if (roleMode === 'admin' && user.peranan !== 'admin') {
      res.status(403).json({
        error: 'Akaun ini bukan Pentadbir Sistem. Sila gunakan tab Log Masuk Kakitangan.',
      });
      return;
    }

    if (user.status !== 'aktif') {
      res.status(403).json({
        error: 'Akaun kakitangan ini tidak aktif. Sila hubungi Pentadbir Sistem / Unit Latihan, JPSM.',
      });
      return;
    }

    const token = signToken({
      userId: user.id,
      noKp: user.noKp,
      peranan: user.peranan,
      exp: Date.now() + 1000 * 60 * 60 * 24 * 7,
    });

    res.json({
      token,
      user: sanitizeUser(user),
    });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const db = loadDb();
    const user = db.users.find((u) => u.id === req.auth?.userId);
    if (!user) {
      res.status(404).json({ error: 'Profil kakitangan tidak ditemui.' });
      return;
    }
    res.json({ user: sanitizeUser(user) });
  });

  app.get('/api/staff', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const db = loadDb();
    if (isPrivilegedRole(req.auth?.peranan)) {
      res.json({
        staff: db.users.filter((u) => u.peranan !== 'admin').map(sanitizeUser),
      });
      return;
    }
    const self = db.users.find((u) => u.id === req.auth?.userId);
    res.json({ staff: self ? [sanitizeUser(self)] : [] });
  });

  app.post('/api/staff', requireAuth, requirePlb, (req: AuthenticatedRequest, res: Response) => {
    const rawNoKp = String(req.body?.noKp ?? '');
    const noFail = req.body?.noFail ? String(req.body.noFail).trim() : undefined;
    const nama = String(req.body?.nama ?? '').trim();
    const jawatan = String(req.body?.jawatan ?? '').trim();
    const klasifikasi = req.body?.klasifikasi
      ? String(req.body.klasifikasi).trim().toUpperCase()
      : undefined;
    const gred = String(req.body?.gred ?? '').trim().toUpperCase();
    const tempatBertugas = String(req.body?.tempatBertugas ?? '').trim();
    const tarafJawatan = normalizeTarafJawatan(String(req.body?.tarafJawatan ?? 'Tetap'));
    const kategoriPerkhidmatan = String(req.body?.kategoriPerkhidmatan ?? 'Sok I').trim();
    const genderRaw = String(req.body?.gender ?? '').trim().toUpperCase();
    const gender: 'L' | 'P' | '' =
      genderRaw === 'L' || genderRaw === 'P' ? genderRaw : '';
    const peranan: UserRole =
      req.body?.peranan === 'admin' && req.auth?.peranan === 'admin'
        ? 'admin'
        : 'pegawai';
    const bulanBerkhidmat = Math.max(
      1,
      Math.min(12, Number(req.body?.bulanBerkhidmat) || 12)
    );
    const password = String(req.body?.password ?? 'elogpl2026');

    if (!isValidNoKp(rawNoKp) || nama.length < 2 || !jawatan || !gred || !tempatBertugas) {
      res.status(400).json({
        error: 'No. K/P (12 digit), Nama, Jawatan, Gred, dan Jabatan/Unit wajib diisi.',
      });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Kata laluan minimum 6 aksara.' });
      return;
    }

    const db = loadDb();
    const targetDigits = stripNoKp(rawNoKp);
    if (db.users.some((u) => stripNoKp(u.noKp) === targetDigits)) {
      res.status(409).json({
        error: `No. K/P ${normalizeNoKp(rawNoKp)} sudah wujud dalam direktori.`,
      });
      return;
    }

    const dept = normalizeJabatanUnit(tempatBertugas);
    const now = new Date().toISOString();
    const created: StoredStaffUser = {
      id: `usr-${crypto.randomUUID().slice(0, 8)}`,
      noFail,
      noKp: normalizeNoKp(rawNoKp),
      icValid: true,
      nama,
      jawatan,
      klasifikasi,
      gred,
      tempatBertugas: dept.tempatBertugas,
      jabatanInduk: dept.jabatanInduk,
      tarafJawatan,
      kategoriPerkhidmatan,
      gender,
      peranan,
      bulanBerkhidmat,
      sasaranTahun: 4,
      status: 'aktif',
      passwordHash: hashPassword(password),
      createdAt: now,
      updatedAt: now,
    };

    db.users.push(created);
    saveDb(db);
    res.status(201).json({ staff: sanitizeUser(created) });
  });

  app.patch('/api/staff/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const db = loadDb();
    const idx = db.users.findIndex((u) => u.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Rekod kakitangan tidak ditemui.' });
      return;
    }

    const target = db.users[idx];
    const isSelf = req.auth?.userId === target.id;
    const isPlb = isPrivilegedRole(req.auth?.peranan);

    if (!isPlb && !isSelf) {
      res.status(403).json({ error: 'Anda tidak dibenarkan mengemas kini profil kakitangan lain.' });
      return;
    }

    let nextNoKp = target.noKp;
    let nextIcValid = target.icValid ?? isValidNoKp(target.noKp);
    if (isPlb && req.body?.noKp !== undefined) {
      const candidate = normalizeNoKp(String(req.body.noKp).trim(), true);
      if (!isValidNoKp(candidate)) {
        res.status(400).json({ error: 'No. K/P baharu mestilah 12 digit yang sah.' });
        return;
      }
      nextNoKp = candidate;
      nextIcValid = true;
      for (const l of db.logs) {
        if (l.staffId === target.id) {
          l.staffNoKp = nextNoKp;
        }
      }
    }

    const nextDept = req.body?.tempatBertugas
      ? normalizeJabatanUnit(String(req.body.tempatBertugas))
      : null;

    let nextPasswordHash = target.passwordHash;
    if (isPlb && req.body?.password && String(req.body.password).trim().length >= 6) {
      nextPasswordHash = hashPassword(String(req.body.password).trim());
    }

    const updated: StoredStaffUser = {
      ...target,
      noKp: nextNoKp,
      icValid: nextIcValid,
      noFail:
        isPlb && req.body?.noFail !== undefined
          ? String(req.body.noFail).trim() || undefined
          : target.noFail,
      nama: req.body?.nama ? String(req.body.nama).trim() : target.nama,
      jawatan: req.body?.jawatan ? String(req.body.jawatan).trim() : target.jawatan,
      klasifikasi:
        req.body?.klasifikasi !== undefined
          ? String(req.body.klasifikasi).trim().toUpperCase() || undefined
          : target.klasifikasi,
      gred: req.body?.gred ? String(req.body.gred).trim().toUpperCase() : target.gred,
      tempatBertugas: nextDept ? nextDept.tempatBertugas : target.tempatBertugas,
      jabatanInduk: nextDept ? nextDept.jabatanInduk : target.jabatanInduk,
      tarafJawatan: req.body?.tarafJawatan
        ? normalizeTarafJawatan(String(req.body.tarafJawatan))
        : target.tarafJawatan,
      kategoriPerkhidmatan: req.body?.kategoriPerkhidmatan
        ? String(req.body.kategoriPerkhidmatan).trim()
        : target.kategoriPerkhidmatan,
      gender:
        req.body?.gender === 'L' || req.body?.gender === 'P' || req.body?.gender === ''
          ? req.body.gender
          : target.gender,
      bulanBerkhidmat:
        req.body?.bulanBerkhidmat !== undefined
          ? Math.max(1, Math.min(12, Number(req.body.bulanBerkhidmat) || target.bulanBerkhidmat))
          : target.bulanBerkhidmat,
      sasaranTahun:
        isPlb && req.body?.sasaranTahun !== undefined
          ? Math.max(1, Math.min(30, Number(req.body.sasaranTahun) || 4))
          : target.sasaranTahun,
      peranan:
        isPlb && (req.body?.peranan === 'admin' || req.body?.peranan === 'pegawai')
          ? req.body.peranan
          : target.peranan,
      status:
        isPlb && (req.body?.status === 'aktif' || req.body?.status === 'tidak_aktif')
          ? req.body.status
          : target.status,
      passwordHash: nextPasswordHash,
      updatedAt: new Date().toISOString(),
    };

    db.users[idx] = updated;
    saveDb(db);
    res.json({ staff: sanitizeUser(updated) });
  });

  app.delete('/api/staff/:id', requireAuth, requirePlb, (req: AuthenticatedRequest, res: Response) => {
    const db = loadDb();
    const idx = db.users.findIndex((u) => u.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Rekod kakitangan tidak ditemui.' });
      return;
    }
    const target = db.users[idx];
    if (target.id === req.auth?.userId || target.peranan === 'admin') {
      res.status(400).json({ error: 'Akaun Pentadbir Sistem aktif tidak boleh dipadam.' });
      return;
    }

    db.users.splice(idx, 1);
    const beforeLogs = db.logs.length;
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

    saveDb(db);
    res.json({ ok: true, deletedLogsCount: beforeLogs - db.logs.length });
  });

  app.post('/api/staff/reset-database', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    if (req.auth?.peranan !== 'admin') {
      res.status(403).json({ error: 'Hanya Admin boleh menetapkan semula pangkalan data.' });
      return;
    }
    const action = req.body?.action === 'clear_all' ? 'clear_all' : 'reseed';
    if (action === 'clear_all') {
      const db = loadDb();
      db.users = db.users.filter((u) => u.peranan === 'admin');
      db.logs = [];
      db.tnaRecords = [];
      saveDb(db);
      res.json({ ok: true, totalStaff: 0, totalLogs: 0 });
      return;
    }

    const fresh = createSeedDatabase();
    saveDb(fresh);
    res.json({
      ok: true,
      totalStaff: fresh.users.filter((u) => u.peranan !== 'admin').length,
      totalLogs: fresh.logs.length,
    });
  });

  app.post('/api/staff/import-csv', requireAuth, requirePlb, (req: AuthenticatedRequest, res: Response) => {
    const csvText = String(req.body?.csvText ?? '');
    const fileName = String(req.body?.fileName ?? 'rekod-kursus-import.csv');
    const mode = req.body?.mode === 'replace' ? 'replace' : 'merge';

    if (!csvText.trim()) {
      res.status(400).json({ error: 'Fail CSV kosong.' });
      return;
    }

    const parsed = parsePerbadananLabuanCsv(csvText, fileName);
    if (parsed.users.length === 0) {
      res.status(400).json({
        error: 'Tiada baris rekod kakitangan sah ditemui dalam format CSV Perbadanan Labuan.',
      });
      return;
    }

    const db = loadDb();
    const defaultStaffHash = hashPassword('elogpl2026');

    if (mode === 'replace') {
      const admins = db.users.filter((u) => u.peranan === 'admin');
      const prevHashById = new Map(db.users.map((u) => [stripNoKp(u.noKp), u.passwordHash]));
      db.users = [
        ...admins,
        ...parsed.users.map((u) => ({
          ...u,
          peranan: 'pegawai' as UserRole,
          passwordHash: prevHashById.get(stripNoKp(u.noKp)) ?? defaultStaffHash,
        })),
      ];
      db.logs = parsed.logs;
      db.auditStats = parsed.auditStats;
      saveDb(db);
      res.json({
        ok: true,
        importedStaff: db.users.length,
        importedLogs: db.logs.length,
        auditStats: db.auditStats,
      });
      return;
    }

    // Merge mode
    let addedStaff = 0;
    let addedLogs = 0;
    const existingByKp = new Map(db.users.map((u) => [stripNoKp(u.noKp), u]));
    const parsedIdToTargetUser = new Map<string, StoredStaffUser>();

    for (const u of parsed.users) {
      const key = stripNoKp(u.noKp);
      const existing = existingByKp.get(key);
      if (existing) {
        parsedIdToTargetUser.set(u.id, existing);
      } else {
        const created: StoredStaffUser = {
          ...u,
          peranan: 'pegawai',
          passwordHash: defaultStaffHash,
        };
        db.users.push(created);
        existingByKp.set(key, created);
        parsedIdToTargetUser.set(u.id, created);
        addedStaff++;
      }
    }

    const existingLogSignatures = new Set(
      db.logs.map((l) => `${l.staffId || stripNoKp(l.staffNoKp)}|${l.tajuk.toLowerCase()}|${l.tarikhMula}`)
    );

    for (const l of parsed.logs) {
      const targetUser = l.staffId ? parsedIdToTargetUser.get(l.staffId) : undefined;
      const targetId = targetUser?.id ?? l.staffId;
      const sig = `${targetId || stripNoKp(l.staffNoKp)}|${l.tajuk.toLowerCase()}|${l.tarikhMula}`;
      if (!existingLogSignatures.has(sig)) {
        db.logs.push({
          ...l,
          id: `log-imp-${crypto.randomUUID().slice(0, 8)}`,
          staffId: targetId,
        });
        existingLogSignatures.add(sig);
        addedLogs++;
      }
    }

    saveDb(db);
    res.json({
      ok: true,
      importedStaff: addedStaff,
      importedLogs: addedLogs,
      auditStats: db.auditStats,
    });
  });

  app.get('/api/training-logs', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const db = loadDb();
    const tahunParam = req.query.tahun ? String(req.query.tahun) : '2026';
    const tahunFilter = tahunParam === 'all' ? null : Number(tahunParam) || 2026;
    const isPlb = isPrivilegedRole(req.auth?.peranan);
    const currentUser = db.users.find((u) => u.id === req.auth?.userId);

    const statusFilter = req.query.status ? String(req.query.status) : null;
    const filterStaffId = req.query.staffId ? String(req.query.staffId) : null;
    const filterKp = req.query.noKp ? stripNoKp(String(req.query.noKp)) : null;

    let logs = db.logs.filter((log) => {
      if (tahunFilter !== null && log.tahun !== tahunFilter) return false;
      if (statusFilter && log.statusPengesahan !== statusFilter) return false;

      if (isPlb) {
        if (filterStaffId) return log.staffId === filterStaffId;
        if (filterKp) return stripNoKp(log.staffNoKp) === filterKp;
        return true;
      }

      if (currentUser && log.staffId) {
        return log.staffId === currentUser.id;
      }
      return stripNoKp(log.staffNoKp) === stripNoKp(req.auth?.noKp ?? '');
    });

    logs = logs.sort((a, b) => b.tarikhMula.localeCompare(a.tarikhMula));
    res.json({ logs });
  });

  app.post('/api/training-logs', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const db = loadDb();
    const isPlb = isPrivilegedRole(req.auth?.peranan);

    let owner: StoredStaffUser | undefined;
    if (isPlb && req.body?.staffId) {
      owner = db.users.find((u) => u.id === String(req.body.staffId));
    } else if (isPlb && req.body?.staffNoKp) {
      owner = db.users.find(
        (u) => stripNoKp(u.noKp) === stripNoKp(String(req.body.staffNoKp))
      );
    } else {
      owner = db.users.find((u) => u.id === req.auth?.userId);
    }

    if (!owner) {
      res.status(404).json({ error: 'Pegawai bagi rekod latihan tidak ditemui.' });
      return;
    }

    const rawKod = req.body?.kodKursusPL
      ? (String(req.body.kodKursusPL).trim().toUpperCase() as PlCourseCode)
      : undefined;
    const kodMeta = rawKod && rawKod in PL_COURSE_CODES ? PL_COURSE_CODES[rawKod] : null;

    const kategori = (kodMeta?.kategori ??
      String(req.body?.kategori ?? 'latihan_bermodul')) as TrainingCategory;
    const validCategories: TrainingCategory[] = [
      'latihan_bermodul',
      'pembelajaran_bersemuka',
      'pembelajaran_tidak_bersemuka',
      'pembelajaran_kendiri',
    ];
    if (!validCategories.includes(kategori)) {
      res.status(400).json({ error: 'Kategori aktiviti latihan tidak sah.' });
      return;
    }

    const tajuk = String(req.body?.tajuk ?? '').trim();
    const jenisAktiviti =
      String(req.body?.jenisAktiviti ?? '').trim() ||
      (kodMeta ? `${kodMeta.label} (${kodMeta.code})` : '');
    const tarikhMula = String(req.body?.tarikhMula ?? '').trim();
    const tarikhTamat = String(req.body?.tarikhTamat ?? tarikhMula).trim();
    const tempat = String(req.body?.tempat ?? '').trim();
    const anjuran = String(req.body?.anjuran ?? '').trim();
    const tahun =
      Number(req.body?.tahun) || Number(tarikhMula.slice(0, 4)) || new Date().getFullYear();

    if (!tajuk || !jenisAktiviti || !tarikhMula || !tempat) {
      res.status(400).json({
        error: 'Tajuk, Jenis Aktiviti, Tarikh, dan Tempat wajib diisi.',
      });
      return;
    }

    let bilanganHari = 0;
    let jumlahJam = 0;
    const masaMula = req.body?.masaMula ? String(req.body.masaMula).trim() : undefined;
    const masaTamat = req.body?.masaTamat ? String(req.body.masaTamat).trim() : undefined;

    if (kodMeta) {
      bilanganHari = Math.max(1, Number(req.body?.bilanganHari) || 1);
      jumlahJam = Number(req.body?.jumlahJam) || bilanganHari * 6;
    } else if (kategori === 'latihan_bermodul') {
      bilanganHari = Math.max(1, Number(req.body?.bilanganHari) || 1);
      jumlahJam = Number(req.body?.jumlahJam) || bilanganHari * 6;
    } else if (kategori === 'pembelajaran_kendiri') {
      bilanganHari = 1;
      jumlahJam = 6;
    } else {
      const calculated = calculateDurationHours(masaMula, masaTamat);
      jumlahJam = Number(req.body?.jumlahJam) || calculated;
      if (jumlahJam <= 0 || jumlahJam >= 6) {
        res.status(400).json({
          error:
            'Sesi pembelajaran (< 6 jam) memerlukan tempoh jam sah antara 0.5 hingga 5.9 jam.',
        });
        return;
      }
    }

    const now = new Date().toISOString();
    const entry: TrainingLogEntry = {
      id: `log-${crypto.randomUUID().slice(0, 8)}`,
      staffId: owner.id,
      staffNoKp: owner.noKp,
      tahun,
      kategori,
      kodKursusPL: kodMeta?.code,
      jenisAktiviti,
      tajuk,
      lokasiSkop:
        kategori === 'latihan_bermodul'
          ? req.body?.lokasiSkop === 'luar_negara'
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
      sumber: req.body?.sumber ? String(req.body.sumber).trim() : undefined,
      pegawaiPenyelia: req.body?.pegawaiPenyelia
        ? String(req.body.pegawaiPenyelia).trim()
        : undefined,
      keterangan: req.body?.keterangan ? String(req.body.keterangan).trim() : undefined,
      isAssembly: kodMeta?.isAssembly ?? false,
      statusPengesahan: isPlb && req.body?.autoVerify ? 'disahkan' : 'menunggu',
      disahkanOleh:
        isPlb && req.body?.autoVerify
          ? db.users.find((u) => u.id === req.auth?.userId)?.nama ?? 'Pentadbir Sistem'
          : undefined,
      tarikhPengesahan:
        isPlb && req.body?.autoVerify ? now.slice(0, 10) : undefined,
      createdAt: now,
      updatedAt: now,
    };

    db.logs.unshift(entry);
    saveDb(db);
    res.status(201).json({ log: entry });
  });

  app.patch('/api/training-logs/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const db = loadDb();
    const idx = db.logs.findIndex((l) => l.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Rekod latihan tidak ditemui.' });
      return;
    }

    const existing = db.logs[idx];
    const isPlb = isPrivilegedRole(req.auth?.peranan);
    const isOwner =
      existing.staffId === req.auth?.userId ||
      stripNoKp(existing.staffNoKp) === stripNoKp(req.auth?.noKp ?? '');

    if (!isPlb && !isOwner) {
      res.status(403).json({ error: 'Akses ditolak untuk mengubah rekod latihan pegawai lain.' });
      return;
    }

    let next: TrainingLogEntry = { ...existing };

    if (req.body?.statusPengesahan !== undefined) {
      if (!isPlb) {
        res.status(403).json({
          error: 'Hanya Pentadbir Sistem boleh mengesahkan log latihan.',
        });
        return;
      }
      const nextStatus = req.body.statusPengesahan as VerificationStatus;
      if (!['menunggu', 'disahkan', 'ditolak'].includes(nextStatus)) {
        res.status(400).json({ error: 'Status pengesahan tidak sah.' });
        return;
      }
      const verifier = db.users.find((u) => u.id === req.auth?.userId);
      next = {
        ...next,
        statusPengesahan: nextStatus,
        disahkanOleh:
          nextStatus === 'menunggu' ? undefined : verifier?.nama ?? 'Pentadbir Sistem',
        jawatanPengesah: nextStatus === 'menunggu' ? undefined : verifier?.jawatan ?? 'Pentadbir Sistem',
        tarikhPengesahan:
          nextStatus === 'menunggu' ? undefined : new Date().toISOString().slice(0, 10),
        catatanPengesah: req.body?.catatanPengesah
          ? String(req.body.catatanPengesah).trim()
          : next.catatanPengesah,
      };
    }

    // Allow Pentadbir Sistem to fix missing PL course code or shifted/typo entries
    if (isPlb && req.body?.kodKursusPL !== undefined) {
      const code = String(req.body.kodKursusPL).trim().toUpperCase() as PlCourseCode;
      if (!(code in PL_COURSE_CODES)) {
        res.status(400).json({ error: `Kod kursus '${code}' tidak sah.` });
        return;
      }
      const meta = PL_COURSE_CODES[code];
      next = {
        ...next,
        kodKursusPL: code,
        kategori: meta.kategori,
        jenisAktiviti: `${meta.label} (${code})`,
        isAssembly: meta.isAssembly,
        anomalyFlag: next.anomalyFlag === 'missing_course_code' ? undefined : next.anomalyFlag,
      };
    }

    if (!isPlb && existing.statusPengesahan === 'disahkan' && req.body?.statusPengesahan === undefined) {
      res.status(400).json({
        error: 'Rekod yang telah disahkan oleh Pentadbir Sistem tidak boleh disunting lagi.',
      });
      return;
    }

    if (req.body?.tajuk) next.tajuk = String(req.body.tajuk).trim();
    if (req.body?.jenisAktiviti) next.jenisAktiviti = String(req.body.jenisAktiviti).trim();
    if (req.body?.tempat) next.tempat = String(req.body.tempat).trim();
    if (req.body?.anjuran) next.anjuran = String(req.body.anjuran).trim();
    if (req.body?.tarikhMula) next.tarikhMula = String(req.body.tarikhMula).trim();
    if (req.body?.tarikhTamat) next.tarikhTamat = String(req.body.tarikhTamat).trim();
    if (req.body?.tahun) next.tahun = Number(req.body.tahun) || next.tahun;
    if (req.body?.bilanganHari !== undefined) {
      next.bilanganHari = Math.max(0, Number(req.body.bilanganHari) || 0);
    }
    if (req.body?.keterangan !== undefined) {
      next.keterangan = String(req.body.keterangan).trim();
    }
    if (isPlb && req.body?.clearAnomaly) {
      next.anomalyFlag = undefined;
    }
    next.updatedAt = new Date().toISOString();

    db.logs[idx] = next;
    saveDb(db);
    res.json({ log: next });
  });

  app.delete('/api/training-logs/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const db = loadDb();
    const idx = db.logs.findIndex((l) => l.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Rekod latihan tidak ditemui.' });
      return;
    }
    const existing = db.logs[idx];
    const isPlb = isPrivilegedRole(req.auth?.peranan);
    const isOwner =
      existing.staffId === req.auth?.userId ||
      stripNoKp(existing.staffNoKp) === stripNoKp(req.auth?.noKp ?? '');

    if (!isPlb && !isOwner) {
      res.status(403).json({ error: 'Akses ditolak.' });
      return;
    }
    if (!isPlb && existing.statusPengesahan === 'disahkan') {
      res.status(400).json({ error: 'Rekod yang sudah disahkan tidak boleh dipadam.' });
      return;
    }

    db.logs.splice(idx, 1);
    saveDb(db);
    res.json({ ok: true });
  });

  app.get('/api/tna', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const db = loadDb();
    const tahun = Number(req.query.tahun) || 2026;
    const targetNoKp =
      isPrivilegedRole(req.auth?.peranan) && req.query.noKp
        ? normalizeNoKp(String(req.query.noKp))
        : normalizeNoKp(req.auth?.noKp ?? '');

    const record = db.tnaRecords.find(
      (r) => r.tahun === tahun && stripNoKp(r.staffNoKp) === stripNoKp(targetNoKp)
    );

    res.json({
      tna: record ?? {
        staffNoKp: targetNoKp,
        tahun,
        sebabTidakMemenuhi: ['', '', ''],
        kursusDiperlukan: ['', '', '', '', ''],
        updatedAt: new Date().toISOString(),
      },
    });
  });

  app.put('/api/tna', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const db = loadDb();
    const tahun = Number(req.body?.tahun) || 2026;
    const staffNoKp = normalizeNoKp(req.auth?.noKp ?? '');

    const rawReasons = Array.isArray(req.body?.sebabTidakMemenuhi)
      ? req.body.sebabTidakMemenuhi
      : [];
    const rawCourses = Array.isArray(req.body?.kursusDiperlukan)
      ? req.body.kursusDiperlukan
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
    if (idx === -1) {
      db.tnaRecords.push(record);
    } else {
      db.tnaRecords[idx] = record;
    }

    saveDb(db);
    res.json({ tna: record });
  });

  app.get('/api/reports/compliance', requireAuth, requirePlb, (req: AuthenticatedRequest, res: Response) => {
    const db = loadDb();
    const tahun = Number(req.query.tahun) || 2026;
    const { rows } = buildComplianceData(db, tahun);

    const totalStaff = rows.length;
    const metTarget = rows.filter((r) => r.compliance.patuhSepenuhnya).length;
    const threeDays = rows.filter((r) => r.compliance.jumlahKeseluruhanHari === 3).length;
    const twoDays = rows.filter((r) => r.compliance.jumlahKeseluruhanHari === 2).length;
    const oneDay = rows.filter((r) => r.compliance.jumlahKeseluruhanHari === 1).length;
    const zeroDays = rows.filter((r) => r.compliance.jumlahKeseluruhanHari === 0).length;

    res.json({
      tahun,
      summary: {
        totalStaff,
        metTarget,
        threeDays,
        twoDays,
        oneDay,
        zeroDays,
      },
      rows,
    });
  });

  app.get('/api/analytics/overview', requireAuth, requirePlb, (req: AuthenticatedRequest, res: Response) => {
    const db = loadDb();
    const tahun = Number(req.query.tahun) || 2026;
    const overview = buildAnalyticsOverview(db, tahun);
    res.json(overview);
  });

  app.get('/api/reports/export-normalized', requireAuth, requirePlb, (req: AuthenticatedRequest, res: Response) => {
    const db = loadDb();
    const tahun = Number(req.query.tahun) || 2026;
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

    const csv = `\uFEFF${[header.join(','), ...lines].join('\n')}`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="elogpl-laporan-ternormal-${tahun}.csv"`
    );
    res.send(csv);
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
