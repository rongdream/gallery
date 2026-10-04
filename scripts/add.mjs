// 新增（或更新）一本相簿：壓縮網頁版/縮圖、打包 ZIP、產生相簿資料
// 用法：npm run add -- "<照片資料夾>" --title "相簿標題" [--slug abc] [--private] [--date 2026-02-01] [--cover 檔名] [--zip-original]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { ZipArchive } from 'archiver';
import { ROOT, OUTPUT, SITE_DATA, loadAlbums, saveAlbums, rebuildIndex, loadConfig } from './lib.mjs';

const args = process.argv.slice(2);
const flags = {};
const positional = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a.startsWith('--')) {
    const key = a.slice(2);
    const next = args[i + 1];
    if (next === undefined || next.startsWith('--')) flags[key] = true;
    else { flags[key] = next; i++; }
  } else positional.push(a);
}

const src = positional[0] && path.resolve(positional[0]);
if (!src || !fs.existsSync(src) || !fs.statSync(src).isDirectory()) {
  console.error('請提供照片資料夾，例如：\n  npm run add -- "/路徑/我的相簿" --title "相簿標題" --slug my-album');
  process.exit(1);
}

const cfg = loadConfig();
const IMG = /\.(jpe?g|png|tiff?|webp)$/i;
const natural = new Intl.Collator('zh-Hant', { numeric: true });

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (IMG.test(e.name)) out.push(p);
  }
  return out;
}

const files = walk(src).sort((a, b) => natural.compare(path.basename(a), path.basename(b)));
if (!files.length) { console.error('資料夾內找不到照片（支援 jpg / png / tiff / webp）'); process.exit(1); }
const seen = new Set();
for (const f of files) {
  const n = path.basename(f);
  if (seen.has(n)) { console.error(`檔名重複：${n}（不同子資料夾內有同名檔案，請先改名）`); process.exit(1); }
  seen.add(n);
}

const folderName = path.basename(src);
const isPrivate = !!flags.private;
const albums = loadAlbums();
// 以來源資料夾辨識既有相簿，重跑時沿用同一個網址
const existing = albums.find((a) => a.source === src);
const slug = flags.slug || existing?.slug || (isPrivate ? crypto.randomBytes(6).toString('hex') : 'album-' + crypto.randomBytes(3).toString('hex'));
if (!/^[a-z0-9][a-z0-9-]*$/i.test(slug)) { console.error('--slug 只能用英文、數字與減號'); process.exit(1); }
const dm = folderName.match(/^(\d{4})(\d{2})(\d{2})/);
const date = flags.date || existing?.date || (dm ? `${dm[1]}-${dm[2]}-${dm[3]}` : new Date(fs.statSync(files[0]).mtime).toISOString().slice(0, 10));
const title = flags.title || existing?.title || folderName;

const outDir = path.join(OUTPUT, slug);
const webDir = path.join(outDir, 'web');
const thumbDir = path.join(outDir, 'thumb');
const viewDir = path.join(outDir, 'view');
const origDir = path.join(outDir, 'original');
for (const d of [webDir, thumbDir, viewDir, origDir, SITE_DATA]) fs.mkdirSync(d, { recursive: true });

const { webLongEdge, webQuality, thumbWidth, viewLongEdge, viewQuality } = cfg.images;
const baseOf = (f) => path.basename(f, path.extname(f));

async function processOne(file) {
  const base = baseOf(file);
  const webPath = path.join(webDir, base + '.jpg');
  const thumbPath = path.join(thumbDir, base + '.webp');
  const viewPath = path.join(viewDir, base + '.webp');
  const link = path.join(origDir, path.basename(file));
  const srcMtime = fs.statSync(file).mtimeMs;
  const fresh = (p) => fs.existsSync(p) && fs.statSync(p).mtimeMs >= srcMtime;

  if (!fresh(webPath)) {
    await sharp(file).rotate().resize({ width: webLongEdge, height: webLongEdge, fit: 'inside', withoutEnlargement: true })
      .toColourspace('srgb').jpeg({ quality: webQuality, mozjpeg: true }).toFile(webPath);
  }
  if (!fresh(viewPath)) {
    await sharp(webPath).resize({ width: viewLongEdge, height: viewLongEdge, fit: 'inside', withoutEnlargement: true }).webp({ quality: viewQuality }).toFile(viewPath);
  }
  if (!fresh(thumbPath)) {
    await sharp(webPath).resize({ width: thumbWidth, withoutEnlargement: true }).webp({ quality: 72 }).toFile(thumbPath);
  }
  try { fs.unlinkSync(link); } catch {}
  fs.symlinkSync(file, link);

  const meta = await sharp(webPath).metadata();
  return {
    name: path.basename(file),
    base,
    w: meta.width,
    h: meta.height,
    webSize: fs.statSync(webPath).size,
    origSize: fs.statSync(file).size,
  };
}

