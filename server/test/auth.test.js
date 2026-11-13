import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { promisify } from 'node:util';
import { browser, DATABASE_URL, freshApp, join } from './helpers.js';

const skip = DATABASE_URL ? false : 'DATABASE_URL is not set';
let app, db, clock, close;
before(async () => { if (!skip) ({ app, db, clock, close } = await freshApp()); });
after(async () => { if (close) await close(); });

test('a username and a password create an account, with no invite code', { skip }, async () => {
  const b = browser(app);
  const res = await b.post('/api/signup', { username: 'mossfox', password: 'correct-horse' });
  assert.equal(res.statusCode, 201);
  assert.equal(res.json().username, 'mossfox');
  assert.equal(res.json().role, 'player');

  const cookie = String(res.headers['set-cookie']);
  assert.match(cookie, /^gk_session=[\w-]{40,};/);
  for (const flag of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/', 'Max-Age=2592000']) assert.ok(cookie.includes(flag), `cookie is missing ${flag}`);

  const account = (await db.query('SELECT password_hash FROM accounts WHERE username = $1', ['mossfox'])).rows[0];
  assert.match(account.password_hash, /^\$argon2id\$/, 'the password is stored as an argon2id hash');
  const session = (await db.query('SELECT token_hash, expires_at FROM sessions')).rows[0];
  assert.match(session.token_hash, /^[0-9a-f]{64}$/);
  assert.ok(!cookie.includes(session.token_hash), 'only the hash of the token is stored');
  const days = (new Date(session.expires_at) - Date.now()) / 86_400_000;
  assert.ok(days > 29.9 && days < 30.1, 'the session lasts 30 days');

  assert.equal((await b.get('/api/me')).json().username, 'mossfox');
});

test('weak passwords, odd usernames and taken usernames are refused', { skip }, async () => {
  const b = browser(app, '203.0.113.2');
  assert.equal((await b.post('/api/signup', { username: 'pip', password: 'short' })).json().error, 'bad_password');
  assert.equal((await b.post('/api/signup', { username: 'a b', password: 'correct-horse' })).json().error, 'bad_username');
  const taken = await b.post('/api/signup', { username: 'MossFox', password: 'correct-horse' });
  assert.equal(taken.statusCode, 409);
  assert.equal(taken.json().error, 'username_taken');
  assert.equal((await b.post('/api/signup', { username: 'pip_and_dab', password: 'correct-horse' })).statusCode, 201);
});

test('sign-up is limited to 10 tries in ten minutes from one address', { skip }, async () => {
  const b = browser(app, '203.0.113.40');
  for (let i = 0; i < 10; i++) assert.equal((await b.post('/api/signup', { username: 'a b', password: 'correct-horse' })).statusCode, 400);
  const blocked = await b.post('/api/signup', { username: 'limit_test', password: 'correct-horse' });
  assert.deepEqual([blocked.statusCode, blocked.json().error], [429, 'too_many_tries']);
  assert.equal((await browser(app, '203.0.113.41').post('/api/signup', { username: 'limit_test', password: 'correct-horse' })).statusCode, 201, 'another address is not held up');
});

test('signing in: right password, any capitals in the username; wrong password refused', { skip }, async () => {
  const b = browser(app, '203.0.113.3');
  const wrong = await b.post('/api/signin', { username: 'mossfox', password: 'not-the-password' });
  assert.equal(wrong.statusCode, 401);
  assert.equal(wrong.json().error, 'wrong_details');
  assert.equal(wrong.headers['set-cookie'], undefined);
  const nobody = await b.post('/api/signin', { username: 'no_such_player', password: 'not-the-password' });
  assert.deepEqual([nobody.statusCode, nobody.json().message], [401, wrong.json().message], 'an unknown username reads the same as a wrong password');
  const ok = await b.post('/api/signin', { username: 'MOSSFOX', password: 'correct-horse' });
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.json().username, 'mossfox');
  assert.equal((await b.get('/api/me')).statusCode, 200);
});

test('sign-in attempts are rate-limited per username and per address', { skip }, async () => {
  // Per username: five wrong passwords from five different addresses lock the name for ten minutes.
  for (let i = 0; i < 5; i++) assert.equal((await browser(app, `198.51.100.${i}`).post('/api/signin', { username: 'pip_and_dab', password: 'wrong-password' })).statusCode, 401);
  const locked = await browser(app, '198.51.100.9').post('/api/signin', { username: 'pip_and_dab', password: 'correct-horse' });
  assert.equal(locked.statusCode, 429);
  assert.equal(locked.json().error, 'too_many_tries');
  clock.t += 11 * 60 * 1000;
  assert.equal((await browser(app, '198.51.100.9').post('/api/signin', { username: 'pip_and_dab', password: 'correct-horse' })).statusCode, 200);

  // Per address: twenty tries of any kind from one address, read from CF-Connecting-IP.
  const b = browser(app, '192.0.2.77');
  for (let i = 0; i < 20; i++) assert.equal((await b.post('/api/signin', { username: `ghost_${i}`, password: 'wrong-password' })).statusCode, 401);
  assert.equal((await b.post('/api/signin', { username: 'mossfox', password: 'correct-horse' })).statusCode, 429);
  assert.equal((await browser(app, '192.0.2.78').post('/api/signin', { username: 'mossfox', password: 'correct-horse' })).statusCode, 200);
});

