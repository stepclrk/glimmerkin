import { resolve } from 'node:path';
import { buildApp } from './app.js';

const port = Number(process.env.PORT ?? 7777);
const gameFile = resolve(process.env.GAME_FILE ?? '../dist/index.html');

const app = buildApp({ gameFile, logger: true });

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    app.close().then(() => process.exit(0), () => process.exit(1));
  });
}

app.listen({ port, host: '0.0.0.0' }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
