// One share sheet instead of a LinkedIn-shaped button.
//
// Two things travel together: the post text, and the project documentation
// itself. Where the browser supports sharing files, both go out in a single
// native share. Everywhere else the text lands on the clipboard, the file lands
// in Downloads, and the platform's own composer opens ready to paste and attach
// — which is the only way to get a file onto LinkedIn or Facebook from a web
// page anyway, since neither accepts an attachment through a share URL.
//
// The file is therefore built the moment the sheet opens, not when a platform is
// picked. Inlining a dozen screenshots takes seconds, and both navigator.share
// and window.open need to be called while the click that triggered them is still
// counted as user activation — build first, and every tile stays instant.
import { CAMP } from './camp.js';
import { store, V } from './store.js';
import { buildDoc, sharePost } from './doc.js';
import { $, $$, esc, toast, download, slug } from './ui.js';

// X still counts to 280. Everything else takes the post whole.
const X_LIMIT = 275;

const PLATFORMS = [
  {
    id: 'linkedin',
    label: 'LinkedIn',
    note: 'Opens the composer with your post in it',
    href: (text) => 'https://www.linkedin.com/feed/?shareActive=true&text=' + encodeURIComponent(text),
  },
  {
    id: 'facebook',
    label: 'Facebook',
    note: 'Needs your live link',
    needsUrl: true,
    href: (text, url) =>
      'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url) + '&quote=' + encodeURIComponent(text),
  },
  {
    id: 'x',
    label: 'X',
    note: 'Trimmed to fit 280 characters',
    href: (text) => 'https://x.com/intent/post?text=' + encodeURIComponent(fit(text, X_LIMIT)),
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    note: 'Send it to a chat or a group',
    href: (text) => 'https://wa.me/?text=' + encodeURIComponent(text),
  },
  {
    id: 'email',
    label: 'Email',
    note: 'Opens your mail app — attach the file there',
    self: true,
    href: (text) => 'mailto:?subject=' + encodeURIComponent(subject()) + '&body=' + encodeURIComponent(text),
  },
];

const aiName = () => V('h3a', 'ainame') || '';
const liveUrl = () => V('h4b', 'liveurl') || V('h4a', 'repo') || '';
const subject = () => `${aiName() || 'My AI'} — built at ${CAMP.title}`;
const docName = () => `${slug(aiName() || store.profile.name)}-project-documentation.html`;

// Whole words where possible: a post cut mid-word reads like a bug.
function fit(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const stop = cut.lastIndexOf(' ');
  return (stop > max * 0.6 ? cut.slice(0, stop) : cut) + '…';
}

// Feature-detected with a throwaway file: browsers that support navigator.share
// for text alone still refuse files, and there is no way to ask but to ask.
function canShareFile() {
  try {
    return !!navigator.canShare?.({ files: [new File([''], 'x.html', { type: 'text/html' })] });
  } catch {
    return false;
  }
}

// Rebuilt for every opening of the sheet: answers and screenshots change
// between one share and the next, and a cached file would go out stale.
let file = null;
let onDisk = false;

