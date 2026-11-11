/* Shared by the pages around the game. */
window.GK = (() => {
  const SAVE_KEY = 'glimmerkin.v1';        // the game's copy of the creature in this browser
  const ACCOUNT_KEY = 'glimmerkin.account'; // which account that copy belongs to, if any

  /** Calls the server. Always answers { ok, status, data }, never throws. */
  async function api(method, path, body) {
    try {
      const res = await fetch(path, {
        method,
        credentials: 'same-origin',
        headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      let data = null;
      try { data = await res.json(); } catch (e) { /* no body */ }
      return { ok: res.ok, status: res.status, data: data || {} };
    } catch (e) {
      return { ok: false, status: 0, data: { error: 'offline', message: 'The server could not be reached. Check your connection and try again.' } };
    }
  }

  /** The creature saved in this browser, or null. */
  function localSave() {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY));
      return d && d.v === 1 && d.pet && d.littles ? d : null;
    } catch (e) { return null; }
  }
  function localOwner() { try { return localStorage.getItem(ACCOUNT_KEY); } catch (e) { return null; } }
  function setLocalOwner(id) { try { if (id) localStorage.setItem(ACCOUNT_KEY, id); else localStorage.removeItem(ACCOUNT_KEY); } catch (e) { } }
  function setLocalSave(doc) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(doc)); } catch (e) { } }

  /** Shows a message in a notice element, or hides it when the message is empty. */
  function say(el, message, kind) {
    el.textContent = message || '';
    el.className = 'notice ' + (kind || 'error');
    el.hidden = !message;
  }

  /** Wires a form: disables its button while busy and shows any refusal in its notice. */
  function form(el, handler) {
    const notice = el.querySelector('[data-notice]'), button = el.querySelector('button[type=submit]');
    el.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (notice) say(notice, '');
      button.disabled = true;
      try {
        const problem = await handler(Object.fromEntries(new FormData(el)));
        if (problem && notice) { say(notice, problem); notice.focus(); }
      } finally { button.disabled = false; }
    });
  }

  return { api, localSave, localOwner, setLocalOwner, setLocalSave, say, form };
})();

/** A date as people say it: "Today, 16:40", "Yesterday", "6 Nov 2026". */
GK.when = (iso, withTime) => {
  if (!iso) return 'Never';
  const d = new Date(iso), now = new Date();
  const days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (days === 0) return withTime ? 'Today, ' + time : 'Today';
  if (days === 1) return withTime ? 'Yesterday, ' + time : 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

/** Builds an element: GK.el('td', { class: 'code' }, 'MOSS-4821'). Text is never read as HTML. */
GK.el = (tag, attrs, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) { if (k === 'onclick') node.addEventListener('click', v); else if (v !== false && v != null) node.setAttribute(k, v === true ? '' : v); }
  for (const child of children.flat()) if (child != null) node.append(child);
  return node;
};

GK.copy = async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch (e) { return false; } };

/**
 * Signs out. The copy of the creature in this browser goes too, so that whoever plays here next starts
 * with their own. If this browser was ahead of the account, the account is brought up to date first.
 */
GK.signOut = async (accountId) => {
  const local = GK.localSave();
  if (local && accountId && GK.localOwner() === accountId) await GK.api('PUT', '/api/save', { save: local });
  const res = await GK.api('POST', '/api/signout', {});
  if (!res.ok) return res.data.message || 'Signing out did not work. Try again.';
  if (GK.localOwner()) { try { localStorage.removeItem('glimmerkin.v1'); } catch (e) { } GK.setLocalOwner(null); }
  location.assign('/');
  return null;
};
