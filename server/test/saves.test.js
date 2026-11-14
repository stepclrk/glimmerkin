import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { browser, DATABASE_URL, freshApp, HOST, join, sampleSave } from './helpers.js';

const skip = DATABASE_URL ? false : 'DATABASE_URL is not set';
let app, db, clock, close;
before(async () => { if (!skip) ({ app, db, clock, close } = await freshApp()); });
after(async () => { if (close) await close(); });

const code = (doc) => 'GLIM1.' + Buffer.from(JSON.stringify(doc)).toString('base64');

test('saves need a session', { skip }, async () => {
  const b = browser(app);
  assert.equal((await b.get('/api/save')).statusCode, 401);
  assert.equal((await b.put('/api/save', { save: sampleSave() })).statusCode, 401);
  assert.equal((await b.post('/api/save/import', { save: sampleSave() })).statusCode, 401);
});

test('a save is stored and read back; the newer copy wins', { skip }, async () => {
  const phone = await join(app, db, 'mossfox');
  assert.deepEqual((await phone.get('/api/save')).json(), { save: null, savedAt: null, rev: 0 });

  const first = sampleSave('Nimbu', 1_000_000);
  assert.equal((await phone.put('/api/save', { save: first })).statusCode, 200);
  assert.deepEqual((await phone.get('/api/save')).json(), { save: first, savedAt: 1_000_000, rev: 1 });

  // Another device, signed in to the same account, saves later.
  const laptop = browser(app, '203.0.113.9');
  await laptop.post('/api/signin', { username: 'mossfox', password: phone.password });
  const later = { ...sampleSave('Nimbu', 2_000_000), dust: 99 };
  assert.equal((await laptop.put('/api/save', { save: later })).statusCode, 200);

  // The phone, still holding the older copy, is refused and handed the newer one.
  const stale = await phone.put('/api/save', { save: { ...first, savedAt: 1_500_000 } });
  assert.equal(stale.statusCode, 409);
  assert.equal(stale.json().error, 'newer_save');
  assert.deepEqual(stale.json().save, later);
  assert.equal((await phone.get('/api/save')).json().save.dust, 99);
  assert.equal((await phone.put('/api/save', { save: later })).statusCode, 200, 'sending the same copy again is fine');
  assert.equal((await db.query('SELECT count(*)::int AS n FROM saves')).rows[0].n, 1, 'one save per account');
});

test('a save names the copy it grew from; one that grew from an older copy is refused, whatever the clocks say', { skip }, async () => {
  const phone = await join(app, db, 'fernwick');
  const tablet = browser(app, '203.0.113.10');
  await tablet.post('/api/signin', { username: 'fernwick', password: phone.password });

  // The first save names copy 0: the account had none.
  const first = await phone.put('/api/save', { save: sampleSave('Pebbit', 5_000), base: 0 });
  assert.equal(first.statusCode, 200);
  assert.equal(first.json().rev, 1);
  assert.equal((await tablet.put('/api/save', { save: sampleSave('Pebbit', 6_000), base: 0 })).statusCode, 409, 'copy 0 is gone');

  // Both devices read copy 1. The tablet saves first; its clock is behind, which no longer matters.
  const fromTablet = { ...sampleSave('Pebbit', 4_000), dust: 7 };
  const t = await tablet.put('/api/save', { save: fromTablet, base: 1 });
  assert.equal(t.statusCode, 200);
  assert.equal(t.json().rev, 2);

  // The phone played offline from copy 1, with a later clock. It is refused and handed the tablet's copy.
  const p = await phone.put('/api/save', { save: { ...sampleSave('Pebbit', 9_000), dust: 3 }, base: 1 });
  assert.equal(p.statusCode, 409);
  assert.equal(p.json().error, 'other_device');
  assert.match(p.json().message, /Another device/);
  assert.equal(p.json().rev, 2);
  assert.deepEqual(p.json().save, fromTablet);

  // Choosing to keep the phone's copy: it now names copy 2, and is stored as copy 3.
  const kept = await phone.put('/api/save', { save: { ...sampleSave('Pebbit', 9_000), dust: 3 }, base: 2 });
  assert.equal(kept.statusCode, 200);
  assert.equal(kept.json().rev, 3);
  assert.equal((await tablet.get('/api/save')).json().save.dust, 3);

  // A save with no base, from an older game page, still counts the copy on.
  assert.equal((await tablet.put('/api/save', { save: sampleSave('Pebbit', 10_000) })).statusCode, 200);
  assert.equal((await tablet.get('/api/save')).json().rev, 4);

  for (const bad of [-1, 1.5, '2', null]) {
    const res = await phone.put('/api/save', { save: sampleSave('Pebbit', 11_000), base: bad });
    assert.equal(res.statusCode, 400, String(bad));
    assert.equal(res.json().error, 'bad_base');
  }
});

