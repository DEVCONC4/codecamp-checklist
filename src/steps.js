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
          return `<button class="snav ${st.done ? 'done' : ''} ${S.optional ? 'opt' : ''}" data-go="${s.id}" aria-current="${current === s.id}">
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

function updateMissing(s) {
  const btn = $('#doneBtn');
  const out = $('#missingOut');
  if (!btn) return;
  if (store.progress[s.id]?.done) {
    btn.disabled = false;
    out.textContent = '';
    return;
  }
  const miss = missingFor(s);
  btn.disabled = miss.length > 0;
  out.textContent = miss.length ? 'Still needed: ' + miss.map((p) => p.label.toLowerCase()).join(', ') : '';
}

export function renderStep() {
  const s = stepById(current);
  const st = (store.progress[s.id] ||= { values: {}, done: false, doneAt: null });
  const num = s.optional ? '—' : stepNumber(s.id);
  const i = STEPS.findIndex((x) => x.id === current);

  $('#stepPane').innerHTML = `
    <div class="step-head">
      <div class="meta">
        <span class="eyebrow">${esc(s.module)}${s.optional ? '' : ` · Step ${num} of ${String(TOTAL).padStart(2, '0')}`}</span>
        <span class="pill">${s.minutes} min</span>
        ${s.optional ? '<span class="pill on-dash">Optional</span>' : ''}
        ${st.done ? '<span class="pill on-stamp">Verified</span>' : ''}
      </div>
      <h2>${esc(s.title)}</h2>
    </div>
    <div class="prose">${s.body}</div>
    ${isFacilitator() && s.mentorNote ? `<div class="key"><span class="eyebrow">Facilitator note</span><p>${esc(s.mentorNote)}</p></div>` : ''}
    <section class="proof">
      <header><h3>Proof of work</h3><span class="eyebrow">${s.optional ? 'Optional' : 'Step ' + num}</span></header>
      <p class="lede">${
        s.proofs.some((p) => p.type === 'screenshot')
          ? 'Attach what you’ve got, then stamp the step.'
          : 'Fill these in, then stamp the step — no screenshot needed for this one.'
      } You can come back and edit any of this later.</p>
      ${s.proofs.map((p) => fieldHTML(s, p)).join('')}
      <div class="actions">
        <button class="btn btn-primary" id="doneBtn">${st.done ? 'Unstamp this step' : 'Stamp complete'}</button>
        ${i < STEPS.length - 1
          ? '<button class="btn btn-ghost" id="nextBtn">Next step →</button>'
          : `<button class="btn ${allDone() ? 'btn-primary' : 'btn-ghost'}" id="finishBtn">Finish →</button>`}
        <span class="missing" id="missingOut"></span>
      </div>
      ${st.done ? `<div style="margin-top:22px;text-align:right">${stampHTML(num, st.doneAt)}</div>` : ''}
    </section>`;

  wireStep(s);
  updateMissing(s);
}

function wireStep(s) {
  $$('.copy').forEach((b) =>
    b.addEventListener('click', () =>
      navigator.clipboard.writeText(b.dataset.copy).then(() => {
        b.textContent = 'Copied';
        setTimeout(() => (b.textContent = 'Copy'), 1400);
      }),
    ),
  );

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

  $('#doneBtn').addEventListener('click', async () => {
    const next = !store.progress[s.id]?.done;
    await setDone(s.id, next);
    renderSidebar();
    renderRail();
    renderStep();
    if (next) {
      const el = document.querySelector('.stamp');
      if (el) el.classList.add('press');
      toast(allDone() ? "That's the last one — your project documentation is unlocked" : 'Step stamped — nice work');
    }
  });

  // The last step ends nowhere useful, so it hands over to My project — where
  // the documentation, the share sheet and the progress report all live.
  const fb = $('#finishBtn');
  if (fb) fb.addEventListener('click', finish);

  const nb = $('#nextBtn');
  if (nb) {
    nb.addEventListener('click', () => {
      const i = STEPS.findIndex((x) => x.id === current);
      goTo(STEPS[Math.min(i + 1, STEPS.length - 1)].id);
    });
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
