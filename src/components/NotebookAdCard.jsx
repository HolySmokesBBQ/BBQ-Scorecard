import { useAppContext } from '../context/AppContext.jsx';
import { track } from '../scoring.js';
import useNotebookPromo, { NOTEBOOK_PLAY_URL, NOTEBOOK_ACCENT } from '../hooks/useNotebookPromo.js';

// Cross-promo card for the standalone BBQ Notebook app. Lives on the
// Scorecard Home screen, above the review list.

export default function NotebookAdCard() {
  const { S } = useAppContext();
  const [show, dismiss] = useNotebookPromo('bbq-notebook-ad-dismissed-at');

  const handleDismiss = (e) => {
    e?.stopPropagation();
    track('notebook_ad_dismissed');
    dismiss();
  };

  const handleClick = () => {
    track('notebook_ad_clicked');
    window.open(NOTEBOOK_PLAY_URL, '_blank', 'noopener,noreferrer');
  };

  if (!show) return null;

  return (
    <div
      onClick={handleClick}
      style={{
        background: S.card,
        border: `1px solid ${NOTEBOOK_ACCENT}`,
        borderLeft: `4px solid ${NOTEBOOK_ACCENT}`,
        borderRadius: '8px',
        padding: '12px 14px',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        cursor: 'pointer',
        position: 'relative',
      }}
    >
      <img
        src={`${import.meta.env.BASE_URL}bbq-notebook-logo.png`}
        alt=""
        style={{ width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0 }}
        onError={(e) => { e.target.style.display = 'none'; }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "'Oswald', sans-serif",
          fontSize: '13px',
          fontWeight: 700,
          letterSpacing: '1px',
          color: NOTEBOOK_ACCENT,
          marginBottom: '2px',
        }}>
          BBQ NOTEBOOK
        </div>
        <div style={{
          fontSize: '12px',
          color: S.muted,
          lineHeight: 1.35,
        }}>
          Cooking BBQ too? Track every smoke, save rubs, compare cooks with friends.
        </div>
      </div>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss"
        style={{
          background: 'none',
          border: 'none',
          color: S.muted,
          fontSize: '20px',
          cursor: 'pointer',
          padding: '4px 8px',
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}