// 簡單的並行處理池
const photos = new Array(files.length);
let next = 0, done = 0;
const t0 = Date.now();
async function worker() {
  while (next < files.length) {
    const i = next++;
    photos[i] = await processOne(files[i]);
    done++;
    if (done % 20 === 0 || done === files.length) process.stdout.write(`\r壓縮中 ${done}/${files.length}`);
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
console.log(`\n壓縮完成，用時 ${((Date.now() - t0) / 1000).toFixed(0)} 秒`);

// ZIP（照片本身已是 JPEG，用 store 不再壓縮，速度快）
function zipTo(zipPath, entries) {
  return new Promise((resolve, reject) => {
    const out = fs.createWriteStream(zipPath);
    const ar = new ZipArchive({ store: true, zip64: true });
    out.on('close', resolve);
    ar.on('error', reject);
    ar.pipe(out);
    for (const e of entries) ar.file(e.path, { name: e.name });
    ar.finalize();
  });
}

const zips = {};
const webZip = path.join(outDir, `${slug}-web.zip`);
console.log('打包小檔 ZIP …');
await zipTo(webZip, photos.map((p) => ({ path: path.join(webDir, p.base + '.jpg'), name: p.base + '.jpg' })));
zips.web = { file: path.basename(webZip), size: fs.statSync(webZip).size };

const origZip = path.join(outDir, `${slug}-original.zip`);
if (flags['zip-original']) {
  console.log('打包原檔 ZIP（檔案大，需要一點時間）…');
  await zipTo(origZip, photos.map((p) => ({ path: path.join(origDir, p.name), name: p.name })));
  zips.original = { file: path.basename(origZip), size: fs.statSync(origZip).size };
} else if (fs.existsSync(origZip)) {
  zips.original = { file: path.basename(origZip), size: fs.statSync(origZip).size };
}

let cover = flags.cover || existing?.cover || photos[0].name;
if (!photos.some((p) => p.name === cover)) cover = photos[0].name;

const visibility = flags.private ? 'private' : (existing?.visibility || 'public');
const entry = {
  slug, title, date, visibility, cover,
  coverStyle: flags['cover-style'] || existing?.coverStyle || 'frame',
  coverColor: flags['cover-color'] || existing?.coverColor || cfg.coverColor,
  coverPos: existing?.coverPos ?? 50,
  source: src,
};
const manifest = { ...entry, count: photos.length, zips, photos: photos.map(({ name, base, w, h, origSize, webSize }) => ({ name, base, w, h, origSize, webSize })) };
delete manifest.source;
fs.writeFileSync(path.join(SITE_DATA, `${slug}.json`), JSON.stringify(manifest));

const idx = albums.findIndex((a) => a.slug === slug);
if (idx >= 0) albums[idx] = entry; else albums.push(entry);
saveAlbums(albums);
rebuildIndex();

const mb = (n) => (n / 1048576).toFixed(0) + 'MB';
const totalWeb = photos.reduce((s, p) => s + p.webSize, 0);
const totalOrig = photos.reduce((s, p) => s + p.origSize, 0);
console.log(`\n✔ 相簿「${title}」已建立`);
console.log(`  網址代號：${slug}（${visibility === 'private' ? '私人，不會出現在首頁' : '公開，會出現在首頁'}）`);
console.log(`  ${photos.length} 張；小檔平均 ${(totalWeb / photos.length / 1024).toFixed(0)}KB（共 ${mb(totalWeb)}），原檔共 ${mb(totalOrig)}`);
console.log(`\n本機預覽：npm run preview，然後開 http://localhost:8787/album.html?a=${slug}`);
