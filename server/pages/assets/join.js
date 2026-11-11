// A creature already living in this browser, and not tied to another account, comes along.
const guest = GK.localOwner() ? null : GK.localSave();
if (guest) document.getElementById('join-creature').textContent = 'Your guest creature, ' + guest.pet.name + ', comes with you.';

GK.form(document.getElementById('join'), async (fields) => {
  if (!fields.code.trim()) return 'Type the invite code you were given.';
  if (!/^[A-Za-z0-9_]{3,20}$/.test(fields.username.trim())) return 'A username is 3 to 20 letters, numbers or underscores. Make one up; do not use your real name.';
  if (fields.password.length < 10) return 'A password needs at least 10 characters.';
  const body = { code: fields.code.trim(), username: fields.username.trim(), password: fields.password };
  if (guest) body.save = guest;
  const res = await GK.api('POST', '/api/signup', body);
  if (!res.ok) return res.data.message || 'The account could not be created. Try again.';
  // From now on the creature in this browser belongs to this account. A browser that held another
  // account's creature starts clean, so that creature is never copied into the new account.
  if (!guest) { try { localStorage.removeItem('glimmerkin.v1'); } catch (e) { } }
  GK.setLocalOwner(res.data.id);
  location.assign('/play');
});
