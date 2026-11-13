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

test('the game page points phones at the manifest and the home screen icon', async () => {
  const res = await app.inject({ method: 'GET', url: '/play' });
  assert.match(res.body, /<link rel="manifest" href="\/manifest\.webmanifest">/);
  assert.match(res.body, /<link rel="apple-touch-icon" href="\/apple-touch-icon\.png">/);
  assert.ok(res.body.indexOf('rel="manifest"') < res.body.indexOf('</head>'), 'the tags belong in the head');
});

test('the manifest opens the game full screen', async () => {
  const res = await app.inject({ method: 'GET', url: '/manifest.webmanifest' });
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['content-type'], /^application\/manifest\+json/);
  const m = JSON.parse(res.body);
  assert.equal(m.name, 'Glimmerkin');
  assert.equal(m.start_url, '/play');
  assert.equal(m.display, 'standalone');
  const sizes = m.icons.map((i) => i.sizes);
  assert.ok(sizes.includes('192x192') && sizes.includes('512x512'), 'Chrome needs a 192 and a 512 icon to offer an install');
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'));
});

for (const [url, size] of [['/icons/icon-192.png', 192], ['/icons/icon-512.png', 512], ['/apple-touch-icon.png', 180]]) {
  test(`${url} is a ${size} pixel PNG`, async () => {
    const res = await app.inject({ method: 'GET', url });
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['content-type'], 'image/png');
    const png = res.rawPayload;
    assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  });
}
