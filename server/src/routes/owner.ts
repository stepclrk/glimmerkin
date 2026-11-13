import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { isObject, refuse, requireAccount, endSession, type Context } from '../http.js';
import { creatureForm } from '../saves.js';
import { hashPassword, newOneTimePassword, verifyPassword } from '../security.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** When the newest backup file was written, or null when there is none to see. */
export function lastBackup(backupDir: string | undefined): string | null {
  if (!backupDir) return null;
  try {
    const times = readdirSync(backupDir).filter((name) => name.endsWith('.enc')).map((name) => statSync(join(backupDir, name)).mtimeMs);
    return times.length ? new Date(Math.max(...times)).toISOString() : null;
  } catch {
    return null;
  }
}

async function onlyOwner(ctx: Context, accountId: string): Promise<boolean> {
  const { rows } = await ctx.db.query("SELECT id FROM accounts WHERE role = 'owner'");
  return rows.length === 1 && rows[0].id === accountId;
}

export function ownerRoutes(app: FastifyInstance, ctx: Context): void {
  /* ---------- a player's own account ---------- */

  app.delete('/api/account', async (request, reply) => {
    const account = await requireAccount(ctx, request, reply, { allowMustChange: true });
    if (!account) return reply;
    const body = isObject(request.body) ? request.body : {};
    const row = (await ctx.db.query('SELECT password_hash FROM accounts WHERE id = $1', [account.id])).rows[0];
    if (!row || !(await verifyPassword(row.password_hash, typeof body.password === 'string' ? body.password : ''))) {
      return refuse(reply, 401, 'wrong_details', 'That password is not right, so nothing was deleted. Check it and try again.');
    }
    if (account.role === 'owner' && (await onlyOwner(ctx, account.id))) {
      return refuse(reply, 409, 'only_owner', 'You are the only owner, so this account cannot be deleted. Make another owner first with the owner command.');
    }
    await endSession(ctx, request, reply);
    await ctx.db.query('DELETE FROM accounts WHERE id = $1', [account.id]);
    return reply.code(204).send();
  });

  /* ---------- the owner page ---------- */

  app.get('/api/owner/summary', async (request, reply) => {
    if (!(await requireAccount(ctx, request, reply, { owner: true }))) return reply;
    const { rows } = await ctx.db.query(
      'SELECT count(*)::int AS players FROM accounts',
    );
    return reply.send({ players: rows[0].players, lastBackup: lastBackup(ctx.backupDir) });
  });

  app.get('/api/owner/players', async (request, reply) => {
    const owner = await requireAccount(ctx, request, reply, { owner: true });
    if (!owner) return reply;
    const { rows } = await ctx.db.query(
      `SELECT a.id, a.username, a.role, a.created_at, a.must_change_password,
              s.doc #>> '{pet,name}' AS creature, s.doc #>> '{pet,xp}' AS xp, s.updated_at AS last_saved, a.last_seen_at
         FROM accounts a LEFT JOIN saves s ON s.account_id = a.id
        ORDER BY coalesce(s.updated_at, a.last_seen_at, a.created_at) DESC`,
    );
    return reply.send({
      players: rows.map((r) => ({
        id: r.id,
        username: r.username,
        role: r.role,
        you: r.id === owner.id,
        creature: r.creature ?? null,
        form: r.creature ? creatureForm(Number(r.xp) || 0) : null,
        lastPlayed: r.last_saved ?? r.last_seen_at ?? null,
        waitingForNewPassword: r.must_change_password,
        createdAt: r.created_at,
      })),
    });
  });

  // With no email there is no self-service reset: the owner passes a one-time password on.
  app.post<{ Params: { id: string } }>('/api/owner/players/:id/reset', async (request, reply) => {
    if (!(await requireAccount(ctx, request, reply, { owner: true }))) return reply;
    if (!UUID.test(request.params.id)) return refuse(reply, 404, 'no_such_player', 'That player no longer exists. Reload the page.');
    const oneTimePassword = newOneTimePassword();
    const { rows } = await ctx.db.query(
      'UPDATE accounts SET password_hash = $1, must_change_password = true WHERE id = $2 RETURNING username',
      [await hashPassword(oneTimePassword), request.params.id],
    );
    if (!rows[0]) return refuse(reply, 404, 'no_such_player', 'That player no longer exists. Reload the page.');
    await ctx.db.query('DELETE FROM sessions WHERE account_id = $1', [request.params.id]);
    return reply.send({ username: rows[0].username, oneTimePassword });
  });

  app.delete<{ Params: { id: string } }>('/api/owner/players/:id', async (request, reply) => {
    const owner = await requireAccount(ctx, request, reply, { owner: true });
    if (!owner) return reply;
    if (request.params.id === owner.id) return refuse(reply, 400, 'that_is_you', 'That is your own account. To delete it, use your account page.');
    const { rows } = UUID.test(request.params.id)
      ? await ctx.db.query('DELETE FROM accounts WHERE id = $1 RETURNING username', [request.params.id])
      : { rows: [] };
    if (!rows[0]) return refuse(reply, 404, 'no_such_player', 'That player no longer exists. Reload the page.');
    return reply.code(204).send();
  });
}
