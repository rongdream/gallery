# 攝影相簿網站

網站放在 **GitHub Pages**（免費、不需網域），照片放在 **Cloudflare R2**（便宜、下載流量免費）。

```
你的照片資料夾 ──npm run add──▶ output/（小檔、縮圖、ZIP）──npm run upload──▶ R2
                                  site/data/（相簿資料）──npm run deploy──▶ docs/ ──git push──▶ GitHub Pages
```

## 日常流程（設定完成後）

```bash
# 1. 新增相簿（公開，會出現在首頁作品集）
npm run add -- "/路徑/我的相簿資料夾" --title "相簿標題" --slug my-album

# 客戶專用相簿（不出現在首頁；沒給 --slug 會自動產生一串亂碼網址）
npm run add -- "/路徑/客戶資料夾" --title "王小明 婚禮" --private

# 想附上「原檔整包 ZIP」（檔案大、打包較久）加 --zip-original
# 想指定封面加 --cover "檔名.jpg"；指定日期加 --date 2026-02-01

# 2. 本機先看看效果（不用上傳）
npm run preview        # 開 http://localhost:8787

# 3. 上傳照片並更新網站
npm run upload         # 傳到 R2，已傳過的會自動跳過
npm run deploy         # 打包網站到 docs/
git add -A && git commit -m "新增相簿" && git push
```

網址格式：`https://<你的帳號>.github.io/<repo名稱>/album.html?a=<slug>`

## 一次性設定

### A. Cloudflare R2（存照片）
1. 註冊 https://dash.cloudflare.com ，左側選 **R2 Object Storage**，開通（需綁信用卡，10GB 內免費）。
2. **Create bucket**，名稱例如 `photos`。
3. 進入 bucket → **Settings** → **Public Development URL** → Enable。取得 `https://pub-xxxx.r2.dev`，填進 `.env` 的 `MEDIA_BASE_URL`。
4. 同一頁 **CORS Policy** → 貼上下面內容（讓網頁能「下載小檔」）：
   ```json
   [{ "AllowedOrigins": ["https://<你的帳號>.github.io", "http://localhost:8787"], "AllowedMethods": ["GET", "HEAD"], "AllowedHeaders": ["*"] }]
   ```
5. R2 首頁右側 **Manage API Tokens** → Create API token → 權限選 **Object Read & Write**，限定這個 bucket。把 Account ID、Access Key ID、Secret Access Key 填進 `.env`（複製 `.env.example`）。**這些金鑰只放在你自己電腦的 `.env`，不要貼給任何人。**

> `r2.dev` 網址是 Cloudflare 提供給測試用的，有流量上限。作品集正式推廣、流量變大時，建議之後綁網域（`R2 → Custom Domains`），網站程式不用改，只要換 `MEDIA_BASE_URL`。

### B. GitHub Pages（放網站）
1. 在 GitHub 建一個新 repo（Public，免費 Pages 需要）。
2. 在本資料夾：`git init && git add -A && git commit -m "init"`，再依 GitHub 頁面指示 `git remote add origin ...` 與 `git push -u origin main`。
3. repo → **Settings → Pages** → Source 選 **Deploy from a branch**，Branch 選 `main`，資料夾選 **/docs**。

## 要知道的事
- **私人相簿的保護只靠「猜不到的網址」**。repo 是公開的，別人理論上能在 repo 裡看到相簿資料檔，所以真正敏感的案子請謹慎；需要密碼保護或完全隱藏時，之後可改用 Cloudflare Pages + Access。
- 原始照片資料夾（`20*/`）已被 `.gitignore` 排除，不會進 git。
- 小檔規格在 `config.json`（長邊 2048px、JPEG 品質 82，約 200–500KB），改了之後重跑 `npm run add` 即可（需刪除 `output/<slug>/web` 才會重壓）。
