import type { FastifyInstance } from 'fastify';

/**
 * The Android app on Google Play is the same game page, opened full screen by Chrome (a Trusted Web Activity).
 * Chrome hides its address bar only when this site says the app is its own: /.well-known/assetlinks.json names
 * the app's package and the fingerprints of the keys it is signed with. See android/README.md.
 */
export const ANDROID_PACKAGE = 'io.flokr.glimmerkin';

/**
 * Reads SHA-256 certificate fingerprints from a list separated by commas or spaces, as Play Console shows them
 * (AB:CD:...) or as bare hex. Returns them in the AB:CD:... form, with anything that is not a fingerprint left out.
 */
export function readFingerprints(list: string | undefined): { fingerprints: string[]; rejected: string[] } {
  const fingerprints: string[] = [], rejected: string[] = [];
  for (const item of (list ?? '').split(/[\s,]+/).filter(Boolean)) {
    const hex = item.replace(/:/g, '').toUpperCase();
    if (!/^[0-9A-F]{64}$/.test(hex)) { rejected.push(item); continue; }
    const pairs = hex.match(/../g) as string[];
    const fingerprint = pairs.join(':');
    if (!fingerprints.includes(fingerprint)) fingerprints.push(fingerprint);
  }
  return { fingerprints, rejected };
}

/** Answers /.well-known/assetlinks.json. With no fingerprints it answers an empty list: the site claims no app. */
export function androidRoutes(app: FastifyInstance, fingerprints: string[]): void {
  const statements = fingerprints.length
    ? [{
      relation: ['delegate_permission/common.handle_all_urls'],
      target: { namespace: 'android_app', package_name: ANDROID_PACKAGE, sha256_cert_fingerprints: fingerprints },
    }]
    : [];
  const body = JSON.stringify(statements);
  app.get('/.well-known/assetlinks.json', async (_request, reply) =>
    reply.header('Cache-Control', 'public, max-age=300').type('application/json').send(body));
}
