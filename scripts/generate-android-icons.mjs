// Regenerate Android launcher icons from a 1024 master, eliminating the
// white-border problem (adaptive background was #FFFFFF behind a circular
// badge). Produces a brand-brown, edge-to-edge tile with the badge sized to
// sit safely inside Android's circle/squircle crop — nothing gets shaved.
//
// Usage:
//   node scripts/generate-android-icons.mjs <master.png> <res-dir> [bgHex] [scale]
//
//   <master.png>  1024x1024 source icon (each app uses its own art)
//   <res-dir>     e.g. android/app/src/main/res
//   [bgHex]       background fill, e.g. 503A2B. If omitted, auto-sampled
//                 from the master's corner (each app keeps its own color).
//   [scale]       badge size as a fraction of the tile (default 0.68 — the
//                 approved safe-zone look).
//
// Writes, for every density: ic_launcher.png (legacy), ic_launcher_round.png,
// ic_launcher_foreground.png (adaptive foreground). Sets the adaptive
// background color to the brown. Also drops a 512 ic_launcher-playstore.png
// beside the res dir for the Play Console store-listing icon.

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const master = process.argv[2];
const resDir = process.argv[3];
let bgArg = process.argv[4];
const scale = process.argv[5] ? parseFloat(process.argv[5]) : 0.68;

if (!master || !resDir) {
  console.error('Usage: node scripts/generate-android-icons.mjs <master.png> <res-dir> [bgHex] [scale]');
  process.exit(1);
}

// Background color resolution. Explicit arg wins. Otherwise sample the
// master's corner — but that fails when the master art sits on a white
// field (it grabs #FFFFFF, the exact thing we're removing). So: if the
// sampled color is near-white, fall back to the app's EXISTING adaptive
// background color (often already the right brand color); if that's also
// white/absent, stop and ask for an explicit hex rather than baking in white.
const nearWhite = (hex) => {
  const R = parseInt(hex.slice(0, 2), 16), G = parseInt(hex.slice(2, 4), 16), B = parseInt(hex.slice(4, 6), 16);
  return R >= 235 && G >= 235 && B >= 235;
};
const readExistingBg = () => {
  const f = path.join(resDir, 'values', 'ic_launcher_background.xml');
  if (!fs.existsSync(f)) return null;
  const m = fs.readFileSync(f, 'utf8').match(/<color name="ic_launcher_background">#([0-9A-Fa-f]{6,8})<\/color>/);
  return m ? m[1].slice(0, 6).toUpperCase() : null;
};

let bgHex;
if (bgArg) {
  bgHex = bgArg.replace('#', '').toUpperCase();
  console.log(`bg: using explicit #${bgHex}`);
} else {
  const px = await sharp(master).extract({ left: 6, top: 6, width: 1, height: 1 }).raw().toBuffer();
  const sampled = [px[0], px[1], px[2]].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
  const existing = readExistingBg();
  if (!nearWhite(sampled)) {
    bgHex = sampled;
    console.log(`bg: sampled #${bgHex} from master corner`);
  } else if (existing && !nearWhite(existing)) {
    bgHex = existing;
    console.log(`bg: master corner is white (#${sampled}); falling back to existing adaptive bg #${bgHex}`);
  } else {
    console.error(`Cannot auto-detect a brand color: master corner (#${sampled}) and existing bg (#${existing || 'none'}) are both white/absent.`);
    console.error(`Re-run with an explicit hex as the 3rd arg, e.g.  node scripts/generate-android-icons.mjs "${master}" "${resDir}" 2C2E32`);
    process.exit(1);
  }
}
const r = parseInt(bgHex.slice(0, 2), 16);
const g = parseInt(bgHex.slice(2, 4), 16);
const b = parseInt(bgHex.slice(4, 6), 16);

const DENSITIES = [
  { dir: 'mdpi',    legacy: 48,  fg: 108 },
  { dir: 'hdpi',    legacy: 72,  fg: 162 },
  { dir: 'xhdpi',   legacy: 96,  fg: 216 },
  { dir: 'xxhdpi',  legacy: 144, fg: 324 },
  { dir: 'xxxhdpi', legacy: 192, fg: 432 },
];

const badge = (px) => sharp(master).resize(px, px, { fit: 'contain' }).png().toBuffer();
const brown = (size) => ({ create: { width: size, height: size, channels: 4, background: { r, g, b, alpha: 1 } } });
const clear = (size) => ({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });

for (const d of DENSITIES) {
  const mdir = path.join(resDir, `mipmap-${d.dir}`);
  fs.mkdirSync(mdir, { recursive: true });

  // Adaptive foreground: badge on transparent, scaled into the safe zone.
  const fgPx = Math.round(d.fg * scale);
  const fgOff = Math.round((d.fg - fgPx) / 2);
  await sharp(clear(d.fg))
    .composite([{ input: await badge(fgPx), left: fgOff, top: fgOff }])
    .png().toFile(path.join(mdir, 'ic_launcher_foreground.png'));

  // Legacy square (Android 7-): brown fill + badge.
  const lPx = Math.round(d.legacy * scale);
  const lOff = Math.round((d.legacy - lPx) / 2);
  const square = await sharp(brown(d.legacy))
    .composite([{ input: await badge(lPx), left: lOff, top: lOff }]).png().toBuffer();
  await sharp(square).toFile(path.join(mdir, 'ic_launcher.png'));

  // Legacy round: circle-crop the square.
  const mask = Buffer.from(
    `<svg width="${d.legacy}" height="${d.legacy}"><circle cx="${d.legacy/2}" cy="${d.legacy/2}" r="${d.legacy/2}" fill="#fff"/></svg>`
  );
  await sharp(square).composite([{ input: mask, blend: 'dest-in' }])
    .png().toFile(path.join(mdir, 'ic_launcher_round.png'));
}

// Flip the adaptive background color from white to the brand brown.
const colorFile = path.join(resDir, 'values', 'ic_launcher_background.xml');
if (fs.existsSync(colorFile)) {
  let xml = fs.readFileSync(colorFile, 'utf8');
  xml = xml.replace(
    /(<color name="ic_launcher_background">)#[0-9A-Fa-f]{3,8}(<\/color>)/,
    `$1#${bgHex.toUpperCase()}$2`
  );
  fs.writeFileSync(colorFile, xml);
}

// Play Console store-listing icon (512, no transparency) beside the res dir.
const pPx = Math.round(512 * scale);
const pOff = Math.round((512 - pPx) / 2);
await sharp(brown(512))
  .composite([{ input: await badge(pPx), left: pOff, top: pOff }])
  .png().toFile(path.join(resDir, '..', 'ic_launcher-playstore.png'));

console.log(`Icons regenerated in ${resDir}  (bg #${bgHex.toUpperCase()}, scale ${scale})`);
