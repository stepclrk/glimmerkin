import pg from 'pg';

export type Db = pg.Pool;

export function connect(databaseUrl: string): Db {
  return new pg.Pool({ connectionString: databaseUrl, max: 10 });
}

/**
 * Schema changes, in order. Never edit one that has shipped: add another. Each runs once, inside a
 * transaction, and is recorded in schema_migrations.
 */
const MIGRATIONS: Array<{ id: string; sql: string }> = [
  {
    id: '001_accounts',
    sql: `
      CREATE TABLE accounts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        username text NOT NULL,
        password_hash text NOT NULL,
        role text NOT NULL DEFAULT 'player' CHECK (role IN ('player', 'owner')),
        must_change_password boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        last_seen_at timestamptz
      );
      CREATE UNIQUE INDEX accounts_username_key ON accounts (lower(username));

      CREATE TABLE sessions (
        token_hash text PRIMARY KEY,
        account_id uuid NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL
      );
      CREATE INDEX sessions_account_id ON sessions (account_id);

      CREATE TABLE invites (
        code text PRIMARY KEY,
        created_at timestamptz NOT NULL DEFAULT now(),
        used_by uuid REFERENCES accounts (id) ON DELETE SET NULL,
        used_at timestamptz,
        cancelled_at timestamptz
      );

      CREATE TABLE saves (
        account_id uuid PRIMARY KEY REFERENCES accounts (id) ON DELETE CASCADE,
        doc jsonb NOT NULL,
        saved_at bigint NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `,
  },
];

/** Bring the database up to date. Safe to run from several processes at once. */
export async function migrate(db: Db): Promise<string[]> {
  const client = await db.connect();
  const ran: string[] = [];
  try {
    await client.query('SELECT pg_advisory_lock(7777)');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, ran_at timestamptz NOT NULL DEFAULT now())');
    const done = new Set((await client.query<{ id: string }>('SELECT id FROM schema_migrations')).rows.map((r) => r.id));
    for (const m of MIGRATIONS) {
      if (done.has(m.id)) continue;
      await client.query('BEGIN');
      try {
        await client.query(m.sql);
        await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [m.id]);
        await client.query('COMMIT');
        ran.push(m.id);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(7777)').catch(() => undefined);
    client.release();
  }
  return ran;
}

/** Wait for Postgres to accept connections: the stack starts both containers together. */
export async function waitForDb(db: Db, attempts = 30, delayMs = 1000): Promise<void> {
  for (let i = 1; ; i++) {
    try {
      await db.query('SELECT 1');
      return;
    } catch (error) {
      if (i >= attempts) throw error;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}
