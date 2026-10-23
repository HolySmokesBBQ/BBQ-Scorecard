// In-app account deletion for BBQ Board (legal register #1). Scorecard's
// src/accountDeletion.js doesn't fit Board, for two reasons:
//   - It re-authenticates first, and an anonymous Board user has no
//     credential to re-authenticate with.
//   - It walks users/{uid}, friends and friendCodes. Board's project has
//     none of those (firestore.board.rules allows board_prices only), so
//     those reads would be denied and block every deletion.
//
// Board's order, with the same two rules as Scorecard's:
//   1. Google accounts re-authenticate FIRST. If that fails or is
//      cancelled, nothing has been touched.
//   2. Delete every board_prices doc the user owns. If any of them won't
//      delete, stop and keep the account so the user can retry.
//   3. Delete the Auth record.
//   4. Sign out and wipe Board's local data.
//
// Anonymous users (auditor ruling 2026-10-21): skip step 1. If step 3
// fails with auth/requires-recent-login, the prices are already gone and
// the leftover anonymous record holds nothing but a random uid, so sign
// out, wipe, and report authRecordKept so the screen can say the record
// expires on its own. No Cloud Function: billed infrastructure stays out
// of the deletion path.
//
// The Firebase calls are injected as `ops` (accountDeletionFirebase.board.js)
// so the order and failure rules are testable on their own.

export const BOARD_LOCAL_PREFIXES = ['board', 'hs-'];

export function wipeBoardLocal(ls = globalThis.localStorage) {
  if (!ls) return;
  const doomed = [];
  for (let i = 0; i < ls.length; i++) {
    const k = ls.key(i);
    if (k && BOARD_LOCAL_PREFIXES.some((p) => k.startsWith(p))) doomed.push(k);
  }
  for (const k of doomed) { try { ls.removeItem(k); } catch {} }
}

// What the screen says after a run. Each line says only what is true for
// that result: a failure before the data stage touched nothing, a data
// failure kept the account, and an anonymous run that kept the auth record
// says the record expires (auditor's wording, 2026-10-21).
export function deletionOutcome(result) {
  if (!result) return null;
  if (result.ok) {
    const n = result.deletedCount;
    const prices = n === 1 ? '1 price' : `${n} prices`;
    if (result.authRecordKept) {
      return { ok: true, text: `Your submissions are deleted now (${prices}). The anonymous sign-in record expires on its own.` };
    }
    return { ok: true, text: `Your account and your submissions (${prices}) are deleted, and Board's data is cleared from this phone.` };
  }
  if (result.stage === 'reauth') {
    return { ok: false, text: 'Nothing was deleted. Board needs you to sign in with Google once more to confirm it is you.' };
  }
  if (result.stage === 'data') {
    return { ok: false, text: "Some of your prices couldn't be deleted, so your account is still here. Check your connection and try again." };
  }
  return { ok: false, text: "Your prices are deleted, but the account itself couldn't be. Check your connection and try again." };
}

const codeOf = (e) => e?.code || String(e?.message || e);

export async function deleteBoardAccount({ ops, onProgress = () => {} }) {
  const user = ops.currentUser();
  if (!user) return { ok: false, stage: 'reauth', error: 'not-signed-in' };
  const { uid, isAnonymous } = user;

  onProgress('reauth');
  if (!isAnonymous) {
    try { await ops.reauthenticate(user); }
    catch (e) { return { ok: false, stage: 'reauth', error: codeOf(e) }; }
  }

  onProgress('data');
  let ids;
  try { ids = await ops.listOwnedPriceIds(uid); }
  catch (e) { return { ok: false, stage: 'data', failed: [{ id: '*', code: codeOf(e) }] }; }
  const failed = [];
  for (const id of ids) {
    try { await ops.deletePrice(id); }
    catch (e) { failed.push({ id, code: codeOf(e) }); }
  }
  if (failed.length) return { ok: false, stage: 'data', failed };

  onProgress('account');
  let authRecordKept = false;
  try {
    await ops.deleteUser();
  } catch (e) {
    const code = codeOf(e);
    if (!(isAnonymous && code === 'auth/requires-recent-login')) {
      return { ok: false, stage: 'auth', error: code };
    }
    authRecordKept = true;
  }

  onProgress('device');
  try { await ops.signOut(); } catch {}
  try { await ops.wipeLocal(); } catch {}

  onProgress('done');
  return { ok: true, authRecordKept, deletedCount: ids.length };
}
