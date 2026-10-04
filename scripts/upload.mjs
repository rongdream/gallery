// 把 output/ 內的照片與 ZIP 上傳到 Cloudflare R2（已上傳且大小相同的檔案會自動跳過）
import fs from 'node:fs';
import path from 'node:path';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { OUTPUT } from './lib.mjs';

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
  console.error('尚未設定 R2。請複製 .env.example 為 .env 並填入四個值（做法見 README.md）。');
  process.exit(1);
}
const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.tif': 'image/tiff', '.tiff': 'image/tiff', '.zip': 'application/zip' };

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.name.startsWith('.')) continue;
    if (e.isDirectory()) yield* walk(p);
    else yield p; // symlink（原檔）也會被當成檔案處理
  }
}

// 縮圖放在 GitHub Pages（有 CDN、比 r2.dev 快），不上傳到 R2
const files = [...walk(OUTPUT)].filter((p) => !p.includes(`${path.sep}thumb${path.sep}`)).map((p) => ({ p, key: path.relative(OUTPUT, p).split(path.sep).join('/'), size: fs.statSync(p).size }));
console.log(`共 ${files.length} 個檔案，檢查哪些需要上傳…`);

let up = 0, skip = 0, i = 0, bytes = 0;
async function work() {
  while (i < files.length) {
    const f = files[i++];
    try {
      const h = await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: f.key }));
      if (h.ContentLength === f.size) { skip++; continue; }
    } catch {}
    const isDownload = /\/original\//.test(f.key) || f.key.endsWith('.zip');
    const name = path.basename(f.p);
    await new Upload({
      client: s3,
      params: {
        Bucket: R2_BUCKET, Key: f.key, Body: fs.createReadStream(f.p),
        ContentType: TYPES[path.extname(f.p).toLowerCase()] || 'application/octet-stream',
        CacheControl: 'public, max-age=31536000, immutable',
        // 原檔與 ZIP：瀏覽器點下去直接下載，而不是在分頁開啟
        ...(isDownload && { ContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(name)}` }),
      },
      queueSize: 4, partSize: 16 * 1024 * 1024,
    }).done();
    up++; bytes += f.size;
    process.stdout.write(`\r已上傳 ${up} 個（${(bytes / 1048576).toFixed(0)}MB），跳過 ${skip} 個`);
  }
}
await Promise.all(Array.from({ length: 6 }, work));
console.log(`\n✔ 完成：上傳 ${up} 個，已存在而跳過 ${skip} 個`);
