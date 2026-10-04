// 本機預覽：網站在 /，照片在 /media/（讀取 output/，不需要上傳）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { SITE, OUTPUT } from './lib.mjs';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.zip': 'application/zip', '.svg': 'image/svg+xml' };
const PORT = Number(process.env.PORT) || 8787;

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const base = p.startsWith('/media/') ? OUTPUT : SITE;
  if (base === OUTPUT) p = p.slice('/media'.length);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(base, p);
  if (!file.startsWith(base) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
  const headers = { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': fs.statSync(file).size };
  if (base === OUTPUT && /\/(original\/|[^/]+\.zip$)/.test(p)) headers['Content-Disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(file))}`;
  res.writeHead(200, headers);
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`預覽中：http://localhost:${PORT}`));
