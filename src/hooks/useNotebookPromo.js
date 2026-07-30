import { useState, useEffect } from 'react';

// Shared dismiss-with-timeout hook for the Notebook cross-promo channels.
// Every channel (Home card, Detail banner, launch modal) uses the same
// 30-day pattern: dismiss the notice and it stays hidden for 30 days,
// then quietly comes back. Long enough that repeat prompts aren't
// annoying, short enough that we don't lose the promo channel entirely.

const HIDE_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export default function useNotebookPromo(storageKey) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const dismissedAt = Number(localStorage.getItem(storageKey) || 0);
      const elapsed = Date.now() - dismissedAt;
      if (!dismissedAt || elapsed > HIDE_DURATION_MS) setShow(true);
    } catch {
      setShow(true);
    }
  }, [storageKey]);

  const dismiss = () => {
    try { localStorage.setItem(storageKey, String(Date.now())); } catch {}
    setShow(false);
  };

  return [show, dismiss];
}

export const NOTEBOOK_PLAY_URL = 'https://play.google.com/store/apps/details?id=com.holysmokesbbq.notebook';
export const NOTEBOOK_ACCENT = '#4A6741';
