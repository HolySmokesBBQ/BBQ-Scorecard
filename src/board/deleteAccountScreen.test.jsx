// Renders each state of Settings' delete-account card to static HTML. The
// live Board project can't be used to click through it (no test accounts on
// production Firebase), so this pins what each state says and offers.
import { describe, test, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// The test transform uses the classic JSX runtime; Settings.jsx relies on
// the app build's automatic one.
globalThis.React = React;

vi.mock('../firebase.board.js', () => ({ auth: {}, db: {} }));
vi.mock('./accountDeletionFirebase.board.js', () => ({ boardDeletionOps: {} }));
vi.mock('firebase/auth', () => ({ signOut: vi.fn() }));

const { DeleteAccount } = await import('./Settings.jsx');
const html = (props) => renderToStaticMarkup(
  <DeleteAccount onStart={() => {}} onCancel={() => {}} onConfirm={() => {}} {...props} />,
);

describe('Settings delete-account card', () => {
  test('idle offers the first step only', () => {
    const h = html({ user: { isAnonymous: false }, state: 'idle', result: null });
    expect(h).toContain('Delete my account');
    expect(h).not.toContain('Delete everything');
  });

  test('confirm for a Google account says Google will ask again', () => {
    const h = html({ user: { isAnonymous: false }, state: 'confirm', result: null });
    expect(h).toContain('Delete everything');
    expect(h).toContain('Google will ask you to sign in once more');
  });

  test('confirm for an anonymous user never mentions Google sign-in', () => {
    const h = html({ user: { isAnonymous: true }, state: 'confirm', result: null });
    expect(h).toContain('every price you posted from this phone');
    expect(h).not.toMatch(/Google/);
  });

  test('a failed run shows why, still on the confirm step', () => {
    const h = html({ user: { isAnonymous: false }, state: 'confirm', result: { ok: false, stage: 'data', failed: [] } });
    expect(h).toContain('account is still here');
    expect(h).toContain('role="alert"');
  });

  test('done, anonymous record kept: the auditor line and a Done button', () => {
    const h = html({ user: null, state: 'done', result: { ok: true, authRecordKept: true, deletedCount: 2 } });
    expect(h).toContain('The anonymous sign-in record expires on its own.');
    expect(h).toContain('>Done<');
  });
});
