// 只在本機編輯模式載入（雙擊「開啟編輯.command」）。不會被發佈到網站上。
window.initAdmin = ({ slug, getAlbum, reload, closeLb, getCur }) => {
  const st = document.createElement('style');
  st.textContent = `
  #adm-bar{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:70;display:flex;align-items:center;gap:6px;background:#2b2926;color:#fff;padding:8px 10px 8px 16px;box-shadow:0 10px 36px rgba(0,0,0,.3);font:.85rem/1 -apple-system,"PingFang TC",sans-serif;max-width:calc(100vw - 20px)}
  #adm-bar .lab{margin-right:8px;color:#e0b98a;white-space:nowrap}
  #adm-bar button{background:#fff;color:#2b2926;border:0;padding:10px 14px;font:inherit;cursor:pointer;white-space:nowrap}
  #adm-bar button:hover{background:#f0e6d8}
  #adm-bar button.go{background:#c4742b;color:#fff}#adm-bar button.go:hover{background:#d8853a}
  #adm-bar button.off{background:#555;color:#ddd}
  #adm{position:fixed;left:50%;bottom:78px;transform:translateX(-50%);z-index:70;width:340px;max-height:calc(100vh - 120px);overflow:auto;background:#fff;border:1px solid #ddd;box-shadow:0 14px 50px rgba(0,0,0,.25);padding:18px;display:none;font:.85rem/1.5 -apple-system,"PingFang TC",sans-serif;color:#2b2926}
  #adm.open{display:block}
  #adm h3{margin:0 0 4px;font-size:.95rem}
  #adm label{display:block;margin:14px 0 4px;font-size:.78rem;color:#8a847c}
  #adm input[type=text],#adm input[type=date],#adm select{width:100%;padding:8px;border:1px solid #ccc;font:inherit}
  #adm input[type=color]{width:56px;height:34px;border:1px solid #ccc;padding:2px;background:#fff}
  #adm input[type=range]{width:100%}
  #adm .row{display:flex;gap:8px;align-items:center}
  .pickmode .it::after{content:"設為封面";position:absolute;inset:0;display:grid;place-items:center;background:rgba(196,116,43,.55);color:#fff;font:600 1rem -apple-system,"PingFang TC",sans-serif;letter-spacing:.1em;opacity:0;transition:opacity .15s}
  .pickmode .it:hover::after{opacity:1}`;
  document.head.append(st);

  const bar = document.createElement('div');
  bar.id = 'adm-bar';
  bar.innerHTML = `<span class="lab">✎ 編輯模式（只有你看得到）</span>
    <button id="b-pick">① 換封面照片</button>
    <button id="b-set">② 封面樣式／標題</button>
    <button id="b-pub" class="go">③ 發佈到網站</button>`;
  document.body.append(bar);

  const panel = document.createElement('div');
  panel.id = 'adm';
  panel.innerHTML = `<h3>封面樣式／標題</h3>
    <label>標題</label><input type="text" id="a-title">
    <label>日期</label><input type="date" id="a-date">
    <label>這本相簿要不要出現在首頁的相簿清單？</label><select id="a-vis"><option value="public">要（公開）</option><option value="private">不要（只有拿到網址的人看得到）</option></select>
    <label>封面樣式</label><select id="a-style"><option value="frame">置中小照片（像 Pic-Time）</option><option value="full">整張照片滿版</option></select>
    <label>封面背景顏色（置中小照片樣式用）</label><div class="row"><input type="color" id="a-color"></div>
    <label>滿版時照片的上下位置 <span id="a-posv"></span></label><input type="range" id="a-pos" min="0" max="100">`;
  document.body.append(panel);

  const $a = (id) => document.getElementById(id);
  const fill = () => {
    const m = getAlbum();
    $a('a-title').value = m.title; $a('a-date').value = m.date; $a('a-vis').value = m.visibility;
    $a('a-style').value = m.coverStyle || 'frame'; $a('a-color').value = m.coverColor || '#54493c';
    $a('a-pos').value = m.coverPos ?? 50; $a('a-posv').textContent = (m.coverPos ?? 50) + '%';
  };
  fill();

  async function post(path, body) {
    return fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());
  }
  async function save(patch, msg = '已儲存（還沒發佈，按③才會更新網站）') {
    const r = await post('/api/album', { slug, ...patch });
    if (!r.ok) return toast('儲存失敗：' + r.error);
    await reload(); fill(); toast(msg);
  }
  $a('a-title').onchange = (e) => save({ title: e.target.value });
  $a('a-date').onchange = (e) => save({ date: e.target.value });
  $a('a-vis').onchange = (e) => save({ visibility: e.target.value });
  $a('a-style').onchange = (e) => save({ coverStyle: e.target.value });
  $a('a-color').onchange = (e) => save({ coverColor: e.target.value });
  $a('a-pos').oninput = (e) => ($a('a-posv').textContent = e.target.value + '%');
  $a('a-pos').onchange = (e) => save({ coverPos: Number(e.target.value) });

  // ① 換封面照片：點一下相簿裡的照片就設定好
  const stopPick = () => { window.pickCover = null; document.body.classList.remove('pickmode'); $a('b-pick').textContent = '① 換封面照片'; $a('b-pick').classList.remove('off'); };
  const setCover = async (p) => { stopPick(); await save({ cover: p.name }, '封面已更換（還沒發佈，按③才會更新網站）'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  $a('b-pick').onclick = () => {
    if (window.pickCover) return stopPick();
    panel.classList.remove('open');
    window.pickCover = async (i) => { const photos = (await fetch(`data/${slug}.json`).then((r) => r.json())).photos; setCover(photos[i]); };
    document.body.classList.add('pickmode');
    $a('b-pick').textContent = '取消（請往下點選一張照片）'; $a('b-pick').classList.add('off');
    document.getElementById('grid').scrollIntoView({ behavior: 'smooth' });
    toast('請點一張照片，它就會變成封面');
  };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && window.pickCover) stopPick(); });
  const sc = document.getElementById('setCover');
  if (sc) sc.onclick = async () => { const p = getCur(); closeLb(); await setCover(p); };

  // ② 樣式面板
  $a('b-set').onclick = () => { stopPick(); panel.classList.toggle('open'); };

  // ③ 發佈
  $a('b-pub').onclick = async () => {
    if (!confirm('要把目前的修改發佈到網站嗎？\n（約 1 分鐘後，大家看到的網站就會更新）')) return;
    const b = $a('b-pub'); b.textContent = '發佈中…請稍候'; b.disabled = true;
    try {
      const r = await post('/api/publish', {});
      toast(r.ok ? '✔ ' + r.msg : '發佈失敗：' + r.error);
    } catch { toast('發佈失敗，請確認編輯模式視窗還開著'); }
    b.textContent = '③ 發佈到網站'; b.disabled = false;
  };
};
