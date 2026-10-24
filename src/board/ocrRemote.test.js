// Tier B remote OCR (spec docs/superpowers/specs/2026-09-29-board-ocr-size-design.md,
// auditor ruling 2026-10-23). These are the spec's tamper, origin, cache
// and offline tests. Nothing here touches the network.

import { describe, test, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { webcrypto, createHash } from 'node:crypto';
import {
  OCR_BASE, loadVerified, pickCoreVariant, assertOcrUrl, prepareRemoteOcr,
  ocrErrorCode, ocrErrorMessage, OCR_ERROR_CODES, useRemoteOcr,
} from './ocrRemote.js';
import { OCR_HASHES, OCR_VERSION } from './ocrHashes.js';
import { computeOcrHashes, renderHashesModule } from '../../scripts/gen-ocr-hashes.mjs';

const ROOT = resolve(__dirname, '../..');
const subtle = webcrypto.subtle;
const real = (f) => new Uint8Array(readFileSync(resolve(ROOT, 'public/tesseract', f)));
const LANG = 'eng.traineddata';
const CORE = 'tesseract-core-lstm.wasm.js';

function memCache(init = {}) {
  const m = new Map(Object.entries(init));
  return {
    get: vi.fn(async (k) => m.get(k)),
    set: vi.fn(async (k, v) => { m.set(k, v); }),
    del: vi.fn(async (k) => { m.delete(k); }),
    m,
  };
}
const okResponse = (bytes) => ({ ok: true, status: 200, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });
const fetchServing = (files) => vi.fn(async (url) => {
  const name = url.slice(OCR_BASE.length);
  if (!url.startsWith(OCR_BASE) || !files[name]) return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) };
  return okResponse(files[name]);
});

describe('hash constants (the CI check)', () => {
  test('committed ocrHashes.js matches public/tesseract and the pinned core package', () => {
    const fresh = renderHashesModule(computeOcrHashes(ROOT));
    const committed = readFileSync(resolve(ROOT, 'src/board/ocrHashes.js'), 'utf8').replace(/\r\n/g, '\n');
    expect(committed).toBe(fresh);
  });
  test('the URL is pinned to the core version', () => {
    expect(OCR_BASE).toBe(`https://holysmokesbbqco.com/ocr/tesseract-${OCR_VERSION}/`);
  });
});

