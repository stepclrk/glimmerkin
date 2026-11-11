import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { buildApp } from '../dist/app.js';

const gameFile = resolve(import.meta.dirname, '../../dist/index.html');
assert.ok(existsSync(gameFile), 'dist/index.html is missing. Run `sh build.sh` in the repository root first.');
const app = buildApp({ gameFile });

test('the game is served at /play with no sign-in', async () => {
  const res = await app.inject({ method: 'GET', url: '/play' });
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['content-type'], /^text\/html/);
  assert.match(res.body, /<title>Glimmerkin<\/title>/);
  assert.match(res.body, /function genWorld\(/, 'the page should carry the game script');
  assert.equal(res.headers['set-cookie'], undefined, 'guest play sets no cookie');
});

test('an unchanged page answers 304', async () => {
  const first = await app.inject({ method: 'GET', url: '/play' });
  const again = await app.inject({ method: 'GET', url: '/play', headers: { 'if-none-match': first.headers.etag } });
  assert.equal(again.statusCode, 304);
  assert.equal(again.body, '');
});

test('with no pages folder, the front door leads to the game', async () => {
  const res = await app.inject({ method: 'GET', url: '/' });
  assert.equal(res.statusCode, 302);
  assert.equal(res.headers.location, '/play');
});

test('health check', async () => {
  const res = await app.inject({ method: 'GET', url: '/healthz' });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { ok: true });
});

test('security headers are on every answer', async () => {
  for (const url of ['/play', '/healthz', '/nope']) {
    const res = await app.inject({ method: 'GET', url });
    assert.equal(res.headers['x-content-type-options'], 'nosniff', url);
    assert.match(res.headers['content-security-policy'], /frame-ancestors 'none'/, url);
    assert.equal(res.headers['referrer-policy'], 'no-referrer', url);
  }
});

test('unknown addresses answer 404 and point at the game', async () => {
  const res = await app.inject({ method: 'GET', url: '/nope' });
  assert.equal(res.statusCode, 404);
  assert.match(res.body, /\/play/);
});
