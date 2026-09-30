// Board's native build ships only the Tesseract files it can load
// (scripts/board-native-assets.mjs). These tests prove the kept set covers
// every file the engine can ask for, by reading tesseract.js's own source
// rather than trusting a hand-written list. If an upgrade changes getCore's
// selection or Board's worker options, these fail before a build ships
// without a file some phone needs.
//
// Security audit acceptance criterion for Board 2.4.5 (Tier A): the
// remaining files must cover getCore's full selection matrix.

import { describe, test, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { TESSERACT_KEEP, isKept } from '../../scripts/board-native-assets.mjs';

const ROOT = resolve(__dirname, '../..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');

const getCore = read('node_modules/tesseract.js/src/worker-script/browser/getCore.js');
const createWorkerSrc = read('node_modules/tesseract.js/src/createWorker.js');
const workerScript = read('node_modules/tesseract.js/src/worker-script/index.js');
const app = read('src/App.board.jsx');

// The options object Board passes to createWorker.
const workerCall = app.match(/createWorker\(([\s\S]*?)\n\s*\}\);/);

describe('getCore selection matrix', () => {
  const coreFiles = [...getCore.matchAll(/\/(tesseract-core[\w-]*\.wasm\.js)`/g)].map(m => m[1]);

  test('getCore still picks from six .wasm.js builds', () => {
    // relaxedsimd / simd / baseline, each with and without -lstm.
    expect(new Set(coreFiles).size).toBe(6);
  });

  test('every LSTM build getCore can pick is kept', () => {
    const lstm = coreFiles.filter(f => f.includes('-lstm'));
    expect(lstm).toHaveLength(3);
    for (const f of lstm) expect(isKept(`tesseract/${f}`), f).toBe(true);
  });

  test('getCore imports a .wasm.js, never a standalone .wasm or plain .js loader', () => {
    expect(getCore).toMatch(/importScripts\(corePathImportFile\)/);
    for (const f of coreFiles) expect(f.endsWith('.wasm.js')).toBe(true);
  });
});

describe("Board's worker only ever loads the LSTM builds", () => {
  test('Board creates the worker with OEM 1', () => {
    expect(workerCall, 'createWorker call not found in App.board.jsx').toBeTruthy();
    expect(workerCall[1]).toMatch(/^'eng',\s*1,/);
  });

  test('OEM 1 is LSTM_ONLY and LSTM_ONLY selects the -lstm core', () => {
    const oem = read('node_modules/tesseract.js/src/constants/OEM.js');
    expect(oem).toMatch(/LSTM_ONLY:\s*1\b/);
    expect(createWorkerSrc).toMatch(
      /lstmOnlyCore = \[OEM\.DEFAULT, OEM\.LSTM_ONLY\]\.includes\(oem\) && !options\.legacyCore/,
    );
    expect(workerCall[1]).not.toMatch(/legacyCore/);
  });

  test('Board points corePath at a directory, so getCore does the selecting', () => {
    expect(workerCall[1]).toMatch(/corePath:\s*tessBase\b/);
    expect(app).toMatch(/const tessBase = `\$\{import\.meta\.env\.BASE_URL\}tesseract\/`/);
  });
});

describe('language data', () => {
  test('Board asks for eng.traineddata uncompressed, which is what we ship', () => {
    // tesseract.js defaults gzip to true and would request .gz.
    expect(workerScript).toMatch(/gzip = true/);
    expect(workerCall[1]).toMatch(/gzip:\s*false/);
    expect(isKept('tesseract/eng.traineddata')).toBe(true);
    expect(existsSync(resolve(ROOT, 'public/tesseract/eng.traineddata.gz'))).toBe(false);
  });

  test('eng.traineddata is not already gzipped', () => {
    const head = readFileSync(resolve(ROOT, 'public/tesseract/eng.traineddata')).subarray(0, 2);
    expect(head[0] === 0x1f && head[1] === 0x8b).toBe(false);
  });
});

describe('kept files exist', () => {
  test('every kept OCR file is in public/', () => {
    for (const p of TESSERACT_KEEP) expect(existsSync(resolve(ROOT, 'public', p)), p).toBe(true);
  });

  test('the dead builds are not kept', () => {
    for (const f of [
      'tesseract/tesseract-core.wasm.js',
      'tesseract/tesseract-core-simd.wasm.js',
      'tesseract/tesseract-core-relaxedsimd.wasm.js',
      'tesseract/tesseract-core-lstm.wasm',
      'tesseract/tesseract-core-lstm.js',
    ]) expect(isKept(f), f).toBe(false);
  });
});
