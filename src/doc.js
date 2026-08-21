// The two things a participant can take away.
//
// buildDoc      — a portfolio write-up. Editorial, public, feedback withheld.
// buildProgress — a working record for the facilitator. Always available, so
//                 nobody who stalls in Sprint 2 leaves with nothing to hand in.
//
// They differ in type, not in palette: both run the DEVCON 17 three-colour
// system on white, and the write-up simply takes the larger display setting,
// because it is an editorial piece rather than a working record.
import { CAMP, STEPS, REQ, TOTAL, PRIVATE, stepById, stepNumber } from './camp.js';
import { store, V, SH, doneCount, allDone, inlineShots } from './store.js';
import { esc } from './ui.js';

const FONTS =
  '<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">';

async function allInlined() {
  const out = {};
  for (const s of STEPS) out[s.id] = SH(s.id).length ? await inlineShots(s.id) : [];
  return out;
}

export async function buildDoc() {
  const me = store.profile;
  const pics = await allInlined();
  const ai = V('h3a', 'ainame') || 'My AI';
  const blurb = V('h3a', 'blurb');
  const model = V('p1', 'model') || V('h2d', 'selected') || V('h2c', 'selected') || 'an open-source model';
  const lang = V('h3b', 'lang') || 'English';
  const file = V('h3c', 'file');
  const live = V('h4b', 'liveurl');
  const repo = V('h4a', 'repo') || V('h1b', 'forkurl');
  const gh = V('p3', 'gh');
  const date = new Date().toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });

  const link = (u, l) => (u ? `<a class="lk" href="${esc(u)}" target="_blank" rel="noopener">${l} <span>↗</span></a>` : '');
  const facts = [
    ['Model', model],
    ['Runs on', 'Ollama, locally on my ' + (me.os || 'machine')],
    ['Replies in', lang],
    ['Grounded on', file || 'the bundled reference document'],
    ['Deployed with', 'Vercel'],
    ['Built at', `${CAMP.title} · ${CAMP.event} · ${CAMP.date}`],
  ];
  const decision = (label, title, bodyHtml) =>
    bodyHtml ? `<div class="dec"><span class="lbl">${label}</span><h3>${title}</h3>${bodyHtml}</div>` : '';

  const walk = CAMP.modules
    .map((m) => {
      const inner = m.steps
        .filter((s) => !PRIVATE.includes(s.id))
        .map((s) => {
          const ans = s.proofs.filter((p) => p.type !== 'screenshot' && V(s.id, p.key));
          const shots = pics[s.id] || [];
          if (!ans.length && !shots.length) return '';
          return `<div class="stp">
            <h4>${esc(s.title)}</h4>
            ${ans.map((p) => `<p class="an"><span>${esc(p.label)}</span>${esc(V(s.id, p.key))}</p>`).join('')}
            ${shots.length ? `<div class="figs">${shots.map((x) => `<figure><img src="${x.data}" alt="${esc(x.name)}"></figure>`).join('')}</div>` : ''}
          </div>`;
        })
        .join('');
      return inner ? `<section class="mod"><span class="lbl">${esc(m.title)}</span>${inner}</section>` : '';
    })
    .join('');

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(ai)} — built by ${esc(me.name)}</title>
${FONTS}
<style>
:root{--ink:#1C0F4A;--soft:#574C7A;--faint:#8981A8;--rule:#E4DDF5;--panel:#F6F3FD;
--stamp:#4725BA;--gold:#E8CA04;--tint:#EDE7FB;
--grad:linear-gradient(90deg,#4725BA 0%,#8A4FD0 55%,#E8CA04 100%);
--sparkg:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 0L14.3 9.7 24 12 14.3 14.3 12 24 9.7 14.3 0 12 9.7 9.7Z' fill='%23E8CA04'/%3E%3C/svg%3E");
--d:'Montserrat',system-ui,sans-serif;--b:'Inter',system-ui,sans-serif;--m:'JetBrains Mono',monospace}
*{box-sizing:border-box}
body{margin:0;background-color:#fff;background-image:radial-gradient(760px 420px at 4% -6%,rgba(71,37,186,.05),transparent 68%),radial-gradient(640px 360px at 99% 1%,rgba(232,202,4,.045),transparent 70%);background-repeat:no-repeat;background-attachment:fixed;color:var(--ink);font-family:var(--b);font-size:17px;line-height:1.65}
.page{max-width:820px;margin:0 auto;padding:64px 26px 80px}
h1,h2,h3,h4{font-family:var(--d);font-weight:800;letter-spacing:-.02em;line-height:.95;margin:0}
.lbl{font-family:var(--d);font-size:10px;font-weight:800;letter-spacing:.13em;text-transform:uppercase;color:var(--faint);display:block}
header.hero{position:relative;padding-bottom:34px;margin-bottom:38px;border-bottom:1px solid var(--rule);background-image:var(--sparkg);background-position:right 4px top 0;background-size:26px 26px;background-repeat:no-repeat}
header.hero h1{font-size:56px;line-height:.92;color:var(--stamp);margin:14px 0 0}
header.hero h1::after{content:"";display:block;width:64px;height:5px;border-radius:999px;background:var(--grad);margin:22px 0 20px}
header.hero .tag{font-size:20px;color:var(--soft);margin:0 0 24px;max-width:36ch}
.by{font-family:var(--d);font-size:11px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--soft)}
.links{display:flex;gap:10px;flex-wrap:wrap;margin-top:24px}
.lk{font-family:var(--d);font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;
 text-decoration:none;color:#fff;background:var(--ink);padding:12px 20px;border-radius:999px;display:inline-block}
.lk span{opacity:.6}
.lk:nth-child(1){background:var(--stamp)}
section{margin:46px 0}
section>h2{font-size:11px;font-family:var(--d);font-weight:800;letter-spacing:.14em;text-transform:uppercase;
 color:var(--stamp);margin-bottom:18px}
p{margin:0 0 16px}
.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;margin-top:26px}
.facts div{background:var(--panel);border-radius:16px;padding:16px 18px}
.facts dt{font-family:var(--d);font-size:9px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--faint)}
.facts dd{margin:5px 0 0;font-size:16.5px;font-weight:500}
.dec{background:var(--panel);border-radius:18px;padding:22px 24px;margin-bottom:32px}
.dec h3{font-size:23px;margin:6px 0 12px}
.dec blockquote{margin:0;padding:16px 18px;background:#fff;border-radius:12px;font-size:16.5px;white-space:pre-wrap}
.mod{margin-bottom:42px}
.mod>.lbl{color:var(--stamp);padding-bottom:10px;margin-bottom:20px;border-bottom:1px solid var(--rule)}
.stp{margin-bottom:32px}
.stp h4{font-size:19px;margin-bottom:11px}
.an{font-size:16px;margin:0 0 11px;white-space:pre-wrap}
.an span{display:block;font-family:var(--d);font-size:9px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:var(--faint);margin-bottom:3px}
.figs{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin-top:15px}
.figs img{width:100%;border-radius:12px;display:block}
footer{border-top:1px solid var(--rule);margin-top:56px;padding-top:28px;display:flex;gap:24px;align-items:center;flex-wrap:wrap}
footer .grow{flex:1;min-width:220px}
/* One colour. A seal is pressed in a single ink. */
.stamp{display:inline-block;border:2px solid var(--stamp);color:var(--stamp);border-radius:14px;padding:10px 16px;
 transform:rotate(-3deg);font-family:var(--d);text-align:center}
.stamp b{display:block;font-size:14px;font-weight:800;letter-spacing:.18em}
.stamp i{display:block;font-family:var(--m);font-size:8.5px;letter-spacing:.1em;font-style:normal;border-top:1px solid currentColor;margin-top:5px;padding-top:5px;opacity:.75}
ul.refs{padding-left:20px;margin:0}
ul.refs li{margin-bottom:7px;font-size:16px}
@media print{body{background:#fff}header.hero{background-image:none}.page{padding:0}.lk{background:none!important;color:var(--ink);padding:0;text-decoration:underline}}
@media (max-width:640px){header.hero h1{font-size:38px}.page{padding:38px 18px 60px}}
</style></head><body><div class="page">

<header class="hero">
  <span class="lbl">${esc(CAMP.title)} · Project documentation</span>
  <h1>${esc(ai)}</h1>
  <p class="tag">A private AI that runs on my own computer — built, customized and deployed in three hours.</p>
  <div class="by">${esc(me.name)}${gh ? ' · @' + esc(gh) : ''} · ${esc(date)}</div>
  <div class="links">${link(live, 'Live site')}${link(repo, 'Source code')}</div>
</header>

<section>
  <h2>Overview</h2>
  <p>${blurb ? `<strong>${esc(ai)}</strong> — ${esc(blurb)}</p>
  <p>It` : `<strong>${esc(ai)}</strong> is a chat AI that`} runs entirely on my own machine. No cloud, no subscription, no data leaving the room. I picked an open-source model and ran it locally with Ollama, gave it its own personality and reply language, taught it my own documents, and then deployed a public version that anyone can talk to.</p>
  <p>The point of building it this way is control. The version on my laptop is free, offline and private — nobody can meter it, price it or switch it off.</p>
  <div class="facts">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</div>
</section>

<section>
  <h2>Key decisions</h2>
  ${decision('Choosing a model', `Why ${esc(model)}`,
    V('h1a', 'why') ? `<p>${esc(V('h1a', 'why'))}</p>${V('h1a', 'size') ? `<p class="an"><span>Size band</span>${esc(V('h1a', 'size'))}</p>` : ''}` : '')}
  ${decision('Personality', 'The system prompt I wrote',
    V('h3a', 'prompt') ? `<blockquote>${esc(V('h3a', 'prompt'))}</blockquote><p>It replies in ${esc(lang)} no matter what language the question comes in.</p>` : '')}
  ${decision('Knowledge', 'What I taught it',
    V('h3c', 'file') ? `<p>${esc(V('h3c', 'file'))}</p>${V('h3c', 'asked') ? `<p class="an"><span>Asked</span>${esc(V('h3c', 'asked'))}</p>` : ''}<p>The document isn't used for training. Relevant passages are retrieved and added to the prompt at question time — retrieval-augmented generation — which is why a long file still works on a small model.</p>` : '')}
</section>

<section>
  <h2>How I built it</h2>
  ${walk}
</section>

${V('h4d', 'hardest') ? `<section>
  <h2>What I learned</h2>
  <p class="an"><span>Hardest part</span>${esc(V('h4d', 'hardest'))}</p>
</section>` : ''}

<section>
  <h2>References</h2>
  <ul class="refs">
    <li>Original project — <a href="https://github.com/Spod101/barangayAI">github.com/Spod101/barangayAI</a></li>
    <li>Ollama, for running models locally — <a href="https://ollama.com">ollama.com</a></li>
    <li>Model library — <a href="https://ollama.com/library">ollama.com/library</a></li>
    <li>DEVCON Philippines — <a href="https://devcon.ph">devcon.ph</a></li>
  </ul>
</section>

<footer>
  <div class="grow">
    <span class="lbl">Verified completion</span>
    <p style="margin:8px 0 0;font-size:16.5px">${esc(me.name)} completed all ${TOTAL} steps of ${esc(CAMP.code)} — ${esc(CAMP.title)}, ${esc(CAMP.event)} — on ${esc(date)}.</p>
  </div>
  <span class="stamp"><b>VERIFIED</b><i>${esc(CAMP.code)} · ${TOTAL}/${TOTAL} STEPS</i></span>
</footer>

</div></body></html>`;
}

export async function buildProgress() {
  const me = store.profile;
  const pics = await allInlined();
  const done = doneCount();
  const complete = allDone();
  const when = new Date().toLocaleString([], { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const blocks = CAMP.modules
    .map((m) => `<section><span class="lbl">${esc(m.title)}</span>${m.steps
      .map((s) => {
        const S = stepById(s.id);
        const st = store.progress[s.id] || {};
        const n = S.optional ? '—' : stepNumber(s.id);
        const ans = s.proofs.filter((p) => p.type !== 'screenshot' && V(s.id, p.key));
        const shots = pics[s.id] || [];
        const tag = st.done
          ? '<span class="tg ok">Stamped</span>'
          : `<span class="tg no">${ans.length || shots.length ? 'Started' : 'Not started'}</span>`;
        return `<div class="stp">
          <div class="hd"><span class="n">${n}</span><h4>${esc(s.title)}</h4>${tag}</div>
          ${ans.length
            ? `<dl>${ans.map((p) => `<dt>${esc(p.label)}</dt><dd>${esc(V(s.id, p.key))}</dd>`).join('')}</dl>`
            : '<p class="none">Nothing submitted.</p>'}
          ${shots.length ? `<div class="figs">${shots.map((x) => `<figure><img src="${x.data}" alt="${esc(x.name)}"></figure>`).join('')}</div>` : ''}
        </div>`;
      })
      .join('')}</section>`)
    .join('');

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(me.name)} — progress ${done}/${TOTAL} — ${esc(CAMP.title)}</title>
${FONTS}
<style>
:root{--ink:#1C0F4A;--soft:#574C7A;--faint:#8981A8;--rule:#E4DDF5;--panel:#F6F3FD;
--stamp:#4725BA;--gold:#E8CA04;--tint:#EDE7FB;
--grad:linear-gradient(90deg,#4725BA 0%,#8A4FD0 55%,#E8CA04 100%);
--d:'Montserrat',system-ui,sans-serif;--b:'Inter',system-ui,sans-serif;--m:'JetBrains Mono',monospace}
*{box-sizing:border-box}
body{margin:0;background-color:#fff;background-image:radial-gradient(760px 420px at 4% -6%,rgba(71,37,186,.05),transparent 68%),radial-gradient(640px 360px at 99% 1%,rgba(232,202,4,.045),transparent 70%);background-repeat:no-repeat;background-attachment:fixed;color:var(--ink);font-family:var(--b);font-size:16.5px;line-height:1.6}
.page{max-width:780px;margin:0 auto;padding:52px 24px 72px}
h1,h2,h4{font-family:var(--d);font-weight:800;letter-spacing:-.02em;line-height:.95;margin:0}
.lbl{font-family:var(--d);font-size:9.5px;font-weight:800;letter-spacing:.13em;text-transform:uppercase;color:var(--faint);display:block}
header{padding-bottom:24px;margin-bottom:14px;border-bottom:1px solid var(--rule)}
header h1{font-size:36px;line-height:.92;color:var(--stamp);margin:12px 0 8px}
.who{font-family:var(--d);font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--soft)}
/* Purple bar, gold leading edge - the same progress mark the app uses. */
.bar{height:8px;background:var(--panel);border-radius:999px;overflow:hidden;margin:20px 0 8px}
.bar i{display:block;height:100%;border-radius:999px;background:var(--stamp);position:relative}
.bar i::after{content:"";position:absolute;top:0;bottom:0;right:0;width:40px;background:linear-gradient(90deg,transparent,var(--gold))}
.note{background:var(--panel);border-radius:14px;padding:15px 17px;font-size:15px;margin:28px 0 36px}
section{margin:0 0 36px}
section>.lbl{color:var(--stamp);padding-bottom:9px;margin-bottom:18px;border-bottom:1px solid var(--rule)}
.stp{margin-bottom:22px;padding-bottom:22px;border-bottom:1px solid var(--rule)}
.stp:last-child{border-bottom:0}
.hd{display:flex;align-items:baseline;gap:10px;margin-bottom:10px;flex-wrap:wrap}
.hd h4{font-size:18px;flex:1;min-width:180px}
.n{font-family:var(--m);font-size:12px;font-weight:700;color:var(--faint)}
.tg{font-family:var(--d);font-size:9px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;padding:4px 10px;border-radius:999px;white-space:nowrap}
.tg.ok{color:#fff;background:var(--stamp)}
.tg.no{color:var(--soft);background:var(--panel)}
dl{margin:0}
dt{font-family:var(--d);font-size:9px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:var(--faint);margin-top:10px}
dd{margin:3px 0 0;font-size:15.5px;white-space:pre-wrap}
.none{margin:0;color:var(--faint);font-size:15px}
.figs{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;margin-top:14px}
.figs img{width:100%;border-radius:10px;display:block}
footer{border-top:1px solid var(--rule);margin-top:40px;padding-top:24px;font-size:15px;color:var(--soft)}
@media print{body{background:#fff}.page{padding:0}}
@media (max-width:600px){header h1{font-size:27px}.page{padding:32px 16px 50px}}
</style></head><body><div class="page">

<header>
  <span class="lbl">${esc(CAMP.title)} · ${esc(CAMP.code)} · Progress report</span>
  <h1>${esc(me.name)}</h1>
  <!-- Name, OS and date only. The write-up is meant to be shared, and the
       account's email address has no business travelling with it. -->
  <div class="who">${esc(me.os || '')} · ${esc(when)}</div>
  <div class="bar"><i style="width:${Math.round((done / TOTAL) * 100)}%"></i></div>
  <div class="who">${done} of ${TOTAL} required steps stamped${complete ? ' · complete' : ''}</div>
</header>

<p class="note">${complete
    ? `All ${TOTAL} steps are stamped, so the full project write-up is unlocked in the app — this file is the working record.`
    : `This is a working record, not a portfolio piece. The project write-up is a separate file and unlocks at ${TOTAL}/${TOTAL}.`}</p>

${blocks}

<footer>Generated by the ${esc(CAMP.title)} checklist on ${esc(when)}.</footer>

</div></body></html>`;
}

// One post, written to work on any platform — the sheet in share.js sends it to
// whichever one the participant picks, with the documentation file alongside.
export function sharePost() {
  const ai = V('h3a', 'ainame') || 'my own AI';
  const model = V('p1', 'model') || 'an open-source model';
  const live = V('h4b', 'liveurl');
  const lang = V('h3b', 'lang') || 'English';
  // Their own one-line description leads the post when they wrote one; the
  // specs follow it rather than standing in for it.
  const blurb = (V('h3a', 'blurb') || '').replace(/\s+/g, ' ').trim();
  return `I built my own AI today — and it runs entirely on my laptop.

Meet ${ai}${blurb ? ` — ${blurb}

It's ` : ': '}${model} running locally through Ollama, answering in ${lang}, grounded on my own documents. No cloud, no subscription, no data leaving my machine.
${live ? '\nTry it: ' + live : ''}

Three hours, from install to deployed, at ${CAMP.title} (${CAMP.acronym}) with DEVCON Philippines. Most of us use AI built somewhere else. Today I built one.

${CAMP.tagline}

${CAMP.hashtags.join(' ')}`;
}
