// Tests for Board's app-shell error boundary.
//
// The boundary exists because Board had no error boundary at all: when
// Settings threw `STATES.map is not a function` (fixed in 2.4.0), the whole
// app went white and the only way out was force-quitting. GA logged
// app_exception across 6 users in the same window as a 37.5% uninstall
// rate. A blank screen is the worst possible failure mode for a price
// lookup app, so the shell now catches render throws and offers a reload.
//
// Reconciliation (does Preact actually route a child's throw into the
// boundary?) is verified in the browser against the dev server, since
// that's runtime behavior. These tests cover the boundary's own contract:
// how it derives state from an error, what it reports, and what the
// reload handler does.

import { describe, test, expect, vi } from 'vitest';
import {
  deriveStateFromError,
  describeError,
  ErrorBoundary,
} from './ErrorBoundary.jsx';

describe('deriveStateFromError', () => {
  test('flags the boundary as errored and keeps the message', () => {
    const s = deriveStateFromError(new Error('boom'));
    expect(s.hasError).toBe(true);
    expect(s.message).toBe('boom');
  });

  test('tolerates a non-Error throw', () => {
    expect(deriveStateFromError('a string').hasError).toBe(true);
    expect(deriveStateFromError(null).hasError).toBe(true);
    expect(deriveStateFromError(undefined).message).toBe('unknown error');
  });
});

describe('describeError', () => {
  test('prefers the stack, then the message, then String()', () => {
    const withStack = new Error('x'); withStack.stack = 'STACK';
    expect(describeError(withStack)).toBe('STACK');
    const noStack = new Error('just message'); noStack.stack = undefined;
    expect(describeError(noStack)).toBe('just message');
    expect(describeError(42)).toBe('42');
  });

  test('caps length so a runaway stack cannot blow up the report', () => {
    const e = new Error('y'); e.stack = 'z'.repeat(10000);
    expect(describeError(e).length).toBeLessThanOrEqual(2000);
  });
});

describe('ErrorBoundary reporting', () => {
  test('componentDidCatch logs via console.error so diagnostics captures it', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const b = new ErrorBoundary({});
    b.componentDidCatch(new Error('caught'), { componentStack: '\n  in Foo' });
    expect(spy).toHaveBeenCalled();
    const joined = spy.mock.calls.map(c => c.join(' ')).join('\n');
    expect(joined).toContain('caught');
    expect(joined).toContain('in Foo');
    spy.mockRestore();
  });

  test('componentDidCatch emits a board_error_boundary analytics event when gtag exists', () => {
    const calls = [];
    globalThis.window = { gtag: (...a) => calls.push(a) };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const b = new ErrorBoundary({});
    b.componentDidCatch(new Error('tracked'), { componentStack: '' });
    expect(calls.some(c => c[0] === 'event' && c[1] === 'board_error_boundary')).toBe(true);
    spy.mockRestore();
    delete globalThis.window;
  });

  test('componentDidCatch survives gtag being absent or throwing', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    globalThis.window = {};
    expect(() => new ErrorBoundary({}).componentDidCatch(new Error('a'), {})).not.toThrow();
    globalThis.window = { gtag: () => { throw new Error('gtag broke'); } };
    expect(() => new ErrorBoundary({}).componentDidCatch(new Error('b'), {})).not.toThrow();
    spy.mockRestore();
    delete globalThis.window;
  });
});

describe('ErrorBoundary.handleReload', () => {
  test('calls window.location.reload', () => {
    const reload = vi.fn();
    globalThis.window = { location: { reload } };
    new ErrorBoundary({}).handleReload();
    expect(reload).toHaveBeenCalledTimes(1);
    delete globalThis.window;
  });
});
