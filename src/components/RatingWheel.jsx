import { useState, useRef, useCallback, useEffect } from 'react';

/* Press-and-hold radial rating dial.
   Press anywhere on the wheel, then rotate around the center to select.
   Continuous 0.1 resolution across a 300° arc (60° dead zone at bottom).
   Haptic tick at each integer crossing. Stepper fallback below for
   accessibility (keyboard, screen readers, users who prefer discrete input).
*/

const ARC_START = 210;   // degrees, where value=min sits (7 o'clock)
const ARC_END = 510;     // 510 = 150 + 360; treat as 150° at 5 o'clock (past 12)
const ARC_SWEEP = ARC_END - ARC_START; // 300°

// Normalize an angle relative to arc coords: 210° → 210, 359° → 359, 0° → 360, 150° → 510.
// This makes the arc a monotonic range 210 → 510 for math.
function normalizeArcAngle(angle) {
  return angle < ARC_START ? angle + 360 : angle;
}

function angleToValue(angle, min, max) {
  const a = normalizeArcAngle(angle);
  const clamped = Math.max(ARC_START, Math.min(ARC_END, a));
  const fraction = (clamped - ARC_START) / ARC_SWEEP;
  return min + fraction * (max - min);
}

function valueToAngle(value, min, max) {
  const v = value == null ? min : Math.max(min, Math.min(max, value));
  const fraction = (v - min) / (max - min);
  return ARC_START + fraction * ARC_SWEEP;
}

function polarToCartesian(cx, cy, radius, angleDeg) {
  const rad = angleDeg * Math.PI / 180;
  return { x: cx + Math.cos(rad) * radius, y: cy + Math.sin(rad) * radius };
}

