import { STEPS, REQ, TOTAL, stepNumber } from './camp.js';
import { store, V, SH, doneCount, allDone } from './store.js';
import { $, $$, esc, toast, stampHTML, zoom, download, slug } from './ui.js';
import { buildDoc, buildProgress, linkedInPost } from './doc.js';
import { goTo, renderAll } from './steps.js';
import { show } from './main.js';

export function renderRecord() {
  const done = doneCount();
  const left = REQ.filter((s) => !store.progress[s.id]?.done);

  $('#unlockOut').innerHTML = allDone()
    ? `<div class="unlocked">
        <div class="grow">
          <span class="eyebrow" style="color:var(--stamp)">Unlocked</span>
          <h3>Your project documentation is ready</h3>
          <p>A write-up of what you built, why you made the choices you made, and what you learned — with your screenshots throughout. Share it, print it, put it in your portfolio.</p>
        </div>
        <div class="btns">
          <button class="btn btn-primary" id="dlDoc">Download documentation</button>
          <button class="btn" id="copyPost">Copy post for LinkedIn</button>
        </div>
      </div>`
    : `<div class="locked">
        <span class="eyebrow">Locked</span>
        <h3>${TOTAL - done} step${TOTAL - done === 1 ? '' : 's'} to go</h3>
        <p>Your project documentation is generated from everything you submit today, so it unlocks once all ${TOTAL} required steps are stamped. Keep going — your answers below are already saved.</p>
        <div class="togo">${left
          .map((s) => `<button data-jump="${s.id}">${stepNumber(s.id)} · ${esc(s.title)}</button>`)
          .join('')}</div>
      </div>`;

  const rows = REQ.concat(STEPS.filter((s) => s.optional))
    .map((s) => {
      const st = store.progress[s.id] || {};
      const n = s.optional ? '—' : stepNumber(s.id);
      const ans = s.proofs.filter((p) => p.type !== 'screenshot' && V(s.id, p.key));
      const pics = SH(s.id);
      return `<div class="rrow">
        <div class="num">${n}</div>
        <div>
          <h4>${esc(s.title)}</h4>
          ${ans.length
            ? `<dl class="answers">${ans.map((p) => `<dt>${esc(p.label)}</dt><dd>${esc(V(s.id, p.key))}</dd>`).join('')}</dl>`
            : '<p class="nowt">Nothing submitted yet</p>'}
          ${pics.length ? `<div class="rshots">${pics.map((x) => `<img src="${esc(x.url)}" data-zoom="${esc(x.url)}" alt="">`).join('')}</div>` : ''}
        </div>
        <div class="rstamp">${st.done ? stampHTML(n, st.doneAt) : '<span class="pill">Not stamped</span>'}</div>
      </div>`;
    })
    .join('');

  $('#recordOut').innerHTML = `<div class="record">
    <span class="eyebrow">Submitted so far</span>
    <h2 style="font-size:24px;margin:6px 0 4px">${esc(store.profile.name)}</h2>
    <p class="mono" style="font-size:12px;color:var(--ink-soft);margin:0">${esc(store.profile.os || '')} · ${done} of ${TOTAL} steps stamped</p>
    <div class="sendrow">
      <button class="btn btn-ghost btn-sm" id="dlProgress">Download progress report</button>
      <span>Everything below in one file, finished or not${allDone() ? '' : ` — your project write-up is separate and unlocks at ${TOTAL}/${TOTAL}`}.</span>
    </div>
    <div>${rows}</div></div>`;

  $$('#unlockOut [data-jump]').forEach((b) =>
    b.addEventListener('click', () => {
      show('steps');
      goTo(b.dataset.jump);
    }),
  );
  $$('#recordOut [data-zoom]').forEach((el) => el.addEventListener('click', () => zoom(el.dataset.zoom)));

  const dp = $('#dlProgress');
  if (dp) dp.addEventListener('click', () => grab(dp, buildProgress, `${slug(store.profile.name)}-progress-${done}-of-${TOTAL}.html`, 'Progress report downloaded'));

  const dd = $('#dlDoc');
  if (dd) dd.addEventListener('click', () => grab(dd, buildDoc, `${slug(V('h3a', 'ainame') || store.profile.name)}-project-documentation.html`, 'Downloaded — keep a copy for your portfolio'));

  const cp = $('#copyPost');
  if (cp) {
    cp.addEventListener('click', () =>
      navigator.clipboard
        .writeText(linkedInPost())
        .then(() => toast('Post copied — paste it straight into LinkedIn'))
        .catch(() => toast("Couldn't reach the clipboard — try the download instead")),
    );
  }
}

// Building an export pulls every screenshot back down to inline it, so the
// button has to say it's working rather than look dead for a few seconds.
async function grab(btn, build, filename, msg) {
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Preparing…';
  try {
    const html = await build();
    download(new Blob([html], { type: 'text/html' }), filename);
    toast(msg);
  } catch (e) {
    toast("Couldn't build the file: " + (e.message || 'unknown error'));
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}
