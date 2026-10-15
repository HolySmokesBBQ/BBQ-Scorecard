import { useState, useEffect } from 'react';

// Board's hamburger menu — right-side floating ☰ button that opens a
// right-slide drawer. Structure matches Scorecard's AppNav and
// Notebook's NotebookHamburger: titled groups + About button pinned
// in the footer. Board's groups are lighter because Board has fewer
// nav destinations than the other two apps.

const PAL = {
  bg: '#1a1a1a', panel: '#232830', panelDeep: '#1c2027',
  border: '#3a4048', brass: '#d4a64a',
  text: '#f5e6d3', textDim: '#9aa3ad',
};

const MENU_GROUPS = [
  { title: 'BBQ BOARD', items: [{ label: 'Home', key: 'home' }] },
  { title: 'TOOLS',     items: [{ label: 'Calculator', key: 'calculator' }] },
  { title: 'ACCOUNT',   items: [{ label: 'Settings', key: 'settings' }] },
];

export default function BoardHamburger({ currentView, onNavigate, onAbout }) {
  const [open, setOpen] = useState(false);

  // Close drawer on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const handleSelect = (key) => {
    setOpen(false);
    onNavigate(key);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        style={{
          position: 'fixed',
          top: 'calc(env(safe-area-inset-top, 0px) + 10px)',
          right: '14px',
          zIndex: 900,
          background: PAL.panel,
          border: `1px solid ${PAL.border}`,
          borderRadius: 8,
          width: 40,
          height: 40,
          fontSize: 18,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: PAL.text,
          boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
        }}
      >
        ☰
      </button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
              zIndex: 2999,
            }}
          />
          <div
            role="dialog" aria-label="Menu"
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0,
              width: 'min(320px, 85vw)',
              background: PAL.bg,
              borderLeft: `1px solid ${PAL.border}`,
              zIndex: 3000,
              display: 'flex', flexDirection: 'column',
              paddingTop: 'env(safe-area-inset-top, 0px)',
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              boxShadow: '-4px 0 24px rgba(0,0,0,0.4)',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', borderBottom: `1px solid ${PAL.border}`,
            }}>
              <span style={{
                fontFamily: "'Oswald', sans-serif", fontSize: 14, fontWeight: 700,
                letterSpacing: 3, color: PAL.textDim,
              }}>
                MENU
              </span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                style={{
                  background: 'transparent', border: 'none', color: PAL.text,
                  fontSize: 24, cursor: 'pointer', padding: 0, lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
              {MENU_GROUPS.map(group => (
                <div key={group.title} style={{ marginBottom: 20 }}>
                  <div style={{
                    padding: '0 20px 6px', fontFamily: "'Oswald', sans-serif",
                    fontSize: 11, letterSpacing: 2, color: PAL.textDim, fontWeight: 700,
                  }}>
                    {group.title}
                  </div>
                  {group.items.map(item => {
                    const active = currentView === item.key;
                    return (
                      <button
                        key={item.key}
                        onClick={() => handleSelect(item.key)}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          background: active ? PAL.panel : 'transparent',
                          border: 'none',
                          borderBottom: `1px solid ${PAL.border}`,
                          color: active ? PAL.brass : PAL.text,
                          padding: '14px 20px', fontSize: 15, cursor: 'pointer',
                          fontWeight: active ? 600 : 400,
                        }}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div style={{ borderTop: `1px solid ${PAL.border}`, padding: '12px 20px' }}>
              <button
                onClick={() => { setOpen(false); onAbout(); }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  background: 'transparent', border: 'none',
                  color: PAL.brass, padding: '10px 0', fontSize: 14,
                  fontFamily: "'Oswald', sans-serif", letterSpacing: 2, cursor: 'pointer',
                }}
              >
                ABOUT HOLY SMOKES BBQ
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
