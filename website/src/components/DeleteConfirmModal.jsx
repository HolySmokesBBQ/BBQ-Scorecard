import { useState } from 'react';
import { useAppContext } from '../context/AppContext.jsx';

// In-app "are you sure?" for deleting a review. Replaces the native
// window.confirm so it looks like part of the app on iOS. The
// "Never ask me again" tick sets a flag (handled in AppContext) so a
// mass-delete run isn't interrupted on every single review.
//
// Mounted once globally (App.jsx). Renders only while a review is pending
// deletion (pendingDeleteId set).

export default function DeleteConfirmModal() {
  const { S, reviews, pendingDeleteId, confirmPendingDelete, cancelPendingDelete } = useAppContext();
  const [neverAsk, setNeverAsk] = useState(false);

  if (pendingDeleteId == null) return null;
  const review = reviews.find(r => r.id === pendingDeleteId);

  const onCancel = () => { setNeverAsk(false); cancelPendingDelete(); };
  const onDelete = () => { confirmPendingDelete(neverAsk); setNeverAsk(false); };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: S.card, border: `1px solid ${S.border}`, borderRadius: '12px',
          padding: '22px 20px', maxWidth: '360px', width: '100%', color: S.text,
        }}
      >
        <div style={{
          fontFamily: "'Oswald', sans-serif", fontSize: '18px', fontWeight: 700,
          letterSpacing: '1px', color: S.accent, marginBottom: '8px',
        }}>
          Delete this review?
        </div>
        <div style={{ fontSize: '14px', color: S.text, lineHeight: 1.5, marginBottom: '18px' }}>
          {review?.restaurant
            ? <>“{review.restaurant}” will be removed. This can’t be undone.</>
            : <>This review will be removed. This can’t be undone.</>}
        </div>

        <label style={{
          display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer',
          fontSize: '13px', color: S.muted, marginBottom: '20px',
        }}>
          <input
            type="checkbox"
            checked={neverAsk}
            onChange={(e) => setNeverAsk(e.target.checked)}
            style={{ width: '18px', height: '18px', accentColor: S.accent, cursor: 'pointer' }}
          />
          Never ask me again
        </label>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '12px', borderRadius: '8px', cursor: 'pointer',
              background: 'none', border: `1px solid ${S.border}`, color: S.text,
              fontSize: '14px', fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onDelete}
            style={{
              flex: 1, padding: '12px', borderRadius: '8px', cursor: 'pointer',
              background: '#f87171', border: '1px solid #f87171', color: '#fff',
              fontSize: '14px', fontWeight: 700, fontFamily: 'inherit',
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
