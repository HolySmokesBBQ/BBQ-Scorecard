import { useAppContext } from '../context/AppContext.jsx';
import { track } from '../scoring.js';
import useNotebookPromo, { NOTEBOOK_PLAY_URL, NOTEBOOK_ACCENT } from '../hooks/useNotebookPromo.js';

// Post-review cross-promo. Rendered on the Detail page — the moment
// right after a user saves a BBQ review is the highest-intent moment
// to suggest they also track their own cooks in the Notebook app.
// Same 30-day dismiss pattern as the Home card, keyed separately so
// dismissing one channel doesn't mute the other.

export default function NotebookReviewBanner() {
  const { S } = useAppContext();
  const [show, dismiss] = useNotebookPromo('bbq-notebook-review-banner-dismissed-at');

  const handleDismiss = (e) => {
    e?.stopPropagation();
    track('notebook_review_banner_dismissed');
    dismiss();
  };

  const handleClick = () => {
    track('notebook_review_banner_clicked');
    window.open(NOTEBOOK_PLAY_URL, '_blank', 'noopener,noreferrer');
  };

  if (!show) return null;

  return (
    <div
      onClick={handleClick}
      style={{
        background: `${NOTEBOOK_ACCENT}12`,
        border: `1px solid ${NOTEBOOK_ACCENT}`,
        borderRadius: '8px',
        padding: '10px 12px',
        marginTop: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        cursor: 'pointer',
      }}
    >
      <div style={{ flex: 1, fontSize: '12px', color: S.text, lineHeight: 1.4 }}>
        <span style={{ color: NOTEBOOK_ACCENT, fontWeight: 700 }}>Cooking BBQ yourself?</span>
        {' '}Track your own smokes in <b>BBQ Notebook</b> →
      </div>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss"
        style={{
          background: 'none',
          border: 'none',
          color: S.muted,
          fontSize: '18px',
          cursor: 'pointer',
          padding: '2px 6px',
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}
