// The two things a participant can take away.
//
// buildDoc      — a portfolio write-up. Editorial, public, wrap-up withheld.
// buildProgress — a working record for the facilitator. Always available, so
//                 nobody who stalls in Hour 2 leaves with nothing to hand in.
//
// They differ on purpose: the write-up sits on a lighter editorial ground, the
// progress report wears the app's own logbook paper.
import { CAMP, STEPS, REQ, TOTAL, PRIVATE, stepById, stepNumber } from './camp.js';
import { store, V, SH, doneCount, allDone, inlineShots } from './store.js';
import { esc } from './ui.js';

const FONTS =
  '<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Newsreader:opsz,wght@6..72,400;500;600&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">';

async function allInlined() {
  const out = {};
  for (const s of STEPS) out[s.id] = SH(s.id).length ? await inlineShots(s.id) : [];
  return out;
}

export async function buildDoc() {
  const me = store.profile;
  const pics = await allInlined();
  const ai = V('h3a', 'ainame') || 'My AI';
  const model = V('p1', 'model') || V('h2c', 'selected') || 'an open-source model';
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
    ['Built at', CAMP.title],
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
:root{--ink:#17211C;--soft:#5D6A62;--faint:#8B968E;--rule:#DDE1D6;--stamp:#17594A;--tint:#EEF3EF;
--d:'Space Grotesk',system-ui,sans-serif;--b:'Newsreader',Georgia,serif;--m:'JetBrains Mono',monospace}
*{box-sizing:border-box}
body{margin:0;background:#F7F8F4;color:var(--ink);font-family:var(--b);font-size:18px;line-height:1.65}
.page{max-width:820px;margin:0 auto;padding:60px 26px 80px}
h1,h2,h3,h4{font-family:var(--d);font-weight:700;letter-spacing:-.02em;margin:0}
.lbl{font-family:var(--m);font-size:10.5px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--faint);display:block}
header.hero{border-bottom:2px solid var(--ink);padding-bottom:30px;margin-bottom:34px}
header.hero h1{font-size:52px;line-height:1.02;margin:12px 0 12px}
header.hero .tag{font-size:21px;color:var(--soft);margin:0 0 22px;max-width:34ch}
.by{font-family:var(--m);font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--soft)}
.links{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px}
.lk{font-family:var(--m);font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;
 text-decoration:none;color:#fff;background:var(--ink);padding:10px 15px;border-radius:4px;display:inline-block}
.lk span{opacity:.6}
.lk:nth-child(1){background:var(--stamp)}
section{margin:44px 0}
section>h2{font-size:15px;font-family:var(--m);font-weight:700;letter-spacing:.18em;text-transform:uppercase;
 color:var(--faint);border-bottom:1px solid var(--rule);padding-bottom:9px;margin-bottom:20px}
p{margin:0 0 16px}
.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:2px;background:var(--rule);border:1px solid var(--rule);border-radius:5px;overflow:hidden;margin-top:24px}
.facts div{background:#F7F8F4;padding:14px 16px}
.facts dt{font-family:var(--m);font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--faint)}
.facts dd{margin:3px 0 0;font-size:16.5px;font-weight:500}
.dec{border-left:3px solid var(--stamp);padding:2px 0 2px 20px;margin-bottom:30px}
.dec h3{font-size:22px;margin:6px 0 10px}
.dec blockquote{margin:0;padding:16px 18px;background:var(--tint);border-radius:5px;font-size:17px;white-space:pre-wrap}
.mod{margin-bottom:40px}
.mod>.lbl{border-bottom:1px solid var(--rule);padding-bottom:8px;margin-bottom:18px}
.stp{margin-bottom:30px}
.stp h4{font-size:19px;margin-bottom:10px}
.an{font-size:16.5px;margin:0 0 10px;white-space:pre-wrap}
.an span{display:block;font-family:var(--m);font-size:9.5px;letter-spacing:.13em;text-transform:uppercase;color:var(--faint);margin-bottom:2px}
.figs{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin-top:14px}
.figs img{width:100%;border:1px solid var(--rule);border-radius:5px;display:block}
footer{border-top:2px solid var(--ink);margin-top:52px;padding-top:26px;display:flex;gap:24px;align-items:center;flex-wrap:wrap}
footer .grow{flex:1;min-width:220px}
.stamp{display:inline-block;border:2.5px solid var(--stamp);color:var(--stamp);border-radius:6px;padding:9px 15px;
 transform:rotate(-3deg);font-family:var(--m);text-align:center;box-shadow:inset 0 0 0 1px var(--stamp)}
