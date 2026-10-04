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

// 首頁只列出公開相簿（含封面尺寸，不必逐本讀取相簿資料）；私人相簿只能靠網址進入
export function rebuildIndex() {
  const pub = loadAlbums()
    .filter((a) => a.visibility === 'public')
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || (b.date || '').localeCompare(a.date || ''))
    .map((a) => {
      const m = JSON.parse(fs.readFileSync(path.join(SITE_DATA, `${a.slug}.json`), 'utf8'));
      const c = m.photos.find((p) => p.name === a.cover) || m.photos[0];
      return { slug: a.slug, title: a.title, date: a.date || '', count: m.count, coverBase: c.base, w: c.w, h: c.h, coverPos: a.coverPos ?? 50 };
    });
  fs.mkdirSync(SITE_DATA, { recursive: true });
  fs.writeFileSync(path.join(SITE_DATA, 'albums.json'), JSON.stringify(pub));
  const { siteName, tagline, contact, brandLine, about } = loadConfig();
  fs.writeFileSync(path.join(SITE_DATA, 'site.json'), JSON.stringify({ siteName, tagline, contact, brandLine, about: buildAbout(about) }));
}

// 自我介紹：整理連結格式；沒填的欄位不顯示。Instagram 可以只填帳號（例如 @abc 或 abc）
function buildAbout(a = {}) {
  const link = (v, base) => {
    v = (v || '').trim();
    if (!v) return '';
    if (/^https?:\/\//i.test(v)) return v;
    if (base) return base + v.replace(/^@/, '');
    return /\./.test(v) ? 'https://' + v : '';
  };
  const out = {
    name: (a.name || '').trim(), role: (a.role || '').trim(),
    // 空一行＝新段落；同一段內的換行會保留
    bio: (a.bio || '').split(/\n\s*\n/).map((t) => t.split('\n').map((x) => x.trim()).filter(Boolean).join('\n')).filter(Boolean),
    links: [
      ['官網', link(a.website)],
      ['Instagram', link(a.instagram, 'https://www.instagram.com/')],
      ['LINE', link(a.line)],
      ['部落格', link(a.medium, 'https://medium.com/@')],
      ['Email', (a.email || '').trim() ? 'mailto:' + a.email.trim() : ''],
    ].filter(([, href]) => href).map(([label, href]) => ({ label, href })),
    photo: fs.existsSync(path.join(SITE, 'about', 'photo.jpg')) ? 'about/photo.jpg' : '',
  };
  return out.bio.length || out.links.length || out.name ? out : null;
}
