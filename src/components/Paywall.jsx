import { useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext.jsx';
import { FREE_REVIEW_LIMIT, UNLOCK_PRICE_FALLBACK } from '../entitlements.js';
import { getUnlockPrice, purchaseUnlock, restorePurchases } from '../purchases.js';

// The 4.0 paywall. Shown only when an iOS user on the free tier tries to
// save review number FREE_REVIEW_LIMIT + 1.
//
// Two things this screen must always do, both because Apple checks for
// them and because they're the honest thing to do:
//   - offer Restore Purchase (required; also the path for people who
//     bought the app back when it cost money)
//   - state plainly that nothing already saved is being taken away

export default function Paywall() {
  const { S, paywallOpen, closePaywall, reviews, refreshEntitlements } = useAppContext();
  const [price, setPrice] = useState(UNLOCK_PRICE_FALLBACK);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!paywallOpen) return;
    setMsg(null);
    let alive = true;
    getUnlockPrice().then(p => { if (alive) setPrice(p); });
    return () => { alive = false; };
  }, [paywallOpen]);

  if (!paywallOpen) return null;

  const onBuy = async () => {
    setBusy(true); setMsg(null);
    const res = await purchaseUnlock();
    setBusy(false);
    if (res.ok) { refreshEntitlements(); closePaywall(); return; }
    if (!res.cancelled) setMsg(res.error);
  };

  const onRestore = async () => {
    setBusy(true); setMsg(null);
    const res = await restorePurchases();
    setBusy(false);
    if (res.ok && res.restored) { refreshEntitlements(); closePaywall(); return; }
    setMsg(res.error || 'No previous purchase found on this Apple ID.');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div style={{
        background: S.card, border: `1px solid ${S.border}`, borderRadius: '12px',
        padding: '24px 20px', maxWidth: '380px', width: '100%', color: S.text,
      }}>
        <div style={{
          fontFamily: "'Oswald', sans-serif", fontSize: '20px', fontWeight: 700,
          letterSpacing: '1px', color: S.accent, marginBottom: '10px',
        }}>
          Keep scoring
        </div>

        <div style={{ fontSize: '14px', lineHeight: 1.55, marginBottom: '14px' }}>
          That is your {FREE_REVIEW_LIMIT} free reviews used up. Unlock the full
          scorecard for unlimited reviews, one time, no subscription.
        </div>

        <div style={{
          fontSize: '13px', color: S.muted, lineHeight: 1.5, marginBottom: '18px',
          background: S.dark, borderRadius: '8px', padding: '10px 12px',
        }}>
          Your {reviews.length} saved {reviews.length === 1 ? 'review stays' : 'reviews stay'} yours
          either way. You can still open, edit, export, and print everything
          you have already scored.
        </div>

        {msg && (
          <div style={{
            fontSize: '13px', color: '#f87171', marginBottom: '14px', lineHeight: 1.4,
          }}>
            {msg}
          </div>
        )}

        <button
          onClick={onBuy}
          disabled={busy}
          style={{
            width: '100%', padding: '14px', borderRadius: '8px',
            cursor: busy ? 'default' : 'pointer', border: 'none',
            background: busy ? '#555' : S.accent, color: '#fff',
            fontFamily: "'Oswald', sans-serif", fontSize: '16px', fontWeight: 700,
            letterSpacing: '1px', marginBottom: '10px',
          }}
        >
          {busy ? 'Working…' : `Unlock for ${price}`}
        </button>

        <button
          onClick={onRestore}
          disabled={busy}
          style={{
            width: '100%', padding: '11px', borderRadius: '8px',
            cursor: busy ? 'default' : 'pointer',
            background: 'none', border: `1px solid ${S.border}`, color: S.text,
            fontSize: '13px', fontFamily: 'inherit', marginBottom: '10px',
          }}
        >
          Restore purchase
        </button>

        <button
          onClick={closePaywall}
          disabled={busy}
          style={{
            width: '100%', padding: '8px', background: 'none', border: 'none',
            color: S.muted, fontSize: '13px', cursor: busy ? 'default' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Not now
        </button>
      </div>
    </div>
  );
}
