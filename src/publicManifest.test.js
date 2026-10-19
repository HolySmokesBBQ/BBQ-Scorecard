// public/ ships inside every app bundle, so its contents are a deliberate,
// reviewed list. This fails EVERY session's suite the moment a file lands in
// (or vanishes from) public/ without a matching manifest edit - the guard
// born from pit-game.js riding dead inside four days of store bundles.
import { describe, it, expect } from 'vitest';
import { diff } from '../scripts/check-public-manifest.mjs';

describe('public/ manifest', () => {
  it('contains no unlisted files (anything here ships into every AAB/IPA)', () => {
    const d = diff();
    expect(d.unlisted, `unlisted files in public/ - if deliberate, run: node scripts/check-public-manifest.mjs --update (same commit)`).toEqual([]);
  });
  it('is not missing any manifested file (deletions must update the manifest)', () => {
    const d = diff();
    expect(d.missing, `manifested files missing from public/ - if deliberate, run: node scripts/check-public-manifest.mjs --update (same commit)`).toEqual([]);
  });
});
