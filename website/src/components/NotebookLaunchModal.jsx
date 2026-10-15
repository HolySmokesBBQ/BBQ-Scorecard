import { useAppContext } from '../context/AppContext.jsx';
import { track } from '../scoring.js';
import useNotebookPromo, { NOTEBOOK_PLAY_URL, NOTEBOOK_ACCENT } from '../hooks/useNotebookPromo.js';

// One-time launch celebration modal. Fires the first time a user opens
// the app after v3.2.0 lands, letting them know BBQ Notebook is live.
// Same 30-day dismiss timeout: if they say "not now," it stays quiet
// for 30 days, then reappears once. Get Notebook click → Play Store.

export default function NotebookLaunchModal() {
  const { S } = useAppContext();
  const [show, dismiss] = useNotebookPromo('bbq-notebook-launch-modal-dismissed-at');

  const handleDismiss = () => {
    track('notebook_launch_modal_dismissed');
    dismiss();
  };

  const handleGet = () => {
    track('notebook_launch_modal_clicked');
    window.open(NOTEBOOK_PLAY_URL, '_blank', 'noopener,noreferrer');
    dismiss();
  };

  if (!show) return null;

  return (
    <div
      onClick={handleDismiss}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: S.card,
          border: `2px solid ${NOTEBOOK_ACCENT}`,
          borderRadius: '12px',
          padding: '24px 20px',
          maxWidth: '360px',
          width: '100%',
          textAlign: 'center',
          position: 'relative',
        }}
      >
        <button
          onClick={handleDismiss}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: '8px',
            right: '10px',
            background: 'none',
            border: 'none',
            color: S.muted,
            fontSize: '22px',
            cursor: 'pointer',
            lineHeight: 1,
          }}
        >
          ×
        </button>

        <img
          src={`${import.meta.env.BASE_URL}bbq-notebook-logo.png`}
          alt=""
          style={{ width: '72px', height: '72px', borderRadius: '50%', marginBottom: '12px' }}
          onError={(e) => { e.target.style.display = 'none'; }}
        />

        <div style={{
          fontFamily: "'Oswald', sans-serif",
          fontSize: '18px',
          fontWeight: 700,
          letterSpacing: '2px',
          color: NOTEBOOK_ACCENT,
          marginBottom: '8px',
        }}>
          BBQ NOTEBOOK IS LIVE
        </div>

        <div style={{
          fontSize: '14px',
          color: S.text,
          lineHeight: 1.5,
          marginBottom: '20px',
        }}>
          Track your own cooks, save rub recipes, and compare notes with friends.
          A new standalone app from Holy Smokes BBQ Co.
        </div>

        <button
          onClick={handleGet}
          style={{
            background: NOTEBOOK_ACCENT,
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            padding: '12px 24px',
            fontSize: '14px',
            fontFamily: "'Oswald', sans-serif",
            fontWeight: 700,
            letterSpacing: '1.5px',
            cursor: 'pointer',
            width: '100%',
            marginBottom: '8px',
          }}
        >
          GET BBQ NOTEBOOK
        </button>

        <button
          onClick={handleDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: S.muted,
            fontSize: '12px',
            cursor: 'pointer',
            padding: '8px',
            width: '100%',
          }}
        >
          Not right now
        </button>
      </div>
    </div>
  );
}
