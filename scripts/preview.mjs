// 本機預覽 + 編輯：網站在 /，縮圖在 /t/，其餘照片在 /media/（讀取 output/，不需要上傳）
// 只監聽 127.0.0.1；相簿頁在本機會多出「編輯相簿」面板，儲存後寫回 albums.json 與相簿資料
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { SITE, SITE_DATA, OUTPUT, loadAlbums, saveAlbums, rebuildIndex } from './lib.mjs';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.zip': 'application/zip', '.svg': 'image/svg+xml' };
const PORT = Number(process.env.PORT) || 8787;

function saveAlbum(slug, f) {
  const albums = loadAlbums();
  const a = albums.find((x) => x.slug === slug);
  const mfile = path.join(SITE_DATA, `${slug}.json`);
  if (!a || !fs.existsSync(mfile)) throw new Error('找不到相簿');
  const m = JSON.parse(fs.readFileSync(mfile, 'utf8'));
  const patch = {};
  if (typeof f.title === 'string' && f.title.trim()) patch.title = f.title.trim().slice(0, 100);
  if (/^\d{4}-\d{2}-\d{2}$/.test(f.date || '')) patch.date = f.date;
  if (['public', 'private'].includes(f.visibility)) patch.visibility = f.visibility;
  if (m.photos.some((p) => p.name === f.cover)) patch.cover = f.cover;
  if (['frame', 'full'].includes(f.coverStyle)) patch.coverStyle = f.coverStyle;
  if (/^#[0-9a-f]{6}$/i.test(f.coverColor || '')) patch.coverColor = f.coverColor;
  if (Number.isFinite(f.coverPos)) patch.coverPos = Math.min(100, Math.max(0, Math.round(f.coverPos)));
  Object.assign(a, patch);
  Object.assign(m, patch);
  saveAlbums(albums);
  fs.writeFileSync(mfile, JSON.stringify(m));
  rebuildIndex();
  return patch;
}

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (req.method === 'POST' && u.pathname === '/api/album') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        const { slug, ...fields } = JSON.parse(body);
        const patch = saveAlbum(slug, fields);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, patch }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }
  let p = decodeURIComponent(u.pathname);
  let base = SITE;
  if (p.startsWith('/media/')) { base = OUTPUT; p = p.slice('/media'.length); }
  else if (p.startsWith('/t/')) { base = OUTPUT; const [, , slug, ...rest] = p.split('/'); p = `/${slug}/thumb/${rest.join('/')}`; }
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(base, p);
  if (!file.startsWith(base) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
  const headers = { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': fs.statSync(file).size, 'Cache-Control': 'no-cache' };
  if (/^\/[^/]+\/(original\/|[^/]+\.zip$)/.test(p) && base === OUTPUT) headers['Content-Disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(file))}`;
  res.writeHead(200, headers);
  fs.createReadStream(file).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log(`預覽中：http://localhost:${PORT}`));
