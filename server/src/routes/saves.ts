import type { FastifyInstance } from 'fastify';
import { isObject, refuse, requireAccount, type Context } from '../http.js';
import { creatureForm, decodeSaveCode, saveProblem, type SaveDoc } from '../saves.js';

export function saveRoutes(app: FastifyInstance, ctx: Context): void {
  app.get('/api/save', async (request, reply) => {
    const account = await requireAccount(ctx, request, reply);
    if (!account) return reply;
    const row = (await ctx.db.query('SELECT doc, saved_at FROM saves WHERE account_id = $1', [account.id])).rows[0];
    return reply.send(row ? { save: row.doc, savedAt: Number(row.saved_at) } : { save: null, savedAt: null });
  });

  // What the account page shows: the creature, its form and when it was last saved.
  app.get('/api/save/summary', async (request, reply) => {
    const account = await requireAccount(ctx, request, reply, { allowMustChange: true });
    if (!account) return reply;
    const row = (await ctx.db.query("SELECT doc #>> '{pet,name}' AS creature, doc #>> '{pet,xp}' AS xp, updated_at FROM saves WHERE account_id = $1", [account.id])).rows[0];
    return reply.send(row ? { creature: row.creature, form: creatureForm(Number(row.xp) || 0), lastSaved: row.updated_at } : { creature: null, form: null, lastSaved: null });
  });

  // The newer copy wins. A save older than the stored one is refused, and the reply carries the stored one.
  app.put('/api/save', async (request, reply) => {
    const account = await requireAccount(ctx, request, reply);
    if (!account) return reply;
    const save = isObject(request.body) ? request.body.save : undefined;
    const problem = saveProblem(save);
    if (problem) return refuse(reply, 400, 'bad_save', `That save was not stored: ${problem}`);
    const doc = save as SaveDoc;
    const stored = (await ctx.db.query(
      `INSERT INTO saves (account_id, doc, saved_at) VALUES ($1, $2, $3)
       ON CONFLICT (account_id) DO UPDATE SET doc = EXCLUDED.doc, saved_at = EXCLUDED.saved_at, updated_at = now()
       WHERE saves.saved_at <= EXCLUDED.saved_at
       RETURNING saved_at`,
      [account.id, JSON.stringify(doc), doc.savedAt],
    )).rows[0];
    if (!stored) {
      const newer = (await ctx.db.query('SELECT doc, saved_at FROM saves WHERE account_id = $1', [account.id])).rows[0];
      return refuse(reply, 409, 'newer_save', 'Your account already holds a newer save, from another device. That one is kept.', { save: newer.doc, savedAt: Number(newer.saved_at) });
    }
    await ctx.db.query('UPDATE accounts SET last_seen_at = now() WHERE id = $1', [account.id]);
    return reply.send({ savedAt: doc.savedAt });
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
       ON CONFLICT (account_id) DO UPDATE SET doc = EXCLUDED.doc, saved_at = EXCLUDED.saved_at, updated_at = now()`,
      [account.id, JSON.stringify(doc), doc.savedAt],
    );
    return reply.send({ save: doc, savedAt: doc.savedAt, creature: doc.pet.name });
  });
}
