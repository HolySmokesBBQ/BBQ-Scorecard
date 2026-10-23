// Packs games/pit-sim into one HTML page for Joel's private preview Artifact: every ./script is inlined
// in order at the end of the body (they were deferred, so they run after the DOM they build on),
// window.PitSimTester is set (the Tester tools; the site copy never sets it), the title reads
// "Your Pit Preview", and tracks/*.mp3 are copied beside the page (published as Artifact files).
// Usage: node games/pit-sim/dev/package-preview.cjs <out dir> [--no-tester]
const fs = require('fs');
const path = require('path');

const GAME = path.join(__dirname, '..');
const out = process.argv[2];
if (!out) { console.error('usage: package-preview.cjs <out dir> [--no-tester]'); process.exit(2); }
const tester = !process.argv.includes('--no-tester');

let html = fs.readFileSync(path.join(GAME, 'index.html'), 'utf8');
const used = [];
const inl = [];
html = html.replace(/[ \t]*<script src="\.\/([^"?]+)(?:\?[^"]*)?" defer><\/script>\r?\n?/g, function (m, rel) {
  const src = fs.readFileSync(path.join(GAME, rel), 'utf8').replace(/<\/script/gi, '<\\/script');
  used.push(rel);
  inl.push('<script>\n' + src + '\n</script>');
  return '';
});
if (!used.length) { console.error('no ./ scripts found in index.html'); process.exit(1); }
if (html.indexOf('</body>') < 0) { console.error('no </body> in index.html'); process.exit(1); }
const flag = tester ? '<script>window.PitSimTester = true;</script>\n' : '';
html = html.replace('</body>', function () { return flag + inl.join('\n') + '\n</body>'; });
html = html.replace(/<title>[^<]*<\/title>/, '<title>Your Pit Preview</title>');

fs.mkdirSync(path.join(out, 'tracks'), { recursive: true });
fs.writeFileSync(path.join(out, 'index.html'), html, 'utf8');
const tracks = fs.readdirSync(path.join(GAME, 'tracks')).filter((f) => f.endsWith('.mp3'));
for (const f of tracks) fs.copyFileSync(path.join(GAME, 'tracks', f), path.join(out, 'tracks', f));
console.log('scripts: ' + used.join(', ') + ' | tester: ' + tester + ' | tracks: ' + tracks.length + ' | bytes ' + Buffer.byteLength(html));
