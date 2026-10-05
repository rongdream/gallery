const MEDIA = (window.GALLERY && window.GALLERY.media) || '/media';
const enc = encodeURIComponent;
// 縮圖在 GitHub Pages（t/），其餘在 R2（MEDIA）。路徑用相對網址，所以放在任何子路徑都能用
const url = {
  thumb: (s, base) => `t/${s}/${enc(base)}.webp`,
  view: (s, base) => `${MEDIA}/${s}/view/${enc(base)}.webp`,
  web: (s, base) => `${MEDIA}/${s}/web/${enc(base)}.jpg`,
  orig: (s, name) => `${MEDIA}/${s}/original/${enc(name)}`,
  zip: (s, f) => `${MEDIA}/${s}/${enc(f)}`,
};
const $ = (id) => document.getElementById(id);
const fmtSize = (n) => n >= 1073741824 ? (n / 1073741824).toFixed(1) + ' GB' : (n / 1048576).toFixed(0) + ' MB';
const fmtDate = (d) => d.replaceAll('-', '.');
const getJSON = (p) => fetch(p).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
const ICON = {
  share: '<svg viewBox="0 0 24 24"><path d="M14 4l7 7-7 7M21 11H9a6 6 0 00-6 6v1"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M12 4v11M7 11l5 5 5-5M5 20h14"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19"/></svg>',
  prev: '<svg viewBox="0 0 24 24"><path d="M15 4l-8 8 8 8"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M9 4l8 8-8 8"/></svg>',
};
function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.append(t); }
  t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2400);
}
// 頂端列。active: 'albums'；tools: 額外放在右側的 HTML
function renderBar(site, { active = 'albums', tools = '' } = {}) {
  document.body.insertAdjacentHTML('afterbegin', `<header class="bar">
    <a class="brand" href="./">${site.brandLine || 'PHOTOS BY'}<b></b></a>
    <nav><a href="./" class="${active === 'albums' ? 'on' : ''}">相簿</a></nav>
    <div class="tools">${tools}<button class="ic" id="shareBtn" title="分享連結">${ICON.share}</button></div></header>`);
  document.querySelector('.brand b').textContent = site.siteName;
  $('shareBtn').onclick = async () => {
    try { if (navigator.share) { await navigator.share({ title: document.title, url: location.href }); return; } } catch { return; }
    try { await navigator.clipboard.writeText(location.href); toast('已複製連結'); } catch { toast(location.href); }
  };
}

// 自我介紹區塊（放在每本相簿最下方，也用在 about.html）。沒有填內容就不顯示
function aboutHTML(site, { page = false } = {}) {
  const a = site.about;
  if (!a) return '';
  const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  return `<section class="about${page ? ' page' : ''}">
    <div class="about-in">
      ${a.photo ? `<img class="ap" src="${a.photo}" alt="${esc(a.name || '')}">` : ''}
      <div class="at">
        <div class="ak">ABOUT</div>
        ${a.name ? `<h2>${esc(a.name)}</h2>` : ''}
        ${a.role ? `<div class="ar">${esc(a.role)}</div>` : ''}
        ${a.bio.map((t) => `<p>${esc(t).replace(/\n/g, '<br>')}</p>`).join('')}
        ${a.links.length ? `<div class="al">${a.links.map((l) => `<a href="${l.href}" target="_blank" rel="noopener">${l.label}</a>`).join('')}</div>` : ''}
      </div>
    </div></section>`;
}
