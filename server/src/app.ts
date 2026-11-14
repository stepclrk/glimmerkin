import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Db } from './db.js';
import { refuse, type Context } from './http.js';
import { buildId, installRoutes, withHeadTags } from './install.js';
import { pageRoutes } from './pages.js';
import { authRoutes } from './routes/auth.js';
import { ownerRoutes } from './routes/owner.js';
import { saveRoutes } from './routes/saves.js';

export interface AppOptions {
  /** Path to the built game page (dist/index.html). */
  gameFile: string;
  /** The offline copy's service worker. Defaults to sw.js beside the game page; without one, /sw.js is not served. */
  workerFile?: string;
  /** Folder holding the pages around the game. Without it only the game is served. */
  pagesDir?: string;
  /** The database. Without it the game still plays, saving in the browser; accounts answer 503. */
  db?: Db;
  /** Mark the session cookie Secure. On, except when testing over plain HTTP. */
  secureCookies?: boolean;
  /** Where the backup job writes its files, so the owner page can say when the last one ran. */
  backupDir?: string;
  logger?: boolean;
  now?: () => number;
}

/**
 * The game is one self-contained page whose script and styles are inline, so its policy has to allow
 * inline code. Everything else is locked to this site, plus Google Fonts for the typefaces.
 */
const GAME_POLICY = [
  "default-src 'self'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com',
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "worker-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join('; ');

const CHANGES_DATA = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function buildApp(options: AppOptions): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? false, bodyLimit: 400 * 1024 });

  // Read once at start-up: the page only changes when the image is rebuilt. The server adds the tags that let a
  // phone keep the game on its home screen; the page itself stays the same everywhere else it runs.
  // The page also says which build it is, so a copy left open on a phone can find out when it is out of date.
  const raw = readFileSync(options.gameFile), build = buildId(raw);
  const game = withHeadTags(raw, build);
  const workerFile = options.workerFile ?? join(dirname(options.gameFile), 'sw.js');
  const worker = existsSync(workerFile) ? readFileSync(workerFile) : null;
  const etag = '"' + createHash('sha256').update(game).digest('hex').slice(0, 32) + '"';

  app.addHook('onSend', async (_request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'no-referrer');
    if (!reply.hasHeader('Content-Security-Policy')) reply.header('Content-Security-Policy', GAME_POLICY);
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  });

  // Requests that change data must be JSON and come from this site's own pages.
  app.addHook('preValidation', async (request, reply) => {
    if (!request.url.startsWith('/api/')) return;
    reply.header('Cache-Control', 'no-store');
    if (!CHANGES_DATA.has(request.method)) return;
    let originHost: string | null = null;
    try { originHost = new URL(request.headers.origin ?? '').host; } catch { /* missing or malformed */ }
    if (!originHost || originHost !== request.headers.host) {
      return refuse(reply, 403, 'bad_origin', 'This request did not come from the Glimmerkin site, so it was refused.');
    }
    if (request.body !== undefined && !(request.headers['content-type'] ?? '').startsWith('application/json')) {
      return refuse(reply, 415, 'not_json', 'Send JSON.');
    }
  });

  app.get('/healthz', async () => ({ ok: true }));

  // The game. It never requires an account: nobody meets a sign-in screen before they can play.
  app.get('/play', async (request, reply) => {
    reply.header('ETag', etag).header('Cache-Control', 'no-cache');
    if (request.headers['if-none-match'] === etag) return reply.code(304).send();
    return reply.type('text/html; charset=utf-8').send(game);
  });

  installRoutes(app, build, worker);

  const ctx: Context | null = options.db
    ? { db: options.db, secureCookies: options.secureCookies ?? true, now: options.now ?? Date.now, backupDir: options.backupDir }
    : null;

  if (ctx) {
    authRoutes(app, ctx);
    saveRoutes(app, ctx);
    ownerRoutes(app, ctx);
  } else {
    app.all('/api/*', async (_request, reply) =>
      refuse(reply, 503, 'no_accounts', 'Accounts are not set up on this server. The game still saves in this browser.'));
  }

  const pages = options.pagesDir ? pageRoutes(app, options.pagesDir, ctx) : new Set<string>();

  // A server with no pages folder still has a front door: it leads straight to the game.
  if (!pages.has('/')) app.get('/', async (_request, reply) => reply.redirect('/play', 302));

  app.setNotFoundHandler(async (request, reply) => {
    if (request.url.startsWith('/api/')) return refuse(reply, 404, 'not_found', 'There is nothing at this address.');
    return reply.code(404).type('text/plain; charset=utf-8').send('Nothing lives at this address. The game is at /play\n');
  });

  app.setErrorHandler(async (error: { statusCode?: number; message?: string }, request, reply) => {
    const status = error.statusCode && error.statusCode >= 400 && error.statusCode < 500 ? error.statusCode : 500;
    if (status === 500) request.log.error(error);
    if (status === 413) return refuse(reply, 413, 'too_large', 'That is too large to send. A save can be at most 256 KB.');
    if (status === 500) return refuse(reply, 500, 'server_error', 'Something went wrong on the server. Try again in a moment.');
    return refuse(reply, status, 'bad_request', 'The server could not read that request.');
  });

  return app;
}
