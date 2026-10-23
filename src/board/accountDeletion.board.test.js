import { describe, test, expect, vi } from 'vitest';
import { deleteBoardAccount, wipeBoardLocal, deletionOutcome } from './accountDeletion.board.js';

describe('deletionOutcome', () => {
  test('anonymous record kept: the auditor-approved line', () => {
    expect(deletionOutcome({ ok: true, authRecordKept: true, deletedCount: 3 }).text)
      .toBe('Your submissions are deleted now (3 prices). The anonymous sign-in record expires on its own.');
  });
  test('full delete, singular price', () => {
    expect(deletionOutcome({ ok: true, authRecordKept: false, deletedCount: 1 }).text).toMatch(/\(1 price\)/);
  });
  test('a re-auth failure says nothing was deleted', () => {
    expect(deletionOutcome({ ok: false, stage: 'reauth' }).text).toMatch(/^Nothing was deleted/);
  });
  test('a data failure says the account is still here', () => {
    const o = deletionOutcome({ ok: false, stage: 'data', failed: [] });
    expect(o.ok).toBe(false);
    expect(o.text).toMatch(/account is still here/);
  });
});

function makeOps(overrides = {}) {
  const calls = [];
  const ops = {
    currentUser: () => ({ uid: 'u1', isAnonymous: false }),
    reauthenticate: vi.fn(async () => { calls.push('reauth'); }),
    listOwnedPriceIds: vi.fn(async () => { calls.push('list'); return ['p1', 'p2']; }),
    deletePrice: vi.fn(async (id) => { calls.push(`del:${id}`); }),
    deleteUser: vi.fn(async () => { calls.push('deleteUser'); }),
    signOut: vi.fn(async () => { calls.push('signOut'); }),
    wipeLocal: vi.fn(async () => { calls.push('wipe'); }),
    ...overrides,
  };
  return { ops, calls };
}

describe('deleteBoardAccount, Google account', () => {
  test('re-auth, then every price, then the auth record, then the device', async () => {
    const { ops, calls } = makeOps();
    const r = await deleteBoardAccount({ ops });
    expect(r).toEqual({ ok: true, authRecordKept: false, deletedCount: 2 });
    expect(calls).toEqual(['reauth', 'list', 'del:p1', 'del:p2', 'deleteUser', 'signOut', 'wipe']);
  });

  test('a failed or cancelled re-auth touches nothing', async () => {
    const { ops, calls } = makeOps({
      reauthenticate: vi.fn(async () => { throw Object.assign(new Error('x'), { code: 'auth/user-mismatch' }); }),
    });
    const r = await deleteBoardAccount({ ops });
    expect(r).toEqual({ ok: false, stage: 'reauth', error: 'auth/user-mismatch' });
    expect(calls).toEqual([]);
  });

  test('a price that will not delete keeps the account so the user can retry', async () => {
    const { ops, calls } = makeOps({
      deletePrice: vi.fn(async (id) => {
        calls.push(`del:${id}`);
        if (id === 'p1') throw Object.assign(new Error('x'), { code: 'unavailable' });
      }),
    });
    const r = await deleteBoardAccount({ ops });
    expect(r.ok).toBe(false);
    expect(r.stage).toBe('data');
    expect(r.failed).toEqual([{ id: 'p1', code: 'unavailable' }]);
    expect(calls).not.toContain('deleteUser');
    expect(calls).not.toContain('wipe');
  });

  test('a Google account whose auth delete fails is not signed out', async () => {
    const { ops, calls } = makeOps({
      deleteUser: vi.fn(async () => { throw Object.assign(new Error('x'), { code: 'auth/requires-recent-login' }); }),
    });
    const r = await deleteBoardAccount({ ops });
    expect(r).toEqual({ ok: false, stage: 'auth', error: 'auth/requires-recent-login' });
    expect(calls).not.toContain('signOut');
  });
});

describe('deleteBoardAccount, anonymous user (auditor ruling 2026-10-21)', () => {
  const anon = { currentUser: () => ({ uid: 'a1', isAnonymous: true }) };

  test('never tries to re-authenticate, there is nothing to re-auth with', async () => {
    const { ops, calls } = makeOps(anon);
    const r = await deleteBoardAccount({ ops });
    expect(r).toEqual({ ok: true, authRecordKept: false, deletedCount: 2 });
    expect(calls[0]).toBe('list');
    expect(ops.reauthenticate).not.toHaveBeenCalled();
  });

  test('requires-recent-login: prices are gone, so sign out and wipe, and say the record expires', async () => {
    const { ops, calls } = makeOps({
      ...anon,
      deleteUser: vi.fn(async () => { throw Object.assign(new Error('x'), { code: 'auth/requires-recent-login' }); }),
    });
    const r = await deleteBoardAccount({ ops });
    expect(r).toEqual({ ok: true, authRecordKept: true, deletedCount: 2 });
    expect(calls.slice(-2)).toEqual(['signOut', 'wipe']);
  });

  test('any other auth failure stays signed in so they can retry', async () => {
    const { ops, calls } = makeOps({
      ...anon,
      deleteUser: vi.fn(async () => { throw Object.assign(new Error('x'), { code: 'auth/network-request-failed' }); }),
    });
    const r = await deleteBoardAccount({ ops });
    expect(r).toEqual({ ok: false, stage: 'auth', error: 'auth/network-request-failed' });
    expect(calls).not.toContain('signOut');
  });
});

test('no signed-in user', async () => {
  const { ops, calls } = makeOps({ currentUser: () => null });
  expect(await deleteBoardAccount({ ops })).toEqual({ ok: false, stage: 'reauth', error: 'not-signed-in' });
  expect(calls).toEqual([]);
});

test('reports progress stages in order', async () => {
  const { ops } = makeOps();
  const seen = [];
  await deleteBoardAccount({ ops, onProgress: (s) => seen.push(s) });
  expect(seen).toEqual(['reauth', 'data', 'account', 'device', 'done']);
});

test('wipeBoardLocal clears Board and consent keys only', () => {
  const store = new Map([
    ['board:city', 'x'], ['board-default-radius', '25'], ['board:onboarded', '1'],
    ['board:posted-count', '2'], ['hs-analytics-consent:board', '{}'], ['hs-analytics-consent', '{}'],
    ['firebase:authUser:abc', '{}'], ['unrelated', 'keep'],
  ]);
  const ls = {
    get length() { return store.size; },
    key: (i) => [...store.keys()][i],
    removeItem: (k) => store.delete(k),
  };
  wipeBoardLocal(ls);
  expect([...store.keys()].sort()).toEqual(['firebase:authUser:abc', 'unrelated']);
});
