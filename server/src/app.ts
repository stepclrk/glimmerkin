import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import Fastify, { type FastifyInstance } from 'fastify';

export interface AppOptions {
  /** Path to the built game page (dist/index.html). */
  gameFile: string;
  logger?: boolean;
}

/**
 * The game is one self-contained page whose script and styles are inline, so the policy has to allow
 * inline code. Everything else is locked to this site, plus Google Fonts for the typefaces.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com',
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join('; ');

export function buildApp(options: AppOptions): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? false });

  // Read once at start-up: the page only changes when the image is rebuilt.
  const game = readFileSync(options.gameFile);
  const etag = '"' + createHash('sha256').update(game).digest('hex').slice(0, 32) + '"';

  app.addHook('onSend', async (_request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('Content-Security-Policy', CONTENT_SECURITY_POLICY);
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  });

  app.get('/healthz', async () => ({ ok: true }));

  // The game. It never requires an account: nobody meets a sign-in screen before they can play.
  app.get('/play', async (request, reply) => {
    reply.header('ETag', etag).header('Cache-Control', 'no-cache');
    if (request.headers['if-none-match'] === etag) return reply.code(304).send();
    return reply.type('text/html; charset=utf-8').send(game);
  });

  // Until the landing page exists, the front door leads straight to the game.
  app.get('/', async (_request, reply) => reply.redirect('/play', 302));

  app.setNotFoundHandler(async (_request, reply) =>
    reply.code(404).type('text/plain; charset=utf-8').send('Nothing lives at this address. The game is at /play\n'),
  );

  return app;
}
