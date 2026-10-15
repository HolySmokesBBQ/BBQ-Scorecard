import { useEffect } from 'react';
import { useAppContext } from '../context/AppContext.jsx';
import { track } from '../scoring.js';

// Full-screen slide-in menu triggered from the hamburger icon in the
// NotebookHome header. Groups navigation targets by intent (log & library,
// compare & progress, tools, account). Replaces the 9-button quick-actions
// strip that cluttered the home screen through v2.x.

const ACCENT = '#4A6741';

const GROUPS = [
  {
    label: 'LOG & LIBRARY',
    items: [
      { view: 'recipes', label: 'Recipes' },
    ],
  },
  {
    label: 'COMPARE & PROGRESS',
    items: [
      { view: 'leaderboard', label: 'Cook Compare' },
      { view: 'stats',       label: 'Stats' },
      { view: 'rewards',     label: 'Rewards' },
    ],
  },
  {
    label: 'TOOLS',
    items: [
      { view: 'import',      label: 'Import from thermometer' },
      { view: 'humidity',    label: 'Pit Humidity' },
    ],
  },
  {
    label: 'ACCOUNT',
    items: [
      { view: 'settings',    label: 'Settings' },
    ],
  },
];

export default function NotebookHamburger({ onClose, onOpenAbout }) {
  const { S, navigateTo } = useAppContext();

  // Trap body scroll while open + close on Escape.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const go = (view) => {
    track('nav_from_hamburger', { view });
    onClose();
    navigateTo(view);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        zIndex: 1000, display: 'flex', justifyContent: 'flex-end',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: S.card, borderLeft: `1px solid ${S.border}`,
          width: 'min(320px, 88vw)', height: '100%',
          padding: '18px 20px 24px', overflowY: 'auto',
          display: 'flex', flexDirection: 'column',
          color: S.text,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: 2, color: ACCENT }}>
            MENU
          </div>
          <button
            onClick={onClose}
            aria-label="Close menu"
            style={{
              background: 'none', border: `1px solid ${S.border}`, borderRadius: 6,
              color: S.text, padding: '4px 10px', cursor: 'pointer', fontSize: 14,
            }}
          >
            ✕
          </button>
        </div>

        {GROUPS.map(group => (
          <div key={group.label} style={{ marginBottom: 18 }}>
            <div style={{
              fontSize: 10, color: S.muted, letterSpacing: 2, marginBottom: 6,
              fontFamily: "'Oswald', sans-serif",
            }}>
              {group.label}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {group.items.map(item => (
                <button
                  key={item.view}
                  onClick={() => go(item.view)}
                  style={{
                    background: 'none', border: 'none', color: S.text,
                    padding: '10px 4px', textAlign: 'left', fontSize: 15,
                    cursor: 'pointer', fontFamily: 'inherit',
                    borderBottom: `1px solid ${S.border}`,
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* About sits on its own — modal opens over the menu. */}
        <div style={{ marginTop: 'auto', paddingTop: 12 }}>
          <button
            onClick={() => {
              track('nav_from_hamburger', { view: 'about' });
              onClose();
              onOpenAbout?.();
            }}
            style={{
              background: 'none', border: `1px solid ${S.border}`, borderRadius: 6,
              color: S.muted, padding: '10px', width: '100%', fontSize: 13,
              cursor: 'pointer', fontFamily: "'Oswald', sans-serif", letterSpacing: 1,
            }}
          >
            ABOUT HOLY SMOKES BBQ
          </button>
        </div>
      </div>
    </div>
  );
}
