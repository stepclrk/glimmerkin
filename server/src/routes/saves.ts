import type { FastifyInstance } from 'fastify';
import { isObject, refuse, requireAccount, type Context } from '../http.js';
import { creatureForm, decodeSaveCode, saveProblem, type SaveDoc } from '../saves.js';

export function saveRoutes(app: FastifyInstance, ctx: Context): void {
  app.get('/api/save', async (request, reply) => {
    const account = await requireAccount(ctx, request, reply);
    if (!account) return reply;
    const row = (await ctx.db.query('SELECT doc, saved_at, rev FROM saves WHERE account_id = $1', [account.id])).rows[0];
    return reply.send(row ? { save: row.doc, savedAt: Number(row.saved_at), rev: row.rev } : { save: null, savedAt: null, rev: 0 });
  });

  // What the account page shows: the creature, its form and when it was last saved.
  app.get('/api/save/summary', async (request, reply) => {
    const account = await requireAccount(ctx, request, reply, { allowMustChange: true });
    if (!account) return reply;
    const row = (await ctx.db.query("SELECT doc #>> '{pet,name}' AS creature, doc #>> '{pet,xp}' AS xp, updated_at FROM saves WHERE account_id = $1", [account.id])).rows[0];
    return reply.send(row ? { creature: row.creature, form: creatureForm(Number(row.xp) || 0), lastSaved: row.updated_at } : { creature: null, form: null, lastSaved: null });
  });

  // A save names the copy it grew from (base, the rev it last read or wrote). It is stored only if the account
  // still holds that copy; otherwise another device saved in between, and the reply carries that device's copy so
  // the player can choose. A save that names no base (from a game page older than this rule) is stored if it is
  // newer than the stored one by its own clock, as before.
  app.put('/api/save', async (request, reply) => {
    const account = await requireAccount(ctx, request, reply);
    if (!account) return reply;
    const body = isObject(request.body) ? request.body : {};
    const problem = saveProblem(body.save);
    if (problem) return refuse(reply, 400, 'bad_save', `That save was not stored: ${problem}`);
    const base = body.base;
    if (base !== undefined && !(Number.isSafeInteger(base) && (base as number) >= 0)) {
      return refuse(reply, 400, 'bad_base', 'That save was not stored: it names a copy that cannot exist.');
    }
    const doc = body.save as SaveDoc, json = JSON.stringify(doc);
    let stored: { rev: number } | undefined;
    if (base === undefined) {
      stored = (await ctx.db.query(
        `INSERT INTO saves (account_id, doc, saved_at) VALUES ($1, $2, $3)
         ON CONFLICT (account_id) DO UPDATE SET doc = EXCLUDED.doc, saved_at = EXCLUDED.saved_at, rev = saves.rev + 1, updated_at = now()
         WHERE saves.saved_at <= EXCLUDED.saved_at
         RETURNING rev`,
        [account.id, json, doc.savedAt],
      )).rows[0];
    } else if (base === 0) {
      stored = (await ctx.db.query(
        'INSERT INTO saves (account_id, doc, saved_at) VALUES ($1, $2, $3) ON CONFLICT (account_id) DO NOTHING RETURNING rev',
        [account.id, json, doc.savedAt],
      )).rows[0];
    } else {
      stored = (await ctx.db.query(
        `UPDATE saves SET doc = $2, saved_at = $3, rev = rev + 1, updated_at = now()
         WHERE account_id = $1 AND rev = $4 RETURNING rev`,
        [account.id, json, doc.savedAt, base],
      )).rows[0];
      // The account holds no save at all any more: there is nothing to choose between.
      stored ??= (await ctx.db.query(
        'INSERT INTO saves (account_id, doc, saved_at) VALUES ($1, $2, $3) ON CONFLICT (account_id) DO NOTHING RETURNING rev',
        [account.id, json, doc.savedAt],
      )).rows[0];
    }
    if (!stored) {
      const held = (await ctx.db.query('SELECT doc, saved_at, rev FROM saves WHERE account_id = $1', [account.id])).rows[0];
      const extra = { save: held.doc, savedAt: Number(held.saved_at), rev: held.rev };
      return base === undefined
        ? refuse(reply, 409, 'newer_save', 'Your account already holds a newer save, from another device. That one is kept.', extra)
        : refuse(reply, 409, 'other_device', 'Another device saved to your account since this copy was last in step with it.', extra);
    }
    await ctx.db.query('UPDATE accounts SET last_seen_at = now() WHERE id = $1', [account.id]);
    return reply.send({ savedAt: doc.savedAt, rev: stored.rev });
  });

  // Bringing in a creature saved somewhere else replaces the account's creature on purpose, so it is
  // stamped as saved now: every device then takes it as the newest copy.
  app.post('/api/save/import', async (request, reply) => {
    const account = await requireAccount(ctx, request, reply);
    if (!account) return reply;
    const body = isObject(request.body) ? request.body : {};
    const save = typeof body.code === 'string' ? decodeSaveCode(body.code) : body.save;
    const problem = saveProblem(save);
    if (problem) return refuse(reply, 400, 'bad_save', `That creature could not be brought in: ${problem} Copy the whole code and try again.`);
    const current = (await ctx.db.query('SELECT saved_at FROM saves WHERE account_id = $1', [account.id])).rows[0];
    const doc = { ...(save as SaveDoc), savedAt: Math.max(ctx.now(), current ? Number(current.saved_at) + 1 : 0) };
    await ctx.db.query(
      `INSERT INTO saves (account_id, doc, saved_at) VALUES ($1, $2, $3)
       ON CONFLICT (account_id) DO UPDATE SET doc = EXCLUDED.doc, saved_at = EXCLUDED.saved_at, rev = saves.rev + 1, updated_at = now()`,
      [account.id, JSON.stringify(doc), doc.savedAt],
    );
    return reply.send({ save: doc, savedAt: doc.savedAt, creature: doc.pet.name });
  });
}
