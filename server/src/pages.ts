import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { currentAccount, type Context } from './http.js';

/** The pages around the game load their scripts and styles from this site only: nothing inline. */
export const PAGE_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com',
  "img-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join('; ');

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
};

interface File { body: Buffer; type: string; etag: string }

function load(path: string): File {
  const body = readFileSync(path);
  return { body, type: TYPES[extname(path)] ?? 'application/octet-stream', etag: '"' + createHash('sha256').update(body).digest('hex').slice(0, 32) + '"' };
}

function send(request: FastifyRequest, reply: FastifyReply, file: File): FastifyReply {
  reply.header('ETag', file.etag).header('Cache-Control', 'no-cache');
  if (request.headers['if-none-match'] === file.etag) return reply.code(304).send();
  return reply.type(file.type).send(file.body);
}

/** Which page lives at which address, and who may open it. */
const PAGES: Array<{ path: string; file: string; needs?: 'account' | 'owner' }> = [
  { path: '/', file: 'index.html' },
  { path: '/signin', file: 'signin.html' },
  { path: '/join', file: 'join.html' },
  { path: '/account', file: 'account.html', needs: 'account' },
  { path: '/owner', file: 'owner.html', needs: 'owner' },
  { path: '/privacy', file: 'privacy.html' },
];

/** Serves whichever of the pages exist in pagesDir, and everything in its assets folder. */
export function pageRoutes(app: FastifyInstance, pagesDir: string, ctx: Context | null): Set<string> {
  const served = new Set<string>();

  for (const page of PAGES) {
    const path = join(pagesDir, page.file);
    if (!existsSync(path)) continue;
    const file = load(path);
    served.add(page.path);
    app.get(page.path, async (request, reply) => {
      reply.header('Content-Security-Policy', PAGE_POLICY);
      if (page.needs) {
        const account = ctx ? await currentAccount(ctx, request).catch(() => null) : null;
        if (!account) return reply.redirect('/signin', 302);
        if (page.needs === 'owner' && account.role !== 'owner') return reply.redirect('/account', 302);
      }
      return send(request, reply, file);
    });
  }

  const assetsDir = join(pagesDir, 'assets');
  if (existsSync(assetsDir)) {
    const assets = new Map(readdirSync(assetsDir).map((name) => [name, load(join(assetsDir, name))] as const));
    app.get<{ Params: { name: string } }>('/assets/:name', async (request, reply) => {
      const file = assets.get(request.params.name);
      if (!file) return reply.callNotFound();
      reply.header('Content-Security-Policy', PAGE_POLICY);
      return send(request, reply, file);
    });
  }

  return served;
}