function arcPath(cx, cy, radius, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, radius, startAngle);
  const end = polarToCartesian(cx, cy, radius, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

// Convert screen-space touch point to angle relative to element center.
function pointToAngle(clientX, clientY, rect) {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = clientX - cx;
  const dy = clientY - cy;
  let angle = Math.atan2(dy, dx) * 180 / Math.PI;
  if (angle < 0) angle += 360;
  return angle;
}

// Best-effort haptic tick — Capacitor Haptics if present, fall back to Vibration API.
function tick() {
  try {
    if (typeof window !== 'undefined' && window.Capacitor?.Plugins?.Haptics) {
      window.Capacitor.Plugins.Haptics.impact({ style: 'LIGHT' }).catch(() => {});
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(8);
    }
  } catch { /* haptics are best-effort */ }
}

export default function RatingWheel({
  value,
  onChange,
  min = 1,
  max = 9,
  size = 200,
  accent = '#d4782f',
  muted = '#666',
  trackBg = 'rgba(255,255,255,0.08)',
  labelColor = '#f5e6d3',
}) {
  const [active, setActive] = useState(false);
  const wheelRef = useRef(null);
  const lastTickRef = useRef(null);

  const radius = size / 2;
  const trackRadius = radius - 22;
  const cx = radius;
  const cy = radius;

  const currentAngle = valueToAngle(value, min, max);
  const thumbPos = polarToCartesian(cx, cy, trackRadius, currentAngle);

  const commit = useCallback((clientX, clientY) => {
    if (!wheelRef.current) return;
    const rect = wheelRef.current.getBoundingClientRect();
    const angle = pointToAngle(clientX, clientY, rect);
    const raw = angleToValue(angle, min, max);
    const snapped = Math.round(raw * 10) / 10;
    const intPart = Math.floor(snapped);
    if (lastTickRef.current !== intPart) {
      lastTickRef.current = intPart;
      tick();
    }
    onChange(snapped);
  }, [onChange, min, max]);

  const onDown = (e) => {
    e.preventDefault();
    setActive(true);
    lastTickRef.current = value != null ? Math.floor(value) : null;
    const t = e.touches ? e.touches[0] : e;
    commit(t.clientX, t.clientY);
  };

  // Attach move/end handlers to window while dragging so the user can
  // continue past the wheel's bounding box without losing the drag.
  useEffect(() => {
    if (!active) return;
    const onMove = (e) => {
      const t = e.touches ? e.touches[0] : e;
      if (t) commit(t.clientX, t.clientY);
    };
    const onUp = () => setActive(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [active, commit]);

  const stepBy = (delta) => {
    const base = value == null ? (min - delta) : value;
    const next = Math.max(min, Math.min(max, Math.round((base + delta) * 10) / 10));
    lastTickRef.current = Math.floor(next);
    tick();
    onChange(next);
  };

  const display = value == null || value === 0
    ? '--'
    : (Number.isInteger(value) ? String(value) : value.toFixed(1));

  return (
    <div style={{ userSelect: 'none' }}>
      <div
        ref={wheelRef}
        role="slider"
        aria-label="Cook rating"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value ?? min}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); stepBy(0.1); }
          else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); stepBy(-0.1); }
          else if (e.key === 'PageUp') { e.preventDefault(); stepBy(1); }
          else if (e.key === 'PageDown') { e.preventDefault(); stepBy(-1); }
          else if (e.key === 'Home') { e.preventDefault(); onChange(min); }
          else if (e.key === 'End') { e.preventDefault(); onChange(max); }
        }}
        onMouseDown={onDown}
        onTouchStart={onDown}
        style={{
          position: 'relative',
          width: size,
          height: size,
          margin: '0 auto',
          touchAction: 'none',
          cursor: active ? 'grabbing' : 'grab',
          outline: 'none',
        }}
      >
        <svg width={size} height={size} style={{ display: 'block' }} aria-hidden="true">
          {/* Full-arc track */}
          <path
            d={arcPath(cx, cy, trackRadius, ARC_START, ARC_END)}
            fill="none"
            stroke={trackBg}
            strokeWidth={14}
            strokeLinecap="round"
          />
          {/* Filled portion up to current value */}
          {value != null && value > 0 && (
            <path
              d={arcPath(cx, cy, trackRadius, ARC_START, currentAngle)}
              fill="none"
              stroke={accent}
              strokeWidth={14}
              strokeLinecap="round"
            />
          )}
          {/* Thumb */}
          {value != null && value > 0 && (
            <circle
              cx={thumbPos.x}
              cy={thumbPos.y}
              r={14}
              fill={accent}
              stroke="#fff"
              strokeWidth={3}
            />
          )}
        </svg>
        {/* Center readout */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          pointerEvents: 'none',
          fontFamily: "'Oswald', sans-serif",
        }}>
          <div style={{
            fontSize: '48px',
            fontWeight: 700,
            color: value ? accent : muted,
            lineHeight: 1,
          }}>{display}</div>
          <div style={{
            fontSize: '11px',
            color: muted,
            marginTop: '4px',
            letterSpacing: '2px',
          }}>/ {max}</div>
        </div>
      </div>

      {/* Accessible stepper fallback */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '10px',
        marginTop: '12px',
      }}>
        <button
          type="button"
          aria-label="Decrease rating by 0.1"
          onClick={() => stepBy(-0.1)}
          style={stepBtn(muted, labelColor)}
        >−</button>
        <span style={{
          fontSize: '10px',
          color: muted,
          letterSpacing: '2px',
          fontFamily: "'Oswald', sans-serif",
        }}>ADJUST</span>
        <button
          type="button"
          aria-label="Increase rating by 0.1"
          onClick={() => stepBy(0.1)}
          style={stepBtn(muted, labelColor)}
        >+</button>
      </div>
    </div>
  );
}

function stepBtn(border, color) {
  return {
    padding: '6px 14px',
    background: 'transparent',
    border: `1px solid ${border}`,
    color,
    borderRadius: '4px',
    fontSize: '18px',
    fontWeight: 700,
    cursor: 'pointer',
    minWidth: '36px',
    fontFamily: "'Oswald', sans-serif",
  };
}
