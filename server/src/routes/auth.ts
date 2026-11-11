import type { FastifyInstance } from 'fastify';
import {
  clientAddress, endSession, isObject, publicAccount, refuse, requireAccount, startSession, type Context,
} from '../http.js';
import {
  decoyHash, hashPassword, Limiter, normaliseInviteCode, PASSWORD_MIN, validPassword, validUsername, verifyPassword,
} from '../security.js';
import { saveProblem, type SaveDoc } from '../saves.js';

const TEN_MINUTES = 10 * 60 * 1000;
const TOO_MANY = 'Too many tries. Wait ten minutes and try again.';
const BAD_USERNAME = 'A username is 3 to 20 letters, numbers or underscores. Make one up; do not use your real name.';
const BAD_PASSWORD = `A password needs at least ${PASSWORD_MIN} characters.`;

export function authRoutes(app: FastifyInstance, ctx: Context): void {
  // Sign-in: per address (every try counts) and per username (wrong passwords count).
  const signinByAddress = new Limiter(20, TEN_MINUTES, ctx.now);
  const signinByUsername = new Limiter(5, TEN_MINUTES, ctx.now);
  // Invite codes are short, so wrong guesses are counted per address and across the whole site.
  const signupByAddress = new Limiter(10, TEN_MINUTES, ctx.now);
  const badCodesSitewide = new Limiter(30, 6 * TEN_MINUTES, ctx.now);

  app.post('/api/signup', async (request, reply) => {
    const address = clientAddress(request);
    if (signupByAddress.blocked(address) || badCodesSitewide.blocked('all')) return refuse(reply, 429, 'too_many_tries', TOO_MANY);
    signupByAddress.hit(address);

    const body = isObject(request.body) ? request.body : {};
    const code = normaliseInviteCode(body.code);
    if (!validUsername(body.username)) return refuse(reply, 400, 'bad_username', BAD_USERNAME);
    if (!validPassword(body.password)) return refuse(reply, 400, 'bad_password', BAD_PASSWORD);
    let guestSave: SaveDoc | null = null;
    if (body.save !== undefined && body.save !== null) {
      const problem = saveProblem(body.save);
      if (problem) return refuse(reply, 400, 'bad_save', `The creature in this browser could not be brought along: ${problem}`);
      guestSave = body.save as SaveDoc;
    }
    const passwordHash = await hashPassword(body.password);

    const client = await ctx.db.connect();
    try {
      await client.query('BEGIN');
      const invite = code
        ? (await client.query('SELECT code FROM invites WHERE code = $1 AND used_at IS NULL AND cancelled_at IS NULL FOR UPDATE', [code])).rows[0]
        : undefined;
      if (!invite) {
        await client.query('ROLLBACK');
        badCodesSitewide.hit('all');
        return refuse(reply, 400, 'bad_code', 'That invite code is not valid, or has already been used. Check it with whoever invited you.');
      }
      const taken = (await client.query('SELECT 1 FROM accounts WHERE lower(username) = lower($1)', [body.username])).rows[0];
      if (taken) {
        await client.query('ROLLBACK');
        return refuse(reply, 409, 'username_taken', 'Someone already has that username. Try another.');
      }
      const account = (await client.query(
        `INSERT INTO accounts (username, password_hash, last_seen_at) VALUES ($1, $2, now())
         RETURNING id, username, role, must_change_password, created_at`,
        [body.username, passwordHash],
      )).rows[0];
      await client.query('UPDATE invites SET used_by = $1, used_at = now() WHERE code = $2', [account.id, code]);
      if (guestSave) {
        await client.query('INSERT INTO saves (account_id, doc, saved_at) VALUES ($1, $2, $3)', [account.id, JSON.stringify(guestSave), guestSave.savedAt]);
      }
      await client.query('COMMIT');
      await startSession(ctx, reply, account.id);
      return reply.code(201).send({
        ...publicAccount({ id: account.id, username: account.username, role: account.role, mustChangePassword: false, createdAt: account.created_at }),
        id: account.id,
        adopted: Boolean(guestSave),
      });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      // Two people racing for one username: the unique index decides.
      if (isObject(error) && error.code === '23505') return refuse(reply, 409, 'username_taken', 'Someone already has that username. Try another.');
      throw error;
    } finally {
      client.release();
    }
  });

  app.post('/api/signin', async (request, reply) => {
    const address = clientAddress(request);
    const body = isObject(request.body) ? request.body : {};
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const nameKey = username.toLowerCase();
    if (signinByAddress.blocked(address) || signinByUsername.blocked(nameKey)) return refuse(reply, 429, 'too_many_tries', TOO_MANY);
    signinByAddress.hit(address);

    const row = validUsername(username)
      ? (await ctx.db.query('SELECT id, username, role, password_hash, must_change_password, created_at FROM accounts WHERE lower(username) = lower($1)', [username])).rows[0]
      : undefined;
    const ok = await verifyPassword(row ? row.password_hash : await decoyHash(), password);
    if (!row || !ok) {
      signinByUsername.hit(nameKey);
      return refuse(reply, 401, 'wrong_details', 'That username and password do not match. Check both and try again.');
    }
    signinByUsername.clear(nameKey);
    await ctx.db.query('UPDATE accounts SET last_seen_at = now() WHERE id = $1', [row.id]);
    await startSession(ctx, reply, row.id);
    return reply.send({
      ...publicAccount({ id: row.id, username: row.username, role: row.role, mustChangePassword: row.must_change_password, createdAt: row.created_at }),
      id: row.id,
    });
  });

  app.post('/api/signout', async (request, reply) => {
    await endSession(ctx, request, reply);
    return reply.code(204).send();
  });

  app.get('/api/me', async (request, reply) => {
    const account = await requireAccount(ctx, request, reply, { allowMustChange: true });
    if (!account) return reply;
    return reply.send({ ...publicAccount(account), id: account.id });
  });

  app.post('/api/password', async (request, reply) => {
    const account = await requireAccount(ctx, request, reply, { allowMustChange: true });
    if (!account) return reply;
    const body = isObject(request.body) ? request.body : {};
    if (signinByUsername.blocked(account.username.toLowerCase())) return refuse(reply, 429, 'too_many_tries', TOO_MANY);
    const row = (await ctx.db.query('SELECT password_hash FROM accounts WHERE id = $1', [account.id])).rows[0];
    if (!row || !(await verifyPassword(row.password_hash, typeof body.current === 'string' ? body.current : ''))) {
      signinByUsername.hit(account.username.toLowerCase());
      return refuse(reply, 401, 'wrong_details', 'The current password is not right. Check it and try again.');
    }
    if (!validPassword(body.next)) return refuse(reply, 400, 'bad_password', BAD_PASSWORD);
    if (body.next === body.current) return refuse(reply, 400, 'same_password', 'Choose a password different from the current one.');
    await ctx.db.query('UPDATE accounts SET password_hash = $1, must_change_password = false WHERE id = $2', [await hashPassword(body.next), account.id]);
    // Every other device is signed out; this one gets a fresh session.
    await ctx.db.query('DELETE FROM sessions WHERE account_id = $1', [account.id]);
    await startSession(ctx, reply, account.id);
    return reply.send({ ok: true });
  });
}
