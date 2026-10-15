import { useState } from 'react';

// Renders a user's avatar image with a graceful fallback to initials.
//
// Why this is a shared component:
//   Google profile photo URLs (lh3.googleusercontent.com) frequently fail
//   to load inside the Capacitor WebView. The WebView's origin is
//   https://localhost/, and Google's image CDN sometimes rejects requests
//   based on the Referer header that the WebView attaches. The result:
//   raw <img src={photoURL}> elements show the browser's "broken image"
//   icon, which looks terrible — especially right after a fresh login.
//
//   Setting `referrerPolicy="no-referrer"` strips the header on the way
//   out, which fixes the vast majority of these failures. The onError
//   handler covers the remaining cases (network drop, image deleted, URL
//   never set) by swapping to a colored circle with the user's initials.
//
// Pass `name` so we can compute initials. Defaults are sized for the
// most common sites (36px round); override `size` for headers/profile
// pages that want larger.
export default function Avatar({ src, name, size = 36, style = {} }) {
  const [failed, setFailed] = useState(false);

  const initials = (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase() || '?';

  const baseStyle = {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '50%',
    flexShrink: 0,
    ...style,
  };

  // Fall back to initials when we have no URL or the image failed to load.
  if (!src || failed) {
    return (
      <div
        aria-label={name ? `${name} avatar` : 'avatar'}
        style={{
          ...baseStyle,
          background: '#d4782f',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'Oswald', sans-serif",
          fontSize: `${Math.round(size * 0.42)}px`,
          fontWeight: 700,
          letterSpacing: '1px',
        }}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      style={baseStyle}
    />
  );
}
