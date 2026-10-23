import { test, expect, vi } from 'vitest';
import { shouldAskForRating, maybeAskForRating, RATING_ASKED_KEY, RATING_PROMPT_AT } from './ratingPrompt.js';
import { LOCAL_PREFIXES } from './accountDeletion.js';

const memStorage = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m };
};

test('asks only on a new review once the count reaches 3, on native, if never asked', () => {
  const base = { isNative: true, isNew: true, reviewCount: RATING_PROMPT_AT, alreadyAsked: false };
  expect(shouldAskForRating(base)).toBe(true);
  expect(shouldAskForRating({ ...base, reviewCount: 2 })).toBe(false);
  expect(shouldAskForRating({ ...base, isNew: false })).toBe(false);
  expect(shouldAskForRating({ ...base, isNative: false })).toBe(false);
  expect(shouldAskForRating({ ...base, alreadyAsked: true })).toBe(false);
  // Long-time users who update past this release get asked on their next new review.
  expect(shouldAskForRating({ ...base, reviewCount: 40 })).toBe(true);
});

test('asks exactly once per install', async () => {
  const storage = memStorage();
  const request = vi.fn().mockResolvedValue();
  expect(await maybeAskForRating({ isNew: true, reviewCount: 3, storage, isNative: true, request })).toBe(true);
  expect(await maybeAskForRating({ isNew: true, reviewCount: 4, storage, isNative: true, request })).toBe(false);
  expect(request).toHaveBeenCalledTimes(1);
  expect(storage.getItem(RATING_ASKED_KEY)).toBe('1');
});

test('a failing native call is swallowed and still counts as asked', async () => {
  const storage = memStorage();
  const request = vi.fn().mockRejectedValue(new Error('no play services'));
  await expect(maybeAskForRating({ isNew: true, reviewCount: 3, storage, isNative: true, request })).resolves.toBe(true);
  expect(await maybeAskForRating({ isNew: true, reviewCount: 5, storage, isNative: true, request })).toBe(false);
  expect(request).toHaveBeenCalledTimes(1);
});

test('web never asks', async () => {
  const request = vi.fn();
  expect(await maybeAskForRating({ isNew: true, reviewCount: 9, storage: memStorage(), isNative: false, request })).toBe(false);
  expect(request).not.toHaveBeenCalled();
});

test('the asked flag is wiped by account deletion', () => {
  expect(LOCAL_PREFIXES.some((p) => RATING_ASKED_KEY.startsWith(p))).toBe(true);
});
