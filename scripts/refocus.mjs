// 重新自動偵測所有相簿封面的焦點：npm run refocus（會覆蓋你手動調整的焦點，只想改單一相簿請用編輯模式）
import fs from 'node:fs';
import path from 'node:path';
import { OUTPUT, SITE_DATA, loadAlbums, saveAlbums, rebuildIndex, autoFocus } from './lib.mjs';

const only = process.argv[2];
const albums = loadAlbums();
for (const a of albums) {
  if (only && a.slug !== only) continue;
  const mfile = path.join(SITE_DATA, `${a.slug}.json`);
  const m = JSON.parse(fs.readFileSync(mfile, 'utf8'));
  const c = m.photos.find((p) => p.name === a.cover) || m.photos[0];
  const f = await autoFocus(path.join(OUTPUT, a.slug, 'web', c.base + '.jpg'));
  a.coverX = m.coverX = f.x; a.coverPos = m.coverPos = f.y;
  fs.writeFileSync(mfile, JSON.stringify(m));
  console.log(`${a.slug}: 焦點 ${f.x}% / ${f.y}%`);
}
saveAlbums(albums);
rebuildIndex();
