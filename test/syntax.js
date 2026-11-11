// Checks the built page: exactly one inline script, and it parses.
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const file = path.join(__dirname, '..', 'dist', 'index.html');
if (!fs.existsSync(file)) { console.error('dist/index.html is missing. Run `sh build.sh` first.'); process.exit(1); }
const html = fs.readFileSync(file, 'utf8'), scripts = html.match(/<script>[\s\S]*?<\/script>/g) || [];
if (scripts.length !== 1) { console.error('Expected one inline script, found ' + scripts.length); process.exit(1); }
const tmp = path.join(os.tmpdir(), 'glimmerkin-built.js');
fs.writeFileSync(tmp, scripts[0].replace(/^<script>/, '').replace(/<\/script>$/, ''));
execFileSync(process.execPath, ['--check', tmp], { stdio: 'inherit' });
console.log('Built script parses: ' + Math.round(html.length / 1024) + ' KB page.');
