// 只在本機預覽（npm run preview）載入：編輯相簿封面、標題等。不會被發佈到網站上。
window.initAdmin = ({ slug, getAlbum, reload, closeLb, getCur }) => {
  const st = document.createElement('style');
  st.textContent = `
  #adm-btn{position:fixed;right:18px;bottom:18px;z-index:70;background:#c4742b;color:#fff;border:0;padding:12px 18px;font:500 .85rem/1 Jost,sans-serif;letter-spacing:.1em;cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,.25)}
  #adm{position:fixed;right:18px;bottom:70px;z-index:70;width:310px;max-height:calc(100vh - 100px);overflow:auto;background:#fff;border:1px solid #ddd;box-shadow:0 14px 50px rgba(0,0,0,.25);padding:18px;display:none;font:.85rem/1.5 -apple-system,"PingFang TC",sans-serif;color:#2b2926}
  #adm.open{display:block}
  #adm h3{margin:0 0 4px;font-size:.95rem}#adm small{color:#8a847c;display:block;margin-bottom:14px}
  #adm label{display:block;margin:12px 0 4px;font-size:.75rem;color:#8a847c;letter-spacing:.06em}
  #adm input[type=text],#adm input[type=date],#adm select{width:100%;padding:8px;border:1px solid #ccc;font:inherit}
  #adm input[type=color]{width:56px;height:34px;border:1px solid #ccc;padding:2px;background:#fff}
  #adm input[type=range]{width:100%}
  #adm .row{display:flex;gap:8px;align-items:center}
  #adm button.b{width:100%;margin-top:14px;padding:10px;border:1px solid #2b2926;background:#fff;cursor:pointer;font:inherit}
  #adm button.b.on{background:#c4742b;border-color:#c4742b;color:#fff}
  #adm .note{margin-top:12px;font-size:.75rem;color:#8a847c}`;
  document.head.append(st);

  const a = getAlbum();
  const panel = document.createElement('div');
  panel.id = 'adm';
  panel.innerHTML = `<h3>編輯相簿（只有你在本機看得到）</h3><small>改完自動儲存。要上線請執行 deploy 並 git push。</small>
    <label>標題</label><input type="text" id="a-title">
    <label>日期</label><input type="date" id="a-date">
    <label>可見度</label><select id="a-vis"><option value="public">公開（出現在相簿清單）</option><option value="private">私人（只有知道網址的人）</option></select>
    <label>封面樣式</label><select id="a-style"><option value="frame">框式（置中照片＋標題，像 Pic-Time）</option><option value="full">滿版照片</option></select>
    <label>封面背景色</label><div class="row"><input type="color" id="a-color"><span id="a-colorv"></span></div>
    <label>滿版封面的垂直位置 <span id="a-posv"></span></label><input type="range" id="a-pos" min="0" max="100">
    <button class="b" id="a-pick">選擇封面照片：點這裡，再點相簿中的照片</button>
    <div class="note">也可以在照片放大後按「★ 設為封面」。</div>`;
  document.body.append(panel);
  const btn = document.createElement('button');
  btn.id = 'adm-btn'; btn.textContent = '✎ 編輯相簿';
  btn.onclick = () => panel.classList.toggle('open');
  document.body.append(btn);

  const $a = (id) => document.getElementById(id);
  const fill = () => {
    const m = getAlbum();
    $a('a-title').value = m.title; $a('a-date').value = m.date; $a('a-vis').value = m.visibility;
    $a('a-style').value = m.coverStyle || 'frame'; $a('a-color').value = m.coverColor || '#54493c';
    $a('a-colorv').textContent = m.coverColor || ''; $a('a-pos').value = m.coverPos ?? 50; $a('a-posv').textContent = (m.coverPos ?? 50) + '%';
  };
  fill();

  async function save(patch, msg = '已儲存') {
    const r = await fetch('/api/album', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug, ...patch }) }).then((r) => r.json());
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

  const setCover = async (p) => {
    await save({ cover: p.name }, '已設為封面');
    window.pickCover = null; document.body.classList.remove('pickmode'); $a('a-pick').classList.remove('on');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  $a('a-pick').onclick = () => {
    const on = !window.pickCover;
    if (on) {
      
      window.pickCover = async (i) => { const photos = (await fetch(`data/${slug}.json`).then((r) => r.json())).photos; setCover(photos[i]); };
      document.body.classList.add('pickmode'); $a('a-pick').classList.add('on'); toast('請點選要當封面的照片');
    } else { window.pickCover = null; document.body.classList.remove('pickmode'); $a('a-pick').classList.remove('on'); }
  };
  const sc = document.getElementById('setCover');
  if (sc) sc.onclick = async () => { const p = getCur(); closeLb(); await setCover(p); };
};
