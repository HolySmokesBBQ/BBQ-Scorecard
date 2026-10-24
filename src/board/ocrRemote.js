// Board Tier B: on Android, the OCR engine's big files are fetched from our
// own origin on first scan instead of shipping in the AAB (spec
// docs/superpowers/specs/2026-09-29-board-ocr-size-design.md; approved by
// the Security auditor 2026-10-23). iOS and the website keep loading the
// bundled files exactly as before.
//
// Fail-closed, per the spec's non-negotiable constraints:
//   - Only https://holysmokesbbqco.com/ocr/tesseract-<version>/ is ever
//     fetched (no CDN, no redirects, no cookies). The version is in the path,
//     so nothing is overwritten in place.
//   - Every file's SHA-256 is a constant compiled into this bundle
//     (ocrHashes.js, generated and CI-checked). The bytes are hashed before
//     use; any mismatch aborts the scan. There is no retry and no fallback
//     of any kind (auditor condition d).
//   - tesseract.js executes the verified bytes themselves: the core goes in
//     as a blob URL made from the checked ArrayBuffer, and the language data
//     is written to tesseract's cache with cacheMethod 'readOnly' and a dead
//     langPath, so a cache miss fails instead of fetching unverified data.
//   - Verified copies are cached in IndexedDB under version + hash and
//     re-verified on every read, since device storage is writable too.
//
// Play policy basis (auditor condition a): the cores are WebAssembly run by
// the WebView's JavaScript engine, which Play's Device and Network Abuse
// policy exempts ("code that runs in a virtual machine or an interpreter
// ... such as JavaScript in a webview"); eng.traineddata is model data, not
// code. iOS doesn't use this path at all (condition b).

import { OCR_VERSION, OCR_HASHES } from './ocrHashes.js';
import { errorCode } from '../analyticsCodes.js';

export const OCR_ORIGIN = 'https://holysmokesbbqco.com';
export const OCR_BASE = `${OCR_ORIGIN}/ocr/tesseract-${OCR_VERSION}/`;
const LANG_FILE = 'eng.traineddata';

export const OCR_ERROR_CODES = ['ocr-offline', 'ocr-unavailable', 'ocr-integrity', 'ocr-origin', 'ocr-unknown-file'];

const fail = (code) => Object.assign(new Error(code), { code });

export function useRemoteOcr(win = typeof window !== 'undefined' ? window : {}) {
  const cap = win.Capacitor;
  return !!(cap?.isNativePlatform?.() && cap.getPlatform?.() === 'android');
}

export function assertOcrUrl(url) {
  if (typeof url !== 'string' || !url.startsWith(OCR_BASE)) throw fail('ocr-origin');
}

// Same order as tesseract.js's getCore: relaxed SIMD, SIMD, baseline.
export async function pickCoreVariant(detect) {
  const d = detect || await import('wasm-feature-detect');
  if (await d.relaxedSimd()) return 'tesseract-core-relaxedsimd-lstm.wasm.js';
  if (await d.simd()) return 'tesseract-core-simd-lstm.wasm.js';
  return 'tesseract-core-lstm.wasm.js';
}

async function sha256Hex(bytes, subtle) {
  const digest = await subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function defaultCache() {
  const { get, set, del } = await import('idb-keyval');
  return { get, set, del };
}

export async function loadVerified(name, {
  fetchImpl = globalThis.fetch?.bind(globalThis),
  cache,
  subtle = globalThis.crypto?.subtle,
} = {}) {
  const expected = OCR_HASHES[name];
  if (!expected) throw fail('ocr-unknown-file');
  const store = cache || await defaultCache();
  const key = `board-ocr/${OCR_VERSION}/${name}/${expected}`;

  let cached;
  try { cached = await store.get(key); } catch {}
  if (cached) {
    const bytes = cached instanceof Uint8Array ? cached : new Uint8Array(cached);
    if (await sha256Hex(bytes, subtle) === expected) return bytes;
    try { await store.del(key); } catch {}
  }

  const url = OCR_BASE + name;
  assertOcrUrl(url);
  let resp;
  try {
    resp = await fetchImpl(url, { redirect: 'error', credentials: 'omit', cache: 'no-store' });
  } catch {
    throw fail('ocr-offline');
  }
  if (!resp?.ok) throw fail('ocr-unavailable');
  const bytes = new Uint8Array(await resp.arrayBuffer());
  if (await sha256Hex(bytes, subtle) !== expected) throw fail('ocr-integrity');
  try { await store.set(key, bytes); } catch {}
  return bytes;
}

const defaultBlobUrl = (bytes) => URL.createObjectURL(new Blob([bytes], { type: 'application/javascript' }));

// Returns the createWorker options that make tesseract.js run only the
// verified bytes. revoke() frees the core's blob URL after the scan.
export async function prepareRemoteOcr({
  detect, fetchImpl, cache, subtle, tessCache, makeBlobUrl = defaultBlobUrl,
} = {}) {
  const coreName = await pickCoreVariant(detect);
  const opts = { fetchImpl, cache, subtle };
  const [core, lang] = await Promise.all([loadVerified(coreName, opts), loadVerified(LANG_FILE, opts)]);

  // tesseract.js reads `${cachePath}/eng.traineddata` from idb-keyval's
  // default store, the same one the worker opens.
  const cachePath = `board-ocr-lang-${OCR_VERSION}-${OCR_HASHES[LANG_FILE].slice(0, 12)}`;
  const tc = tessCache || await defaultCache();
  await tc.set(`${cachePath}/${LANG_FILE}`, lang);

  const blobUrl = makeBlobUrl(core);
  return {
    // getCore uses an explicit file only when the path ends in "js"; the
    // fragment is ignored when the blob is loaded.
    corePath: `${blobUrl}#${coreName}`,
    langPath: 'about:blank',
    cachePath,
    cacheMethod: 'readOnly',
    revoke: () => { try { URL.revokeObjectURL(blobUrl); } catch {} },
  };
}

export function ocrErrorCode(err) {
  return OCR_ERROR_CODES.includes(err?.code) ? err.code : errorCode(err);
}

// Honest copy for each failure; null means "not an OCR-loading failure".
export function ocrErrorMessage(err) {
  if (err?.code === 'ocr-offline') {
    return 'Scanning a weekly ad needs a connection the first time. Try again once you’re online.';
  }
  if (OCR_ERROR_CODES.includes(err?.code)) {
    return 'Ad scanning isn’t available right now. You can still add prices by hand.';
  }
  return null;
}
