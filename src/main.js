import './styles.css';
import { supabase, configured, bootFailure, authPreflight } from './supabase.js';
import { CAMP } from './camp.js';
import { store, loadProfile, loadAll, flush, isFacilitator } from './store.js';
import { $, $$, toast, pill } from './ui.js';
import { renderAll, wireGlobalKeys } from './steps.js';
import { renderRecord } from './record.js';
import { loadRoom, renderRoom, exportXlsx, subscribeRoom, unsubscribeRoom } from './facilitator.js';

if (!configured) {
  bootFailure();
} else {
  boot();
}

// ── views ────────────────────────────────────────────────────────────

export function show(view) {
  $$('.tab').forEach((t) => t.setAttribute('aria-selected', t.dataset.view === view));
  ['steps', 'record', 'desk'].forEach((v) => ($('#view-' + v).hidden = v !== view));
  if (view === 'record') renderRecord();
  if (view === 'desk') {
    refreshRoom();
    // Only hold a socket open while the desk is actually on screen.
    subscribeRoom(refreshRoom, () => { if (!$('#view-desk').hidden) renderRoom(); });
  } else {
    unsubscribeRoom();
  }
}

async function refreshRoom() {
  try {
    await loadRoom();
    renderRoom();
  } catch (e) {
    $('#roomOut').innerHTML = `<div class="empty"><div class="big">Couldn't load the room</div>${e.message}</div>`;
  }
}

// ── auth ─────────────────────────────────────────────────────────────

// Plain email + password, the way Supabase Auth works out of the box. No mail is
// ever sent: "Confirm email" is off for the camp (README §4) and there is no
// magic link, OTP or password reset anywhere, so the address is only ever an
// identifier. Loose check on purpose — Supabase does the real validation, and a
// stricter regex here would only reject addresses that actually work.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let mode = 'signin';

function setMode(next) {
  mode = next;
  const up = mode === 'signup';
  $('#gateTitle').textContent = up ? 'Create your camp account' : 'Sign in to the camp';
  $('#gateLede').textContent = up
    ? 'One account for the whole day. Your answers and screenshots follow you to any machine in the room.'
    : 'Your progress, answers and screenshots are saved to your account, so you can pick up where you left off.';
  $('#fName').hidden = !up;
  $('#fOS').hidden = !up;
  $('#userHint').hidden = !up;
  $('#authBtn').textContent = up ? 'Create account' : 'Sign in';
  $('#swapText').textContent = up ? 'Already have an account?' : 'New to the camp?';
  $('#swapBtn').textContent = up ? 'Sign in instead' : 'Create an account';
  $('#pPass').autocomplete = up ? 'new-password' : 'current-password';
  msg('');
}

function msg(text, good = false) {
  const el = $('#authMsg');
  el.hidden = !text;
  el.textContent = text;
  el.classList.toggle('good', good);
}

// Project-level breakage, addressed to whoever is running the room. Survives
// setMode and further attempts, because no amount of retrying clears it.
function warn(html) {
  const el = $('#gateWarn');
  el.hidden = !html;
  el.innerHTML = html;
}

// Both project settings live on the same dashboard page, so the fix is one trip
// either way. Each is reached more than once — asked for at boot, and again from
// the error a live attempt returns — so the wording is written once.
const DASH = '<strong>Authentication → Sign In / Providers → Email</strong>';

// `alsoConfirm` folds the second setting into the same message when both are
// wrong, which is the likely case: they are adjacent switches with similar
// names, and turning the provider off is the classic misfire when reaching for
// confirmation. One trip to the dashboard instead of two.
function warnProviderOff(alsoConfirm = false) {
  warn(
    `Email sign-in is switched off for this project, so nobody can sign up or sign in. Under ${DASH}, ` +
    'turn <strong>Enable email provider</strong> back <strong>on</strong>' +
    (alsoConfirm
      ? ' and uncheck <strong>Confirm email</strong> while you are there — both are wrong right now, ' +
        'and they are two different switches.'
      : ', leaving <strong>Confirm email</strong> unchecked. They are two different switches.'),
  );
}

function warnConfirmEmail() {
  warn(
    `<strong>Confirm email</strong> is on for this project, which breaks signups for a camp: under ${DASH}, ` +
    'uncheck it. Supabase mails every new account, the built-in mail server allows only a couple of ' +
    'sends an hour, and the rest of the room gets a rate-limit error instead of an account — waiting ' +
    'does not clear it. Accounts already stuck can be released with ' +
    '<code>supabase/migrations/0004_confirm_existing_users.sql</code>.',
  );
}

async function submitAuth() {
  const btn = $('#authBtn');
  const email = $('#pUser').value.trim().toLowerCase();
  const password = $('#pPass').value;
  const name = $('#pName').value.trim();
  const os = $('#pOS').value;

  if (!email || !password) return msg('Email and password are both needed.');
  if (mode === 'signup') {
    if (!EMAIL_RE.test(email)) return msg("That doesn't look like an email address.");
    if (!name) return msg('Add your name — it goes on your project write-up.');
    if (password.length < 8) return msg('Use at least 8 characters.');
  }

  btn.disabled = true;
  btn.textContent = 'Working…';
  try {
    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email, password, options: { data: { name, os } },
      });
      if (error) throw error;
      // No session back means the project is waiting on a confirmation click.
      // Say whose problem that is rather than sending someone to check a mailbox
      // for a message that may be an hour behind, or capped and never sent.
      if (!data.session) {
        warnConfirmEmail();
        msg('Account created, but sign-in is blocked until a facilitator fixes the project setting above.');
        return;
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
  } catch (e) {
    // A live attempt is the better oracle: it sees the current setting, while
    // the boot check may have run before someone touched the dashboard.
    const code = e?.code || '';
    const m = e?.message || '';
    if (code === 'email_provider_disabled' || /signups are disabled|provider is disabled/i.test(m)) {
      warnProviderOff();
    } else if (code === 'over_email_send_rate_limit' || /email rate limit/i.test(m)) {
      warnConfirmEmail();
    }
    msg(friendly(e));
  } finally {
    btn.disabled = false;
    btn.textContent = mode === 'signup' ? 'Create account' : 'Sign in';
  }
}