export function openShare() {
  file = null;
  onDisk = false;

  const withFiles = canShareFile();
  const el = document.createElement('div');
  el.className = 'sheet';
  el.innerHTML = `<div class="sheet-in" role="dialog" aria-modal="true" aria-labelledby="shareTitle">
    <button class="sheet-x" id="shareClose" title="Close" aria-label="Close">×</button>
    <span class="eyebrow">Share your project</span>
    <h3 id="shareTitle">Your post, with the documentation attached</h3>
    <p class="sheet-lede">Edit the words if you like. Wherever you post it, your documentation goes with it — ${
      withFiles
        ? 'attached to the post itself on <strong>Share…</strong>, and saved to your Downloads for any platform you pick below, since LinkedIn and Facebook can only take an attachment from your own machine.'
        : 'saved to your Downloads the moment you pick a platform, because LinkedIn and Facebook can only take an attachment from your own machine.'
    }</p>

    <div class="field">
      <label for="sharePostText">Your post</label>
      <textarea id="sharePostText" rows="10"></textarea>
    </div>

    <div class="sharefile" id="shareFile">
      <div class="grow">
        <span class="eyebrow">Attachment</span>
        <strong class="mono" id="shareFileName"></strong>
        <small id="shareFileState">Building the file — inlining your screenshots…</small>
      </div>
      <button class="btn btn-sm" id="shareDl" disabled>Download</button>
    </div>

    <span class="eyebrow shareto">Post it to</span>
    <div class="sharegrid">${PLATFORMS.map(
      (p) =>
        `<button class="stile" data-p="${p.id}" disabled><strong>${esc(p.label)}</strong><small>${esc(p.note)}</small></button>`,
    ).join('')}</div>

    <div class="sheet-foot">
      ${withFiles ? '<button class="btn btn-primary" id="shareNative" disabled>Share…</button>' : ''}
      <button class="btn" id="shareCopy">Copy post</button>
      <span class="sp"></span>
      <button class="btn btn-ghost btn-sm" id="shareDone">Close</button>
    </div>
  </div>`;

  document.body.appendChild(el);
  $('#sharePostText', el).value = sharePost();
  $('#shareFileName', el).textContent = docName();

  const close = () => {
    el.remove();
    document.removeEventListener('keydown', onKey);
  };
  function onKey(ev) {
    if (ev.key === 'Escape') close();
  }
  document.addEventListener('keydown', onKey);
  el.addEventListener('click', (ev) => {
    if (ev.target === el) close();
  });
  $('#shareClose', el).addEventListener('click', close);
  $('#shareDone', el).addEventListener('click', close);

  const text = () => $('#sharePostText', el).value.trim();

  $('#shareCopy', el).addEventListener('click', () => copy(text()));

  $('#shareDl', el).addEventListener('click', () => {
    save();
    toast('Documentation saved to your Downloads — attach it to your post');
  });

  const nat = $('#shareNative', el);
  if (nat) nat.addEventListener('click', () => nativeShare(text()));

  $$('.stile', el).forEach((b) =>
    b.addEventListener('click', () => openOn(PLATFORMS.find((x) => x.id === b.dataset.p), text())),
  );

  $('#sharePostText', el).focus();
  prepare(el);
}

// Everything that hands over the file waits on this; the post text and the copy
// button don't, so there is something to do while it builds.
async function prepare(el) {
  const state = $('#shareFileState', el);
  try {
    const html = await buildDoc();
    file = new File([html], docName(), { type: 'text/html' });
  } catch (e) {
    state.textContent = "Couldn't build the file: " + (e.message || 'unknown error');
    $('#shareFile', el).classList.add('bad');
    return;
  }
  // The sheet can be closed mid-build, and a stale node is harmless to skip.
  if (!el.isConnected) return;
  state.textContent = `Ready · ${Math.max(1, Math.round(file.size / 1024))} KB · your choices, answers and screenshots`;
  $$('.stile, #shareDl, #shareNative', el).forEach((b) => (b.disabled = false));
}

function copy(text) {
  return navigator.clipboard
    .writeText(text)
    .then(() => toast('Post copied — paste it into the composer'))
    .catch(() => toast("Couldn't reach the clipboard — select the text and copy it by hand"));
}

// Once per sheet, however many platforms get tried — nobody wants five copies
// of the same write-up in their Downloads folder.
function save() {
  download(file, file.name);
  onDisk = true;
}

// Deliberately synchronous: clipboard first, while this document still has
// focus; the composer last, so window.open is still inside the click.
function openOn(p, text) {
  const url = liveUrl();
  if (p.needsUrl && !url) {
    toast(`${p.label} shares a link, and you haven't added one yet — put your Vercel URL in the deploy step`);
    return;
  }
  navigator.clipboard.writeText(text).catch(() => {});
  if (!onDisk) save();
  const href = p.href(text, url);
  if (p.self) window.location.href = href;
  else window.open(href, '_blank', 'noopener,noreferrer');
  toast(`Post copied, documentation saved — paste it into ${p.label} and attach the file`);
}

function nativeShare(text) {
  navigator.share({ title: subject(), text, files: [file] }).catch((e) => {
    // Cancelling is not an error, and some targets refuse files outright — in
    // which case the clipboard-and-Downloads route still gets them there.
    if (e?.name === 'AbortError') return;
    if (!onDisk) save();
    navigator.clipboard.writeText(text).catch(() => {});
    toast('That app would not take the file — post copied and documentation saved instead');
  });
}
