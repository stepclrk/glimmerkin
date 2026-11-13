import assert from 'node:assert/strict';
import { mkdtempSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join as path } from 'node:path';
import { after, before, test } from 'node:test';
import { buildApp } from '../dist/app.js';
import { browser, DATABASE_URL, freshApp, gameFile, HOST, join, pagesDir, sampleSave } from './helpers.js';

const skip = DATABASE_URL ? false : 'DATABASE_URL is not set';
let app, db, close, owner, player;
before(async () => {
  if (skip) return;
  ({ app, db, close } = await freshApp());
  owner = await join(app, db, 'stephen');
  await db.query("UPDATE accounts SET role = 'owner' WHERE id = $1", [owner.id]);
  player = await join(app, db, 'mossfox', { save: { ...sampleSave('Nimbu'), pet: { ...sampleSave().pet, name: 'Nimbu', xp: 130 } } });
});
after(async () => { if (close) await close(); });

test('the owner routes and the owner page are for the owner role only', { skip }, async () => {
  const anonymous = browser(app);
  for (const [method, url] of [['get', '/api/owner/summary'], ['get', '/api/owner/players'], ['post', `/api/owner/players/${owner.id}/reset`], ['del', `/api/owner/players/${owner.id}`]]) {
    assert.equal((await anonymous[method](url)).statusCode, 401, `${method} ${url} signed out`);
    const res = await player[method](url);
    assert.deepEqual([res.statusCode, res.json().error], [403, 'owner_only'], `${method} ${url} as a player`);
  }
  const page = (b) => app.inject({ method: 'GET', url: '/owner', headers: { host: HOST, ...(b ? { cookie: b.cookie } : {}) } });
  assert.deepEqual([(await page()).statusCode, (await page()).headers.location], [302, '/signin']);
  assert.deepEqual([(await page(player)).statusCode, (await page(player)).headers.location], [302, '/account']);
  assert.equal((await page(owner)).statusCode, 200);
  assert.equal((await app.inject({ method: 'GET', url: '/account', headers: { host: HOST } })).headers.location, '/signin');
  assert.equal((await app.inject({ method: 'GET', url: '/account', headers: { host: HOST, cookie: player.cookie } })).statusCode, 200);
});

test('the invite-code routes are gone', { skip }, async () => {
  assert.equal((await owner.get('/api/owner/invites')).statusCode, 404);
  assert.equal((await owner.post('/api/owner/invites')).statusCode, 404);
});

test('players: username, creature, form and last played', { skip }, async () => {
  const players = (await owner.get('/api/owner/players')).json().players;
  const fox = players.find((p) => p.username === 'mossfox');
  assert.deepEqual([fox.creature, fox.form, fox.you], ['Nimbu', 'Fledgling', false]);
  assert.ok(fox.lastPlayed);
  const me = players.find((p) => p.username === 'stephen');
  assert.deepEqual([me.you, me.role, me.creature], [true, 'owner', null]);
  const summary = (await owner.get('/api/owner/summary')).json();
  assert.deepEqual([summary.players, summary.lastBackup], [2, null]);
  assert.ok(!JSON.stringify(players).includes('argon2'), 'no password hashes leave the server');
});

test('reset password issues a one-time password that must be replaced at next sign-in', { skip }, async () => {
  const res = await owner.post(`/api/owner/players/${player.id}/reset`);
  assert.equal(res.statusCode, 200);
  const { oneTimePassword } = res.json();
  assert.ok(oneTimePassword.length >= 10);
  assert.equal((await player.get('/api/me')).statusCode, 401, 'the player is signed out everywhere');
  const b = browser(app, '203.0.113.31');
  assert.equal((await b.post('/api/signin', { username: 'mossfox', password: player.password })).statusCode, 401, 'the old password no longer works');
  const signin = await b.post('/api/signin', { username: 'mossfox', password: oneTimePassword });
  assert.deepEqual([signin.statusCode, signin.json().mustChangePassword], [200, true]);
  assert.equal((await b.get('/api/save')).json().error, 'must_change_password');
  assert.equal((await b.post('/api/password', { current: oneTimePassword, next: 'my-very-own-password' })).statusCode, 200);
  assert.equal((await b.get('/api/save')).json().save.pet.name, 'Nimbu', 'the creature is untouched by a reset');
  assert.equal((await owner.post('/api/owner/players/not-an-id/reset')).statusCode, 404);
  player = Object.assign(b, { id: player.id, password: 'my-very-own-password' });
});

test('remove deletes the account, its sessions and its save; the owner cannot remove themself here', { skip }, async () => {
  assert.equal((await owner.del(`/api/owner/players/${owner.id}`)).json().error, 'that_is_you');
  assert.equal((await owner.del(`/api/owner/players/${player.id}`)).statusCode, 204);
  assert.equal((await player.get('/api/me')).statusCode, 401);
  for (const table of ['accounts', 'sessions', 'saves']) {
    const column = table === 'accounts' ? 'id' : 'account_id';
    assert.equal((await db.query(`SELECT count(*)::int AS n FROM ${table} WHERE ${column} = $1`, [player.id])).rows[0].n, 0, table);
  }
  assert.equal((await owner.del(`/api/owner/players/${player.id}`)).statusCode, 404);
});

test('a player deletes their own account after typing their password; the only owner cannot', { skip }, async () => {
  const b = await join(app, db, 'leaving_now', { save: sampleSave('Bye') });
  assert.equal((await b.del('/api/account', { password: 'not-my-password' })).statusCode, 401);
  assert.equal((await b.get('/api/me')).statusCode, 200, 'a wrong password deletes nothing');
  const gone = await b.del('/api/account', { password: b.password });
  assert.equal(gone.statusCode, 204);
  assert.match(String(gone.headers['set-cookie']), /Max-Age=0/);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM accounts WHERE username = 'leaving_now'")).rows[0].n, 0);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM saves WHERE account_id = $1', [b.id])).rows[0].n, 0);
  const last = await owner.del('/api/account', { password: owner.password });
  assert.deepEqual([last.statusCode, last.json().error], [409, 'only_owner']);
});

test('the summary on the owner page: creature summary for the account page, and the last backup time', { skip }, async () => {
  const b = await join(app, db, 'summary_fan', { save: sampleSave('Olmi') });
  const s = (await b.get('/api/save/summary')).json();
  assert.deepEqual([s.creature, s.form], ['Olmi', 'Hatchling']);
  assert.ok(s.lastSaved);

  const dir = mkdtempSync(path(tmpdir(), 'gk-backups-'));
  writeFileSync(path(dir, 'glimmerkin-old.sql.gz.enc'), 'x'); utimesSync(path(dir, 'glimmerkin-old.sql.gz.enc'), new Date('2026-11-01T03:00:00Z'), new Date('2026-11-01T03:00:00Z'));
  writeFileSync(path(dir, 'glimmerkin-new.sql.gz.enc'), 'x'); utimesSync(path(dir, 'glimmerkin-new.sql.gz.enc'), new Date('2026-11-10T03:00:00Z'), new Date('2026-11-10T03:00:00Z'));
  writeFileSync(path(dir, 'notes.txt'), 'not a backup');
  const withBackups = buildApp({ gameFile, pagesDir, db, backupDir: dir });
  const res = await withBackups.inject({ method: 'GET', url: '/api/owner/summary', headers: { host: HOST, cookie: owner.cookie } });
  assert.equal(res.json().lastBackup, '2026-11-10T03:00:00.000Z');
  await withBackups.close();
});
