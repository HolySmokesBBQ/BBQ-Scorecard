import { useEffect, useState } from 'react';
import { track } from '../scoring.js';

// Right-slide navigation drawer for BBQ Scorecard (NAV_V2).
//
// Presentation only: the caller passes `groups` (accordion sections)
// and an `onSelect(key)` handler, plus `onAbout`. The drawer owns the
// slide/backdrop/accordion/texture; it knows nothing about routes.
//
// "BBQ-esque, not AI-coded" is done with pure-CSS material texture —
// a faint wood grain (layered linear gradients), a soft smoke glow up
// top, and cast-iron accordion headers (inset shadow). No image files:
// crisp at every density, zero load, and hand-tuned rather than a stock
// texture slapped on.

export default function NavDrawer({ open, onClose, groups, onSelect, onAbout, S, theme }) {
  const [openGroup, setOpenGroup] = useState(0);

  // Escape closes; lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const dark = theme === 'dark';

  // Wood grain: two low-alpha repeating gradients at a slight offset so
  // the "grain" isn't a perfect comb. Smoke: a soft radial up top.
  const woodGrain = dark
    ? `repeating-linear-gradient(92deg, rgba(0,0,0,0.22) 0px, rgba(0,0,0,0) 2px, rgba(255,255,255,0.015) 4px, rgba(0,0,0,0) 7px),
       repeating-linear-gradient(88deg, rgba(0,0,0,0.10) 0px, rgba(0,0,0,0) 9px)`
    : `repeating-linear-gradient(92deg, rgba(90,50,20,0.06) 0px, rgba(0,0,0,0) 3px, rgba(120,70,30,0.04) 5px, rgba(0,0,0,0) 8px)`;
  const smokeGlow = 'radial-gradient(120% 60% at 50% -10%, rgba(212,120,47,0.12), rgba(212,120,47,0) 60%)';

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 3000,
        background: open ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0)',
        transition: 'background 0.25s ease',
        pointerEvents: open ? 'auto' : 'none',
        display: 'flex', justifyContent: 'flex-end',
      }}
    >
      <div
        role="dialog"
        aria-label="Menu"
        style={{
          width: 'min(320px, 88vw)', height: '100%',
          background: `${smokeGlow}, ${woodGrain}, ${S.card}`,
          borderLeft: `1px solid ${S.border}`,
          boxShadow: '-8px 0 32px rgba(0,0,0,0.45)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.28s cubic-bezier(0.22,0.61,0.36,1)',
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        {/* Header row */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 18px 14px', borderBottom: `1px solid ${S.border}`,
        }}>
          <span style={{
            fontFamily: "'Oswald', sans-serif", fontSize: 16, fontWeight: 700,
            letterSpacing: 3, color: S.accent,
          }}>MENU</span>
          <button onClick={onClose} aria-label="Close menu" style={{
            background: 'none', border: `1px solid ${S.border}`, color: S.muted,
            width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 15,
          }}>✕</button>
        </div>

        {/* Accordion groups */}
        <div style={{ flex: 1, padding: '8px 0' }}>
          {groups.map((group, gi) => {
            const isOpen = openGroup === gi;
            return (
              <div key={group.title}>
                <button
                  onClick={() => setOpenGroup(isOpen ? -1 : gi)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 18px', cursor: 'pointer', textAlign: 'left',
                    fontFamily: "'Oswald', sans-serif", fontSize: 13, fontWeight: 700,
                    letterSpacing: 2, color: isOpen ? S.accent : S.text,
                    background: dark ? 'rgba(0,0,0,0.28)' : 'rgba(90,50,20,0.05)',
                    border: 'none',
                    // cast-iron: soft inset top+bottom so the header reads as raised metal
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -2px 4px rgba(0,0,0,0.25)',
                    borderTop: `1px solid ${S.border}`,
                  }}
                >
                  <span>{group.title}</span>
                  <span style={{
                    display: 'inline-block', transition: 'transform 0.22s ease',
                    transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                    color: S.muted, fontSize: 14,
                  }}>›</span>
                </button>
                {/* Items — animated max-height so the drop feels physical */}
                <div style={{
                  maxHeight: isOpen ? `${group.items.length * 52}px` : '0px',
                  overflow: 'hidden', transition: 'max-height 0.28s ease',
                }}>
                  {group.items.map(item => (
                    <button
                      key={item.key}
                      onClick={() => { track('nav_from_hamburger', { view: item.key }); onSelect(item.key); onClose(); }}
                      style={{
                        width: '100%', textAlign: 'left', cursor: 'pointer',
                        padding: '13px 18px 13px 30px', fontSize: 15, color: S.text,
                        background: 'none', border: 'none',
                        borderBottom: `1px solid ${S.border}`,
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer — About */}
        <div style={{ padding: '16px 18px 24px', borderTop: `1px solid ${S.border}` }}>
          <button
            onClick={() => { onAbout(); onClose(); }}
            style={{
              width: '100%', padding: '12px', cursor: 'pointer',
              background: 'none', border: `1px solid ${S.accent}`, borderRadius: 8,
              color: S.accent, fontFamily: "'Oswald', sans-serif",
              fontSize: 12, letterSpacing: 2,
            }}
          >
            ABOUT HOLY SMOKES BBQ
          </button>
        </div>
      </div>
    </div>
  );
}
