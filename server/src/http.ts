import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Db } from './db.js';
import { hashToken, newToken, SESSION_COOKIE, SESSION_DAYS } from './security.js';

export interface Account {
  id: string;
  username: string;
  role: 'player' | 'owner';
  mustChangePassword: boolean;
  createdAt: Date;
}

export interface Context {
  db: Db;
  secureCookies: boolean;
  now: () => number;
  backupDir?: string;
}

/** Every refusal has a code for programs and a sentence for people: what happened and what to do. */
export function refuse(reply: FastifyReply, status: number, error: string, message: string, extra: object = {}): FastifyReply {
  return reply.code(status).send({ error, message, ...extra });
}

/** The player's address. Behind the Cloudflare Tunnel every request arrives from the tunnel itself. */
export function clientAddress(request: FastifyRequest): string {
  const header = request.headers['cf-connecting-ip'];
  return (Array.isArray(header) ? header[0] : header) || request.ip;
}

function readCookie(request: FastifyRequest, name: string): string | null {
  for (const part of (request.headers.cookie ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

function cookie(value: string, maxAgeSeconds: number, secure: boolean): string {
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure ? '; Secure' : ''}`;
}

export async function startSession(ctx: Context, reply: FastifyReply, accountId: string): Promise<void> {
  const token = newToken();
  // Sessions that have run out are cleared here, so the table never holds more than the live ones.
  await ctx.db.query('DELETE FROM sessions WHERE expires_at < now()');
  await ctx.db.query(
    `INSERT INTO sessions (token_hash, account_id, expires_at) VALUES ($1, $2, now() + make_interval(days => $3))`,
    [hashToken(token), accountId, SESSION_DAYS],
  );
  reply.header('Set-Cookie', cookie(token, SESSION_DAYS * 86400, ctx.secureCookies));
}

export async function endSession(ctx: Context, request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = readCookie(request, SESSION_COOKIE);
  if (token) await ctx.db.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
  reply.header('Set-Cookie', cookie('', 0, ctx.secureCookies));
}

/** Who is signed in, or null. */
export async function currentAccount(ctx: Context, request: FastifyRequest): Promise<Account | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const { rows } = await ctx.db.query(
    `SELECT a.id, a.username, a.role, a.must_change_password, a.created_at
       FROM sessions s JOIN accounts a ON a.id = s.account_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashToken(token)],
  );
  const row = rows[0];
  if (!row) return null;
  return { id: row.id, username: row.username, role: row.role, mustChangePassword: row.must_change_password, createdAt: row.created_at };
}

/**
 * The signed-in account, or a refusal already sent. A player holding a one-time password can do nothing
 * but choose a new one, unless the route says otherwise.
 */
export async function requireAccount(
  ctx: Context, request: FastifyRequest, reply: FastifyReply, options: { allowMustChange?: boolean; owner?: boolean } = {},
): Promise<Account | null> {
  const account = await currentAccount(ctx, request);
  if (!account) {
    refuse(reply, 401, 'signed_out', 'You are not signed in. Sign in and try again.');
    return null;
  }
  if (account.mustChangePassword && !options.allowMustChange) {
    refuse(reply, 403, 'must_change_password', 'Choose a new password first, on your account page.');
    return null;
  }
  if (options.owner && account.role !== 'owner') {
    refuse(reply, 403, 'owner_only', 'Only the owner can do that.');
    return null;
  }
  return account;
}

export function publicAccount(account: Account): object {
  return { username: account.username, role: account.role, mustChangePassword: account.mustChangePassword, createdAt: account.createdAt };
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
