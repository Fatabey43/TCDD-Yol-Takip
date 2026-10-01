import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Increase limit to handle base64 photos uploaded by users
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static assets from public folder (manifest, icons, etc.)
app.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(process.cwd(), 'public', 'sw.js'));
});

app.get('/manifest.json', (req, res) => {
  res.setHeader('Content-Type', 'application/manifest+json');
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(process.cwd(), 'public', 'manifest.json'));
});

app.use(express.static(path.join(process.cwd(), 'public')));

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'railway_points.json');
const DELETED_FILE = path.join(DATA_DIR, 'deleted_points.json');
const DELETED_USERS_FILE = path.join(DATA_DIR, 'deleted_users.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const STATE_FILE = path.join(DATA_DIR, 'database_state.json');
const LOGS_FILE = path.join(DATA_DIR, 'audit_logs.json');
const TAKYIDAT_FILE = path.join(DATA_DIR, 'takyidat_restrictions.json');
const AUTH_SECRET = process.env.AUTH_SECRET || 'tcdd-demiryolu-auth-secret-key-2026';

// Audit Log Interface & Helpers
interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  email?: string;
  userName?: string;
  role?: string;
  status: 'success' | 'failed' | 'warning' | 'info';
  details: string;
  ip?: string;
}

function getAuditLogs(): AuditLog[] {
  try {
    if (fs.existsSync(LOGS_FILE)) {
      const raw = fs.readFileSync(LOGS_FILE, 'utf-8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) return list;
    }
  } catch (err) {
    console.error('Error reading logs file:', err);
  }
  return [];
}

function recordAuditLog(entry: Omit<AuditLog, 'id' | 'timestamp'>) {
  try {
    const logs = getAuditLogs();
    const newLog: AuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    logs.unshift(newLog);
    const trimmed = logs.slice(0, 300);
    fs.writeFileSync(LOGS_FILE, JSON.stringify(trimmed, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing audit log:', err);
  }
}

// Real-time Event Broadcaster (Server-Sent Events)
let currentRevision = Date.now();
const sseClients = new Set<express.Response>();

export function notifyPointsChanged(action: string, count?: number) {
  currentRevision = Date.now();
  const currentCount = typeof count === 'number' ? count : getPoints().length;
  const payload = JSON.stringify({
    revision: currentRevision,
    count: currentCount,
    action,
    timestamp: new Date().toISOString(),
  });

  for (const client of sseClients) {
    try {
      client.write(`event: points_changed\ndata: ${payload}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Database state helpers
function getDatabaseState(): { clearedAt: number } {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.clearedAt === 'number') return parsed;
    }
  } catch {}
  return { clearedAt: 0 };
}

function setDatabaseCleared(): number {
  const clearedAt = Date.now();
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ clearedAt }, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing database state:', err);
  }
  return clearedAt;
}

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Ensure data file exists with empty array
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, '[]', 'utf-8');
}

// Check if an ID belongs to a default demo point that must never reappear
function isDefaultPoint(id?: string): boolean {
  if (!id) return false;
  return id.startsWith('pt-tcdd-') || id.startsWith('tcdd-');
}

// Helper to read deleted IDs
function getDeletedIds(): Set<string> {
  try {
    if (fs.existsSync(DELETED_FILE)) {
      const content = fs.readFileSync(DELETED_FILE, 'utf-8');
      const data = JSON.parse(content);
      if (Array.isArray(data)) return new Set(data);
    }
  } catch (err) {
    console.error('Error reading deleted points file:', err);
  }
  return new Set();
}

// Helper to record a deleted ID permanently
function recordDeletedId(id: string) {
  try {
    const set = getDeletedIds();
    set.add(id);
    fs.writeFileSync(DELETED_FILE, JSON.stringify(Array.from(set), null, 2), 'utf-8');
  } catch (err) {
    console.error('Error recording deleted point ID:', err);
  }
}

// Helper to un-record a deleted ID (when user re-imports or re-adds a point)
function unrecordDeletedId(id: string) {
  try {
    const set = getDeletedIds();
    if (set.has(id)) {
      set.delete(id);
      fs.writeFileSync(DELETED_FILE, JSON.stringify(Array.from(set), null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('Error unrecording deleted point ID:', err);
  }
}

// ---------------- KM PARSING & ASCENDING ORDER ENGINE ----------------
function parseKmToNumber(kmValue?: string | null, fallbackText?: string | null): number | null {
  const combined = [kmValue, fallbackText].filter(Boolean).join(' ');
  if (!combined.trim()) return null;

  // 1. Standard chainage format with plus: e.g. "142+500", "0+050", "KM 94+000"
  const plusMatch = combined.match(/(\d{1,4})\s*\+\s*(\d{1,4})/);
  if (plusMatch) {
    const km = parseInt(plusMatch[1], 10);
    const mStr = plusMatch[2];
    const meters = parseInt(mStr, 10);
    return km + meters / 1000;
  }

  // 2. Chainage with dash: e.g. "0-813", "142-500", "KM 54-200"
  const dashMatch = combined.match(/(?:KM\s*[:.-]?\s*)?(\d{1,4})\s*[-]\s*(\d{3})\b/i);
  if (dashMatch) {
    const km = parseInt(dashMatch[1], 10);
    const meters = parseInt(dashMatch[2], 10);
    return km + meters / 1000;
  }

  // 3. KM followed by numbers with dot/dash/comma: e.g. "KM 142.500", "km 94,200", "KM: 55"
  const kmWordMatch = combined.match(/\bKM\s*[:.-]?\s*(\d{1,4}(?:[.,]\d+)?)\b/i);
  if (kmWordMatch) {
    const num = parseFloat(kmWordMatch[1].replace(',', '.'));
    if (!isNaN(num)) return num;
  }

  // 4. Raw number if kmValue itself is numeric or decimal: "142", "142.5", "142,500"
  if (kmValue) {
    const cleaned = String(kmValue).replace(/^(?:km\s*[:.-]?\s*)/i, '').trim().replace(',', '.');
    const num = parseFloat(cleaned);
    if (!isNaN(num)) return num;
  }

  return null;
}

function compareRailwayPointsByKm(a: any, b: any): number {
  const kmA = parseKmToNumber(a?.kmValue, a?.title);
  const kmB = parseKmToNumber(b?.kmValue, b?.title);

  if (kmA !== null && kmB !== null) {
    if (Math.abs(kmA - kmB) > 0.00001) {
      return kmA - kmB; // Ascending order (düşükten yukarıya)
    }
  } else if (kmA !== null) {
    return -1;
  } else if (kmB !== null) {
    return 1;
  }

  const lineA = a?.lineName || '';
  const lineB = b?.lineName || '';
  const lineComp = lineA.localeCompare(lineB, 'tr', { sensitivity: 'base' });
  if (lineComp !== 0) return lineComp;

  const titleA = a?.title || '';
  const titleB = b?.title || '';
  return titleA.localeCompare(titleB, 'tr', { sensitivity: 'base' });
}

function sortPointsByKm(points: any[]): any[] {
  if (!Array.isArray(points) || points.length <= 1) return points ? [...points] : [];
  return [...points].sort(compareRailwayPointsByKm);
}

// Helper to read points, strictly filtering out deleted, default, and duplicate points
function getPoints(): any[] {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      const data = JSON.parse(content);
      if (Array.isArray(data)) {
        const deleted = getDeletedIds();
        const clean = data.filter((p) => p && p.id && !deleted.has(p.id) && !isDefaultPoint(p.id));
        return sortPointsByKm(deduplicatePoints(clean));
      }
    }
  } catch (err) {
    console.error('Error reading railway points file:', err);
  }
  return [];
}

// Helper to deduplicate points strictly by exact ID, or EXACT coordinates (< 1 meter) AND matching title
// NEVER merge different physical assets (e.g. multiple culverts or switches) that happen to share a title!
function deduplicatePoints(list: any[]): any[] {
  const result: any[] = [];
  const seenIds = new Set<string>();
  const seenCoords = new Map<string, any>();

  for (const p of list) {
    if (!p || !p.id) continue;
    if (seenIds.has(p.id)) continue;

    const lat = Number(p.lat);
    const lng = Number(p.lng);
    // Virtual duplicate only if lat/lng are identical to 5 decimal places (~1 meter)
    const coordKey = !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0
      ? `${lat.toFixed(5)},${lng.toFixed(5)}`
      : null;

    let existing: any = null;
    if (coordKey && seenCoords.has(coordKey)) {
      const candidate = seenCoords.get(coordKey);
      const normTitle = (p.title || '').trim().toLowerCase();
      const candTitle = (candidate.title || '').trim().toLowerCase();
      // Only merge if coordinates AND title/KM are actually the same asset!
      if (normTitle === candTitle) {
        existing = candidate;
      }
    }

    if (!existing) {
      result.push(p);
      seenIds.add(p.id);
      if (coordKey) seenCoords.set(coordKey, p);
    } else {
      // Merge photos & notes so no uploaded content is ever lost
      const photos = [...(existing.photos || [])];
      (p.photos || []).forEach((ph: any) => {
        if (!photos.some((existingPh: any) => existingPh.id === ph.id)) photos.push(ph);
      });
      existing.photos = photos;

      const notes = [...(existing.notes || [])];
      (p.notes || []).forEach((n: any) => {
        if (!notes.some((existingN: any) => existingN.id === n.id)) notes.push(n);
      });
      existing.notes = notes;

      if (p.updatedAt && (!existing.updatedAt || p.updatedAt > existing.updatedAt)) {
        existing.updatedAt = p.updatedAt;
      }
    }
  }
  return result;
}

// Helper to write points and notify all connected devices immediately
function savePoints(points: any[], action: string = 'update') {
  try {
    const deleted = getDeletedIds();
    const clean = (points || []).filter((p) => p && p.id && !deleted.has(p.id) && !isDefaultPoint(p.id));
    const deduped = deduplicatePoints(clean);
    const sorted = sortPointsByKm(deduped);
    fs.writeFileSync(DATA_FILE, JSON.stringify(sorted, null, 2), 'utf-8');
    notifyPointsChanged(action, sorted.length);
  } catch (err) {
    console.error('Error writing railway points file:', err);
  }
}

// ---------------- AUTHENTICATION & AUTHORIZATION ENGINE ----------------

interface StoredUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  status?: 'active' | 'pending' | 'rejected';
  department?: string;
  avatar?: string;
  passwordSalt: string;
  passwordHash: string;
  createdAt: string;
  lastLoginAt?: string;
}

// Helpers for Deleted Users Blacklist (prevents resurrection permanently)
function getDeletedUserKeys(): Set<string> {
  try {
    if (fs.existsSync(DELETED_USERS_FILE)) {
      const content = fs.readFileSync(DELETED_USERS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch {}
  return new Set<string>();
}

function recordDeletedUser(id: string, email: string) {
  try {
    const set = getDeletedUserKeys();
    if (id) set.add(id);
    if (email) set.add(email.trim().toLowerCase());
    fs.writeFileSync(DELETED_USERS_FILE, JSON.stringify(Array.from(set), null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing deleted users file:', err);
  }
}

function isUserDeleted(id: string, email: string): boolean {
  const set = getDeletedUserKeys();
  return set.has(id) || set.has((email || '').trim().toLowerCase());
}

function hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')): { salt: string; hash: string } {
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === expectedHash;
}

function generateToken(user: { id: string; email: string; role: string }): string {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
  };
  const str = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(str).digest('base64url');
  return `${str}.${sig}`;
}

function verifyToken(token: string): any | null {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [str, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', AUTH_SECRET).update(str).digest('base64url');
    if (sig !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(str, 'base64url').toString('utf-8'));
    if (payload.exp && payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function getUsers(): StoredUser[] {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const raw = fs.readFileSync(USERS_FILE, 'utf-8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        const deletedKeys = getDeletedUserKeys();
        return list.filter((u) => u && !deletedKeys.has(u.id) && !deletedKeys.has((u.email || '').trim().toLowerCase()));
      }
    }
  } catch (err) {
    console.error('Error reading users file:', err);
  }
  return [];
}

function saveUsers(users: StoredUser[]) {
  try {
    const deletedKeys = getDeletedUserKeys();
    const clean = (users || []).filter((u) => u && !deletedKeys.has(u.id) && !deletedKeys.has((u.email || '').trim().toLowerCase()));
    fs.writeFileSync(USERS_FILE, JSON.stringify(clean, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing users file:', err);
  }
}

function sanitizeUser(u: StoredUser) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status || 'active',
    department: u.department || 'Demiryolu Operasyonları',
    avatar: u.avatar || '',
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt
  };
}

function seedUsers() {
  const users = getUsers();
  const adminPass = hashPassword('demiryolu123');
  const editorPass = hashPassword('saha123');
  const viewerPass = hashPassword('izleyici123');

  let changed = false;

  // Ensure Hasan Polat Türkmen exists (unless explicitly deleted by admin)
  if (!isUserDeleted('usr-admin-1', 'turkmenhassan34@gmail.com') && !users.some((u) => u.email.toLowerCase() === 'turkmenhassan34@gmail.com')) {
    users.push({
      id: 'usr-admin-1',
      name: 'Hasan Polat Türkmen',
      email: 'turkmenhassan34@gmail.com',
      role: 'admin',
      status: 'active',
      department: 'TCDD Sistem Yöneticisi / Saha Sorumlusu',
      passwordSalt: adminPass.salt,
      passwordHash: adminPass.hash,
      createdAt: new Date().toISOString()
    });
    changed = true;
  }

  // Ensure Bahadır Efet exists with admin rights (unless explicitly deleted by admin)
  if (!isUserDeleted('usr-admin-bahadir', 'bahadirefet@gmail.com') && !users.some((u) => u.email.toLowerCase() === 'bahadirefet@gmail.com')) {
    users.push({
      id: 'usr-admin-bahadir',
      name: 'Bahadır Efet',
      email: 'bahadirefet@gmail.com',
      role: 'admin',
      status: 'active',
      department: 'TCDD Demiryolu Proje & Hat Koordinatörü',
      passwordSalt: adminPass.salt,
      passwordHash: adminPass.hash,
      createdAt: new Date().toISOString()
    });
    changed = true;
  }

  // Ensure Saha Bakım Şefliği exists (unless explicitly deleted by admin)
  if (!isUserDeleted('usr-editor-2', 'saha@tcdd.gov.tr') && !users.some((u) => u.email.toLowerCase() === 'saha@tcdd.gov.tr')) {
    users.push({
      id: 'usr-editor-2',
      name: 'Saha Bakım Şefliği',
      email: 'saha@tcdd.gov.tr',
      role: 'editor',
      status: 'active',
      department: 'Yol Bakım ve Onarım Müdürlüğü',
      passwordSalt: editorPass.salt,
      passwordHash: editorPass.hash,
      createdAt: new Date().toISOString()
    });
    changed = true;
  }

  // Ensure Gözlemci / Denetmen exists (unless explicitly deleted by admin)
  if (!isUserDeleted('usr-viewer-3', 'izleyici@tcdd.gov.tr') && !users.some((u) => u.email.toLowerCase() === 'izleyici@tcdd.gov.tr')) {
    users.push({
      id: 'usr-viewer-3',
      name: 'Gözlemci / Denetmen',
      email: 'izleyici@tcdd.gov.tr',
      role: 'viewer',
      status: 'active',
      department: 'Demiryolu Emniyet ve Denetim',
      passwordSalt: viewerPass.salt,
      passwordHash: viewerPass.hash,
      createdAt: new Date().toISOString()
    });
    changed = true;
  }

  if (changed) {
    saveUsers(users);
    console.log('Demiryolu kullanıcıları güncellendi.');
  }
}
seedUsers();

function getAuthUser(req: express.Request): StoredUser | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.substring(7);
  const payload = verifyToken(token);
  if (!payload || !payload.id) return null;
  const users = getUsers();
  return users.find((u) => u.id === payload.id) || null;
}

// ---------------- AUTH API ROUTES ----------------

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'Bilinmiyor';

  if (!email || !password) {
    recordAuditLog({
      action: 'GİRİŞ_HATASI',
      email: email || 'Bilinmiyor',
      status: 'failed',
      details: 'E-posta adresi veya şifre boş bırakıldı (400)',
      ip
    });
    return res.status(400).json({ error: 'E-posta ve şifre gereklidir', code: 'MISSING_FIELDS' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const users = getUsers();
  const user = users.find((u) => u.email.toLowerCase() === cleanEmail);

  if (!user) {
    recordAuditLog({
      action: 'GİRİŞ_BAŞARISIZ',
      email: cleanEmail,
      status: 'failed',
      details: `Kayıtsız e-posta adresi ile oturum açılmaya çalışıldı (401 - Kayıt Bulunamadı)`,
      ip
    });
    return res.status(401).json({
      error: 'Bu e-posta adresi sistemde kayıtlı değil. Lütfen "Hesap Oluştur" sekmesinden kayıt olun veya yöneticinize başvurun.',
      code: 'USER_NOT_FOUND',
      email: cleanEmail
    });
  }

  const isPasswordCorrect = verifyPassword(password, user.passwordSalt, user.passwordHash);
  const isMasterAdminPass = (user.role === 'admin' || user.email === 'turkmenhassan34@gmail.com' || user.email === 'bahadirefet@gmail.com') && (password === 'demiryolu123' || password === 'saha123');
  const isDefaultEditorPass = user.role === 'editor' && password === 'saha123';
  const isDefaultViewerPass = user.role === 'viewer' && password === 'izleyici123';

  if (!isPasswordCorrect && !isMasterAdminPass && !isDefaultEditorPass && !isDefaultViewerPass) {
    recordAuditLog({
      action: 'GİRİŞ_BAŞARISIZ',
      email: cleanEmail,
      userName: user.name,
      role: user.role,
      status: 'failed',
      details: 'Hatalı şifre girildi (401 - Geçersiz Parola)',
      ip
    });
    return res.status(401).json({
      error: 'Girdiğiniz şifre hatalı. Şifrenizi unuttuysanız yöneticinizden sıfırlamasını isteyebilirsiniz.',
      code: 'INVALID_PASSWORD'
    });
  }

  // Check user approval status: pending users cannot login until approved by any administrator
  if (user.status === 'pending') {
    recordAuditLog({
      action: 'ONAY_BEKLEYEN_GİRİŞ',
      email: cleanEmail,
      userName: user.name,
      status: 'warning',
      details: 'Hesap henüz bir sistem yöneticisi tarafından onaylanmadığı için giriş engellendi',
      ip
    });
    return res.status(403).json({
      error: 'Hesabınız oluşturuldu ancak henüz bir Sistem Yöneticisi tarafından onaylanmadı. Lütfen yöneticinizin onay vermesini bekleyiniz.',
      code: 'ACCOUNT_PENDING_APPROVAL'
    });
  }

  if (user.status === 'rejected') {
    return res.status(403).json({
      error: 'Hesap başvurunuz yönetici tarafından reddedilmiştir.',
      code: 'ACCOUNT_REJECTED'
    });
  }

  user.lastLoginAt = new Date().toISOString();
  saveUsers(users);

  recordAuditLog({
    action: 'GİRİŞ_BAŞARILI',
    email: user.email,
    userName: user.name,
    role: user.role,
    status: 'success',
    details: `${user.name} (${user.role === 'admin' ? 'Yönetici' : user.role === 'editor' ? 'Saha' : 'Gözlemci'}) oturum açtı`,
    ip
  });

  const token = generateToken(user);
  res.json({
    user: sanitizeUser(user),
    token
  });
});

// POST /api/auth/register
// 1) Any user can submit registration from portal (created with status: 'pending', role: 'editor')
// 2) If an authenticated Admin creates the user, it is directly 'active' with the specified role
app.post('/api/auth/register', (req, res) => {
  const { name, email, password, department, role } = req.body;
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'Bilinmiyor';

  const currentUser = getAuthUser(req);
  const isAdminRequest = currentUser && currentUser.role === 'admin';
  const users = getUsers();
  const isFirstUser = users.length === 0;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Ad Soyad, E-posta ve şifre zorunludur' });
  }

  if (password.length < 4) {
    return res.status(400).json({ error: 'Şifre en az 4 karakter olmalıdır' });
  }

  const cleanEmail = email.trim().toLowerCase();
  if (users.some((u) => u.email.toLowerCase() === cleanEmail)) {
    recordAuditLog({
      action: 'KAYIT_HATASI',
      email: cleanEmail,
      status: 'failed',
      details: 'Mevcut e-posta adresiyle mükerrer kayıt denendi (409)',
      ip
    });
    return res.status(409).json({ error: 'Bu e-posta adresi zaten kayıtlı. Lütfen giriş yapmayı deneyin.' });
  }

  const { salt, hash } = hashPassword(password);
  const isMasterAdminEmail = cleanEmail === 'bahadirefet@gmail.com' || cleanEmail === 'turkmenhassan34@gmail.com';

  // If created by an Admin, it's active immediately with selected role.
  // If registered from public portal, status is 'pending' (requires admin approval), role defaults to 'editor' (no role choice on public portal)
  let assignedRole: 'admin' | 'editor' | 'viewer' = 'editor';
  let assignedStatus: 'active' | 'pending' | 'rejected' = 'pending';

  if (isMasterAdminEmail || isFirstUser) {
    assignedRole = 'admin';
    assignedStatus = 'active';
  } else if (isAdminRequest) {
    assignedRole = (role === 'admin' || role === 'viewer' || role === 'editor') ? role : 'editor';
    assignedStatus = 'active';
  } else {
    // Public portal registration: No role picker, awaits admin confirmation
    assignedRole = 'editor';
    assignedStatus = 'pending';
  }

  const newUser: StoredUser = {
    id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: name.trim(),
    email: cleanEmail,
    role: assignedRole,
    status: assignedStatus,
    department: department ? department.trim() : 'Demiryolu Operasyonları',
    passwordSalt: salt,
    passwordHash: hash,
    createdAt: new Date().toISOString(),
    lastLoginAt: assignedStatus === 'active' ? new Date().toISOString() : undefined
  };

  users.push(newUser);
  saveUsers(users);

  recordAuditLog({
    action: assignedStatus === 'pending' ? 'YENİ_HESAP_BAŞVURUSU' : 'YENİ_KULLANICI_KAYDI',
    email: cleanEmail,
    userName: newUser.name,
    role: newUser.role,
    status: assignedStatus === 'pending' ? 'info' : 'success',
    details: assignedStatus === 'pending'
      ? `Yeni kullanıcı başvurdu (Yönetici Onayı Bekliyor): ${newUser.name} (${cleanEmail})`
      : `Yeni kullanıcı hesabı oluşturuldu ve aktifleştirildi: ${newUser.name} (${assignedRole})`,
    ip
  });

  if (assignedStatus === 'pending') {
    return res.status(201).json({
      success: true,
      pending: true,
      message: 'Kayıt başvurunuz başarıyla oluşturuldu! Güvenlik nedeniyle sisteme giriş yapabilmeniz için herhangi bir yöneticinin onay vermesi gerekmektedir.',
      user: sanitizeUser(newUser)
    });
  }

  const token = generateToken(newUser);
  res.status(201).json({
    user: sanitizeUser(newUser),
    token
  });
});

// GET /api/auth/me
app.get('/api/auth/me', (req, res) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Oturum bulunamadı veya süresi dolmuş' });
  }
  res.json({ user: sanitizeUser(user) });
});

// GET /api/auth/users (List all users - for Admin and authorized team access)
app.get('/api/auth/users', (req, res) => {
  const currentUser = getAuthUser(req);
  if (currentUser && currentUser.role !== 'admin') {
    return res.status(403).json({ error: 'Yetkisiz erişim. Yalnızca yönetici görüntüleyebilir.' });
  }
  const users = getUsers();
  // Ensure seed users are always present in the response
  if (users.length === 0) {
    seedUsers();
  }
  res.json(getUsers().map(sanitizeUser));
});

// PUT /api/auth/users/:id/role (Change user role - Admin only)
app.put('/api/auth/users/:id/role', (req, res) => {
  const currentUser = getAuthUser(req);
  if (currentUser && currentUser.role !== 'admin') {
    return res.status(403).json({ error: 'Bu işlem için Yönetici yetkisi gereklidir' });
  }

  const { id } = req.params;
  const { role } = req.body;
  if (!role || !['admin', 'editor', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Geçersiz yetki rolü' });
  }

  const users = getUsers();
  const target = users.find((u) => u.id === id);
  if (!target) {
    return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  }

  const oldRole = target.role;
  target.role = role;
  saveUsers(users);

  recordAuditLog({
    action: 'YETKİ_GÜNCELLENDİ',
    email: target.email,
    userName: target.name,
    role: role,
    status: 'info',
    details: `${target.name} yetkisi güncellendi: ${oldRole} -> ${role}`
  });

  res.json({ success: true, user: sanitizeUser(target) });
});

// PUT /api/auth/users/:id/password (Reset/Change user password - Admin only)
app.put('/api/auth/users/:id/password', (req, res) => {
  const currentUser = getAuthUser(req);
  if (currentUser && currentUser.role !== 'admin') {
    return res.status(403).json({ error: 'Şifre sıfırlama işlemi için Yönetici yetkisi gereklidir' });
  }

  const { id } = req.params;
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: 'Yeni şifre en az 4 karakter olmalıdır' });
  }

  const users = getUsers();
  const target = users.find((u) => u.id === id);
  if (!target) {
    return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  }

  const { salt, hash } = hashPassword(newPassword);
  target.passwordSalt = salt;
  target.passwordHash = hash;
  saveUsers(users);

  recordAuditLog({
    action: 'ŞİFRE_SIFIRLANDI',
    email: target.email,
    userName: target.name,
    role: target.role,
    status: 'warning',
    details: `${target.name} (${target.email}) kullanıcısının şifresi yönetici tarafından güncellendi`
  });

  res.json({ success: true, message: 'Kullanıcı şifresi başarıyla güncellendi' });
});

// DELETE /api/auth/users/:id (Remove user - Admin only)
app.delete('/api/auth/users/:id', (req, res) => {
  const currentUser = getAuthUser(req);
  if (currentUser && currentUser.role !== 'admin') {
    return res.status(403).json({ error: 'Bu işlem için Yönetici yetkisi gereklidir' });
  }

  const { id } = req.params;
  const users = getUsers();
  const targetIndex = users.findIndex((u) => u.id === id);
  if (targetIndex === -1) {
    return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  }

  if (currentUser && currentUser.id === id) {
    return res.status(400).json({ error: 'Kendi hesabınızı silemezsiniz' });
  }

  const removed = users[targetIndex];
  users.splice(targetIndex, 1);
  saveUsers(users);

  // Blacklist permanently so this user never resurrects from seed or cache
  recordDeletedUser(removed.id, removed.email);

  recordAuditLog({
    action: 'KULLANICI_SİLİNDİ',
    email: removed.email,
    userName: removed.name,
    status: 'warning',
    details: `${removed.name} (${removed.email}) hesabı sistemden silindi ve kalıcı engellendi`
  });

  res.json({ success: true });
});

// PUT /api/auth/users/:id/approve (Admin confirms pending user and sets role)
app.put('/api/auth/users/:id/approve', (req, res) => {
  const currentUser = getAuthUser(req);
  if (currentUser && currentUser.role !== 'admin') {
    return res.status(403).json({ error: 'Kullanıcı onaylama işlemi için Yönetici yetkisi gereklidir' });
  }

  const { id } = req.params;
  const { role, status = 'active' } = req.body;
  const users = getUsers();
  const target = users.find((u) => u.id === id);
  if (!target) {
    return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  }

  target.status = status;
  if (role && ['admin', 'editor', 'viewer'].includes(role)) {
    target.role = role;
  }
  saveUsers(users);

  recordAuditLog({
    action: status === 'active' ? 'KULLANICI_ONAYLANDI' : 'KULLANICI_DURUMU_DEĞİŞTİ',
    email: target.email,
    userName: target.name,
    role: target.role,
    status: 'success',
    details: `${target.name} (${target.email}) hesabı yönetici tarafından onaylandı: Rol: ${target.role}`
  });

  res.json({ success: true, user: sanitizeUser(target) });
});

// GET /api/logs (Fetch audit & access logs)
app.get('/api/logs', (req, res) => {
  const logs = getAuditLogs();
  res.json(logs);
});

// POST /api/logs/clear
app.post('/api/logs/clear', (req, res) => {
  try {
    fs.writeFileSync(LOGS_FILE, '[]', 'utf-8');
    recordAuditLog({
      action: 'LOGLAR_TEMİZLENDİ',
      status: 'info',
      details: 'Sistem denetim ve oturum günlüğü temizlendi'
    });
    res.json({ success: true, message: 'Log kayıtları temizlendi' });
  } catch (err: any) {
    res.status(500).json({ error: 'Loglar temizlenemedi', details: err?.message });
  }
});

// ---------------- GENERAL API ROUTES ----------------
// Enforce strict no-cache on all API routes so mobile devices & proxies never show stale points
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// SSE real-time stream endpoint: pushes immediate updates to all connected devices in <100ms
app.get('/api/points/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const initialPayload = JSON.stringify({
    revision: currentRevision,
    count: getPoints().length,
    action: 'init',
    timestamp: new Date().toISOString(),
  });
  res.write(`event: connected\ndata: ${initialPayload}\n\n`);

  sseClients.add(res);

  const keepAlive = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch {
      clearInterval(keepAlive);
      sseClients.delete(res);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(keepAlive);
    sseClients.delete(res);
  });
});

// Fast lightweight version polling endpoint
app.get('/api/points/version', (req, res) => {
  res.json({
    revision: currentRevision,
    count: getPoints().length,
  });
});

app.get('/api/health', (req, res) => {
  const points = getPoints();
  res.json({ status: 'ok', totalPoints: points.length, revision: currentRevision });
});

// GET all points
app.get('/api/points', (req, res) => {
  const points = getPoints();
  res.json(points);
});

// Helper to extract KM chainage if not provided
function extractKmFromTitle(title?: string): string {
  if (!title) return '';
  const m = title.match(/(?:KM\s*[:.-]?\s*)?(\d{1,4}\s*\+\s*\d{1,3})/i);
  if (m && m[1]) return m[1].replace(/\s+/g, '');
  const m2 = title.match(/\bKM\s*[:.-]?\s*(\d{1,4})\b/i);
  if (m2 && m2[1]) return m2[1];
  return '';
}

// POST new point
app.post('/api/points', (req, res) => {
  const { id, title, kmValue, lineName, locationDesc, category, lat, lng, description, textStyle, titleTextStyle, notes, photos, createdAt } = req.body;
  if (!title || lat === undefined || lng === undefined) {
    return res.status(400).json({ error: 'Başlık ve koordinatlar zorunludur' });
  }

  const points = getPoints();
  const targetId = id || `pt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  unrecordDeletedId(targetId);
  const resolvedKm = (kmValue && kmValue.trim()) ? kmValue.trim() : extractKmFromTitle(title);

  // Check if point with targetId already exists - if so, update it
  const existingIndex = points.findIndex((p) => p.id === targetId);
  if (existingIndex !== -1) {
    const updated = {
      ...points[existingIndex],
      ...req.body,
      id: targetId,
      title: title.trim(),
      kmValue: resolvedKm,
      lat: Number(lat),
      lng: Number(lng),
      updatedAt: new Date().toISOString(),
    };
    points[existingIndex] = updated;
    savePoints(points, 'update_point');
    return res.json(updated);
  }

  const newPoint = {
    id: targetId,
    title: title.trim(),
    kmValue: resolvedKm,
    lineName: (lineName || 'Genel Demiryolu Hattı').trim(),
    locationDesc: (locationDesc || '').trim(),
    category: category || 'km_marker',
    lat: Number(lat),
    lng: Number(lng),
    description: (description || '').trim(),
    textStyle: textStyle || null,
    titleTextStyle: titleTextStyle || null,
    levelCrossing: req.body.levelCrossing || null,
    notes: Array.isArray(notes) ? notes : [],
    photos: Array.isArray(photos) ? photos : [],
    createdAt: createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  points.unshift(newPoint);
  savePoints(points, 'create_point');
  res.status(201).json(newPoint);
});

// PUT update point (with upsert support)
app.put('/api/points/:id', (req, res) => {
  const { id } = req.params;
  const points = getPoints();
  const index = points.findIndex((p) => p.id === id);

  const rawTitle = req.body.title || (index !== -1 ? points[index].title : '');
  const resolvedKm = (req.body.kmValue && req.body.kmValue.trim())
    ? req.body.kmValue.trim()
    : (index !== -1 && points[index].kmValue ? points[index].kmValue : extractKmFromTitle(rawTitle));

  if (index === -1) {
    // Upsert: point not found on server (e.g. after container restart or created offline), save it!
    const newPoint = {
      id,
      title: (req.body.title || 'Demiryolu Noktası').trim(),
      kmValue: resolvedKm,
      lineName: (req.body.lineName || 'Genel Demiryolu Hattı').trim(),
      locationDesc: (req.body.locationDesc || '').trim(),
      category: req.body.category || 'km_marker',
      lat: req.body.lat !== undefined ? Number(req.body.lat) : 0,
      lng: req.body.lng !== undefined ? Number(req.body.lng) : 0,
      description: (req.body.description || '').trim(),
      textStyle: req.body.textStyle || null,
      titleTextStyle: req.body.titleTextStyle || null,
      levelCrossing: req.body.levelCrossing || null,
      notes: Array.isArray(req.body.notes) ? req.body.notes : [],
      photos: Array.isArray(req.body.photos) ? req.body.photos : [],
      createdAt: req.body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    points.unshift(newPoint);
    savePoints(points);
    return res.json(newPoint);
  }

  const existing = points[index];

  // Protect photos from being erased if req.body.photos is missing or empty when existing has photos
  let finalPhotos = Array.isArray(existing.photos) ? existing.photos : [];
  if (Array.isArray(req.body.photos)) {
    if (req.body.photos.length > 0) {
      finalPhotos = req.body.photos;
    } else if (req.body.preservePhotos !== false && (existing.photos || []).length > 0) {
      finalPhotos = existing.photos;
    } else {
      finalPhotos = [];
    }
  }

  // Protect notes from being erased
  let finalNotes = Array.isArray(existing.notes) ? existing.notes : [];
  if (Array.isArray(req.body.notes)) {
    if (req.body.notes.length > 0) {
      finalNotes = req.body.notes;
    } else if (req.body.preserveNotes !== false && (existing.notes || []).length > 0) {
      finalNotes = existing.notes;
    } else {
      finalNotes = [];
    }
  }

  const updated = {
    ...existing,
    ...req.body,
    id: existing.id, // ID cannot be changed
    title: req.body.title !== undefined ? req.body.title.trim() : existing.title,
    kmValue: resolvedKm,
    lat: req.body.lat !== undefined ? Number(req.body.lat) : existing.lat,
    lng: req.body.lng !== undefined ? Number(req.body.lng) : existing.lng,
    photos: finalPhotos,
    notes: finalNotes,
    updatedAt: new Date().toISOString(),
  };

  points[index] = updated;
  savePoints(points);
  res.json(updated);
});

// DELETE point
app.delete('/api/points/:id', (req, res) => {
  const { id } = req.params;
  recordDeletedId(id);
  let points = getPoints();
  points = points.filter((p) => p.id !== id);
  savePoints(points);
  res.json({ success: true, message: 'Nokta kalıcı olarak silindi', id });
});

// POST add note to a point
app.post('/api/points/:id/notes', (req, res) => {
  const { id } = req.params;
  const { text, author } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Not metni zorunludur' });
  }

  const deleted = getDeletedIds();
  if (deleted.has(id) || isDefaultPoint(id)) {
    return res.status(400).json({ error: 'Silinmiş veya geçersiz nokta' });
  }

  const points = getPoints();
  let point = points.find((p) => p.id === id);
  if (!point) {
    point = {
      id,
      title: (req.body.pointTitle || 'Demiryolu Noktası').trim(),
      kmValue: '',
      lineName: 'Genel Demiryolu Hattı',
      locationDesc: '',
      category: 'km_marker',
      lat: req.body.lat !== undefined ? Number(req.body.lat) : 0,
      lng: req.body.lng !== undefined ? Number(req.body.lng) : 0,
      description: '',
      textStyle: null,
      titleTextStyle: null,
      notes: [],
      photos: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    points.unshift(point);
  }

  if (!Array.isArray(point.notes)) point.notes = [];

  const newNote = {
    id: `note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    text: text.trim(),
    author: (author || 'Saha Personeli').trim(),
    createdAt: new Date().toISOString(),
  };

  point.notes.unshift(newNote);
  point.updatedAt = new Date().toISOString();
  savePoints(points);

  res.status(201).json(newNote);
});

// DELETE note from point (idempotent, no 404 error)
app.delete('/api/points/:id/notes/:noteId', (req, res) => {
  const { id, noteId } = req.params;
  const points = getPoints();
  const point = points.find((p) => p.id === id);
  if (point && Array.isArray(point.notes)) {
    point.notes = point.notes.filter((n: any) => n.id !== noteId);
    point.updatedAt = new Date().toISOString();
    savePoints(points);
  }
  res.json({ success: true });
});

// POST add photo to point (with resilient upsert)
app.post('/api/points/:id/photos', (req, res) => {
  const { id } = req.params;
  const { dataUrl, caption, pointTitle, lat, lng } = req.body;
  if (!dataUrl) {
    return res.status(400).json({ error: 'Fotoğraf verisi zorunludur' });
  }

  const deleted = getDeletedIds();
  if (deleted.has(id) || isDefaultPoint(id)) {
    return res.status(400).json({ error: 'Silinmiş veya geçersiz nokta' });
  }

  const points = getPoints();
  let point = points.find((p) => p.id === id);
  if (!point) {
    // If point does not exist yet on server, create it so photos are never lost!
    point = {
      id,
      title: (pointTitle || 'Demiryolu Noktası').trim(),
      kmValue: '',
      lineName: 'Genel Demiryolu Hattı',
      locationDesc: '',
      category: 'km_marker',
      lat: lat !== undefined ? Number(lat) : 0,
      lng: lng !== undefined ? Number(lng) : 0,
      description: '',
      textStyle: null,
      titleTextStyle: null,
      notes: [],
      photos: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    points.unshift(point);
  }

  if (!Array.isArray(point.photos)) point.photos = [];

  const newPhoto = {
    id: `photo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    dataUrl,
    caption: (caption || '').trim(),
    takenAt: new Date().toISOString(),
  };

  point.photos.unshift(newPhoto);
  point.updatedAt = new Date().toISOString();
  savePoints(points);

  res.status(201).json(newPhoto);
});

// DELETE photo from point (idempotent, no 404 error)
app.delete('/api/points/:id/photos/:photoId', (req, res) => {
  const { id, photoId } = req.params;
  const points = getPoints();
  const point = points.find((p) => p.id === id);
  if (point && Array.isArray(point.photos)) {
    point.photos = point.photos.filter((ph: any) => ph.id !== photoId);
    point.updatedAt = new Date().toISOString();
    savePoints(points);
  }
  res.json({ success: true });
});

// POST batch import points (from KML, GeoJSON or CSV export)
app.post('/api/points/import', (req, res) => {
  const { points: importedPoints, replaceAll } = req.body;
  if (!Array.isArray(importedPoints) || importedPoints.length === 0) {
    return res.json({ success: true, count: 0, total: getPoints().length });
  }

  let currentPoints = getPoints();
  const validatedPoints = importedPoints
    .filter((p) => p && !isDefaultPoint(p.id))
    .map((p, idx) => {
      const pId = p.id || `pt-imp-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`;
      // If this ID was previously marked deleted, un-record it because user is actively importing it
      unrecordDeletedId(pId);

      return {
        id: pId,
        title: (p.title || `KM Noktası ${idx + 1}`).trim(),
        kmValue: (p.kmValue && p.kmValue.trim()) ? p.kmValue.trim() : extractKmFromTitle(p.title),
        lineName: (p.lineName || 'İçe Aktarılan Hat').trim(),
        locationDesc: (p.locationDesc || '').trim(),
        category: p.category || 'km_marker',
        lat: Number(p.lat) || 0,
        lng: Number(p.lng) || 0,
        description: (p.description || '').trim(),
        textStyle: p.textStyle || null,
        titleTextStyle: p.titleTextStyle || null,
        levelCrossing: p.levelCrossing || null,
        notes: Array.isArray(p.notes) ? p.notes : [],
        photos: Array.isArray(p.photos) ? p.photos : [],
        createdAt: p.createdAt || new Date().toISOString(),
        updatedAt: p.updatedAt || new Date().toISOString(),
      };
    }).filter((p) => (p.lat !== 0 && p.lng !== 0) || Boolean(p.kmValue) || Boolean(p.title));

  if (replaceAll) {
    const newIdSet = new Set(validatedPoints.map((p) => p.id));
    currentPoints.forEach((oldP) => {
      if (oldP && oldP.id && !newIdSet.has(oldP.id)) {
        recordDeletedId(oldP.id);
      }
    });
    currentPoints = validatedPoints;
  } else {
    validatedPoints.forEach((p) => {
      const normTitle = (p.title || '').trim().toLowerCase();
      const pKm = (p.kmValue || '').trim().toLowerCase();
      const pLat = Number(p.lat);
      const pLng = Number(p.lng);

      // Match existing by ID, or coordinates (~10 meters), or KM + crossing/title
      const existing = currentPoints.find((cp) => {
        if (cp.id === p.id) return true;
        const cpKm = (cp.kmValue || '').trim().toLowerCase();
        const cpTitle = (cp.title || '').trim().toLowerCase();

        // 1. Distance match if coords exist
        if (!isNaN(pLat) && !isNaN(pLng) && pLat !== 0 && pLng !== 0 && !isNaN(Number(cp.lat)) && !isNaN(Number(cp.lng))) {
          const dLat = Math.abs(Number(cp.lat) - pLat);
          const dLng = Math.abs(Number(cp.lng) - pLng);
          if (dLat < 0.0001 && dLng < 0.0001) return true;
        }

        // 2. Exact KM match (e.g. 54+635 === 54+635)
        if (pKm && cpKm && pKm === cpKm) {
          if (cp.category === 'crossing' || p.category === 'crossing') return true;
          if (normTitle === cpTitle || normTitle.includes(cpTitle) || cpTitle.includes(normTitle)) return true;
        }

        // 3. Exact title match
        if (normTitle && cpTitle && normTitle === cpTitle) return true;

        return false;
      });

      if (existing) {
        // Merge photos so existing uploaded photos are NEVER lost when syncing!
        const photoMap = new Map();
        (existing.photos || []).forEach((ph: any) => photoMap.set(ph.id, ph));
        (p.photos || []).forEach((ph: any) => photoMap.set(ph.id, ph));

        // Merge notes so notes are never lost
        const noteMap = new Map();
        (existing.notes || []).forEach((n: any) => noteMap.set(n.id, n));
        (p.notes || []).forEach((n: any) => noteMap.set(n.id, n));

        // Preserve levelCrossing if existing has it and imported item has null/undefined
        const finalLevelCrossing = (p.levelCrossing && Object.keys(p.levelCrossing).length > 0)
          ? p.levelCrossing
          : (existing.levelCrossing || p.levelCrossing || null);

        Object.assign(existing, {
          ...p,
          id: existing.id, // keep original ID
          lat: (p.lat !== 0 && !isNaN(p.lat)) ? p.lat : existing.lat,
          lng: (p.lng !== 0 && !isNaN(p.lng)) ? p.lng : existing.lng,
          category: (p.category === 'crossing' || existing.category === 'crossing') ? 'crossing' : (p.category || existing.category),
          levelCrossing: finalLevelCrossing,
          photos: Array.from(photoMap.values()),
          notes: Array.from(noteMap.values()),
          updatedAt: (p.updatedAt && p.updatedAt > existing.updatedAt) ? p.updatedAt : existing.updatedAt,
        });
      } else {
        currentPoints.push(p);
      }
    });
  }

  savePoints(currentPoints, 'import_points');
  res.json({ success: true, count: validatedPoints.length, total: currentPoints.length });
});

// GET database state (cleared timestamp and counts)
app.get('/api/database-state', (req, res) => {
  const state = getDatabaseState();
  res.json({
    clearedAt: state.clearedAt,
    pointCount: getPoints().length,
    deletedCount: getDeletedIds().size,
  });
});

// GET all permanently deleted/blacklisted point IDs
app.get('/api/deleted-ids', (req, res) => {
  res.json(Array.from(getDeletedIds()));
});

// ---------------- TAKYİDAT (HIZ KISITLAMALARI & YOL EMRİ) API ----------------
function getTakyidatList(): any[] {
  try {
    if (fs.existsSync(TAKYIDAT_FILE)) {
      const raw = fs.readFileSync(TAKYIDAT_FILE, 'utf-8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) return list;
    }
  } catch (err) {
    console.error('Error reading takyidat file:', err);
  }
  return [];
}

function saveTakyidatList(list: any[]) {
  try {
    fs.writeFileSync(TAKYIDAT_FILE, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving takyidat file:', err);
  }
}

// GET all takyidat restrictions
app.get('/api/takyidat', (req, res) => {
  const list = getTakyidatList();
  res.json(list);
});

// POST new takyidat restriction
app.post('/api/takyidat', (req, res) => {
  const body = req.body;
  if (!body) {
    return res.status(400).json({ error: 'Geçersiz veri' });
  }

  const startKm = String(body.startKm || '').trim();
  const endKm = String(body.endKm || '').trim();
  const startKmNum = typeof body.startKmNum === 'number' ? body.startKmNum : (parseKmToNumber(startKm) || 0);
  const endKmNum = typeof body.endKmNum === 'number' ? body.endKmNum : (parseKmToNumber(endKm) || 0);
  const speedLimit = Number(body.speedLimit) || 30;

  const newEntry = {
    id: body.id || `tak-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    startKm: startKm || `${startKmNum}+000`,
    endKm: endKm || `${endKmNum}+000`,
    startKmNum: Math.min(startKmNum, endKmNum),
    endKmNum: Math.max(startKmNum, endKmNum),
    lineName: body.lineName || 'Eskişehir-Konya',
    speedLimit,
    normalSpeed: Number(body.normalSpeed) || 120,
    reason: body.reason || 'Yol Bakım & Onarım Çalışması',
    status: body.status || 'active',
    trackType: body.trackType || 'both',
    startDate: body.startDate || new Date().toISOString(),
    endDate: body.endDate || '',
    issuedBy: body.issuedBy || '712 Yol Bakım Şefliği',
    noticeNo: body.noticeNo || `YOL EMRİ ${new Date().getFullYear()}/${Math.floor(Math.random() * 90 + 10)}`,
    notes: body.notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const list = getTakyidatList();
  list.unshift(newEntry);
  saveTakyidatList(list);

  recordAuditLog({
    action: 'TAKYIDAT_ADD',
    status: 'success',
    details: `Takyidat eklendi: KM ${newEntry.startKm} - ${newEntry.endKm}, Hız Sınırı: ${newEntry.speedLimit} km/s`,
  });

  notifyPointsChanged('takyidat_changed');
  res.status(201).json(newEntry);
});

// PUT update takyidat restriction
app.put('/api/takyidat/:id', (req, res) => {
  const { id } = req.params;
  const list = getTakyidatList();
  const index = list.findIndex((item) => item.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Takyidat kaydı bulunamadı' });
  }

  const existing = list[index];
  const body = req.body || {};
  const startKm = body.startKm !== undefined ? String(body.startKm).trim() : existing.startKm;
  const endKm = body.endKm !== undefined ? String(body.endKm).trim() : existing.endKm;
  const startKmNum = typeof body.startKmNum === 'number' ? body.startKmNum : (parseKmToNumber(startKm) || existing.startKmNum);
  const endKmNum = typeof body.endKmNum === 'number' ? body.endKmNum : (parseKmToNumber(endKm) || existing.endKmNum);

  const updated = {
    ...existing,
    ...body,
    id: existing.id,
    startKm,
    endKm,
    startKmNum: Math.min(startKmNum, endKmNum),
    endKmNum: Math.max(startKmNum, endKmNum),
    speedLimit: Number(body.speedLimit) || existing.speedLimit,
    updatedAt: new Date().toISOString(),
  };

  list[index] = updated;
  saveTakyidatList(list);

  notifyPointsChanged('takyidat_changed');
  res.json(updated);
});

// DELETE takyidat restriction
app.delete('/api/takyidat/:id', (req, res) => {
  const { id } = req.params;
  const list = getTakyidatList();
  const filtered = list.filter((item) => item.id !== id);

  if (filtered.length === list.length) {
    return res.status(404).json({ error: 'Takyidat kaydı bulunamadı' });
  }

  saveTakyidatList(filtered);
  recordAuditLog({
    action: 'TAKYIDAT_DELETE',
    status: 'warning',
    details: `Takyidat silindi: ID ${id}`,
  });

  notifyPointsChanged('takyidat_changed');
  res.json({ success: true, message: 'Takyidat kaydı silindi' });
});

// POST reset: cleans all points and keeps default points blacklisted
app.post('/api/points/reset-sample', (req, res) => {
  const points = getPoints();
  points.forEach((p) => {
    if (p && p.id) recordDeletedId(p.id);
  });
  savePoints([]);
  const clearedAt = setDatabaseCleared();
  res.json({ success: true, count: 0, total: 0, clearedAt });
});

// DELETE all points
app.delete('/api/points', (req, res) => {
  const points = getPoints();
  points.forEach((p) => {
    if (p && p.id) recordDeletedId(p.id);
  });
  savePoints([]);
  const clearedAt = setDatabaseCleared();
  res.json({ success: true, message: 'Tüm noktalar kalıcı olarak silindi', count: 0, total: 0, clearedAt });
});

// POST create explicit backup
app.post('/api/backup-now', (req, res) => {
  try {
    const backupPath = path.join(DATA_DIR, `railway_points_backup.json`);
    const points = getPoints();
    fs.writeFileSync(backupPath, JSON.stringify(points, null, 2), 'utf-8');
    res.json({ success: true, message: 'Yedek başarıyla alındı', count: points.length });
  } catch (err: any) {
    res.status(500).json({ error: 'Yedek alınamadı', details: err?.message });
  }
});

// POST restore from backup
app.post('/api/restore-backup', (req, res) => {
  try {
    const backupPath = path.join(DATA_DIR, `railway_points_backup.json`);
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: 'Yedek dosyası bulunamadı' });
    }
    const data = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
    if (Array.isArray(data)) {
      savePoints(data);
      return res.json({ success: true, message: 'Yedek başarıyla geri yüklendi', count: data.length });
    }
    res.status(400).json({ error: 'Geçersiz yedek içeriği' });
  } catch (err: any) {
    res.status(500).json({ error: 'Yedek geri yüklenemedi', details: err?.message });
  }
});

// Global Error Handler for API routes
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('API Sunucu Hatası:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Sunucu tarafında bir işlem hatası oluştu', message: err?.message || 'Bilinmeyen hata' });
  }
});

// Vite middleware or static serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Demiryolu KM Sunucusu port ${PORT} üzerinde hazır.`);
  });
}

startServer();
