import { describe, test, expect, vi } from 'vitest';
import {
  recordPost, maybeAskForReview, shareMessage, shareBoard,
  POSTED_COUNT_KEY, REVIEW_ASKED_KEY, REVIEW_AT,
} from './postFollowup.js';

function memStorage(init = {}) {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
}

describe('recordPost', () => {
  test('counts posts per install', () => {
    const s = memStorage();
    expect(recordPost(s)).toBe(1);
    expect(recordPost(s)).toBe(2);
    expect(s.getItem(POSTED_COUNT_KEY)).toBe('2');
  });
  test('an ad scan adds every price it posted', () => {
    const s = memStorage();
    expect(recordPost(s, 3)).toBe(3);
    expect(recordPost(s)).toBe(4);
    expect(recordPost(s, 0)).toBe(4);
  });
  test('survives a broken value', () => {
    expect(recordPost(memStorage({ [POSTED_COUNT_KEY]: 'junk' }))).toBe(1);
  });
  test('keys start with board, so account deletion wipes them', () => {
    expect(POSTED_COUNT_KEY.startsWith('board')).toBe(true);
    expect(REVIEW_ASKED_KEY.startsWith('board')).toBe(true);
  });
});

describe('maybeAskForReview (ASO audit: ask once, on the 2nd post)', () => {
  test('asks on the 2nd post, native only, once', async () => {
    const s = memStorage();
    const request = vi.fn(async () => {});
    expect(await maybeAskForReview({ postCount: 1, storage: s, isNative: true, request })).toBe(false);
    expect(await maybeAskForReview({ postCount: REVIEW_AT, storage: s, isNative: true, request })).toBe(true);
    expect(await maybeAskForReview({ postCount: 3, storage: s, isNative: true, request })).toBe(false);
    expect(request).toHaveBeenCalledTimes(1);
  });
  test('never on the web', async () => {
    const request = vi.fn();
    expect(await maybeAskForReview({ postCount: 2, storage: memStorage(), isNative: false, request })).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });
  test('records the ask before calling, so a failing native call cannot re-ask', async () => {
    const s = memStorage();
    const request = vi.fn(async () => { throw new Error('plugin missing'); });
    expect(await maybeAskForReview({ postCount: 2, storage: s, isNative: true, request })).toBe(true);
    expect(s.getItem(REVIEW_ASKED_KEY)).toBe('1');
  });
});

describe('shareMessage (referrals audit: share the shop and the community, never a price)', () => {
  test('after a post names the shop and links the web app with a utm source', () => {
    const m = shareMessage({ source: 'post_confirm', shopName: 'Kettle Range Meat Co.' });
    expect(m.text).toContain('Kettle Range Meat Co.');
    expect(m.url).toBe('https://holysmokesbbqco.com/board/?utm_source=board_share&utm_medium=app&utm_campaign=post_confirm');
  });
  test('shop detail', () => {
    expect(shareMessage({ source: 'shop_detail', shopName: 'Bunzel’s' }).text).toContain('Bunzel’s');
  });
  test('no price, no dollar sign, no other platform named', () => {
    for (const source of ['post_confirm', 'shop_detail']) {
      const { text } = shareMessage({ source, shopName: 'X' });
      expect(text).not.toMatch(/\$|\/lb|cheap/i);
      expect(text).not.toMatch(/android|iphone|google play|app store/i);
    }
  });
});

describe('shareBoard', () => {
  test('uses the native share sheet when native', async () => {
    const share = vi.fn(async () => {});
    const r = await shareBoard({ source: 'shop_detail', shopName: 'X' }, { isNative: true, nativeShare: share });
    expect(r).toBe('native');
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining('utm_campaign=shop_detail') }));
  });
  test('a cancelled share sheet is not an error', async () => {
    const share = vi.fn(async () => { throw new Error('Share canceled'); });
    expect(await shareBoard({ source: 'shop_detail', shopName: 'X' }, { isNative: true, nativeShare: share })).toBe('cancelled');
  });
  test('falls back to the web share API, then the clipboard', async () => {
    const webShare = vi.fn(async () => {});
    expect(await shareBoard({ source: 'post_confirm', shopName: 'X' }, { isNative: false, webShare })).toBe('web');
    const copy = vi.fn(async () => {});
    expect(await shareBoard({ source: 'post_confirm', shopName: 'X' }, { isNative: false, webShare: null, copy })).toBe('copied');
    expect(copy.mock.calls[0][0]).toContain('https://holysmokesbbqco.com/board/');
  });
});