describe('loadVerified', () => {
  test('a good download verifies, returns the bytes, and is cached under version + hash', async () => {
    const cache = memCache();
    const fetchImpl = fetchServing({ [LANG]: real(LANG) });
    const bytes = await loadVerified(LANG, { fetchImpl, cache, subtle });
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(OCR_HASHES[LANG]);
    expect([...cache.m.keys()]).toEqual([`board-ocr/${OCR_VERSION}/${LANG}/${OCR_HASHES[LANG]}`]);
    expect(fetchImpl).toHaveBeenCalledWith(OCR_BASE + LANG, expect.objectContaining({ redirect: 'error', credentials: 'omit' }));
  });

  test('TAMPER: one flipped byte aborts with ocr-integrity and nothing is cached or returned', async () => {
    const bad = real(CORE).slice();
    bad[1000] ^= 0xff;
    const cache = memCache();
    await expect(loadVerified(CORE, { fetchImpl: fetchServing({ [CORE]: bad }), cache, subtle }))
      .rejects.toMatchObject({ code: 'ocr-integrity' });
    expect(cache.set).not.toHaveBeenCalled();
  });

  test('TAMPER: the right bytes for a different file are rejected (no cross-file substitution)', async () => {
    await expect(loadVerified(CORE, { fetchImpl: fetchServing({ [CORE]: real('tesseract-core-simd-lstm.wasm.js') }), cache: memCache(), subtle }))
      .rejects.toMatchObject({ code: 'ocr-integrity' });
  });

  test('CACHE: a corrupted cached copy is caught on read, dropped, and re-fetched', async () => {
    const key = `board-ocr/${OCR_VERSION}/${LANG}/${OCR_HASHES[LANG]}`;
    const corrupt = real(LANG).slice(); corrupt[0] ^= 1;
    const cache = memCache({ [key]: corrupt });
    const fetchImpl = fetchServing({ [LANG]: real(LANG) });
    const bytes = await loadVerified(LANG, { fetchImpl, cache, subtle });
    expect(cache.del).toHaveBeenCalledWith(key);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(OCR_HASHES[LANG]);
  });

  test('OFFLINE with a good cache: scans without the network', async () => {
    const key = `board-ocr/${OCR_VERSION}/${LANG}/${OCR_HASHES[LANG]}`;
    const fetchImpl = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    const bytes = await loadVerified(LANG, { fetchImpl, cache: memCache({ [key]: real(LANG) }), subtle });
    expect(bytes.length).toBeGreaterThan(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('OFFLINE with no cache: ocr-offline', async () => {
    const fetchImpl = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    await expect(loadVerified(LANG, { fetchImpl, cache: memCache(), subtle })).rejects.toMatchObject({ code: 'ocr-offline' });
  });

  test('a 404 (files not deployed) is ocr-unavailable, never a fallback', async () => {
    await expect(loadVerified(LANG, { fetchImpl: fetchServing({}), cache: memCache(), subtle }))
      .rejects.toMatchObject({ code: 'ocr-unavailable' });
  });

  test('a file with no compiled hash is refused before any fetch', async () => {
    const fetchImpl = vi.fn();
    await expect(loadVerified('worker.min.js', { fetchImpl, cache: memCache(), subtle })).rejects.toMatchObject({ code: 'ocr-unknown-file' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('wrong-origin guard', () => {
  test('only our pinned /ocr/ path passes', () => {
    expect(() => assertOcrUrl(OCR_BASE + LANG)).not.toThrow();
    for (const u of [
      'https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0/' + CORE,
      'https://holysmokesbbqco.com/ocr/tesseract-6.0.0/' + CORE,
      'http://holysmokesbbqco.com/ocr/tesseract-7.0.0/' + CORE,
      'https://holysmokesbbqco.com.evil.example/ocr/tesseract-7.0.0/' + CORE,
    ]) expect(() => assertOcrUrl(u), u).toThrow();
  });
});

describe('pickCoreVariant mirrors getCore', () => {
  const yes = async () => true, no = async () => false;
  test('relaxed SIMD, then SIMD, then baseline', async () => {
    expect(await pickCoreVariant({ relaxedSimd: yes, simd: yes })).toBe('tesseract-core-relaxedsimd-lstm.wasm.js');
    expect(await pickCoreVariant({ relaxedSimd: no, simd: yes })).toBe('tesseract-core-simd-lstm.wasm.js');
    expect(await pickCoreVariant({ relaxedSimd: no, simd: no })).toBe('tesseract-core-lstm.wasm.js');
  });
});

describe('prepareRemoteOcr', () => {
  test('fetches only this device\'s core plus the language file, and hands tesseract verified bytes', async () => {
    const files = {}; for (const f of Object.keys(OCR_HASHES)) files[f] = real(f);
    const fetchImpl = fetchServing(files);
    const tessCache = memCache();
    const urls = [];
    const ocr = await prepareRemoteOcr({
      detect: { relaxedSimd: async () => false, simd: async () => true },
      fetchImpl, cache: memCache(), subtle, tessCache,
      makeBlobUrl: (bytes) => { urls.push(bytes); return 'blob:https://localhost/abc'; },
    });
    expect(fetchImpl.mock.calls.map(c => c[0].slice(OCR_BASE.length)).sort())
      .toEqual(['eng.traineddata', 'tesseract-core-simd-lstm.wasm.js']);
    // getCore only uses an explicit file when the path ends in "js".
    expect(ocr.corePath).toBe('blob:https://localhost/abc#tesseract-core-simd-lstm.wasm.js');
    expect(ocr.corePath.slice(-2)).toBe('js');
    // The language data goes into tesseract's own cache, read-only, and a
    // cache miss can't fall back to an unverified fetch.
    expect(ocr.cacheMethod).toBe('readOnly');
    expect(ocr.langPath).toBe('about:blank');
    expect(tessCache.set).toHaveBeenCalledWith(`${ocr.cachePath}/eng.traineddata`, expect.any(Uint8Array));
    expect(ocr.cachePath).toContain(OCR_HASHES[LANG].slice(0, 12));
  });

  test('a tampered core never becomes a blob URL', async () => {
    const files = {}; for (const f of Object.keys(OCR_HASHES)) files[f] = real(f);
    files['tesseract-core-lstm.wasm.js'] = files['tesseract-core-lstm.wasm.js'].slice(); files['tesseract-core-lstm.wasm.js'][5] ^= 1;
    const makeBlobUrl = vi.fn(() => 'blob:x');
    await expect(prepareRemoteOcr({
      detect: { relaxedSimd: async () => false, simd: async () => false },
      fetchImpl: fetchServing(files), cache: memCache(), subtle, tessCache: memCache(), makeBlobUrl,
    })).rejects.toMatchObject({ code: 'ocr-integrity' });
    expect(makeBlobUrl).not.toHaveBeenCalled();
  });
});

describe('failure copy and codes (auditor condition d)', () => {
  test('offline has its own honest line; everything else says scanning is unavailable', () => {
    expect(ocrErrorMessage({ code: 'ocr-offline' })).toMatch(/needs a connection the first time/);
    for (const code of ['ocr-integrity', 'ocr-unavailable', 'ocr-origin', 'ocr-unknown-file']) {
      expect(ocrErrorMessage({ code })).toMatch(/isn.t available right now.*by hand/);
    }
    expect(ocrErrorMessage(new Error('x'))).toBeNull();
  });
  test('codes sent to analytics come from a fixed list', () => {
    for (const code of OCR_ERROR_CODES) expect(ocrErrorCode({ code })).toBe(code);
    expect(ocrErrorCode({ code: 'auth/network-request-failed' })).toBe('network');
    expect(ocrErrorCode(new Error('leaky text joe@example.com'))).toBe('other');
  });
});

describe('platform switch', () => {
  test('remote only on native Android; iOS and web keep the bundled engine', () => {
    expect(useRemoteOcr({ Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' } })).toBe(true);
    expect(useRemoteOcr({ Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios' } })).toBe(false);
    expect(useRemoteOcr({})).toBe(false);
  });
});
