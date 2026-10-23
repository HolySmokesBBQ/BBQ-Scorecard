// Packs games/pit-sim into one HTML page for Joel's private preview Artifact: every ./script is inlined
// in order, window.PitSimTester is set (the Tester tools; the site copy never sets it), the title reads
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
let first = true;
html = html.replace(/<script src="\.\/([^"?]+)(?:\?[^"]*)?" defer><\/script>/g, function (m, rel) {
  const src = fs.readFileSync(path.join(GAME, rel), 'utf8').replace(/<\/script/gi, '<\\/script');
  used.push(rel);
  const flag = first && tester ? '<script>window.PitSimTester = true;</script>\n  ' : '';
  first = false;
  return flag + '<script>\n' + src + '\n</script>';
});
if (!used.length) { console.error('no ./ scripts found in index.html'); process.exit(1); }
html = html.replace(/<title>[^<]*<\/title>/, '<title>Your Pit Preview</title>');

fs.mkdirSync(path.join(out, 'tracks'), { recursive: true });
fs.writeFileSync(path.join(out, 'index.html'), html, 'utf8');
const tracks = fs.readdirSync(path.join(GAME, 'tracks')).filter((f) => f.endsWith('.mp3'));
for (const f of tracks) fs.copyFileSync(path.join(GAME, 'tracks', f), path.join(out, 'tracks', f));
console.log('scripts: ' + used.join(', ') + ' | tester: ' + tester + ' | tracks: ' + tracks.length + ' | bytes ' + Buffer.byteLength(html));
