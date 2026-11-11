import { resolve } from 'node:path';
import { buildApp } from './app.js';
import { connect, migrate, waitForDb, type Db } from './db.js';

const port = Number(process.env.PORT ?? 7777);
const gameFile = resolve(process.env.GAME_FILE ?? '../dist/index.html');
const pagesDir = resolve(process.env.PAGES_DIR ?? 'pages');
const databaseUrl = process.env.DATABASE_URL;

let db: Db | undefined;
if (databaseUrl) {
  db = connect(databaseUrl);
  await waitForDb(db);
  const ran = await migrate(db);
  if (ran.length) console.log(`Database updated: ${ran.join(', ')}`);
} else {
  console.log('DATABASE_URL is not set: serving the game only, with no accounts.');
}

const app = buildApp({ gameFile, pagesDir, db, secureCookies: process.env.COOKIE_SECURE !== 'false', backupDir: process.env.BACKUP_DIR, logger: true });

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    app.close().then(() => db?.end()).then(() => process.exit(0), () => process.exit(1));
  });
}

app.listen({ port, host: '0.0.0.0' }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
