import { resolve } from 'node:path';
import { buildApp } from '../dist/app.js';
import { connect, migrate } from '../dist/db.js';

export const gameFile = resolve(import.meta.dirname, '../../dist/index.html');
export const pagesDir = resolve(import.meta.dirname, '../pages');
export const DATABASE_URL = process.env.DATABASE_URL;
export const HOST = 'glimmerkin.test';

/** An empty, migrated database and an app on top of it, with a clock the test can move. */
export async function freshApp() {
  const db = connect(DATABASE_URL);
  await db.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migrate(db);
  const clock = { t: Date.now() };
  const app = buildApp({ gameFile, pagesDir, db, now: () => clock.t });
  return { app, db, clock, close: async () => { await app.close(); await db.end(); } };
}

/** A browser on the site: remembers its cookie and sends the site's own Origin. */
export function browser(app, address = '203.0.113.1') {
  let cookie = '';
  const call = async (method, url, body, extra = {}) => {
    const headers = { host: HOST, 'cf-connecting-ip': address, ...(cookie ? { cookie } : {}), ...(method === 'GET' ? {} : { origin: `https://${HOST}` }), ...extra };
    if (extra.origin === null) delete headers.origin;
    const res = await app.inject({ method, url, headers, ...(body === undefined ? {} : { payload: body }) });
    const set = res.headers['set-cookie'];
    if (set) cookie = String(set).split(';')[0].endsWith('=') ? '' : String(set).split(';')[0];
    return res;
  };
  return {
    get: (url) => call('GET', url),
    post: (url, body = {}, extra) => call('POST', url, body, extra),
    put: (url, body = {}, extra) => call('PUT', url, body, extra),
    del: (url, body, extra) => call('DELETE', url, body, extra),
    get cookie() { return cookie; },
    set cookie(value) { cookie = value; },
  };
}

/** Creates an account through the real sign-up route and returns a browser signed in to it. */
export async function join(app, db, username, { password = 'correct-horse-1', save, address } = {}) {
  // Each new player arrives from their own address, so sign-up limits do not get in the way of other tests.
  const b = browser(app, address ?? `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`);
  const res = await b.post('/api/signup', { username, password, ...(save ? { save } : {}) });
  if (res.statusCode !== 201) throw new Error(`sign-up failed: ${res.statusCode} ${res.body}`);
  return Object.assign(b, { id: res.json().id, username, password });
}

export function sampleSave(name = 'Nimbu', savedAt = Date.now() - 60_000) {
  return { v: 1, createdAt: savedAt - 1000, savedAt, lastTick: savedAt, pet: { name, seed: 42, xp: 30, belly: 62, joy: 55, rest: 100, asleep: false, diet: {} },
    littles: [{ id: 'l1', kind: 'ember', name: 'Pip', seed: 7, xp: 0 }], party: ['l1'], eggs: [], pantry: { ember: 2 }, quests: 1, portals: null, sound: true, dust: 5 };
}
