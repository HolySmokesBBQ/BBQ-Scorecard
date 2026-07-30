// Version roadmap notes. Each build's shipped feature summary lives here
// so the source of truth for what each versionCode contains is code-visible
// (rather than only in Play Console release notes). Referenced by
// NotebookStats and NotebookSite version-line renderers.
//
// Newest at top. Only bump when a real feature or fix lands.

export const ROADMAP = [
  { code: 22100, name: '2.2.1', ship: 'Aug 10', title: 'Board data layer (flagged)',
    notes: 'Firestore board_prices scaffolding + submit-form module. Feature flag `board.enabled` gates the tab; users see nothing new until flag flips.' },

  { code: 22000, name: '2.2.0', ship: 'Jul 27', title: 'Calculator NaN fix + Playbook wiring',
    notes: 'Fix MEAT_GUIDE.serving-derived perPersonLb (was NaN via guide.perPersonLb which never existed). Calculator now outputs valid raw + cooked + cook-time.' },

  { code: 21900, name: '2.1.9', ship: 'Jul 13', title: 'Security patches (deep audit)',
    notes: 'Stale-closure race fix in saveCookEntry. allowNavigation wildcard tightened. CSV export formula-injection defused. Manifest AD_ID permission excluded.' },

  { code: 21800, name: '2.1.8', ship: 'Jul 13', title: 'Analytics plumbing',
    notes: 'Notebook reports to dedicated GA4 property G-CZMMZL9BDT (previously shared website property).' },

  { code: 21700, name: '2.1.7', ship: 'Jul 11', title: 'Radial rating dial',
    notes: 'Cook rating replaced with press-and-hold radial dial. Continuous 0.0-9.0 resolution, haptic ticks per integer, stepper fallback for accessibility.' },
];

export const BOARD_FEATURE_FLAG_KEY = 'notebook.board.enabled';
