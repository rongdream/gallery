// 設定自我介紹的照片：npm run about -- "/路徑/我的照片.jpg"（或放照片的資料夾，會用裡面第一張）
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { SITE, rebuildIndex } from './lib.mjs';

let src = process.argv[2] && path.resolve(process.argv[2]);
if (!src || !fs.existsSync(src)) { console.error('請提供照片或資料夾路徑'); process.exit(1); }
if (fs.statSync(src).isDirectory()) {
  const imgs = fs.readdirSync(src).filter((f) => /\.(jpe?g|png|webp|tiff?)$/i.test(f) && !f.startsWith('.')).sort();
  if (!imgs.length) { console.error('資料夾內找不到照片'); process.exit(1); }
  if (imgs.length > 1) console.log(`資料夾內有 ${imgs.length} 張，使用第一張：${imgs[0]}\n（想用別張請直接指定檔案路徑）`);
  src = path.join(src, imgs[0]);
}
fs.mkdirSync(path.join(SITE, 'about'), { recursive: true });
await sharp(src).rotate().resize({ width: 1000, height: 1250, fit: 'inside', withoutEnlargement: true }).toColourspace('srgb').jpeg({ quality: 84, mozjpeg: true }).toFile(path.join(SITE, 'about', 'photo.jpg'));
rebuildIndex();
console.log('✔ 已更新自我介紹照片 → site/about/photo.jpg');
