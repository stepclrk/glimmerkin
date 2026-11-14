import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { ANDROID_PACKAGE, readFingerprints } from '../dist/android.js';
import { buildApp } from '../dist/app.js';

const gameFile = resolve(import.meta.dirname, '../../dist/index.html');
const A = '14:6D:E9:83:C5:73:06:50:D8:EE:B9:95:2F:34:FC:64:16:A0:83:42:E6:1D:BE:A8:8A:04:96:B2:3F:CF:44:E5';
const B_BARE = 'aa'.repeat(32);
const B = Array(32).fill('AA').join(':');

test('fingerprints are read in either form, and anything else is left out', () => {
  const { fingerprints, rejected } = readFingerprints(` ${A}, ${B_BARE}  ${A.toLowerCase()} not-a-fingerprint, AB:CD`);
  assert.deepEqual(fingerprints, [A, B]);
  assert.deepEqual(rejected, ['not-a-fingerprint', 'AB:CD']);
  assert.deepEqual(readFingerprints(undefined), { fingerprints: [], rejected: [] });
  assert.deepEqual(readFingerprints(''), { fingerprints: [], rejected: [] });
});

test('with no fingerprints, assetlinks.json claims no app', async () => {
  const app = buildApp({ gameFile });
  const res = await app.inject({ method: 'GET', url: '/.well-known/assetlinks.json' });
  assert.equal(res.statusCode, 200);
  assert.match(res.headers['content-type'], /^application\/json/);
  assert.deepEqual(res.json(), []);
});

test('assetlinks.json lets the Android app open the site full screen', async () => {
  const app = buildApp({ gameFile, androidFingerprints: [A, B] });
  const res = await app.inject({ method: 'GET', url: '/.well-known/assetlinks.json' });
  assert.equal(res.statusCode, 200);
  assert.ok(res.headers['x-content-type-options'], 'security headers are on this answer too');
  assert.deepEqual(res.json(), [{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: { namespace: 'android_app', package_name: ANDROID_PACKAGE, sha256_cert_fingerprints: [A, B] },
  }]);
  assert.equal(ANDROID_PACKAGE, 'io.flokr.glimmerkin');
});

test('the Android project opens this site, as the package assetlinks.json names', () => {
  const gradle = readFileSync(resolve(import.meta.dirname, '../../android/app/build.gradle'), 'utf8');
  assert.match(gradle, new RegExp(`applicationId "${ANDROID_PACKAGE.replace(/\./g, '\\.')}"`));
  assert.match(gradle, /hostName: 'glimmerkin\.flokr\.io'/);
  assert.match(gradle, /launchUrl: '\/play'/);
});
