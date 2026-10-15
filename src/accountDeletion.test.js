// In-app account deletion (legal register #1, Apple 5.1.1(v)), 2026-10-15.
// Shape approved by the Security auditor: re-auth first, delete the user's
// data (Firestore + Storage + friend links + profile), revoke Sign in with
// Apple, delete the Auth record, then wipe the device. No Cloud Function.
//
// These tests pin the ORDER and the failure handling, which is where a
// deletion flow goes wrong: a half-deleted account with no way back in, or
// an Auth record deleted while the user's data is still in the cloud.

import { describe, test, expect } from 'vitest';
import { deleteAccount, wipeLocalAppData, LOCAL_PREFIXES } from './accountDeletion.js';

function fakeOps(overrides = {}) {
  const calls = [];
  const log = (name) => (...args) => { calls.push([name, ...args]); };
  const ops = {
    currentUser: () => ({ uid: 'u1', providerIds: ['google.com'] }),
    reauthenticate: async (user, opts) => { calls.push(['reauth', user.providerIds[0], opts?.password || null]); return { appleAuthorizationCode: null }; },
    listOwnedDocs: async (col, uid) => { calls.push(['list', col, uid]); return [{ col, id: `${uid}_r1`, itemId: 'r1' }, { col, id: `${uid}_r2`, itemId: 'r2' }]; },
    deleteStorageFolder: async (path) => { calls.push(['rmStorage', path]); },
    deleteDocAt: async (path) => { calls.push(['rmDoc', path]); },
    listIds: async (path) => { calls.push(['listIds', path]); return path.endsWith('/friends') ? ['f1'] : path.endsWith('/friendRequests') ? ['q1'] : []; },
    readProfile: async (uid) => { calls.push(['profile', uid]); return { friendCode: 'BBQ-ABC123' }; },
    revokeApple: log('revokeApple'),
    deleteUser: log('deleteUser'),
    nativeSignOut: log('nativeSignOut'),
    wipeLocal: log('wipeLocal'),
    ...overrides,
  };
  return { ops, calls };
}

const run = (ops, extra = {}) =>
  deleteAccount({ ops, ownedCollections: [{ name: 'reviews', storagePrefix: 'reviews' }], ...extra });

describe('order', () => {
  test('re-auth happens before anything is deleted, and Auth goes after all data', async () => {
    const { ops, calls } = fakeOps();
    const res = await run(ops);
    expect(res.ok).toBe(true);
    const names = calls.map((c) => c[0]);
    expect(names[0]).toBe('reauth');
    const lastData = Math.max(...names.map((n, i) => (['rmDoc', 'rmStorage'].includes(n) ? i : -1)));
    expect(names.indexOf('deleteUser')).toBeGreaterThan(lastData);
    expect(names.indexOf('wipeLocal')).toBeGreaterThan(names.indexOf('deleteUser'));
  });

  test('deletes every owned doc, its photos, both friend links, requests, the friend code and the profile', async () => {
    const { ops, calls } = fakeOps();
    await run(ops);
    const docs = calls.filter((c) => c[0] === 'rmDoc').map((c) => c[1]);
    expect(docs).toEqual(expect.arrayContaining([
      'reviews/u1_r1', 'reviews/u1_r2',
      'users/u1/friends/f1', 'users/f1/friends/u1',
      'users/u1/friendRequests/q1',
      'friendCodes/BBQ-ABC123',
      'users/u1',
    ]));
    // The profile doc goes last among the user's own docs: it is how the
    // friend code is found, so deleting it first would strand the code.
    expect(docs.at(-1)).toBe('users/u1');
    const storage = calls.filter((c) => c[0] === 'rmStorage').map((c) => c[1]);
    expect(storage).toEqual(['reviews/u1/r1', 'reviews/u1/r2']);
  });
});