test('a session that has run out no longer works, and is cleared at the next sign-in', { skip }, async () => {
  const b = await join(app, db, 'long_gone');
  await db.query("UPDATE sessions SET expires_at = now() - interval '1 minute' WHERE account_id = $1", [b.id]);
  assert.equal((await b.get('/api/me')).statusCode, 401);
  await join(app, db, 'just_arrived');
  assert.equal((await db.query('SELECT count(*)::int AS n FROM sessions WHERE account_id = $1', [b.id])).rows[0].n, 0);
});

test('signing out ends the session', { skip }, async () => {
  const b = await join(app, db, 'captain_wob');
  const token = b.cookie;
  assert.equal((await b.get('/api/me')).statusCode, 200);
  const out = await b.post('/api/signout');
  assert.equal(out.statusCode, 204);
  assert.match(String(out.headers['set-cookie']), /Max-Age=0/);
  assert.equal((await b.get('/api/me')).statusCode, 401);
  b.cookie = token; // a copied cookie is no use either: the session is gone from the database
  assert.equal((await b.get('/api/me')).statusCode, 401);
});

test('requests that change data must carry the site\'s own Origin and be JSON', { skip }, async () => {
  const b = browser(app, '203.0.113.50');
  const details = { username: 'mossfox', password: 'correct-horse' };
  assert.equal((await b.post('/api/signin', details, { origin: null })).json().error, 'bad_origin');
  assert.equal((await b.post('/api/signin', details, { origin: 'https://evil.example' })).json().error, 'bad_origin');
  const form = await app.inject({ method: 'POST', url: '/api/signin', headers: { host: 'glimmerkin.test', origin: 'https://glimmerkin.test', 'content-type': 'application/x-www-form-urlencoded' }, payload: 'username=mossfox&password=correct-horse' });
  assert.equal(form.statusCode, 415);
  assert.equal((await b.post('/api/signin', details)).statusCode, 200);
});

test('changing a password signs out other devices; a one-time password must be replaced first', { skip }, async () => {
  const phone = await join(app, db, 'tizkin_fan', { address: '203.0.113.60' });
  const laptop = browser(app, '203.0.113.61');
  await laptop.post('/api/signin', { username: 'tizkin_fan', password: phone.password });
  assert.equal((await phone.post('/api/password', { current: 'wrong-password', next: 'a-brand-new-one' })).statusCode, 401);
  assert.equal((await phone.post('/api/password', { current: phone.password, next: 'short' })).json().error, 'bad_password');
  assert.equal((await phone.post('/api/password', { current: phone.password, next: 'a-brand-new-one' })).statusCode, 200);
  assert.equal((await phone.get('/api/me')).statusCode, 200, 'this device stays signed in');
  assert.equal((await laptop.get('/api/me')).statusCode, 401, 'the other device is signed out');
  assert.equal((await laptop.post('/api/signin', { username: 'tizkin_fan', password: 'a-brand-new-one' })).statusCode, 200);
});

test('the owner command creates the first owner with a one-time password', { skip }, async () => {
  const cli = resolve(import.meta.dirname, '../dist/cli.js');
  const { stdout } = await promisify(execFile)(process.execPath, [cli, 'owner', 'stephen'], { env: { ...process.env, DATABASE_URL } });
  const password = /One-time password: (\S+)/.exec(stdout)?.[1];
  assert.ok(password && password.length >= 10, stdout);
  const b = browser(app, '203.0.113.70');
  const res = await b.post('/api/signin', { username: 'stephen', password });
  assert.deepEqual([res.statusCode, res.json().role, res.json().mustChangePassword], [200, 'owner', true]);
  assert.equal((await b.post('/api/password', { current: password, next: 'my-own-password' })).statusCode, 200);
  assert.equal((await b.get('/api/me')).json().mustChangePassword, false);
});

test('pages: landing, privacy, sign in and join are served with a strict policy; the game still needs no account', { skip }, async () => {
  assert.match((await app.inject({ method: 'GET', url: '/' })).body, /Play as a guest/);
  assert.match((await app.inject({ method: 'GET', url: '/privacy' })).body, /What we keep about you/);
  for (const url of ['/', '/privacy', '/signin', '/join']) {
    const res = await app.inject({ method: 'GET', url });
    assert.equal(res.statusCode, 200, url);
    assert.match(res.headers['content-security-policy'], /script-src 'self';/, url);
  }
  assert.match((await app.inject({ method: 'GET', url: '/assets/site.css' })).headers['content-type'], /^text\/css/);
  assert.equal((await app.inject({ method: 'GET', url: '/assets/nope.js' })).statusCode, 404);
  assert.equal((await app.inject({ method: 'GET', url: '/play' })).statusCode, 200);
});
