# Firestore rules change for in-app account deletion (register #1)

From the Scorecard session for the Security auditor, who commits the shared
`firestore.rules` and publishes it. Per doctrine, it has to be published to
each project **before** any client with the delete flow ships. Scorecard's
4.4.2 deliberately does **not** include the flow.

## The change (two lines in `firestore.rules`)

**1. `users/{userId}` (line 124): let owners delete their own profile.**

```diff
-      allow delete: if false;
+      // In-app account deletion (register #1, Apple 5.1.1(v)): the owner
+      // can delete their own profile. It is deleted last, after the reviews,
+      // friends, friend requests and friend code it points at.
+      allow delete: if isOwner(userId);
```

**2. `friendCodes/{code}` (line 187): let owners delete their own code. Update stays blocked.**

```diff
-      allow update, delete: if false;
+      allow update: if false;
+      // In-app account deletion: the code's owner can release it. Only the
+      // doc whose stored userId is the caller, so nobody can free someone
+      // else's code.
+      allow delete: if isSignedIn() && resource.data.userId == request.auth.uid;
```

The auditor's ruling named `users/{uid}` plus the friends and friendRequests
subcollections. Those two subcollections already allow owner delete, so they
need no change. The `friendCodes` line is **additional**: without it, the
friend-code doc (code → uid) survives every deletion, and the flow treats it
as the user's own data, so it would fail the deletion and keep the account.

## Already allowed, no change needed

- `reviews/{docId}`: owner delete (`resource.data.userId == request.auth.uid`)
- `users/{uid}/friends/{fid}`: either side can delete
- `users/{uid}/friendRequests/{rid}`: the inbox owner or the requester can delete
- Storage `reviews/{uid}/{reviewId}/{photo}`: owner delete

## Client side (not shipped; ready once rules are live)

- `src/accountDeletion.js`: the orchestration. Re-auth first. If the user's
  own data can't all be deleted, the Auth record is kept so they can retry.
  Other users' friend links are best effort. Then the Apple revoke, the Auth
  delete, and a local wipe.
- `src/accountDeletionFirebase.js`: the Firebase operations. Native Google
  and Apple re-auth go through the plugin. Apple revoke uses
  `revokeToken(withAuthorizationCode:)`, confirmed in the plugin's iOS source.
- `src/components/DeleteAccountScreen.jsx`: the screen. Type DELETE (plus
  the password for email accounts), then the sign-in check, progress, and a
  distinct message for each failure stage.
- `src/accountDeletion.test.js`: 12 tests covering order, abort rules,
  providers and the local wipe.
- Settings shows the in-app flow when signed in and keeps the web page link
  when signed out.

## Known leftover (runbook)

Outgoing friend requests sitting in **other** users' inboxes can't be found
from the client, because there's no collection-group read and the app
doesn't track sent requests. They're inert (they point at a dead uid). The
runbook removes them by hand on request.

## Order of operations

1. The auditor commits these two lines and publishes them to the Scorecard
   project (and to Notebook and Board when they adopt the flow).
2. Scorecard verifies the published ruleset in the console.
3. The client flow ships in the next Scorecard version after 4.4.2, Android
   first, then iOS 4.4.x (the App Store build is held for this).
