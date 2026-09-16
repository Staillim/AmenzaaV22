const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
test('HTTP server exposes public assets but never internal files', async () => {
  const child = spawn(process.execPath, ['server.cjs'], { env: { ...process.env, PORT: '5199' }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await Promise.race([once(child.stdout, 'data'), new Promise((_, reject) => { const timer = setTimeout(() => reject(Error('Server startup timeout')), 15000); timer.unref(); })]);
    // The build prints before listen; retry the connection until the server is ready.
    let connected = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      try { await fetch('http://127.0.0.1:5199/'); connected = true; break; }
      catch { await new Promise(resolve => setTimeout(resolve, 100)); }
    }
    assert.equal(connected, true);
    for (const path of ['/.env', '/.env.example', '/server.cjs', '/server/account.cjs', '/package.json', '/.git/config', '/README.md', '/netlify/functions/account.mts', '/%2e%2e%5cserver.cjs']) {
      assert.equal((await fetch('http://127.0.0.1:5199' + path)).status, 404, path);
    }
    const page = await fetch('http://127.0.0.1:5199/');
    assert.equal(page.status, 200);
    assert.equal(page.headers.get('x-frame-options'), 'DENY');
    assert.equal((await fetch('http://127.0.0.1:5199/api/account')).status, 405);
  } finally { child.kill(); await once(child, 'exit'); }
});
