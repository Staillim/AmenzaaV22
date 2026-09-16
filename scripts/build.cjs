const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const name of fs.readdirSync(root)) {
  if (['index.html', 'app.js', 'styles.css'].includes(name) || /\.(png|jpe?g|webp|svg|ico)$/i.test(name)) {
    fs.copyFileSync(path.join(root, name), path.join(out, name));
  }
}
fs.cpSync(path.join(root, 'recursos'), path.join(out, 'recursos'), {
  recursive: true,
  filter: p => fs.statSync(p).isDirectory() || /\.(png|jpe?g|webp|svg|ico)$/i.test(p)
});
console.log('Public assets built in dist; server files and secrets excluded.');
