import { createHash, randomBytes } from 'node:crypto';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
const hash = value => createHash('sha256').update(value).digest('hex');
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const avatars = new Set(['1.webp','2.webp','3.webp','5.webp','6.webp','7.webp','8.webp','9.webp','11.webp','22.webp']);
const sessionSeconds = 8 * 60 * 60;
const defaultUserDays = 30;
const defaultAvatar = '1.webp';
const generatePassword = () => randomBytes(18).toString('base64url');
function configuration(env) {
  const keys = ['FIREBASE_PROJECT_ID','FIREBASE_DATABASE_URL','FIREBASE_CLIENT_EMAIL','FIREBASE_PRIVATE_KEY','FIREBASE_WEB_API_KEY','ADMIN_UIDS','APP_ORIGIN'];
  const cfg = Object.fromEntries(keys.map(k => [k, env(k)]));
  if (keys.some(k => !cfg[k])) fail(503, 'El servidor todavía no está configurado.');
  const rawOrigin = String(cfg.APP_ORIGIN || '').trim().replace(/^["']|["']$/g, '');
  let origin;
  try { origin = new URL(rawOrigin); } catch { fail(503, 'Configuración de origen inválida.'); }
  if (origin.protocol !== 'https:' && origin.hostname !== 'localhost') fail(503, 'Configuración de origen inválida. Debe usar https://');
  cfg.APP_ORIGIN = origin.origin;
  if (cfg.FIREBASE_PROJECT_ID === 'clone-15faa') fail(503, 'Configura el proyecto nuevo, no el comprometido.');
  return cfg;
}
function services(cfg) {
  const cleanKey = (cfg.FIREBASE_PRIVATE_KEY || '').trim().replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
  const app = getApps()[0] || initializeApp({
    credential: cert({ projectId: cfg.FIREBASE_PROJECT_ID, clientEmail: cfg.FIREBASE_CLIENT_EMAIL, privateKey: cleanKey }),
    databaseURL: cfg.FIREBASE_DATABASE_URL
  });
  return { auth: getAuth(app), db: getDatabase(app) };
}
function publicUser(uid, value, admin, expiresAt) {
  return { id: uid, username: value.username, role: admin ? 'admin' : 'user', avatar: avatars.has(value.avatar) ? value.avatar : '1.webp', createdAt: value.createdAt || 0, expiresAt, deviceId: value.deviceId ? 'bound' : null };
}
async function limit(db, key, maximum, windowMs) {
  // Desactivado: no bloquear por demasiados intentos
  return;
}
async function handle(request, context = {}) {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'" };
  const response = (data, status = 200) => new Response(JSON.stringify(data), { status, headers });
  try {
    if (request.method !== 'POST') return response({ error: 'Método no permitido.' }, 405);
    const cfg = configuration(context.env || (key => process.env[key]));
    if (request.headers.get('origin') !== cfg.APP_ORIGIN) fail(403, 'Origen no permitido.');
    if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') fail(415, 'Se requiere JSON.');
    const reader = request.body?.getReader();
    let chunks = [], length = 0;
    if (reader) for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 8192) { await reader.cancel(); fail(413, 'Solicitud demasiado grande.'); }
      chunks.push(Buffer.from(value));
    }
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail(400, 'JSON inválido.'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'Solicitud inválida.');
    const { auth, db } = context.services || services(cfg);
    const admins = new Set(cfg.ADMIN_UIDS.split(',').map(x => x.trim()).filter(Boolean));
    const secure = cfg.APP_ORIGIN.startsWith('https:');
    const cookieName = secure ? '__Host-amenza' : 'amenza-local';
    const setCookie = (value, maxAge) => { headers['Set-Cookie'] = `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`; };
    await limit(db, 'ip:' + (context.ip || 'unknown'), 120, 60000);
    if (body.action === 'login') {
      const identifier = typeof body.identifier === 'string' ? body.identifier.trim() : '';
      if (!identifier || identifier.length > 254 || typeof body.password !== 'string' || body.password.length > 128 || !body.password) fail(400, 'Credenciales inválidas.');
      await limit(db, 'login-ip:' + (context.ip || 'unknown'), 10, 900000);
      await limit(db, 'login-user:' + identifier.toLowerCase(), 10, 900000);
      const email = identifier.includes('@') ? identifier : hash(identifier.toLowerCase()) + '@users.invalid';
      const result = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + encodeURIComponent(cfg.FIREBASE_WEB_API_KEY), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: body.password, returnSecureToken: true }), signal: AbortSignal.timeout(10000)
      });
      if (!result.ok) fail(401, 'Credenciales inválidas o cuenta no disponible.');
      const tokens = await result.json();
      const identity = await auth.verifyIdToken(tokens.idToken, true);
      const admin = admins.has(identity.uid);
      const ref = db.ref('users/' + identity.uid);
      let profile = (await ref.get()).val();
      if (!admin && (!profile || (!Number.isFinite(profile.expiresAt) || profile.expiresAt <= Date.now()) || profile.disabled)) fail(403, 'Cuenta no disponible o expirada.');
      if (!admin) {
        if (typeof body.deviceId !== 'string' || !/^[a-f0-9-]{36}$/.test(body.deviceId)) fail(400, 'Dispositivo inválido.');
        const device = hash(body.deviceId);
        if (profile.deviceId && profile.deviceId !== device) {
          fail(403, 'Cuenta no disponible en este dispositivo.');
        }
        if (!profile.deviceId) {
          await ref.update({ deviceId: device, sessionIssuedAt: identity.iat });
          profile.deviceId = device;
        } else {
          await ref.update({ sessionIssuedAt: identity.iat });
        }
      }
      const cookie = await auth.createSessionCookie(tokens.idToken, { expiresIn: sessionSeconds * 1000 });
      if (!admin) await ref.update({ sessionHash: hash(cookie) });
      setCookie(cookie, sessionSeconds);
      return response({ user: publicUser(identity.uid, profile || { username: identity.email }, admin, admin ? Date.now() + sessionSeconds * 1000 : profile.expiresAt) });
    }
    const cookie = request.headers.get('cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
    let identity;
    try { identity = await auth.verifySessionCookie(cookie || '', true); } catch { fail(401, 'Inicia sesión de nuevo.'); }
    if (body.action === 'logout') {
      await auth.revokeRefreshTokens(identity.uid);
      setCookie('', 0);
      return response({ ok: true });
    }
    const admin = admins.has(identity.uid);
    const profile = (await db.ref('users/' + identity.uid).get()).val();
    if (!admin && (!profile || profile.disabled || (!Number.isFinite(profile.expiresAt) || profile.expiresAt <= Date.now()) || profile.sessionHash !== hash(cookie) || identity.iat < (profile.sessionIssuedAt || 0))) fail(401, 'La sesión ha expirado o fue revocada.');
    if (body.action === 'me') return response({ user: publicUser(identity.uid, profile || { username: identity.email }, admin, admin ? identity.exp * 1000 : profile.expiresAt) });
    if (!admin) fail(403, 'Se requiere administrador.');
    if (body.action === 'list') {
      const users = (await db.ref('users').get()).val() || {};
      return response({ users: Object.entries(users).map(([uid, p]) => publicUser(uid, p, admins.has(uid), p.expiresAt)) });
    }
    if (body.action === 'create') {
      const username = typeof body.username === 'string' ? body.username.trim() : '';
      const password = typeof body.password === 'string' && body.password ? body.password : generatePassword();
      const daysValid = Number.isInteger(body.daysValid) ? body.daysValid : defaultUserDays;
      const avatar = avatars.has(body.avatar) ? body.avatar : defaultAvatar;
      if (!/^[A-Za-z0-9_.-]{3,32}$/.test(username) || typeof password !== 'string' || password.length < 12 || password.length > 128 || daysValid < 1 || daysValid > 365) fail(400, 'Revisa el nombre de usuario.');
      const account = await auth.createUser({ email: hash(username.toLowerCase()) + '@users.invalid', password, displayName: username });
      const record = { username, avatar, createdAt: Date.now(), expiresAt: Date.now() + daysValid * 86400000 };
      try { await db.ref('users/' + account.uid).set(record); }
      catch (error) { await auth.deleteUser(account.uid); throw error; }
      await db.ref('audit').push({ actor: identity.uid, action: 'create', target: account.uid, at: Date.now() });
      return response({ ok: true, username, password, expiresAt: record.expiresAt }, 201);
    }
    if (['delete', 'resetDevice'].includes(body.action)) {
      if (typeof body.uid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(body.uid) || admins.has(body.uid)) fail(400, 'Cuenta no válida.');
      const ref = db.ref('users/' + body.uid);
      if (!(await ref.get()).exists()) fail(404, 'Cuenta no encontrada.');
      if (body.action === 'delete') {
        await ref.update({ disabled: true });
        try { await auth.deleteUser(body.uid); } catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
        await ref.remove();
      } else {
        await ref.update({ deviceId: null, sessionIssuedAt: Math.floor(Date.now() / 1000) + 1 });
        await auth.revokeRefreshTokens(body.uid);
      }
      await db.ref('audit').push({ actor: identity.uid, action: body.action, target: body.uid, at: Date.now() });
      return response({ ok: true });
    }
    fail(400, 'Operación no válida.');
  } catch (error) {
    if (!error.status) console.error('Account request failed:', error);
    return response({ error: error.status ? error.message : 'No se pudo completar la operación.' }, error.status || 503);
  }
}
export { handle, configuration, publicUser };
export default { handle };
