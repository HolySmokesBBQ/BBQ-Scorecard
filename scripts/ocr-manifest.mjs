// BBQ Board's OCR engine as served by the website: /ocr/tesseract-<version>/.
//
// Board 2.5.0 fetches these four files at run time instead of carrying them
// in the AAB (13.3 MB -> ~6 MB) and verifies each against the sha256 below
// before executing anything (auditor, 2026-10-23). The same constants gate
// the build (scripts/assemble-dist.mjs copies the files and refuses to ship
// a byte that does not match) and the live check (scripts/check-ocr-live.mjs
// hashes the decoded body of each live URL after every deploy).
//
// Rules:
// - A version directory is immutable once live (the CDN serves it with a
//   one-year immutable cache). A new engine build is a NEW version directory,
//   never an overwrite of this one.
// - Source bytes come from public/tesseract/ at HEAD. They are not copied
//   into public/ocr/ because every Vite build ships the whole of public/
//   inside every app bundle; the copy happens in assemble-dist only.

export const OCR_VERSION = '7.0.0';
export const OCR_SOURCE_DIR = 'public/tesseract';
export const OCR_SERVE_DIR = `ocr/tesseract-${OCR_VERSION}`;
export const OCR_FILES = [
  { name: 'tesseract-core-relaxedsimd-lstm.wasm.js', sha256: '861a536cf9ef8e63cb644d57bab39c388f37f7d6b6f60024b741c5f6b39a59b3' },
  { name: 'tesseract-core-simd-lstm.wasm.js', sha256: 'c58b46a4c796c0b8afccf77591d5b875b6896b45d402bbce8caa6f5362447b38' },
  { name: 'tesseract-core-lstm.wasm.js', sha256: 'eef5f8b2f8e20e150680b20adaec4a60babafee3adbe8a94583c81fee46e8680' },
  { name: 'eng.traineddata', sha256: '5dc5d8d640a212c9d6184921ba103b186f50e0fed9ee716c53e6b312b400d747' },
];
