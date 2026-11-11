(async () => {
  const $ = (id) => document.getElementById(id);
  const me = await GK.api('GET', '/api/me');
  if (!me.ok) { location.replace('/signin'); return; }
  const account = me.data;
  let creature = null;

  async function showDetails() {
    const s = await GK.api('GET', '/api/save/summary');
    creature = s.ok ? s.data.creature : null;
    $('d-username').textContent = account.username;
    $('d-creature').textContent = creature || 'Not hatched yet';
    $('d-form').textContent = (s.ok && s.data.form) || 'Not yet';
    $('d-saved').textContent = s.ok && s.data.lastSaved ? GK.when(s.data.lastSaved, true) : 'Not yet';
    $('import-warning').textContent = creature ? 'This replaces ' + creature + ' for good, on every device.' : 'It becomes the creature of this account, on every device.';
    $('delete-warning').textContent = 'This removes your account' + (creature ? ' and ' + creature : '') + ' from the server for good. Nobody can bring them back.';
  }
  function done(message) { GK.say($('done'), message, 'good'); if (message) $('done').scrollIntoView({ block: 'nearest' }); }
  function open(id) { for (const f of ['password-form', 'import-form', 'delete-form']) $(f).hidden = f !== id || !$(f).hidden; if (!$(id).hidden) { $(id).scrollIntoView({ block: 'nearest' }); $(id).querySelector('input, textarea').focus(); } }
  for (const b of document.querySelectorAll('[data-open]')) b.addEventListener('click', () => { done(''); open(b.dataset.open); });

  /** After the account's creature is replaced, this browser shows the new one straight away. */
  function nowLocal(save) { GK.setLocalSave(save); GK.setLocalOwner(account.id); }

  // A one-time password has to be replaced before anything else is offered.
  if (account.mustChangePassword) {
    $('must-change').hidden = false; $('password-form').hidden = false; $('actions').hidden = true; $('more').hidden = true; $('details').hidden = true;
    $('pw-current-label').textContent = 'One-time password';
  } else {
    $('owner-link').hidden = account.role !== 'owner';
    await showDetails();
  }

  GK.form($('password-form'), async (f) => {
    if (f.next.length < 10) return 'A password needs at least 10 characters.';
    const res = await GK.api('POST', '/api/password', { current: f.current, next: f.next });
    if (!res.ok) return res.data.message || 'The password was not changed. Try again.';
    if (account.mustChangePassword) { location.assign(account.role === 'owner' ? '/owner' : '/play'); return null; }
    $('password-form').reset(); $('password-form').hidden = true; done('Password changed. Other devices have been signed out.');
    return null;
  });

  GK.form($('import-form'), async (f) => {
    if (!f.code.trim()) return 'Paste the code from “Keep a copy”.';
    const res = await GK.api('POST', '/api/save/import', { code: f.code.trim() });
    if (!res.ok) return res.data.message || 'That creature could not be brought in. Try again.';
    nowLocal(res.data.save); $('import-form').reset(); $('import-form').hidden = true;
    await showDetails(); done(res.data.creature + ' is now the creature of this account.');
    return null;
  });

  GK.form($('delete-form'), async (f) => {
    if (!f.password) return 'Type your password to confirm.';
    const res = await GK.api('DELETE', '/api/account', { password: f.password });
    if (!res.ok) return res.data.message || 'Nothing was deleted. Try again.';
    try { localStorage.removeItem('glimmerkin.v1'); localStorage.removeItem('glimmerkin.guest'); } catch (e) { }
    GK.setLocalOwner(null);
    location.assign('/');
    return null;
  });

  $('signout').addEventListener('click', async () => {
    $('signout').disabled = true;
    const problem = await GK.signOut(account.id);
    if (problem) { GK.say($('signout-notice'), problem); $('signout').disabled = false; }
  });

  // A guest's creature that was in this browser when it signed in to an account with its own creature.
  // It never replaces the account's creature without being asked.
  let guest = null; try { guest = JSON.parse(localStorage.getItem('glimmerkin.guest')); } catch (e) { }
  if (guest && guest.pet && !account.mustChangePassword) {
    const name = guest.pet.name;
    $('guest-title').textContent = 'This browser also has ' + name;
    $('guest-text').textContent = name + ' was being looked after here as a guest before you signed in. ' + (creature ? 'Your account has ' + creature + '. You can keep ' + creature + ', or bring ' + name + ' in to replace it for good.' : 'You can bring it into your account.');
    $('guest-yes').textContent = creature ? 'Replace ' + creature + ' with ' + name : 'Bring ' + name + ' in';
    $('guest-offer').hidden = false;
    const forget = () => { try { localStorage.removeItem('glimmerkin.guest'); } catch (e) { } $('guest-offer').hidden = true; };
    $('guest-no').addEventListener('click', () => { forget(); done(name + ' was left behind. ' + (creature || 'Your creature') + ' stays.'); });
    $('guest-yes').addEventListener('click', async () => {
      const res = await GK.api('POST', '/api/save/import', { save: guest });
      if (!res.ok) { GK.say($('guest-notice'), res.data.message || 'That did not work. Try again.'); return; }
      nowLocal(res.data.save); forget(); await showDetails(); done(name + ' is now the creature of this account.');
    });
  }
})();