// Supabase's own wording is fine for developers and useless in a room of
// beginners. Translate, and keep every message about what to do next.
//
// Keyed on error.code, because prose collapses distinctions that matter: the two
// 429s read almost identically but need opposite advice — a per-IP request cap
// really does clear if you wait, a mail cap is a project setting that never
// will. Older gotrue builds send no code, so the patterns stay as a fallback.
const BY_CODE = {
  user_already_exists: 'There is already an account with that email — sign in instead.',
  email_exists: 'There is already an account with that email — sign in instead.',
  invalid_credentials: 'No account with that email and password.',
  email_address_invalid: 'Supabase will not accept that address. Try another.',
  validation_failed: 'Check the email address — Supabase would not accept it.',
  email_not_confirmed:
    'This account was made while the project still required email confirmation, so it is stuck. ' +
    'A facilitator can release it — see 0004_confirm_existing_users.sql.',
  weak_password: 'Use at least 8 characters.',
  email_provider_disabled: 'Email sign-in is switched off on this project — see the note above.',
  signup_disabled: 'New signups are switched off on this project. Ask a facilitator.',
  over_email_send_rate_limit:
    'Signups are blocked by a project setting, not by anything you did — see the note above.',
  over_request_rate_limit:
    'Too many attempts from this room just now — wait a minute and try again.',
};

function friendly(e) {
  const m = (typeof e === 'string' ? e : e?.message) || '';
  if (BY_CODE[e?.code]) return BY_CODE[e.code];
  if (/already registered|already exists/i.test(m)) return BY_CODE.user_already_exists;
  if (/invalid login credentials/i.test(m)) return BY_CODE.invalid_credentials;
  if (/email address .* invalid/i.test(m)) return BY_CODE.email_address_invalid;
  if (/signups are disabled|provider is disabled/i.test(m)) return BY_CODE.email_provider_disabled;
  if (/not confirmed/i.test(m)) return BY_CODE.email_not_confirmed;
  if (/email rate limit/i.test(m)) return BY_CODE.over_email_send_rate_limit;
  if (/rate limit/i.test(m)) return BY_CODE.over_request_rate_limit;
  if (/password/i.test(m) && /short|least/i.test(m)) return BY_CODE.weak_password;
  return m || 'That did not work.';
}

// ── boot ─────────────────────────────────────────────────────────────

async function boot() {
  $('#gateCode').textContent = CAMP.title + ' · ' + CAMP.code;
  $('#campTitle').textContent = CAMP.title;
  $('#campCode').textContent = CAMP.code;
  setMode('signin');

  // Ask the project up front rather than letting thirty people discover a
  // misconfiguration one failed signup at a time. Not awaited: a slow settings
  // call must not hold the gate. Provider-off is the louder of the two — with it
  // off, nothing works at all — so it wins if somehow both are wrong.
  authPreflight().then(({ emailProviderOff, confirmEmailOn }) => {
    if (emailProviderOff) warnProviderOff(confirmEmailOn === true);
    else if (confirmEmailOn) warnConfirmEmail();
  });

  $('#authBtn').addEventListener('click', submitAuth);
  $('#swapBtn').addEventListener('click', () => setMode(mode === 'signup' ? 'signin' : 'signup'));
  $$('#gate input').forEach((el) =>
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitAuth(); }),
  );

  $$('.tab').forEach((t) => t.addEventListener('click', () => show(t.dataset.view)));
  $('#refreshRoom').addEventListener('click', refreshRoom);
  $('#xlsxBtn').addEventListener('click', exportXlsx);
  $('#signOutBtn').addEventListener('click', async () => {
    await flush();
    unsubscribeRoom();
    await supabase.auth.signOut();
  });

  wireGlobalKeys();
  // Nothing in flight should be lost to a closed tab mid-answer.
  window.addEventListener('beforeunload', () => { flush(); });

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) enter(session.user);
    else leave();
  });

  const { data } = await supabase.auth.getSession();
  if (data.session?.user) enter(data.session.user);
  else leave();
}

let entered = null;

async function leave() {
  entered = null;
  unsubscribeRoom();
  $('#app').hidden = true;
  $('#gate').hidden = false;
}

async function enter(user) {
  if (entered === user.id) return;
  entered = user.id;
  try {
    const profile = await loadProfile(user.id);
    if (!profile) {
      // The signup trigger normally makes this; a project restored without it
      // would otherwise leave the user staring at a blank app.
      const { error } = await supabase.from('profiles').insert({
        id: user.id,
        name: user.user_metadata?.name || String(user.email || '').split('@')[0],
        email: user.email,
        os: user.user_metadata?.os || 'Windows',
      });
      if (error) throw error;
      await loadProfile(user.id);
    }
    await loadAll(user.id);
  } catch (e) {
    entered = null;
    msg('Signed in, but loading your data failed: ' + e.message);
    return;
  }

  $('#gate').hidden = true;
  $('#app').hidden = false;
  $('#pNameOut').textContent = store.profile.name;
  $('#pOSOut').textContent = store.profile.os || '';
  $('#pInitials').textContent = (store.profile.name || '?')
    .split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  $('#deskTab').hidden = !isFacilitator();
  pill('Ready');
  show('steps');
  renderAll();
}
