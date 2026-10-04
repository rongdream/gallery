// 把網站打包到 docs/（GitHub Pages 從這個資料夾發佈），並換上正式的照片網址
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, SITE, OUTPUT, rebuildIndex, loadAlbums } from './lib.mjs';

const media = (process.env.MEDIA_BASE_URL || '').replace(/\/$/, '');
if (!media) {
  console.error('尚未設定 MEDIA_BASE_URL（R2 的公開網址）。請在 .env 填入，做法見 README.md。');
  process.exit(1);
}
rebuildIndex();
const dest = path.join(ROOT, 'docs');
fs.rmSync(dest, { recursive: true, force: true });
fs.cpSync(SITE, dest, { recursive: true, filter: (p) => !p.endsWith('admin.js') });
// 縮圖隨網站一起發佈到 GitHub Pages：docs/t/<相簿>/<檔名>.webp
for (const a of loadAlbums()) fs.cpSync(path.join(OUTPUT, a.slug, 'thumb'), path.join(dest, 't', a.slug), { recursive: true });
fs.writeFileSync(path.join(dest, 'config.js'), `window.GALLERY = { media: ${JSON.stringify(media)} };\n`);
fs.writeFileSync(path.join(dest, '.nojekyll'), '');
console.log('✔ 網站已打包到 docs/ 。接著 git add / commit / push 就會更新 GitHub Pages。');
