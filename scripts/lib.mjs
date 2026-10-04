import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const OUTPUT = path.join(ROOT, 'output');
export const SITE = path.join(ROOT, 'site');
export const SITE_DATA = path.join(SITE, 'data');
const ALBUMS_FILE = path.join(ROOT, 'albums.json');

export function loadConfig() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));
}

export function loadAlbums() {
  return fs.existsSync(ALBUMS_FILE) ? JSON.parse(fs.readFileSync(ALBUMS_FILE, 'utf8')) : [];
}

export function saveAlbums(list) {
  fs.writeFileSync(ALBUMS_FILE, JSON.stringify(list, null, 2));
}

// 首頁只列出公開相簿；私人相簿只能靠網址進入
export function rebuildIndex() {
  const pub = loadAlbums()
    .filter((a) => a.visibility === 'public')
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(({ slug, title, date, cover }) => ({ slug, title, date, cover }));
  fs.mkdirSync(SITE_DATA, { recursive: true });
  fs.writeFileSync(path.join(SITE_DATA, 'albums.json'), JSON.stringify(pub));
  const { siteName, tagline, contact } = loadConfig();
  fs.writeFileSync(path.join(SITE_DATA, 'site.json'), JSON.stringify({ siteName, tagline, contact }));
}
