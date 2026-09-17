const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { handle } = require('../server/account.mjs');
const cfg = {
  FIREBASE_PROJECT_ID: 'new-project', FIREBASE_DATABASE_URL: 'https://new-project.firebaseio.com',
  FIREBASE_CLIENT_EMAIL: 'service@example.com', FIREBASE_PRIVATE_KEY: 'test', FIREBASE_WEB_API_KEY: 'test',
  ADMIN_UIDS: 'owner', APP_ORIGIN: 'https://example.com'
};
function ctx(uid, profile) {
  return { env: key => cfg[key], ip: 'test', services: {
    auth: { verifySessionCookie: async () => { if (!uid) throw Error(); return { uid, iat: 100, exp: 9999999999, email: 'owner@example.com' }; } },
    db: { ref: () => ({
      transaction: async () => ({ committed: true }),
      get: async () => ({ val: () => profile, exists: () => !!profile }),
      set: () => { throw Error('Unexpected write'); },
      update: () => { throw Error('Unexpected write'); }
    }) }
  } };
}
function req(body, origin = cfg.APP_ORIGIN) {
  return new Request(cfg.APP_ORIGIN + '/api/account', { method: 'POST', headers: { origin, 'content-type': 'application/json', cookie: '__Host-amenza=test' }, body: JSON.stringify(body) });
}
test('rejects cross-origin requests before accessing Firebase', async () => {
  assert.equal((await handle(req({ action: 'create' }, 'https://evil.example'), ctx())).status, 403);
});
test('anonymous clients cannot list or modify users', async () => {
  for (const action of ['list', 'create', 'delete', 'resetDevice']) assert.equal((await handle(req({ action }), ctx())).status, 401);
});
test('client and database roles cannot elevate privileges', async () => {
  for (const action of ['list','create','delete','resetDevice']) {
    const result = await handle(req({ action, role: 'admin' }), ctx('member', { role: 'admin', sessionHash: require('node:crypto').createHash('sha256').update('test').digest('hex'), expiresAt: Date.now() + 60000 }));
    assert.equal(result.status, 403);
  }
});
test('expiration, deletion, disabling and revocation are enforced', async () => {
  for (const profile of [null, { expiresAt: 1 }, { expiresAt: Date.now()+60000, disabled: true }, { expiresAt: Date.now()+60000, sessionIssuedAt: 101 }]) {
    if (profile) profile.sessionHash = require('node:crypto').createHash('sha256').update('test').digest('hex');
    assert.equal((await handle(req({ action: 'me' }), ctx('member', profile))).status, 401);
  }
});
test('valid member sees own profile but replaced sessions are rejected', async () => {
  const profile = { username: 'member', expiresAt: Date.now()+60000, sessionHash: require('node:crypto').createHash('sha256').update('test').digest('hex') };
  const response = await handle(req({ action: 'me' }), ctx('member', profile));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).user.role, 'user');
  profile.sessionHash = 'different-session';
  assert.equal((await handle(req({ action: 'me' }), ctx('member', profile))).status, 401);
});
test('logout revokes server credentials and clears the cookie', async () => {
  const context = ctx('member'); let revoked;
  context.services.auth.revokeRefreshTokens = async uid => { revoked = uid; };
  const response = await handle(req({ action: 'logout' }), context);
  assert.equal(response.status, 200);
  assert.equal(revoked, 'member');
  assert.match(response.headers.get('set-cookie'), /HttpOnly; SameSite=Strict; Max-Age=0; Secure/);
});
test('only allowlisted admin can read user list', async () => {
  const result = await handle(req({ action: 'list' }), ctx('owner', { member: { username: 'safe', passwordHash: 'secret', expiresAt: 1234 } }));
  assert.equal(result.status, 200);
  assert.equal(JSON.stringify(await result.json()).includes('secret'), false);
});
test('rejects invalid inputs and attempts to delete admin', async () => {
  assert.equal((await handle(req({ action: 'create', username: '../admin', password: '123' }), ctx('owner'))).status, 400);
  assert.equal((await handle(req({ action: 'delete', uid: 'owner' }), ctx('owner'))).status, 400);
  assert.equal((await handle(req({ action: 'delete', uid: '../users' }), ctx('owner'))).status, 400);
});
test('fails closed without server configuration', async () => {
  assert.equal((await handle(req({ action: 'login' }), { env: () => undefined })).status, 503);
});
test('limits request size and login attempts', async () => {
  assert.equal((await handle(req({ x: 'x'.repeat(9000) }), ctx())).status, 413);
  const context = ctx();
  context.services.db.ref = () => ({ transaction: async () => ({ committed: false }) });
  assert.equal((await handle(req({ action: 'login' }), context)).status, 429);
});
test('public build contains no server, env, SDK configuration or old project', () => {
  for (const name of ['.env', '.env.example', 'server.cjs', 'server', 'netlify', 'package.json', '.git', 'README.md']) assert.equal(fs.existsSync('dist/' + name), false);
  for (const name of ['index.html', 'app.js']) {
    const text = fs.readFileSync('dist/' + name, 'utf8');
    assert.doesNotMatch(text, /clone-15faa|firebase\.database|passwordHash|__firebaseConfig/);
  }
  assert.deepEqual(JSON.parse(fs.readFileSync('database.rules.json', 'utf8')), { rules: { '.read': false, '.write': false } });
});