test('a save of the wrong shape, version or size is refused', { skip }, async () => {
  const b = await join(app, db, 'pip_and_dab');
  const good = sampleSave();
  for (const [bad, why] of [
    [{ ...good, v: 2 }, 'version'], [{ ...good, pet: undefined }, 'no creature'], [{ ...good, littles: 'none' }, 'littles'],
    [{ ...good, savedAt: 'yesterday' }, 'savedAt'], [{ ...good, savedAt: Date.now() + 10 * 86_400_000 }, 'future'], ['a string', 'not an object'], [null, 'null'],
  ]) {
    const res = await b.put('/api/save', { save: bad });
    assert.deepEqual([res.statusCode, res.json().error], [400, 'bad_save'], why);
  }
  const big = await b.put('/api/save', { save: { ...good, padding: 'x'.repeat(257 * 1024) } });
  assert.deepEqual([big.statusCode, big.json().error], [400, 'bad_save']);
  const huge = await b.put('/api/save', { save: { ...good, padding: 'x'.repeat(600 * 1024) } });
  assert.deepEqual([huge.statusCode, huge.json().error], [413, 'too_large']);
  assert.equal((await b.get('/api/save')).json().save, null, 'nothing was stored');
});

test('each account sees only its own save', { skip }, async () => {
  const a = await join(app, db, 'captain_wob'), b = await join(app, db, 'tizkin_fan');
  await a.put('/api/save', { save: sampleSave('Wobbit') });
  await b.put('/api/save', { save: sampleSave('Tizkin') });
  assert.equal((await a.get('/api/save')).json().save.pet.name, 'Wobbit');
  assert.equal((await b.get('/api/save')).json().save.pet.name, 'Tizkin');
});

test('a guest creature sent with sign-up becomes the account\'s save', { skip }, async () => {
  const guest = sampleSave('Quilu');
  const b = await join(app, db, 'new_player', { save: guest });
  assert.deepEqual((await b.get('/api/save')).json().save, guest);
  const refused = await browser(app, '203.0.113.20').post('/api/signup', { username: 'bad_guest', password: 'correct-horse', save: { v: 9 } });
  assert.deepEqual([refused.statusCode, refused.json().error], [400, 'bad_save']);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM accounts WHERE username = 'bad_guest'")).rows[0].n, 0, 'a refused sign-up makes no account');
});

test('export and import: a code made by the game comes back as the same creature, and becomes the newest copy', { skip }, async () => {
  const b = await join(app, db, 'importer');
  await b.put('/api/save', { save: sampleSave('Old', clock.t - 5000) });
  const carried = { ...sampleSave('Carried', 1234), dust: 321, toys: { ball: true } };
  const res = await b.post('/api/save/import', { code: code(carried) + '\n' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().creature, 'Carried');
  const stored = (await b.get('/api/save')).json();
  assert.deepEqual({ ...stored.save, savedAt: 0 }, { ...carried, savedAt: 0 }, 'everything but the save time is unchanged');
  assert.ok(stored.savedAt >= clock.t, 'stamped as saved now, so every device takes it');
  // A device still holding the old creature cannot overwrite it.
  assert.equal((await b.put('/api/save', { save: sampleSave('Old', clock.t - 1000) })).statusCode, 409);
  // The same works with the save itself rather than a code.
  assert.equal((await b.post('/api/save/import', { save: sampleSave('FromFile', 5) })).json().creature, 'FromFile');
  for (const bad of ['GLIM1.not-base64-json', 'hello', 'GLIM1.' + Buffer.from('{"v":1}').toString('base64')]) {
    const r = await b.post('/api/save/import', { code: bad });
    assert.deepEqual([r.statusCode, r.json().error], [400, 'bad_save'], bad);
  }
});

test('a one-time password must be replaced before saves are reachable', { skip }, async () => {
  const b = await join(app, db, 'reset_me');
  await db.query("UPDATE accounts SET must_change_password = true WHERE username = 'reset_me'");
  assert.equal((await b.get('/api/save')).json().error, 'must_change_password');
  assert.equal((await b.put('/api/save', { save: sampleSave() })).statusCode, 403);
  assert.equal((await b.get('/api/me')).json().mustChangePassword, true);
});

test('removing an account removes its sessions and its save', { skip }, async () => {
  const b = await join(app, db, 'leaving', { save: sampleSave('Bye') });
  await db.query('DELETE FROM accounts WHERE id = $1', [b.id]);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM saves WHERE account_id = $1', [b.id])).rows[0].n, 0);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM sessions WHERE account_id = $1', [b.id])).rows[0].n, 0);
  assert.equal((await app.inject({ method: 'GET', url: '/api/me', headers: { host: HOST, cookie: b.cookie } })).statusCode, 401);
});
