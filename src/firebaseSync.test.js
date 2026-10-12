// Review sync against a stray `_docId` field (2026-10-12).
//
// loadMyCloudReviews() tags every loaded review with `_docId`. A June 2026
// build wrote that tag back into 21 of Joel's cloud reviews. The reviews
// rule only allows its whitelisted keys, and every sync writes with
// { merge: true }, so the stored `_docId` rode along on every later write
// and each one was refused. On 4.3.0 the refused reviews sank the whole
// batch, so nothing synced at all, and a review saved on 10/01 never
// reached the cloud.
//
// The fix: every review write explicitly deletes `_docId`, so a poisoned
// doc heals on its next sync instead of staying refused forever.

import { describe, test, expect, beforeEach, vi } from 'vitest';

const DELETE = { __sentinel: 'deleteField' };
const writes = [];
let batchShouldFail = false;

vi.mock('./firebase.js', () => ({ auth: {}, db: {}, storage: {}, googleProvider: {}, appleProvider: {} }));
vi.mock('firebase/auth', () => ({}));
vi.mock('firebase/storage', () => ({}));
vi.mock('firebase/firestore', () => ({
  doc: (_db, col, id) => ({ col, id }),
  collection: () => ({}),
  query: () => ({}),
  where: () => ({}),
  getDoc: async () => ({ exists: () => false }),
  getDocs: async () => ({ docs: [] }),
  deleteDoc: async () => {},
  deleteField: () => DELETE,
  setDoc: async (ref, data, opts) => {
    // Stand-in for the rules: a doc whose id says it is poisoned is refused
    // unless the write deletes `_docId`.
    if (ref.id.includes('poisoned') && data._docId !== DELETE) {
      throw Object.assign(new Error('denied'), { code: 'permission-denied' });
    }
    writes.push({ id: ref.id, data, opts });
  },
  writeBatch: () => {
    const pending = [];
    return {
      set: (ref, data, opts) => pending.push({ id: ref.id, data, opts }),
      commit: async () => {
        if (batchShouldFail) throw Object.assign(new Error('denied'), { code: 'permission-denied' });
        writes.push(...pending);
      },
    };
  },
}));

const sync = await import('./firebaseSync.js');

const review = (id, extra = {}) => ({
  id, restaurant: "J's BBQ", location: 'Milwaukee, WI', date: '2026-10-01',
  scores: { taste: 7 }, photos: [], ...extra,
});

beforeEach(() => { writes.length = 0; batchShouldFail = false; });

describe('every review write clears a stray _docId', () => {
  test('bulk sync deletes _docId on each review', async () => {
    await sync.syncReviewsUp('uid1', [review('a'), review('b', { _docId: 'uid1_b' })]);
    expect(writes).toHaveLength(2);
    for (const w of writes) {
      expect(w.data._docId).toBe(DELETE);
      expect(w.opts).toEqual({ merge: true });
    }
  });

  test('the explicit save write deletes _docId too', async () => {
    await sync.syncReviewWithPhotos('uid1', review('c', { _docId: 'uid1_c' }));
    expect(writes[0].data._docId).toBe(DELETE);
  });

  test('a local _docId tag is never written as a value', async () => {
    await sync.syncReviewsUp('uid1', [review('d', { _docId: 'uid1_d' })]);
    expect(writes[0].data._docId).not.toBe('uid1_d');
  });

  test('only _docId is deleted; the review itself is written intact', async () => {
    await sync.syncReviewsUp('uid1', [review('e')]);
    const d = writes[0].data;
    expect(d.restaurant).toBe("J's BBQ");
    expect(d.scores).toEqual({ taste: 7 });
    expect(d.userId).toBe('uid1');
    expect(Object.values(d).filter((v) => v === DELETE)).toHaveLength(1);
  });
});

describe('one refused review cannot block the rest', () => {
  test('when the batch is refused, each review is retried and the good ones land', async () => {
    batchShouldFail = true;
    const res = await sync.syncReviewsUp('uid1', [review('new-oct-1'), review('poisoned-old')]);
    expect(writes.map((w) => w.id)).toContain('uid1_new-oct-1');
    // With _docId deleted on every write, the poisoned doc heals as well.
    expect(writes.map((w) => w.id)).toContain('uid1_poisoned-old');
    expect(res.failed).toEqual([]);
  });
});
