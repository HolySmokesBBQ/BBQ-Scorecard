import { useState } from 'react';
import { useAppContext } from '../context/AppContext.jsx';
import { track } from '../scoring.js';
import NavDrawer from './NavDrawer.jsx';
import AboutScreen from './AboutScreen.jsx';

// App-wide navigation (NAV_V2). Mounted once in App.jsx so the ☰ menu is
// present on EVERY screen — not just Home. This is what lets the sub-screens
// drop their web-style "Back" buttons: you move around with the menu, the
// iOS-friendly pattern, instead of a back chevron per screen.
//
// The floating button sits below full-screen modals (About = z1000, the
// drawer backdrop = z3000) so it never covers them, and respects the notch
// via the same --safe-area-top hook index.html uses.

const MENU_GROUPS = [
  { title: 'BBQ SCORECARD', items: [{ label: 'Home', key: 'home' }] },
  { title: 'REVIEWS & MAP', items: [{ label: 'Map', key: 'map' }, { label: 'BBQ Near Me', key: 'nearby' }] },
  { title: 'COMPARE & PROGRESS', items: [{ label: 'Compare', key: 'compare' }, { label: 'Stats', key: 'stats' }, { label: 'MVP', key: 'mvp' }, { label: 'Rewards', key: 'achievements' }, { label: 'Leaderboard', key: 'leaderboard' }] },
  { title: 'ACCOUNT', items: [{ label: 'Settings', key: 'settings' }] },
];

export default function AppNav() {
  const { S, theme, navigateTo, setCompareMode, setCompareIds, setView } = useAppContext();
  const [showMenu, setShowMenu] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  const onSelect = (key) => {
    // Compare is a mode on the Home list, not its own destination: turn it
    // on and land the user back on Home to pick their two restaurants.
    if (key === 'compare') { setCompareMode(true); setCompareIds([]); setView('home'); return; }
    navigateTo(key);
  };

  return (
    <>
      <button
        onClick={() => { setShowMenu(true); track('hamburger_opened'); }}
        aria-label="Open menu"
        style={{
          position: 'fixed',
          top: 'calc(var(--safe-area-top, env(safe-area-inset-top, 0px)) + 10px)',
          right: '14px',
          zIndex: 900,
          background: S.card,
          border: `1px solid ${S.border}`,
          borderRadius: '8px',
          width: '40px',
          height: '40px',
          fontSize: '18px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: S.text,
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        }}
      >
        ☰
      </button>

      <NavDrawer
        open={showMenu}
        onClose={() => setShowMenu(false)}
        groups={MENU_GROUPS}
        onSelect={onSelect}
        onAbout={() => setShowAbout(true)}
        S={S}
        theme={theme}
      />
      {showAbout && <AboutScreen onClose={() => setShowAbout(false)} />}
    </>
  );
}
