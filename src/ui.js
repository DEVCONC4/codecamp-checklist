export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const slug = (s) =>
  String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'participant';

export function pill(msg) {
  const el = $('#savePill');
  if (el) el.textContent = msg;
}

export function toast(msg) {
  $$('.toast').forEach((t) => t.remove());
  const d = document.createElement('div');
  d.className = 'toast';
  d.textContent = msg;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 2800);
}

export function saved() {
  pill('Saved ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
}

// The signature element: a rotated viridian rubber stamp carrying the step
// number and the moment it was earned.
export function stampHTML(num, ts) {
  const d = new Date(ts || Date.now());
  const when =
    d.toLocaleDateString([], { day: '2-digit', month: 'short' }).toUpperCase() +
    ' · ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `<span class="stamp"><span class="l1">VERIFIED</span><span class="l2">STEP ${num} · ${when}</span></span>`;
}

export function zoom(src) {
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.innerHTML = `<img src="${esc(src)}" alt="">`;
  // One close path for both ways out, so the keydown listener is always
  // unbound. Removing it only on the Escape branch leaked a document-level
  // listener every time a lightbox was dismissed by clicking instead.
  const close = () => {
    lb.remove();
    document.removeEventListener('keydown', onKey);
  };
  function onKey(ev) {
    if (ev.key === 'Escape') close();
  }
  lb.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  document.body.appendChild(lb);
}

export function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// Screenshots are downscaled before upload: 1280px on the long edge at JPEG
// 0.72 keeps chat UIs and terminals legible while staying small enough that a
// room of thirty people doesn't balloon the storage bucket.
export function shrink(file, max = 1280, q = 0.72) {
  return new Promise((res) => {
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const sc = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * sc);
        c.height = Math.round(img.height * sc);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob((b) => res(b), 'image/jpeg', q);
      };
      img.onerror = () => res(null);
      img.src = fr.result;
    };
    fr.onerror = () => res(null);
    fr.readAsDataURL(file);
  });
}

export const blobToDataURL = (blob) =>
  new Promise((res) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = () => res(null);
    fr.readAsDataURL(blob);
  });
