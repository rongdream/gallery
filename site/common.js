const MEDIA = (window.GALLERY && window.GALLERY.media) || '/media';
const enc = encodeURIComponent;
const url = {
  web: (s, p) => `${MEDIA}/${s}/web/${enc(p.base)}.jpg`,
  thumb: (s, p) => `${MEDIA}/${s}/thumb/${enc(p.base)}.webp`,
  orig: (s, p) => `${MEDIA}/${s}/original/${enc(p.name)}`,
  zip: (s, f) => `${MEDIA}/${s}/${enc(f)}`,
};
const fmtSize = (n) => n >= 1073741824 ? (n / 1073741824).toFixed(1) + ' GB' : (n / 1048576).toFixed(0) + ' MB';
const fmtDate = (d) => d.replaceAll('-', '.');
const getJSON = (p) => fetch(p).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.append(t); }
  t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 2200);
}
