const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

test('Netlify artifact starts outside the repository with only shipped dependencies', { timeout: 60000 }, async t => {
  const { zipFunctions } = await import('@netlify/zip-it-and-ship-it');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'amenza-bundle-test-'));
  t.after(() => {
    const relative = path.relative(os.tmpdir(), root);
    assert.ok(relative.startsWith('amenza-bundle-test-') && !relative.includes(path.sep));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const results = await zipFunctions('netlify/functions', root, {
    archiveFormat: 'none',
    config: { '*': { nodeBundler: 'esbuild', nodeVersion: '22' } }
  });
  const bundle = results.find(item => item.name === 'account');
  const entry = fs.readFileSync(path.join(bundle.path, bundle.entryFilename), 'utf8');
  const importPath = entry.match(/getLambdaHandler\(['"]([^'"]+)['"]\)/)?.[1];
  assert.ok(importPath, 'Netlify handler entry must be discoverable');
  fs.writeFileSync(path.join(bundle.path, 'smoke.cjs'), `
    const assert = require('node:assert/strict');
    (async () => {
      const { default: handler } = await import(${JSON.stringify(importPath)});
      const response = await handler(new Request('https://example.com/api/account'), { ip: 'test' });
      assert.equal(response.status, 405);
      assert.equal((await response.json()).error, 'Método no permitido.');
      const post = await handler(new Request('https://example.com/api/account', {
        method: 'POST', headers: { origin: 'https://example.com', 'content-type': 'application/json' },
        body: JSON.stringify({action: 'me'})
      }), { ip: 'test' });
      assert.equal(post.status, 503);
      assert.equal((await post.json()).error, 'El servidor todavía no está configurado.');
      console.log('isolated Netlify artifact OK');
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `);
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith('FIREBASE_') || ['ADMIN_UIDS', 'APP_ORIGIN', 'NODE_PATH', 'NODE_OPTIONS'].includes(key)) delete env[key];
  }
  const result = spawnSync(process.execPath, ['smoke.cjs'], { cwd: bundle.path, env, encoding: 'utf8', timeout: 15000 });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  assert.match(result.stdout, /isolated Netlify artifact OK/);
});
