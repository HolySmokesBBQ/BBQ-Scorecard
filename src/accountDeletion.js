// In-app account deletion (legal register #1: Apple Guideline 5.1.1(v)
// requires deletion to start in the app). Shape approved by the Security
// auditor 2026-10-15. Written app-agnostic: Scorecard passes its owned
// collections; Notebook and Board can reuse it with their own.
//
// Order matters, because the two ways a deletion flow fails badly are a
// half-deleted account the user can't get back into, and an Auth record
// deleted while their data is still in the cloud:
//   1. Re-authenticate FIRST. user.delete() needs a recent sign-in, and if
//      re-auth fails or is cancelled nothing has been touched yet.
//   2. Delete the user's data. If any of THEIR OWN docs can't be deleted,
//      stop here and keep the Auth record so they can retry. Another
//      user's side of a friendship is best effort (orphaned links to a
//      dead uid are inert; the runbook covers them).
//   3. Revoke Sign in with Apple (Apple requires it for Apple accounts).
//   4. Delete the Auth record.
//   5. Sign the native layer out and wipe this app's local data.
//
// The Firebase calls are injected as `ops` (see accountDeletionFirebase.js)
// so this file holds only the order and the failure rules, which
// accountDeletion.test.js pins.

export const LOCAL_PREFIXES = ['muiller-bbq', 'bbq-', 'hs-'];

// Remove every localStorage key that belongs to the app: reviews, review
// tombstones, drafts, filters, the consent record, the location notice.
// Base64 photos waiting to upload live inside the reviews, so they go too.
export function wipeLocalAppData(ls = globalThis.localStorage) {
  if (!ls) return;
  const doomed = [];
  for (let i = 0; i < ls.length; i++) {
    const k = ls.key(i);
    if (k && LOCAL_PREFIXES.some((p) => k.startsWith(p))) doomed.push(k);
  }
  for (const k of doomed) { try { ls.removeItem(k); } catch {} }
}

async function attempt(fn, path, bucket) {
  try { await fn(); } catch (e) { bucket.push({ path, code: e?.code || String(e?.message || e) }); }
}

export async function deleteAccount({ ops, ownedCollections, password, onProgress = () => {} }) {
  const user = ops.currentUser();
  if (!user) return { ok: false, stage: 'reauth', error: 'not-signed-in' };
  const { uid } = user;

  // 1. Re-auth.
  onProgress('reauth');
  let appleAuthorizationCode = null;
  try {
    const r = await ops.reauthenticate(user, { password });
    appleAuthorizationCode = r?.appleAuthorizationCode || null;
  } catch (e) {
    return { ok: false, stage: 'reauth', error: e?.code || String(e?.message || e) };
  }

  // 2. Data.
  onProgress('data');
  const failed = [];     // the user's own data: blocks the Auth delete
  const leftovers = [];  // other users' docs: best effort, noted

  for (const { name, storagePrefix } of ownedCollections) {
    let docs = [];
    try { docs = await ops.listOwnedDocs(name, uid); }
    catch (e) { failed.push({ path: `${name}/*`, code: e?.code || String(e) }); continue; }
    for (const d of docs) {
      if (storagePrefix && d.itemId) {
        await attempt(() => ops.deleteStorageFolder(`${storagePrefix}/${uid}/${d.itemId}`), `${storagePrefix}/${uid}/${d.itemId}`, failed);
      }
      await attempt(() => ops.deleteDocAt(`${name}/${d.id}`), `${name}/${d.id}`, failed);
    }
  }

  let friendIds = [];
  try { friendIds = await ops.listIds(`users/${uid}/friends`); } catch (e) { failed.push({ path: `users/${uid}/friends`, code: e?.code || String(e) }); }
  for (const f of friendIds) {
    await attempt(() => ops.deleteDocAt(`users/${uid}/friends/${f}`), `users/${uid}/friends/${f}`, failed);
    await attempt(() => ops.deleteDocAt(`users/${f}/friends/${uid}`), `users/${f}/friends/${uid}`, leftovers);
  }

  let requestIds = [];
  try { requestIds = await ops.listIds(`users/${uid}/friendRequests`); } catch (e) { failed.push({ path: `users/${uid}/friendRequests`, code: e?.code || String(e) }); }
  for (const q of requestIds) {
    await attempt(() => ops.deleteDocAt(`users/${uid}/friendRequests/${q}`), `users/${uid}/friendRequests/${q}`, failed);
  }

  // The profile holds the friend code, so read it before deleting either,
  // and delete the profile doc last.
  let profile = null;
  try { profile = await ops.readProfile(uid); } catch (e) { failed.push({ path: `users/${uid}`, code: e?.code || String(e) }); }
  if (profile?.friendCode) {
    await attempt(() => ops.deleteDocAt(`friendCodes/${profile.friendCode}`), `friendCodes/${profile.friendCode}`, failed);
  }
  if (profile) {
    await attempt(() => ops.deleteDocAt(`users/${uid}`), `users/${uid}`, failed);
  }

  if (failed.length) return { ok: false, stage: 'data', failed, leftovers };

  // 3 + 4. Apple revoke, then the Auth record.
  onProgress('account');
  if (user.providerIds?.includes('apple.com') && appleAuthorizationCode) {
    await attempt(() => ops.revokeApple(appleAuthorizationCode), 'apple-token', leftovers);
  }
  try {
    await ops.deleteUser(user);
  } catch (e) {
    return { ok: false, stage: 'auth', error: e?.code || String(e?.message || e), leftovers };
  }

  // 5. Device.
  onProgress('device');
  try { await ops.nativeSignOut(); } catch {}
  try { await ops.wipeLocal(); } catch {}

  onProgress('done');
  return { ok: true, leftovers };
}
