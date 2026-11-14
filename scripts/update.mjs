// 互動式「新增／更新相簿」：列出 原檔/ 裡的資料夾，選一個，問幾個問題，然後自動
// 壓縮 → 上傳 R2 → 更新網站 → 推上 GitHub，最後印出網址。
// 用法：雙擊「新增或更新相簿.command」（--dry 只印出會執行的指令，不真的做）
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline/promises';
import { spawnSync } from 'node:child_process';
import { ROOT, SITE_DATA, loadAlbums } from './lib.mjs';

const DRY = process.argv.includes('--dry');
const SRC_ROOT = process.env.GALLERY_SRC_ROOT || path.join(ROOT, '原檔');
const BASE_URL = 'https://rongdream.github.io/gallery/';
const IMG = /\.(jpe?g|png|tiff?|webp)$/i;
const rl = readline.createInterface({ input: process.stdin });
const lines = rl[Symbol.asyncIterator]();
const ask = async (q, def = '') => {
  process.stdout.write(q);
  const { value, done } = await lines.next();
  if (done) process.stdout.write('\n');
  return ((done ? '' : value).trim() || def);
};

const listImages = (dir) => {
  const out = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else if (IMG.test(e.name)) out.push(e.name);
  } };
  walk(dir);
  return out;
};

function run(cmd, args) {
  console.log('\n▶ ' + [cmd, ...args].join(' '));
  if (DRY) return;
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) { console.error('\n✖ 這一步失敗了，已停止，沒有繼續往下做。請把上面的錯誤訊息貼給 Claude。'); process.exit(1); }
}

// ── 掃描資料夾 ──
if (!fs.existsSync(SRC_ROOT)) { console.error('找不到資料夾：' + SRC_ROOT); process.exit(1); }
const albums = loadAlbums();
const folders = fs.readdirSync(SRC_ROOT, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => {
  const dir = path.join(SRC_ROOT, e.name);
  const files = listImages(dir);
  const album = albums.find((a) => a.source === dir);
  let status = '🆕 還沒上架';
  if (album) {
    const mf = path.join(SITE_DATA, `${album.slug}.json`);
    const have = new Set(fs.existsSync(mf) ? JSON.parse(fs.readFileSync(mf, 'utf8')).photos.map((p) => p.name) : []);
    const added = files.filter((f) => !have.has(f)).length;
    const removed = [...have].filter((n) => !files.includes(n)).length;
    status = added || removed ? `✏️ 有變動（新增 ${added} 張${removed ? `、少了 ${removed} 張` : ''}）` : `✅ 已上架（${files.length} 張）`;
  }
  return { name: e.name, dir, files, album, status };
}).filter((f) => f.files.length);

console.log('\n=== 新增／更新相簿 ===\n');
if (!folders.length) { console.log('原檔/ 裡沒有放照片的資料夾。請先把照片資料夾放進 原檔/ 。'); rl.close(); process.exit(0); }
folders.forEach((f, i) => console.log(`${String(i + 1).padStart(2)}. ${f.name}\n     ${f.status}${f.album ? `　→ ${f.album.title}` : ''}`));
const pick = parseInt(await ask('\n請輸入要處理的資料夾編號（直接按 Enter 離開）：'), 10);
const f = folders[pick - 1];
if (!f) { console.log('沒有選擇，結束。'); rl.close(); process.exit(0); }

const args = ['scripts/add.mjs', f.dir];
let slug, kind;
if (f.album) {
  // ── 更新既有相簿：沿用標題、網址、封面與設定，只更新照片 ──
  slug = f.album.slug;
  const m = JSON.parse(fs.readFileSync(path.join(SITE_DATA, `${slug}.json`), 'utf8'));
  args.push('--slug', slug);
  if (m.zips && m.zips.original) args.push('--zip-original'); // 有原檔 ZIP 的相簿，更新時一併重新打包
  console.log(`\n將更新相簿「${f.album.title}」，標題、網址、封面都維持不變。`);
} else {
  // ── 新相簿 ──
  console.log(`\n新相簿：${f.name}（${f.files.length} 張）\n`);
  const title = await ask('相簿標題（會顯示在網站上）：', f.name);
  console.log('\n這本相簿是哪一種？\n  1. 作品集：公開，會出現在首頁，不開放下載（不上傳原檔）\n  2. 活動／客戶相簿：不出現在首頁，只有拿到網址的人看得到，開放下載（含原檔）');
  kind = (await ask('請輸入 1 或 2：', '1')) === '2' ? 'client' : 'portfolio';
  let s = (await ask('網址代號（英文、數字、減號；可直接按 Enter 自動產生）：')).toLowerCase();
  if (s && !/^[a-z0-9][a-z0-9-]*$/.test(s)) { console.error('代號只能用英文、數字與減號。'); process.exit(1); }
  if (!s) s = (kind === 'client' ? '' : 'album-') + crypto.randomBytes(kind === 'client' ? 6 : 3).toString('hex');
  if (albums.some((a) => a.slug === s)) { console.error(`代號 ${s} 已經被使用，請換一個。`); process.exit(1); }
  slug = s;
  args.push('--title', title, '--slug', slug);
  if (kind === 'client') args.push('--private', '--download', '--zip-original');
  else {
    const order = Math.max(0, ...albums.filter((a) => a.visibility === 'public').map((a) => a.order ?? 0)) + 1;
    args.push('--no-download', '--date', 'none', '--order', String(order));
  }
}

const go = (await ask('\n確認開始？處理完會直接上傳並發佈到網站。(y/N)：')).toLowerCase();
if (go !== 'y') { console.log('已取消，什麼都沒有做。'); rl.close(); process.exit(0); }
rl.close();

run('node', args);
run('node', ['--env-file=.env', 'scripts/upload.mjs']);
run('node', ['--env-file=.env', 'scripts/deploy.mjs']);
run('git', ['add', '-A']);
const st = DRY ? { stdout: 'x' } : spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8' });
if (st.stdout.trim()) { run('git', ['commit', '-m', f.album ? `更新相簿：${f.album.title}` : `新增相簿：${slug}`]); run('git', ['push']); }
else console.log('\n沒有需要發佈的變動。');

console.log(`\n✔ 完成！約 1 分鐘後網站更新。\n\n這本相簿的網址：\n  ${BASE_URL}album.html?a=${slug}\n`);
if (!f.album) console.log('想換封面或調整焦點：雙擊「開啟編輯.command」，進入這本相簿，用編輯列修改，再按「④ 發佈到網站」。\n如果看到舊畫面，請按 Cmd+Shift+R。');
