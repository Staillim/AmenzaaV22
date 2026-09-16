// Simple zero-dependency static server for the Roblox clone
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "dist");
const { handle } = require("./server/account.cjs");
require("./scripts/build.cjs");
const PORT = process.env.PORT || 5173;

const MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
};

const server = http.createServer(async (req, res) => {
    try {
        const url = new URL(req.url, 'http://localhost:' + PORT);
        if (url.pathname === '/api/account') {
            const chunks = []; let size = 0;
            for await (const chunk of req) {
                size += chunk.length;
                if (size > 8192) { res.writeHead(413); res.end(); return; }
                chunks.push(chunk);
            }
            const request = new Request(url, {
                method: req.method, headers: req.headers,
                body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks)
            });
            const result = await handle(request, { ip: req.socket.remoteAddress });
            res.writeHead(result.status, Object.fromEntries(result.headers));
            res.end(await result.text()); return;
        }
        if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
        const urlPath = decodeURIComponent(url.pathname);
        const filePath = path.resolve(ROOT, '.' + (urlPath === '/' ? '/index.html' : urlPath));
        const relative = path.relative(ROOT, filePath);
        if (relative.startsWith('..') || path.isAbsolute(relative) || !MIME[path.extname(filePath).toLowerCase()]) {
            res.writeHead(404); res.end(); return;
        }
        const stat = await fs.promises.stat(filePath).catch(() => null);
        if (!stat?.isFile()) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, {
            'Content-Type': MIME[path.extname(filePath).toLowerCase()],
            'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer',
            'Content-Security-Policy': "frame-ancestors 'none'; object-src 'none'; base-uri 'self'"
        });
        if (req.method === 'HEAD') res.end(); else fs.createReadStream(filePath).pipe(res);
    } catch { res.writeHead(400); res.end('Bad request'); }
});
server.listen(PORT, '127.0.0.1', () => console.log('App: http://localhost:' + PORT));
