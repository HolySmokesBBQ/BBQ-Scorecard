// Sync firestore.rules enum blocks from src/board/schema.js.
//
// Why this exists:
//   The rules file had a stale region allowlist (SECURITY-AUDIT-BOARD-DEEP.md
//   Finding B-5): schema.js had 27 REGIONS but the rules only listed 19.
//   Submissions from Atlanta, Louisville, Charlotte, etc. silently 404'd.
//   Every time schema.js grows (regions, cuts, store types) and rules don't,
//   we ship the same class of bug.
//
// This script keeps the two in sync automatically. It edits three marked
// blocks in firestore.rules in place. Schema.js is the source of truth;
// firestore.rules is generated between the markers.
//
// Blocks synced:
//   /* @sync:cuts */       — CUT_ORDER (or CUTS keys)
//   /* @sync:regions */    — REGIONS keys
//   /* @sync:storeTypes */ — STORE_TYPES keys
//
// Usage:
//   node scripts/sync-firestore-rules.mjs
//     Rewrites firestore.rules with the current schema.js values.
//     Prints a diff summary. Exits 0 whether or not anything changed.
//
//   node scripts/sync-firestore-rules.mjs --check
//     Fails with exit 1 if rules would change (for CI).
//
// Deploy flow:
//   `npm run deploy:rules` runs this script then `firebase deploy --only firestore:rules`.
//   Adding a region = edit schema.js, run npm run deploy:rules. That's it.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { CUTS, CUT_ORDER, REGIONS, STORE_TYPES } from '../src/board/schema.js';

const ROOT = resolve(import.meta.dirname, '..');
const RULES_PATH = resolve(ROOT, 'firestore.rules');

// Preserve CUT_ORDER's ordering so the file diff stays small when a cut
// is inserted mid-list. Fall through to CUTS keys as a safety net if
// CUT_ORDER ever misses a cut.
const cutIds = [...new Set([...CUT_ORDER, ...Object.keys(CUTS)])];
const regionIds = Object.keys(REGIONS);
const storeTypeIds = Object.keys(STORE_TYPES);

// Format an array of ids into a Firestore-rules-style list, wrapped at
// roughly the width of the surrounding rules code. Each line is
// indented by `indent` spaces.
function formatList(ids, indent) {
  const pad = ' '.repeat(indent);
  const wrapWidth = 78;
  const lines = [];
  let current = '';
  for (const id of ids) {
    const piece = `'${id}', `;
    if (current.length + piece.length > wrapWidth) {
      lines.push(current.replace(/, $/, ','));
      current = piece;
    } else {
      current += piece;
    }
  }
  if (current) lines.push(current.replace(/, $/, ''));
  return lines.map(l => pad + l).join('\n');
}

function renderCutsBlock() {
  return [
    '                    && request.resource.data.cut in [',
    formatList(cutIds, 22),
    '                    ]',
  ].join('\n');
}

function renderRegionsBlock() {
  return [
    '                    && request.resource.data.region in [',
    formatList(regionIds, 22),
    '                    ]',
  ].join('\n');
}

function renderStoreTypesBlock() {
  return [
    `                    && request.resource.data.storeType in [${storeTypeIds.map(id => `'${id}'`).join(', ')}]`,
  ].join('\n');
}

function replaceBlock(source, marker, newBlock) {
  // \r?\n, not \n: core.autocrlf is true in this repo and there is no
  // .gitattributes, so a checkout can leave a rules file entirely CRLF.
  // firestore.rules was 360 CRLF / 0 LF on 2026-10-21 while
  // firestore.board.rules was 0 CRLF / 104 LF, which is why Board's deploy
  // worked and the shared one threw "Marker /* @sync:cuts */ not found" with
  // the marker plainly sitting in the file. This hook is a firebase.json
  // predeploy step, so that failure blocked every rules deploy against the
  // shared file, for all three apps.
  const re = new RegExp(
    `(// /\\* @sync:${marker} \\*/\\r?\\n)([\\s\\S]*?)(\\r?\\n\\s*// /\\* @endsync \\*/)`,
    'm',
  );
  if (!re.test(source)) {
    throw new Error(`Marker /* @sync:${marker} */ … /* @endsync */ not found in firestore.rules`);
  }
  // Emit the block with the line ending the file already uses. The render
  // helpers join with \n, so on a CRLF file the rewritten block differed from
  // identical existing content by its endings alone -- `updated === original`
  // was then false, the --check mode reported OUT OF SYNC on content that
  // matched schema.js perfectly, and "fixing" it wrote a mixed-ending file.
  // Confirmed 2026-10-21: firestore.rules normalised to byte-identical content
  // once endings were accounted for, having been declared stale.
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  return source.replace(re, `$1${newBlock.replace(/\n/g, eol)}$3`);
}

// Both rules files carry the same generated enum blocks:
//   firestore.rules       — the shared file (Scorecard's project is `default`)
//   firestore.board.rules — Board's project only, deployed with --project board
// Board's deployed ruleset drifted 13 regions behind schema.js because it
// lived only in the Firebase console with nothing in the repo to sync. Both
// files are checked and rewritten here so that cannot recur.
const TARGETS = [RULES_PATH, resolve(ROOT, 'firestore.board.rules')];

const check = process.argv.includes('--check');
let anyChanged = false;
let anyStale = false;

for (const target of TARGETS) {
  if (!existsSync(target)) continue;
  const name = basename(target);
  const original = readFileSync(target, 'utf8');
  let updated = original;
  updated = replaceBlock(updated, 'cuts', renderCutsBlock());
  updated = replaceBlock(updated, 'regions', renderRegionsBlock());
  updated = replaceBlock(updated, 'storeTypes', renderStoreTypesBlock());

  if (updated === original) {
    console.log(`${name} is already in sync with schema.js.`);
    continue;
  }
  if (check) {
    console.error(`${name} is OUT OF SYNC with schema.js. Run \`npm run sync:rules\` to fix.`);
    anyStale = true;
    continue;
  }
  writeFileSync(target, updated);
  console.log(`${name} updated from schema.js.`);
  anyChanged = true;
}

console.log(`  cuts: ${cutIds.length}, regions: ${regionIds.length}, storeTypes: ${storeTypeIds.length}`);
process.exit(anyStale ? 1 : 0);