describe('failures', () => {
  test('a failed or cancelled re-auth deletes nothing', async () => {
    const { ops, calls } = fakeOps({ reauthenticate: async () => { throw Object.assign(new Error('x'), { code: 'auth/popup-closed-by-user' }); } });
    const res = await run(ops);
    expect(res).toMatchObject({ ok: false, stage: 'reauth' });
    expect(calls.some((c) => ['rmDoc', 'rmStorage', 'deleteUser', 'wipeLocal'].includes(c[0]))).toBe(false);
  });

  test('if the user\'s own data cannot all be deleted, the Auth record is kept so they can retry', async () => {
    const { ops, calls } = fakeOps({
      deleteDocAt: async (path) => { calls.push(['rmDoc', path]); if (path === 'reviews/u1_r2') throw Object.assign(new Error('no'), { code: 'permission-denied' }); },
    });
    const res = await run(ops);
    expect(res).toMatchObject({ ok: false, stage: 'data' });
    expect(res.failed.map((f) => f.path)).toContain('reviews/u1_r2');
    expect(calls.some((c) => c[0] === 'deleteUser')).toBe(false);
    expect(calls.some((c) => c[0] === 'wipeLocal')).toBe(false);
  });

  test("another user's side of a friendship failing is best effort and does not block", async () => {
    const { ops, calls } = fakeOps({
      deleteDocAt: async (path) => { calls.push(['rmDoc', path]); if (path === 'users/f1/friends/u1') throw new Error('denied'); },
    });
    const res = await run(ops);
    expect(res.ok).toBe(true);
    expect(res.leftovers.map((l) => l.path)).toContain('users/f1/friends/u1');
    expect(calls.some((c) => c[0] === 'deleteUser')).toBe(true);
  });

  test('a failed Auth delete after data is gone reports stage auth and does not wipe the device', async () => {
    const { ops, calls } = fakeOps({ deleteUser: async () => { throw Object.assign(new Error('x'), { code: 'auth/requires-recent-login' }); } });
    const res = await run(ops);
    expect(res).toMatchObject({ ok: false, stage: 'auth' });
    expect(calls.some((c) => c[0] === 'wipeLocal')).toBe(false);
  });

  test('a missing profile or friend code is fine (already gone, or never made)', async () => {
    const { ops } = fakeOps({ readProfile: async () => null });
    const res = await run(ops);
    expect(res.ok).toBe(true);
  });
});

describe('providers', () => {
  test('Sign in with Apple accounts get their Apple token revoked before Auth is deleted', async () => {
    const { ops, calls } = fakeOps({
      currentUser: () => ({ uid: 'u1', providerIds: ['apple.com'] }),
      reauthenticate: async () => ({ appleAuthorizationCode: 'code-123' }),
    });
    await run(ops);
    const names = calls.map((c) => c[0]);
    expect(calls.find((c) => c[0] === 'revokeApple')).toEqual(['revokeApple', 'code-123']);
    expect(names.indexOf('revokeApple')).toBeLessThan(names.indexOf('deleteUser'));
  });

  test('non-Apple accounts never call the Apple revoke', async () => {
    const { ops, calls } = fakeOps();
    await run(ops);
    expect(calls.some((c) => c[0] === 'revokeApple')).toBe(false);
  });

  test('email accounts re-auth with the password the user typed', async () => {
    const { ops, calls } = fakeOps({ currentUser: () => ({ uid: 'u1', providerIds: ['password'] }) });
    await run(ops, { password: 'brisket7' });
    expect(calls[0]).toEqual(['reauth', 'password', 'brisket7']);
  });

  test('progress is reported in order', async () => {
    const { ops } = fakeOps();
    const seen = [];
    await run(ops, { onProgress: (s) => seen.push(s) });
    expect(seen).toEqual(['reauth', 'data', 'account', 'device', 'done']);
  });
});

describe('local wipe', () => {
  test("removes only this app's keys", () => {
    const store = new Map([
      ['muiller-bbq-reviews', '[]'], ['bbq-deleted-review-ids', '[]'], ['hs-analytics-consent:scorecard', '{}'],
      ['hs-nearby-location-ack', '1'], ['bbq-sort', 'date'], ['someone-elses-key', 'keep'],
    ]);
    const ls = {
      get length() { return store.size; },
      key: (i) => [...store.keys()][i],
      removeItem: (k) => store.delete(k),
    };
    wipeLocalAppData(ls);
    expect([...store.keys()]).toEqual(['someone-elses-key']);
    expect(LOCAL_PREFIXES).toEqual(expect.arrayContaining(['muiller-bbq', 'bbq-', 'hs-']));
  });
});
