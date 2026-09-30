// What BBQ Board's native build keeps from the shared public/ directory.
//
// vite.config.native.board.js uses `publicDir: 'public'`, which copies every
// file in public/ into dist-board-native/, and from there into the Android
// AAB and the iOS app. public/ is shared with the other apps, so most of it
// is theirs, and most of public/tesseract/ is OCR engine builds Board can
// never load. pruneBoardNative() deletes everything that came from public/
// and isn't listed here. Vite's own output (hashed JS/CSS, index.html,
// sw.js, manifest) is untouched. The prune runs in the Vite build, so
// Android and iOS (Codemagic runs build:board-native too) both get it.
//
// Why only three core files: tesseract.js 7's getCore.js imports exactly one
// `.wasm.js` (the WebAssembly binary is embedded, so the standalone `.wasm`
// and the plain `.js` loaders are never requested), chosen by CPU:
// relaxed-SIMD, else SIMD, else baseline. Board calls
// createWorker('eng', 1, ...) and OEM 1 is LSTM-only, so only the `-lstm`
// variant of each can load. src/board/ocrAssets.test.js re-derives this
// from getCore.js so an engine upgrade can't silently break it.
// Design: docs/superpowers/specs/2026-09-29-board-ocr-size-design.md.

import { existsSync, readdirSync, rmSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';

export const TESSERACT_KEEP = [
  'tesseract/worker.min.js',
  'tesseract/eng.traineddata',
  'tesseract/tesseract-core-relaxedsimd-lstm.wasm.js',
  'tesseract/tesseract-core-simd-lstm.wasm.js',
  'tesseract/tesseract-core-lstm.wasm.js',
];

// Files from public/ that Board's own code, index.board.html or PWA
// manifest reference. Directories end in '/' and keep everything under them.
export const PUBLIC_KEEP = [
  'fonts/',
  'favicon.ico',
  'board-icon-192.png',
  'board-icon-512.png',
  'bbq-board-logo.png',
  'gtm-init.js',
  ...TESSERACT_KEEP,
];

export function isKept(relPath) {
  return PUBLIC_KEEP.some(k => (k.endsWith('/') ? relPath.startsWith(k) : relPath === k));
}

function listFiles(dir, rel = '') {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listFiles(join(dir, entry.name), relPath));
    else out.push(relPath);
  }
  return out;
}

function removeEmptyDirs(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) removeEmptyDirs(join(dir, entry.name));
  }
  if (readdirSync(dir).length === 0) rmdirSync(dir);
}

// Returns the relative paths it removed.
export function pruneBoardNative(outDir, publicDir) {
  const removed = [];
  for (const relPath of listFiles(publicDir)) {
    if (isKept(relPath)) continue;
    const target = join(outDir, relPath);
    if (existsSync(target)) {
      rmSync(target);
      removed.push(relPath);
    }
  }
  for (const entry of readdirSync(outDir, { withFileTypes: true })) {
    if (entry.isDirectory()) removeEmptyDirs(join(outDir, entry.name));
  }
  const missing = TESSERACT_KEEP.filter(p => !existsSync(join(outDir, p)));
  if (missing.length) {
    throw new Error(`Board native build is missing OCR files: ${missing.join(', ')}`);
  }
  return removed;
}
