/**
 * One-off commands for whoever runs the server.
 *
 *   docker compose exec web node dist/cli.js owner <username>
 *     Makes <username> the owner and prints a one-time password. On a fresh install this creates the
 *     first account. Run it again if the owner is ever locked out.
 */
import { connect, migrate } from './db.js';
import { hashPassword, newOneTimePassword, validUsername } from './security.js';

const [command, username] = process.argv.slice(2);

if (command !== 'owner' || !validUsername(username)) {
  console.error('Usage: node dist/cli.js owner <username>\nA username is 3 to 20 letters, numbers or underscores.');
  process.exit(2);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set, so there is no database to create the owner in.');
  process.exit(2);
}

const db = connect(process.env.DATABASE_URL);
try {
  await migrate(db);
  const password = newOneTimePassword();
  const hash = await hashPassword(password);
  const { rows } = await db.query(
    `INSERT INTO accounts (username, password_hash, role, must_change_password) VALUES ($1, $2, 'owner', true)
     ON CONFLICT (lower(username)) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'owner', must_change_password = true
     RETURNING id, username`,
    [username, hash],
  );
  await db.query('DELETE FROM sessions WHERE account_id = $1', [rows[0].id]);
  console.log(`Owner account: ${rows[0].username}`);
  console.log(`One-time password: ${password}`);
  console.log('Sign in at /signin. You will be asked to choose your own password straight away.');
} finally {
  await db.end();
}
