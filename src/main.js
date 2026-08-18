import './styles.css';
import { supabase, configured, bootFailure, confirmEmailIsOn } from './supabase.js';
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

// Supabase Auth needs an email for password sign-in, so a username is mapped to
// a reserved-TLD address that can never resolve or receive mail (RFC 6761).
// Nothing is ever sent to it and it is never shown to anyone.
const SYNTH_DOMAIN = 'codecamp.test';
const USERNAME_RE = /^[a-z0-9](?:[a-z0-9._-]{1,28}[a-z0-9])?$/;
const toEmail = (username) => `${username.trim().toLowerCase()}@${SYNTH_DOMAIN}`;

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

// Reached three ways — asked for at boot, inferred from a session-less signup,
// or diagnosed from the 429 — so the instruction is written once.
function warnConfirmEmail() {
  warn(
    'This project still has <strong>Confirm email</strong> switched on, so signing up is broken. ' +
    'Login is by username: the address behind it ends in <code>.test</code> and can never receive ' +
    'the confirmation, and the built-in mail server allows only a couple of sends an hour, so most ' +
    'of the room gets a rate-limit error instead of an account. Waiting will not help. ' +
    'A facilitator: uncheck it under <strong>Authentication → Sign In / Providers → Email</strong>, ' +
    'then run <code>supabase/migrations/0004_confirm_camp_users.sql</code> to release the accounts ' +
    'already made.',
  );
}

async function submitAuth() {
  const btn = $('#authBtn');
  const username = $('#pUser').value.trim().toLowerCase();
  const password = $('#pPass').value;
  const name = $('#pName').value.trim();
  const os = $('#pOS').value;

  if (!username || !password) return msg('Username and password are both needed.');
  if (mode === 'signup') {
    if (!USERNAME_RE.test(username)) {
      return msg('Usernames are 3–30 characters: letters, numbers, dots, dashes and underscores.');
    }
    if (!name) return msg('Add your name — it goes on your project write-up.');
    if (password.length < 8) return msg('Use at least 8 characters.');
  }

  btn.disabled = true;
  btn.textContent = 'Working…';
  try {
    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email: toEmail(username), password, options: { data: { name, os, username } },
      });
      if (error) throw error;
      // Confirm email must be off for a camp; if someone turns it back on,
      // signUp returns no session, and the confirmation was mailed to an
      // address that cannot receive it, so nobody can finish on their own.
      if (!data.session) {
        warnConfirmEmail();
        msg('Account created, but sign-in is blocked until a facilitator fixes the project setting above.');
        return;
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: toEmail(username), password });
      if (error) throw error;
    }
  } catch (e) {
    // The mail cap can only be hit if confirmation is on, whatever the boot
    // check managed to find out.
    if (e?.code === 'over_email_send_rate_limit' || /email rate limit/i.test(e?.message || '')) {
      warnConfirmEmail();
    }
    msg(friendly(e));
  } finally {
    btn.disabled = false;
    btn.textContent = mode === 'signup' ? 'Create account' : 'Sign in';
  }
}

// Supabase phrases these in terms of the address it stores, which nobody here
// has ever seen. Translate before showing them.
//
// Prefer error.code: the two 429s look identical in prose but need opposite
// advice — a per-IP request cap really does clear if you wait, while the mail
// cap is a project setting that never will. Older gotrue builds send no code,
// so the message patterns stay as a fallback.
const BY_CODE = {
  user_already_exists: 'That username is taken — pick another.',
  email_exists: 'That username is taken — pick another.',
  invalid_credentials: 'No account with that username and password.',
  email_address_invalid: 'That username has characters Supabase will not accept.',
  email_not_confirmed:
    'This account was made while the project still required email confirmation, so it is stuck. ' +
    'A facilitator can release it — see 0004_confirm_camp_users.sql.',
  weak_password: 'Use at least 8 characters.',
  signup_disabled: 'Signups are switched off on this project. Ask a facilitator.',
  over_email_send_rate_limit:
    'Signups are blocked by a project setting, not by you — see the note above.',
  over_request_rate_limit:
    'Too many attempts from this room just now — wait a minute and try again.',
};

function friendly(e) {
  const m = (typeof e === 'string' ? e : e?.message) || '';
  if (typeof e === 'object' && e?.code && BY_CODE[e.code]) return BY_CODE[e.code];
  if (/already registered|already exists/i.test(m)) return BY_CODE.user_already_exists;
  if (/invalid login credentials/i.test(m)) return BY_CODE.invalid_credentials;
  if (/email address .* invalid/i.test(m)) return BY_CODE.email_address_invalid;
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

  // Ask the project up front rather than letting thirty people discover it one
  // 429 at a time. Not awaited: a slow settings call must not hold the gate.
  confirmEmailIsOn().then((on) => { if (on) warnConfirmEmail(); });

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
      const fallbackUser = user.user_metadata?.username || String(user.email || '').split('@')[0];
      const { error } = await supabase.from('profiles').insert({
        id: user.id,
        name: user.user_metadata?.name || fallbackUser,
        username: fallbackUser,
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
