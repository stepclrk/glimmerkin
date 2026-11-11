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