.stamp b{display:block;font-size:15px;letter-spacing:.2em}
.stamp i{display:block;font-size:8.5px;letter-spacing:.11em;font-style:normal;border-top:1px solid currentColor;margin-top:4px;padding-top:4px}
ul.refs{padding-left:20px;margin:0}
ul.refs li{margin-bottom:7px;font-size:16.5px}
@media print{body{background:#fff}.page{padding:0}.lk{background:none!important;color:var(--ink);padding:0;text-decoration:underline}}
@media (max-width:640px){header.hero h1{font-size:36px}.page{padding:36px 18px 60px}}
</style></head><body><div class="page">

<header class="hero">
  <span class="lbl">${esc(CAMP.title)} · Project documentation</span>
  <h1>${esc(ai)}</h1>
  <p class="tag">A private AI that runs on my own computer — built, customized and deployed in four hours.</p>
  <div class="by">${esc(me.name)}${gh ? ' · @' + esc(gh) : ''} · ${esc(date)}</div>
  <div class="links">${link(live, 'Live site')}${link(repo, 'Source code')}</div>
</header>

<section>
  <h2>Overview</h2>
  <p><strong>${esc(ai)}</strong> is a chat AI that runs entirely on my own machine. No cloud, no subscription, no data leaving the room. I picked an open-source model and ran it locally with Ollama, gave it its own personality and reply language, taught it my own documents, and then deployed a public version that anyone can talk to.</p>
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
    V('h3c', 'qa') ? `<p>${esc(V('h3c', 'qa'))}</p><p>The document isn't used for training. Relevant passages are retrieved and added to the prompt at question time — retrieval-augmented generation — which is why a long file still works on a small model.</p>` : '')}
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
    <p style="margin:8px 0 0;font-size:16.5px">${esc(me.name)} completed all ${TOTAL} steps of ${esc(CAMP.title)} (${esc(CAMP.code)}) on ${esc(date)}.</p>
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
:root{--ink:#17211C;--soft:#5D6A62;--faint:#8B968E;--rule:#C6CCBD;--panel:#E4E7DE;
--stamp:#17594A;--tint:#D9E6DF;
--d:'Space Grotesk',system-ui,sans-serif;--b:'Newsreader',Georgia,serif;--m:'JetBrains Mono',monospace}
*{box-sizing:border-box}
body{margin:0;background:#EDEFE8;color:var(--ink);font-family:var(--b);font-size:17px;line-height:1.6}
.page{max-width:780px;margin:0 auto;padding:48px 24px 72px}
h1,h2,h4{font-family:var(--d);font-weight:700;letter-spacing:-.015em;margin:0}
.lbl{font-family:var(--m);font-size:10px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--faint);display:block}
header{border-bottom:2px solid var(--ink);padding-bottom:22px;margin-bottom:12px}
header h1{font-size:34px;margin:10px 0 6px}
.who{font-family:var(--m);font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--soft)}
.bar{height:7px;background:var(--panel);border:1px solid var(--rule);border-radius:4px;overflow:hidden;margin:18px 0 8px}
.bar i{display:block;height:100%;background:var(--stamp)}
.note{background:var(--panel);border:1px solid var(--rule);border-left:3px solid var(--stamp);border-radius:5px;padding:13px 15px;font-size:15.5px;margin:26px 0 34px}
section{margin:0 0 34px}
section>.lbl{border-bottom:1px solid var(--rule);padding-bottom:7px;margin-bottom:16px}
.stp{margin-bottom:22px;padding-bottom:20px;border-bottom:1px dashed var(--rule)}
.stp:last-child{border-bottom:0}
.hd{display:flex;align-items:baseline;gap:10px;margin-bottom:9px;flex-wrap:wrap}
.hd h4{font-size:18px;flex:1;min-width:180px}
.n{font-family:var(--m);font-size:12px;font-weight:700;color:var(--faint)}
.tg{font-family:var(--m);font-size:9.5px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;padding:3px 8px;border-radius:3px;white-space:nowrap}
.tg.ok{color:var(--stamp);background:var(--tint)}
.tg.no{color:var(--soft);background:var(--panel)}
dl{margin:0}
dt{font-family:var(--m);font-size:9.5px;letter-spacing:.13em;text-transform:uppercase;color:var(--faint);margin-top:9px}
dd{margin:2px 0 0;font-size:16px;white-space:pre-wrap}
.none{margin:0;color:var(--faint);font-style:italic;font-size:15.5px}
.figs{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;margin-top:13px}
.figs img{width:100%;border:1px solid var(--rule);border-radius:4px;display:block}
footer{border-top:2px solid var(--ink);margin-top:36px;padding-top:22px;font-size:15.5px;color:var(--soft)}
@media print{body{background:#fff}.page{padding:0}}
@media (max-width:600px){header h1{font-size:26px}.page{padding:30px 16px 50px}}
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

export function linkedInPost() {
  const ai = V('h3a', 'ainame') || 'my own AI';
  const model = V('p1', 'model') || 'an open-source model';
  const live = V('h4b', 'liveurl');
  const lang = V('h3b', 'lang') || 'English';
  return `I built my own AI today — and it runs entirely on my laptop.

Meet ${ai}: ${model} running locally through Ollama, answering in ${lang}, grounded on my own documents. No cloud, no subscription, no data leaving my machine.
${live ? '\nTry it: ' + live : ''}

Four hours, from install to deployed, at ${CAMP.title} with DEVCON Philippines. Most of us use AI built somewhere else. Today I built one.

#AISaBarangay #DEVCON #OpenSource #AI #Philippines`;
}
