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

// Screenshots are downscaled before upload: 1280px on the long edge at quality
// 0.72 keeps chat UIs and terminals legible while staying small enough that a
// room of thirty people doesn't balloon the storage bucket.
//
// WebP rather than JPEG at that same quality. Measured on camp-shaped captures
// — a terminal running ollama list, the app mid-answer, the project open in VS
// Code, a full screen with the wifi tray — it lands about 40% smaller for the
// same visible sharpness. That saving lands twice: once on the bucket, and
// again on the desk view, which refetches every thumbnail in the roster each
// time the four-hour signed URLs expire.
//
// The format is chosen, never assumed. Handed a mime type it can't write, a
// canvas silently encodes PNG instead — several times LARGER than the JPEG this
// replaces, which is the exact opposite of the point, and nothing would say so.
// Old laptops are the normal case at a camp, so ask what the canvas can
// actually produce and take JPEG when the answer is no.
let encoder = null;
function pickEncoder() {
  if (encoder) return encoder;
  encoder = 'image/jpeg';
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    if (c.toDataURL('image/webp').startsWith('data:image/webp')) encoder = 'image/webp';
  } catch { /* a canvas that won't encode at all leaves JPEG, and upload reports it */ }
  return encoder;
}

// The object key's extension has to follow the bytes actually produced, so the
// caller reads it from blob.type rather than assuming the format it asked for.
export const EXT = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };

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
        c.toBlob((b) => {
          if (import.meta.env.DEV) logRatio(c, b, q, file);
          res(b);
        }, pickEncoder(), q);
      };
      img.onerror = () => res(null);
      img.src = fr.result;
    };
    fr.onerror = () => res(null);
    fr.readAsDataURL(file);
  });
}

// Dev-only: the format switch was sized on synthetic screenshots, so print the
// real numbers for real uploads instead of trusting the estimate. Vite strips
// this from the production bundle, so a camp laptop never pays for the second
// encode. Reads 0% smaller when the fallback is in play — that is the signal
// that this browser couldn't write WebP.
function logRatio(canvas, blob, q, file) {
  canvas.toBlob((jpg) => {
    if (!blob || !jpg) return;
    const kb = (b) => (b.size / 1024).toFixed(0);
    console.log(
      `[shrink] ${file?.name || 'pasted'} ${canvas.width}x${canvas.height} — `
      + `${blob.type} ${kb(blob)} KB vs image/jpeg ${kb(jpg)} KB `
      + `(${(100 * (1 - blob.size / jpg.size)).toFixed(0)}% smaller)`,
    );
  }, 'image/jpeg', q);
}

export const blobToDataURL = (blob) =>
  new Promise((res) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = () => res(null);
    fr.readAsDataURL(blob);
  });
