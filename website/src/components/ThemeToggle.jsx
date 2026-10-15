import { useAppContext } from '../context/AppContext.jsx';
import { track } from '../scoring.js';

// Website theme button, shared by the Scorecard and Notebook site headers.
//
// Shows the theme you are IN (icon + word) and cycles dark → light → system
// on click. The previous version showed the icon for the theme you'd switch
// TO, so a sun sat on screen while the page was dark and a moon while it
// was light, and the "system" stop was invisible whenever it matched the
// OS. Found by Joel 2026-09-06; reproduced on the live site before fixing.

const ORDER = ['dark', 'light', 'system'];
const META = {
  dark:   { icon: '☽', label: 'Dark' },
  light:  { icon: '☀', label: 'Light' },
  system: { icon: '◐', label: 'System' },
};

export default function ThemeToggle({ from = 'site' }) {
  const { S, themePref, setThemePref } = useAppContext();
  const current = META[themePref] ? themePref : 'dark';
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];

  return (
    <button
      type="button"
      onClick={() => { setThemePref(next); track('theme_changed', { theme: next, from }); }}
      aria-label={`Theme: ${META[current].label}. Switch to ${META[next].label}`}
      title={`Theme: ${META[current].label} (click for ${META[next].label})`}
      data-theme-pref={current}
      style={{
        background: 'none', border: `1px solid ${S.border}`,
        borderRadius: '16px', height: '32px', padding: '0 12px 0 10px',
        fontSize: '13px', fontWeight: 600, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        color: S.text, fontFamily: 'inherit',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: '15px', lineHeight: 1 }}>{META[current].icon}</span>
      <span>{META[current].label}</span>
    </button>
  );
}
