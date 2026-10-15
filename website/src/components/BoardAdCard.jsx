import { useAppContext } from '../context/AppContext.jsx';
import { track } from '../scoring.js';
import useNotebookPromo from '../hooks/useNotebookPromo.js';

// Website-only cross-promo card for BBQ Board, the butcher price directory
// at /board/. Same shape as NotebookAdCard so the two read as one system.
// Lives in website/src only: the native apps never compile this folder, so
// there is no store-guideline exposure (nothing here links to a store).
// Dismiss hides it for 30 days via the shared promo hook.

export const BOARD_ACCENT = '#d4a64a'; // Board's brass (App.board.jsx PAL.brass)
const BOARD_URL = '/board/';

export default function BoardAdCard({ from = 'unknown' }) {
  const { S } = useAppContext();
  const [show, dismiss] = useNotebookPromo('bbq-board-ad-dismissed-at');

  const handleDismiss = (e) => {
    e?.stopPropagation();
    track('board_ad_dismissed', { from });
    dismiss();
  };

  const handleClick = () => {
    track('board_ad_clicked', { from });
    // Same-tab: this is the website navigating to another page of itself.
    window.location.href = BOARD_URL;
  };

  if (!show) return null;

  return (
    <div
      onClick={handleClick}
      style={{
        background: S.card,
        border: `1px solid ${BOARD_ACCENT}`,
        borderLeft: `4px solid ${BOARD_ACCENT}`,
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
        src={`${import.meta.env.BASE_URL}bbq-board-logo.png`}
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
          color: BOARD_ACCENT,
          marginBottom: '2px',
        }}>
          BBQ BOARD
        </div>
        <div style={{
          fontSize: '12px',
          color: S.muted,
          lineHeight: 1.35,
        }}>
          Butcher prices near you. See what brisket and ribs cost at shops in 100+ cities before you drive.
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
