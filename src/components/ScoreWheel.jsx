import { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../context/AppContext.jsx';
import { DESCRIPTORS } from '../constants.js';

// Radial score picker. Long-press a category row in ReviewForm to open
// this over the score. Drag around the dial to change the value —
// haptic tick per increment. Release commits, tap outside cancels.
//
// Interaction is designed for one-handed pit-side use: you don't have
// to hit a small button precisely, just rotate your thumb around the
// dial center. The angle from center → value mapping is coarse enough
// to be forgiving with greasy hands.

const VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const START_ANGLE = -Math.PI / 2 - (Math.PI * 8) / 9;
const ANGLE_STEP = (2 * Math.PI) / 9;
const RADIUS = 110;
const DIAL_SIZE = 280;

// Map a touch position (relative to dial center) to a value 1-9.
// The dial arranges 1 at the top-left, going clockwise around to 9.
function positionToValue(dx, dy) {
  const angle = Math.atan2(dy, dx);
  let normalized = angle - START_ANGLE;
  while (normalized < 0) normalized += 2 * Math.PI;
  while (normalized >= 2 * Math.PI) normalized -= 2 * Math.PI;
  const idx = Math.round(normalized / ANGLE_STEP);
  return VALUES[Math.max(0, Math.min(VALUES.length - 1, idx))];
}

function haptic() {
  try { navigator.vibrate?.(8); } catch {}
}

export default function ScoreWheel({ categoryKey, categoryLabel, initialValue, onCommit, onCancel }) {
  const { S } = useAppContext();
  const [value, setValue] = useState(initialValue || 5);
  const dialRef = useRef(null);
  const lastValueRef = useRef(value);

  useEffect(() => {
    haptic();
  }, []);

  const handleMove = (clientX, clientY) => {
    const dial = dialRef.current;
    if (!dial) return;
    const rect = dial.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const next = positionToValue(clientX - cx, clientY - cy);
    if (next !== lastValueRef.current) {
      lastValueRef.current = next;
      setValue(next);
      haptic();
    }
  };

  // Set value on touch/click start so a plain tap on "7" commits 7,
  // not the initial value. Before this, tap-only interaction always
  // returned initialValue because handleMove only ran during touchmove.
  const onTouchStart = (e) => {
    e.preventDefault();
    const t = e.touches[0];
    if (t) handleMove(t.clientX, t.clientY);
  };

  const onTouchMove = (e) => {
    e.preventDefault();
    const t = e.touches[0];
    if (t) handleMove(t.clientX, t.clientY);
  };

  const onTouchEnd = () => {
    onCommit(lastValueRef.current);
  };

  const onMouseDown = (e) => {
    handleMove(e.clientX, e.clientY);
  };

  const onMouseMove = (e) => {
    if (e.buttons !== 1) return;
    handleMove(e.clientX, e.clientY);
  };

  const onMouseUp = () => {
    onCommit(lastValueRef.current);
  };

  const descriptor = DESCRIPTORS[categoryKey]?.[value] || '';

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        zIndex: 2000, padding: '20px',
        touchAction: 'none', userSelect: 'none',
      }}
    >
      <div style={{
        fontFamily: "'Oswald', sans-serif",
        fontSize: '14px', letterSpacing: '2px',
        color: S.accent, marginBottom: '8px', textAlign: 'center',
      }}>
        {categoryLabel}
      </div>
      {descriptor && (
        <div style={{
          fontSize: '12px', color: S.muted, fontStyle: 'italic',
          marginBottom: '16px', textAlign: 'center', maxWidth: '280px',
        }}>
          {descriptor}
        </div>
      )}

      <div
        ref={dialRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        style={{
          width: `${DIAL_SIZE}px`, height: `${DIAL_SIZE}px`,
          position: 'relative',
          borderRadius: '50%',
          background: S.card,
          border: `2px solid ${S.border}`,
          boxShadow: `0 8px 32px rgba(0,0,0,0.5)`,
        }}
      >
        {/* Selected value big in center */}
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          fontFamily: "'Oswald', sans-serif",
          fontSize: '72px', fontWeight: 700,
          color: S.accent, lineHeight: 1,
        }}>
          {value}
        </div>

        {/* Numbers around the dial */}
        {VALUES.map((n, i) => {
          const angle = START_ANGLE + i * ANGLE_STEP;
          const x = DIAL_SIZE / 2 + RADIUS * Math.cos(angle);
          const y = DIAL_SIZE / 2 + RADIUS * Math.sin(angle);
          const active = n === value;
          return (
            <div key={n} style={{
              position: 'absolute',
              left: `${x}px`, top: `${y}px`,
              transform: 'translate(-50%, -50%)',
              width: '32px', height: '32px',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', fontWeight: 700,
              background: active ? S.accent : 'transparent',
              color: active ? '#fff' : S.muted,
              transition: 'background 0.1s',
            }}>
              {n}
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop: '20px', fontSize: '11px', color: S.muted,
        letterSpacing: '1px', textAlign: 'center',
      }}>
        DRAG AROUND DIAL · RELEASE TO COMMIT
      </div>
    </div>
  );
}
