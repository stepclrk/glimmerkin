// Draws the app's launcher icons and splash image into app/src/main/res, before Gradle builds the app.
// They come from the same code as the web icons (server/src/install.ts), so the repository holds no image files
// and the app's icon always matches the one a phone gets from "Add to home screen".
// Needs the server built first: (cd server && npm ci && npm run build)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { iconPng } from '../server/dist/install.js';

const res = join(dirname(fileURLToPath(import.meta.url)), 'app/src/main/res');
// density: [launcher icon, adaptive icon layer, splash image], in pixels, as Bubblewrap sizes them.
const DENSITIES = {
  mdpi: [48, 82, 300], hdpi: [72, 123, 450], xhdpi: [96, 164, 600], xxhdpi: [144, 246, 900], xxxhdpi: [192, 328, 1200],
};
const write = (folder, name, size) => {
  mkdirSync(join(res, folder), { recursive: true });
  writeFileSync(join(res, folder, name), iconPng(size));
};
for (const [density, [launcher, maskable, splash]] of Object.entries(DENSITIES)) {
  write(`mipmap-${density}`, 'ic_launcher.png', launcher);
  write(`mipmap-${density}`, 'ic_maskable.png', maskable);
  write(`drawable-${density}`, 'splash.png', splash);
}
console.log('Drew the launcher icons and splash images into', res);
