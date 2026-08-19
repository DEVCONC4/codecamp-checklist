import { CAMP, STEPS, REQ, TOTAL, stepById, stepNumber } from './camp.js';
import { store, V, SH, doneCount, allDone, isFacilitator, setValue, setDone, addScreenshots, removeScreenshot } from './store.js';
import { $, $$, esc, toast, stampHTML, zoom } from './ui.js';
import { show } from './main.js';

let current = STEPS[0].id;
export const currentStep = () => current;
export function goTo(id) {
  current = id;
  renderAll();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function renderAll() {
  renderSidebar();
  renderStep();
  renderRail();
}

// Steps open in order: a step is shut while any required step before it is
// still unstamped. Optional steps never block anybody.
//
// A step that is already stamped is never shut, whatever sits behind it. That
// matters for accounts carrying stamps from before the order was enforced —
// locking their own finished work behind a preview would hide their answers.
export function blockerFor(id) {
  if (store.progress[id]?.done) return null;
  const i = STEPS.findIndex((s) => s.id === id);
  for (let k = 0; k < i; k++) {
    const s = STEPS[k];
    if (!s.optional && !store.progress[s.id]?.done) return s;
  }
  return null;
}

const hasContent = (s) =>
  SH(s.id).length || s.proofs.some((p) => p.type !== 'screenshot' && V(s.id, p.key));

const hold = (ms) =>
  new Promise((r) => setTimeout(r, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : ms));

export function renderRail() {
  $('#railFill').style.width = (doneCount() / TOTAL) * 100 + '%';
}

function renderSidebar() {
  $('#sidebar').innerHTML = CAMP.modules
    .map(
      (m) => `
    <div class="mod">
      <span class="eyebrow">${esc(m.title)}</span>
      ${m.steps
        .map((s) => {
          const S = stepById(s.id);
          const st = store.progress[s.id] || {};
          const shut = blockerFor(s.id);
          // Still clickable while shut: reading ahead is encouraged, submitting
          // ahead is not.
          const tip = shut ? ` title="Opens once step ${stepNumber(shut.id)} is stamped"` : '';
          return `<button class="snav ${st.done ? 'done' : ''} ${S.optional ? 'opt' : ''} ${shut ? 'shut' : ''}" data-go="${s.id}" aria-current="${current === s.id}"${tip}>
          <span class="dot">${st.done ? '✓' : S.optional ? '·' : stepNumber(s.id)}</span>
          <span>${esc(s.title)}</span></button>`;
        })
        .join('')}
    </div>`,
    )
    .join('');
  $$('#sidebar [data-go]').forEach((b) => b.addEventListener('click', () => goTo(b.dataset.go)));
}

function fieldHTML(s, p) {
  const v = store.progress[s.id]?.values?.[p.key] ?? '';
  const req = p.required ? '<span class="req">Required</span>' : '';
  const hint = p.hint ? `<div class="hint">${esc(p.hint)}</div>` : '';
  const id = `f-${s.id}-${p.key}`;

  if (p.type === 'screenshot') {
    const list = SH(s.id).filter((x) => x.key === p.key);
    return `<div class="field">
      <label>${esc(p.label)}${req}</label>
      <div class="drop" data-drop="${p.key}" tabindex="0" role="button">
        <div class="big">Paste, drop, or click to add a screenshot</div>
        <p>Press <span class="kbd">Ctrl</span> <span class="kbd">V</span> anywhere on this step — no need to save the file first</p>
      </div>
      <input type="file" accept="image/*" multiple hidden data-file="${p.key}">
      <div class="shots">${list
        .map(
          (x) => `
        <figure class="shot" data-zoom="${esc(x.url)}">
          <img src="${esc(x.url)}" alt=""><figcaption class="cap">${esc(x.name)}</figcaption>
          <button class="x" data-rm="${esc(x.id)}" title="Remove">×</button></figure>`,
        )
        .join('')}</div>
      ${hint}</div>`;
  }
  if (p.type === 'longtext') {
    return `<div class="field"><label for="${id}">${esc(p.label)}${req}</label>
      <textarea id="${id}" data-val="${p.key}" rows="3">${esc(v)}</textarea>${hint}</div>`;
  }
  if (p.type === 'choice') {
    return `<div class="field"><label for="${id}">${esc(p.label)}${req}</label>
      <select id="${id}" data-val="${p.key}"><option value="">Choose one…</option>
      ${p.options.map((o) => `<option ${v === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>${hint}</div>`;
  }
  return `<div class="field"><label for="${id}">${esc(p.label)}${req}</label>
    <input id="${id}" data-val="${p.key}" value="${esc(v)}">${hint}</div>`;
}

function missingFor(s) {
  return s.proofs.filter(
    (p) =>
      p.required &&
      (p.type === 'screenshot' ? !SH(s.id).some((x) => x.key === p.key) : !V(s.id, p.key)),
  );
}

// One button carries both jobs, so this gates moving on as well as stamping:
// unanswered required proofs mean the step doesn't advance.
function updateMissing(s) {
  const btn = $('#goBtn');
  const out = $('#missingOut');
  if (!btn) return;
  btn.textContent = goLabel(s);
  if (store.progress[s.id]?.done) {
    btn.disabled = false;
    out.textContent = '';
    return;
  }
  const miss = missingFor(s);
  btn.disabled = miss.length > 0;
  out.textContent = miss.length ? 'Still needed: ' + miss.map((p) => p.label.toLowerCase()).join(', ') : '';
}

// An optional step nobody filled in is skipped, not stamped — a stamp on an
// untouched step would be a lie about what was done.
function goLabel(s) {
  if (STEPS[STEPS.length - 1].id === s.id) return 'Finish →';
  return s.optional && !store.progress[s.id]?.done && !hasContent(s) ? 'Skip this step →' : 'Next step →';
}

function ledeHTML(s, shut) {
  if (shut) {
    return `A preview of what this step will ask for. It opens once step ${stepNumber(shut.id)} is stamped — nothing here saves until then.`;
  }
  const what = s.proofs.some((p) => p.type === 'screenshot')
    ? 'Attach what you’ve got and fill these in'
    : 'Fill these in — no screenshot needed for this one';
  const how = s.optional
    ? ''
    : ` <strong>${goLabel(s).replace(' →', '')}</strong> stamps the step for you — there is no box to tick yourself.`;
  return `${what}.${how} You can come back and edit any of this later.`;
}

function lockHTML(shut) {
  const n = stepNumber(shut.id);
  return `<div class="lockpanel">
    <div>
      <span class="eyebrow">Locked</span>
      <h3>Finish step ${n} first</h3>
      <p>Steps are stamped in order, so this one opens as soon as <strong>step ${n} · ${esc(shut.title)}</strong> is stamped. Read ahead as much as you like in the meantime.</p>
      <button class="btn btn-primary btn-sm" id="lockGo">Go to step ${n} →</button>
    </div>
  </div>`;
}

export function renderStep() {
  const s = stepById(current);
  const st = (store.progress[s.id] ||= { values: {}, done: false, doneAt: null });
  const num = s.optional ? '—' : stepNumber(s.id);
  const shut = blockerFor(s.id);

  $('#stepPane').innerHTML = `
    <div class="step-head">
      <div class="meta">
        <span class="eyebrow">${esc(s.module)}${s.optional ? '' : ` · Step ${num} of ${String(TOTAL).padStart(2, '0')}`}</span>
        <span class="pill">${s.minutes} min</span>
        ${s.optional ? '<span class="pill on-dash">Optional</span>' : ''}
        ${st.done ? '<span class="pill on-stamp">Verified</span>' : ''}
        ${shut ? '<span class="pill on-flag">Preview</span>' : ''}
      </div>
      <h2>${esc(s.title)}</h2>
    </div>
    <div class="prose">${s.body}</div>
    ${isFacilitator() && s.mentorNote ? `<div class="key"><span class="eyebrow">Facilitator note</span><p>${esc(s.mentorNote)}</p></div>` : ''}
    <section class="proof">
      <header><h3>Proof of work</h3><span class="eyebrow">${s.optional ? 'Optional' : 'Step ' + num}</span></header>
      <p class="lede">${ledeHTML(s, shut)}</p>
      <div class="shutwrap">
        <div class="prooffields"${shut ? ' inert' : ''}>
          ${s.proofs.map((p) => fieldHTML(s, p)).join('')}
        </div>
        ${shut ? lockHTML(shut) : ''}
      </div>
      ${shut ? '' : `<div class="actions">
        <button class="btn btn-primary" id="goBtn">${esc(goLabel(s))}</button>
        <span class="missing" id="missingOut"></span>
      </div>`}
      ${st.done ? `<div style="margin-top:22px;text-align:right">${stampHTML(num, st.doneAt)}</div>` : ''}
    </section>`;

  wireStep(s, shut);
  if (!shut) updateMissing(s);
}

function wireStep(s, shut) {
  // The prose is live either way — code blocks are for reading ahead with.
  $$('.copy').forEach((b) =>
    b.addEventListener('click', () =>
      navigator.clipboard.writeText(b.dataset.copy).then(() => {
        b.textContent = 'Copied';
        setTimeout(() => (b.textContent = 'Copy'), 1400);
      }),
    ),
  );

  if (shut) {
    $('#lockGo').addEventListener('click', () => goTo(shut.id));
    return;
  }

  $$('[data-val]').forEach((el) =>
    el.addEventListener('input', () => {
      setValue(s.id, el.dataset.val, el.value);
      updateMissing(s);
    }),
  );

  $$('[data-drop]').forEach((dz) => {
    const key = dz.dataset.drop;
    const input = document.querySelector(`[data-file="${key}"]`);
    dz.addEventListener('click', () => input.click());
    dz.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
    });
    input.addEventListener('change', () => upload(s, key, input.files));
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('over'));
    dz.addEventListener('drop', (e) => {
      e.preventDefault();
      dz.classList.remove('over');
      upload(s, key, e.dataTransfer.files);
    });
  });

  $$('[data-rm]').forEach((b) =>
    b.addEventListener('click', async (e) => {
      e.stopPropagation();
      await removeScreenshot(s.id, b.dataset.rm);
      renderStep();
    }),
  );

  $$('[data-zoom]').forEach((f) => f.addEventListener('click', () => zoom(f.dataset.zoom)));

  $('#goBtn').addEventListener('click', (ev) => proceed(s, ev.currentTarget));
}

// Moving on *is* the verification: the button only goes live once every required
// proof is in, and stamping is what it does. Nobody stamps their own step from a
// separate control, and nothing gets stamped that wasn't checked first.
let moving = false;

async function proceed(s, btn) {
  if (moving) return;
  const done = !!store.progress[s.id]?.done;
  if (!done && missingFor(s).length) {
    updateMissing(s);
    return;
  }

  const i = STEPS.findIndex((x) => x.id === s.id);
  const last = i === STEPS.length - 1;
  // Optional steps are skipped rather than stamped when nothing was submitted.
  const stamping = !done && (!s.optional || hasContent(s));

  moving = true;
  try {
    if (stamping) {
      btn.disabled = true;
      btn.textContent = 'Stamping…';
      await setDone(s.id, true);
      renderSidebar();
      renderRail();
      renderStep();
      const el = document.querySelector('.stamp');
      if (el) el.classList.add('press');
      // The stamp landing is the reward for the step; let it play before the
      // page moves out from under it. finish() carries its own message.
      if (!last) toast(allDone() ? "That's the last one — your project documentation is unlocked" : 'Step stamped — nice work');
      await hold(560);
    }
    if (last) finish();
    else goTo(STEPS[i + 1].id);
  } finally {
    moving = false;
  }
}

function finish() {
  show('record');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  toast(
    allDone()
      ? `All ${TOTAL} steps stamped — download your documentation or share it from here`
      : 'Everything you have submitted so far — your write-up unlocks once every step is stamped',
  );
}

async function upload(s, key, files) {
  const n = await addScreenshots(s.id, key, files);
  if (n) {
    renderStep();
    toast(n > 1 ? n + ' screenshots added' : 'Screenshot added');
  }
}

// Paste anywhere on the step. This is the biggest friction reduction in the
// app — it removes the save-file-then-browse detour entirely.
export function wireGlobalKeys() {
  document.addEventListener('paste', async (e) => {
    if ($('#app').hidden || $('#view-steps').hidden) return;
    const items = [...(e.clipboardData?.items || [])].filter((i) => i.type.startsWith('image/'));
    if (!items.length) return;
    e.preventDefault();
    const shut = blockerFor(current);
    if (shut) {
      toast(`Finish step ${stepNumber(shut.id)} first — this one is still a preview`);
      return;
    }
    const s = stepById(current);
    const sp = s.proofs.find((p) => p.type === 'screenshot');
    if (!sp) { toast("This step doesn't take screenshots"); return; }
    await upload(s, sp.key, items.map((i) => i.getAsFile()).filter(Boolean));
  });

  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input,textarea,select')) return;
    if ($('#app').hidden || $('#view-steps').hidden) return;
    const i = STEPS.findIndex((x) => x.id === current);
    if (e.key === 'ArrowRight' && i < STEPS.length - 1) goTo(STEPS[i + 1].id);
    if (e.key === 'ArrowLeft' && i > 0) goTo(STEPS[i - 1].id);
  });
}
