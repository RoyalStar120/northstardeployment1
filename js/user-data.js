/**
 * Per-user data, saved to the person's account in Supabase.
 *
 * The app keeps working with localStorage as before; this file makes those keys belong to
 * whoever is logged in:
 *  - when a different person logs in on this phone, the previous person's data is cleared
 *  - their saved data is loaded from the server (/api/user-data/:id)
 *  - every change to one of these keys is saved back to the server shortly after
 * Guests keep their data on the phone only.
 */
(function () {
  'use strict';

  // Keys that belong to one person
  const USER_KEYS = [
    'northstar_latest_resume_data',
    'northstar_latest_resume_text',
    'northstar_resume_saved',
    'northstar_jobs_explored',
    'northstar_donations',
    'northstar_visited_pages',
    'northstar_saved_resources',
    'northstar_user_saved_places',
    'northstar_ai_used',
    'northstar_app_explored',
    'northstar_progress_customized',
    'northstar_last_delivery_id',
    'northstar_planned_dropoff',
    'northstar_custom_posted_jobs',
    'northstar_ai_consent',
    'northstar_blocked_posters'
  ];
  const OWNER_KEY = 'northstar_data_owner';
  const SYNCED_KEY = 'northstar_data_synced_at';
  const DIRTY_KEY = 'northstar_data_dirty';

  const store = window.localStorage;
  const rawGet = store.getItem.bind(store);
  const rawSet = store.setItem.bind(store);
  const rawRemove = store.removeItem.bind(store);

  const SESSION_TTL_MS = 5 * 60 * 1000;

  function idleMs(s) {
    const last = typeof window.nsSessionLastActive === 'function'
      ? window.nsSessionLastActive(s)
      : Math.max(Number(s.lastActiveAt) || 0, Number(s.loggedInAt) || 0) || NaN;
    return Number.isFinite(last) ? (Date.now() - last) : Infinity;
  }

  function session() {
    if (typeof window.nsGetValidSession === 'function') {
      return window.nsGetValidSession();
    }
    try {
      const s = JSON.parse(rawGet('northstar_session') || 'null');
      if (!s || typeof s !== 'object') return null;
      const idle = idleMs(s);
      if (idle < -60000 || idle >= SESSION_TTL_MS) {
        try { rawRemove('northstar_session'); rawRemove('northstar_user_role'); } catch (e) {}
        return null;
      }
      return s;
    } catch (e) {
      return null;
    }
  }

  function accountOf(s) {
    if (!s || s.isGuest || !s.id || !s.token) return null;
    const idle = idleMs(s);
    return (idle >= -60000 && idle < SESSION_TTL_MS) ? s : null;
  }

  function chatKeyFor(id) { return `ns_companion_chats_${id}`; }

  // Keys named after the account (chats by id, milestone progress by username)
  function accountKeys(account) {
    return account ? [chatKeyFor(account.id), `northstar_data_${account.username}`] : [];
  }

  function isUserKey(key, account) {
    return USER_KEYS.includes(key) || accountKeys(account).includes(key);
  }

  function keysFor(account) {
    return USER_KEYS.concat(accountKeys(account));
  }

  function clearUserKeys() {
    USER_KEYS.forEach(k => { try { rawRemove(k); } catch (e) {} });
    // Older builds kept a few things under these names
    ['northstar_data_Guest', 'northstar_guest_progress_data', 'ns_companion_chats_guest', 'northstar_cached_jobs_items_v3_volunteer'].forEach(k => { try { rawRemove(k); } catch (e) {} });
    // Everyone else's progress and chats
    const control = [OWNER_KEY, SYNCED_KEY, DIRTY_KEY];
    const stale = [];
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (k && (k.startsWith('northstar_data_') || k.startsWith('ns_companion_chats_')) && !control.includes(k)) stale.push(k);
    }
    stale.forEach(k => { try { rawRemove(k); } catch (e) {} });
  }

  // Login screen: after signing in, data already on this phone that has no other owner
  // (a guest's, or an older phone-only account's) becomes this account's.
  window.nsAdoptPhoneData = function (newId, oldIds) {
    const prev = rawGet(OWNER_KEY) || '';
    if (prev && prev !== 'guest' && !(oldIds || []).includes(prev)) return false;
    const fromChats = [prev || 'guest'].concat(oldIds || []).map(chatKeyFor);
    const chats = fromChats.map(k => rawGet(k)).find(Boolean);
    if (chats && !rawGet(chatKeyFor(newId))) rawSet(chatKeyFor(newId), chats);
    const present = USER_KEYS.filter(k => rawGet(k) != null);
    if (rawGet(chatKeyFor(newId)) != null) present.push(chatKeyFor(newId));
    rawSet(OWNER_KEY, newId);
    rawRemove(SYNCED_KEY);
    if (present.length) rawSet(DIRTY_KEY, JSON.stringify(present)); else rawRemove(DIRTY_KEY);
    return true;
  };

  // ---- Owner check: a new person on this phone starts clean ----
  const s = session();
  if (!s && !/index\.html$|login\.html$|signup\.html$|\/$/.test(location.pathname)) {
    location.replace('index.html');
    return;
  }
  const account = accountOf(s);
  const owner = account ? account.id : (session() ? 'guest' : '');
  const previousOwner = rawGet(OWNER_KEY) || '';
  if (owner && !previousOwner) {
    rawSet(OWNER_KEY, owner); // first run of this build on this phone
  } else if (owner && owner !== previousOwner) {
    clearUserKeys();
    if (previousOwner && previousOwner !== 'guest') { try { rawRemove(chatKeyFor(previousOwner)); } catch (e) {} }
    rawRemove(SYNCED_KEY);
    rawRemove(DIRTY_KEY);
    rawSet(OWNER_KEY, owner);
  }

  if (!account) {
    window.nsUserData = { ready: Promise.resolve(false), saveNow: () => Promise.resolve(false) };
    return;
  }

  // ---- Saving ----
  // DIRTY_KEY lists the keys changed on this phone since the last save. Saving sends the whole
  // set, so it only happens after the account's data has been merged in (see load), otherwise
  // an early write (pages note visits on load) would replace everything saved before.
  let saveTimer = null;
  let saving = null;
  let loaded = false;

  function dirtyKeys() {
    const raw = rawGet(DIRTY_KEY);
    if (!raw) return [];
    if (raw === '1') return keysFor(account); // older marker: everything on this phone
    try { const list = JSON.parse(raw); return Array.isArray(list) ? list : []; } catch (e) { return []; }
  }

  function markDirty(keys) {
    const set = new Set(dirtyKeys().concat(keys));
    if (set.size) rawSet(DIRTY_KEY, JSON.stringify([...set]));
    else rawRemove(DIRTY_KEY);
  }

  function snapshot() {
    const data = {};
    keysFor(account).forEach(k => {
      const v = rawGet(k);
      if (v != null) data[k] = v;
    });
    return data;
  }

  function authHeaders() {
    // The token is refreshed while the person is active (ns-boot.js), so read the latest one
    let token = account.token;
    try {
      const cur = JSON.parse(rawGet('northstar_session') || 'null');
      if (cur && cur.id === account.id && cur.token) token = cur.token;
    } catch (e) {}
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  }

  function handleAuthFailure(resp) {
    if (resp.status !== 401) return false;
    // Token expired or invalid: ask the person to log in again
    try {
      if (typeof window.nsClearSession === 'function') window.nsClearSession();
      else { rawRemove('northstar_session'); rawRemove('northstar_user_role'); }
    } catch (e) {}
    if (!/index\.html$|\/$/.test(location.pathname)) location.href = 'index.html';
    return true;
  }

  async function saveNow(opts = {}) {
    clearTimeout(saveTimer);
    if (!loaded) return false; // load() saves once the account's data is merged
    if (saving) await saving.catch(() => {});
    const pending = dirtyKeys();
    if (!pending.length) return true;
    rawRemove(DIRTY_KEY); // anything changed while saving marks it dirty again
    saving = (async () => {
      try {
        const resp = await fetch(`/api/user-data/${encodeURIComponent(account.id)}`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify({ data: snapshot() }),
          keepalive: !!opts.keepalive
        });
        if (handleAuthFailure(resp)) return false;
        const out = await resp.json().catch(() => ({}));
        if (!resp.ok || !out.success) throw new Error(out.error || resp.status);
        rawSet(SYNCED_KEY, String(out.updatedAt || Date.now()));
        return true;
      } catch (e) {
        markDirty(pending); // try again on the next change or page
        return false;
      }
    })();
    const ok = await saving;
    saving = null;
    return ok;
  }

  function scheduleSave(key) {
    markDirty([key]);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 800);
  }

  // Watch writes to this person's keys
  try {
    const proto = Object.getPrototypeOf(store);
    const origSet = proto.setItem;
    const origRemove = proto.removeItem;
    proto.setItem = function (key, value) {
      const prev = this === store ? rawGet(key) : null;
      origSet.call(this, key, value);
      if (this !== store) return;
      if (String(key) === 'northstar_session') {
        // Keep the newest token for this account (used by the last save after signing out)
        try {
          const next = JSON.parse(String(value) || 'null');
          if (next && next.id === account.id && next.token) account.token = next.token;
        } catch (e) {}
        return;
      }
      if (isUserKey(String(key), account) && prev !== String(value)) scheduleSave(String(key));
    };
    proto.removeItem = function (key) {
      const had = this === store && rawGet(key) != null;
      origRemove.call(this, key);
      if (had && isUserKey(String(key), account)) scheduleSave(String(key));
    };
  } catch (e) {}

  window.addEventListener('pagehide', () => {
    if (dirtyKeys().length) saveNow({ keepalive: true });
  });

  // ---- Loading: merge the account's saved data with changes made on this phone ----
  async function load() {
    let changed = false;
    try {
      const resp = await fetch(`/api/user-data/${encodeURIComponent(account.id)}`, { headers: authHeaders(), cache: 'no-store' });
      if (handleAuthFailure(resp)) return false;
      const out = await resp.json();
      if (!out || !out.success) throw new Error('load failed');
      {
        const serverAt = Number(out.updatedAt) || 0;
        const localAt = Number(rawGet(SYNCED_KEY)) || 0;
        if (serverAt > localAt) {
          // Keys changed on this phone and not saved yet keep the phone's value
          const keep = new Set(dirtyKeys());
          const incoming = out.data || {};
          keysFor(account).forEach(k => {
            if (keep.has(k)) return;
            const next = Object.prototype.hasOwnProperty.call(incoming, k) ? incoming[k] : null;
            const cur = rawGet(k);
            if (next == null && cur != null) { rawRemove(k); changed = true; }
            else if (next != null && next !== cur) { rawSet(k, next); changed = true; }
          });
          rawSet(SYNCED_KEY, String(serverAt));
        }
      }
      loaded = true;
    } catch (e) {
      // Offline: keep using what's on the phone. Save later only if this phone already has
      // the account's data (otherwise a save could replace it with less).
      loaded = !!rawGet(SYNCED_KEY);
    }
    if (dirtyKeys().length) saveNow();
    return changed;
  }

  const ready = load().then(changed => {
    if (changed) {
      // The page drew before the account's data arrived; tell it (or redraw once)
      const evt = new CustomEvent('ns:userdata', { cancelable: true });
      const handled = !window.dispatchEvent(evt);
      if (!handled) {
        const typing = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
        if (!typing) location.reload();
      }
    }
    return changed;
  });

  window.nsUserData = { ready, saveNow };
})();
