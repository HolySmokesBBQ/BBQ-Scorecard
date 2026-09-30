// Tests for Board's sign-in failure handling.
//
// handleSignIn used to swallow every failure: console.error, an analytics
// event, then nothing. Its callers (the submit gate and the ad-scan gate)
// already wrapped it in try/catch expecting a throw, so their "Sign in
// failed" message never fired — and because nothing threw, they carried on
// as though sign-in had SUCCEEDED, closing the gate and queueing a submit
// for a user who didn't exist. A failed sign-in read as a dead button, which
// is exactly what App Review rejected Scorecard 4.0.0 for (Guideline
// 2.1(a)). Security audit AUDIT-2026-09-29-TEARDOWN.md, F-5 residual.
//
// The fix: handleSignIn rethrows, bounded by a timeout, and every caller
// turns the error into user-visible text — except a deliberate cancel,
// which is a normal thing to do and should stay silent.

import { describe, test, expect, vi, afterEach } from 'vitest';
import {
  AUTH_TIMEOUT_MS,
  withTimeout,
  isUserCancel,
  signInErrorMessage,
} from './signIn.js';

afterEach(() => vi.useRealTimers());

describe('withTimeout', () => {
  test('resolves with the value when the promise wins', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 'Sign-in')).resolves.toBe('ok');
  });

  test('rejects with the original error when the promise rejects', async () => {
    const e = Object.assign(new Error('boom'), { code: 'auth/network-request-failed' });
    await expect(withTimeout(Promise.reject(e), 'Sign-in')).rejects.toBe(e);
  });

  test('rejects with code auth/timeout when the promise hangs', async () => {
    vi.useFakeTimers();
    const hung = new Promise(() => {});
    const p = withTimeout(hung, 'Google sign-in');
    vi.advanceTimersByTime(AUTH_TIMEOUT_MS + 1);
    await expect(p).rejects.toMatchObject({ code: 'auth/timeout' });
    await expect(p).rejects.toThrow(/Google sign-in timed out/);
  });

  test('the timeout is 30 seconds, matching firebaseSync', () => {
    expect(AUTH_TIMEOUT_MS).toBe(30000);
  });
});

describe('isUserCancel', () => {
  test('recognises the ways a user backs out', () => {
    expect(isUserCancel({ code: 'auth/popup-closed-by-user' })).toBe(true);
    expect(isUserCancel({ code: 'auth/cancelled-popup-request' })).toBe(true);
    // Capacitor plugin cancel surfaces in the message on Android.
    expect(isUserCancel({ message: 'The user canceled the sign-in flow.' })).toBe(true);
    expect(isUserCancel({ message: 'Sign in canceled' })).toBe(true);
  });

  test('does not treat real failures as a cancel', () => {
    expect(isUserCancel({ code: 'auth/network-request-failed' })).toBe(false);
    expect(isUserCancel({ code: 'auth/timeout' })).toBe(false);
    expect(isUserCancel({ code: 'auth/internal-error' })).toBe(false);
    expect(isUserCancel(new Error('Something broke'))).toBe(false);
  });

  test('tolerates garbage', () => {
    expect(isUserCancel(null)).toBe(false);
    expect(isUserCancel(undefined)).toBe(false);
    expect(isUserCancel('a string')).toBe(false);
  });
});

describe('signInErrorMessage', () => {
  test('returns null for a user cancel, so the caller shows nothing', () => {
    expect(signInErrorMessage({ code: 'auth/popup-closed-by-user' })).toBe(null);
  });

  test('explains a timeout in plain English', () => {
    expect(signInErrorMessage({ code: 'auth/timeout' }))
      .toBe('Sign-in took too long. Check your connection and try again.');
  });

  test('gives a real failure a message and strips the Firebase prefix', () => {
    const m = signInErrorMessage({ code: 'auth/network-request-failed',
      message: 'Firebase: Error (auth/network-request-failed).' });
    expect(m).toMatch(/^Sign-in failed\./);
    expect(m).not.toMatch(/Firebase:/);
  });

  test('never returns empty text for a real failure', () => {
    expect(signInErrorMessage(new Error(''))).toBe('Sign-in failed. Try again.');
    expect(signInErrorMessage({})).toBe('Sign-in failed. Try again.');
  });
});
