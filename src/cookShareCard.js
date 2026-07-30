// Cook share-card generator — renders a 1080×1920 PNG of a cook log
// into a Blob that the caller hands to the Web Share API or downloads.
// Canvas-based so it works inside Capacitor WebView without depending
// on sharp or a server-side render.

const W = 1080;
const H = 1920;

const ACCENT       = '#4A6741';
const ACCENT_LIGHT = '#7a9670';
const GOLD         = '#d4a64a';
const BG_TOP       = '#0e0e0e';
const BG_MID       = '#1a1410';
const BG_BOTTOM    = '#0e0a08';
const CARD_BG      = '#1f1812';
const BORDER       = '#3a2f22';
const TEXT_MAIN    = '#f5e6d3';
const TEXT_BODY    = '#d6c4ad';
const TEXT_MUTED   = '#999999';

async function generateCookShareCard(cook) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  drawBackground(ctx);
  await drawHeader(ctx);
  drawTitle(ctx, cook);
  drawStats(ctx, cook);
  drawDetails(ctx, cook);
  drawFooter(ctx);

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

// Convenience: generate + share/download in one call. Returns true on
// success, false if the user cancelled or the share failed.
export async function shareCookCard(cook) {
  const blob = await generateCookShareCard(cook);
  if (!blob) return false;
  const filename = `${(cook.name || 'cook').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-bbq-notebook.png`;

  // Web Share API with files works on Android Chrome + most native
  // WebViews; falls back to download otherwise.
  if (navigator.canShare && navigator.canShare({ files: [new File([blob], filename, { type: 'image/png' })] })) {
    try {
      await navigator.share({
        title: cook.name || 'BBQ cook',
        text: `${cook.meatType ? `${cook.meatType} cook` : 'BBQ cook'} logged on BBQ Notebook`,
        files: [new File([blob], filename, { type: 'image/png' })],
      });
      return true;
    } catch (e) {
      if (e.name === 'AbortError') return false;
      console.warn('Share failed, falling back to download:', e);
    }
  }

  // Download fallback — creates an <a> with the blob URL and clicks it.
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

// ── Drawing ──────────────────────────────────────────────────────

function drawBackground(ctx) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, BG_TOP);
  grad.addColorStop(0.5, BG_MID);
  grad.addColorStop(1, BG_BOTTOM);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Subtle green glow at the top — matches the screenshot generator
  const glow = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, W * 0.65);
  glow.addColorStop(0, 'rgba(74, 103, 65, 0.18)');
  glow.addColorStop(1, 'rgba(74, 103, 65, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
}

async function drawHeader(ctx) {
  // Try to draw the logo if it's reachable; never fail the card if not.
  try {
    const img = await loadImage(`${import.meta.env.BASE_URL || '/'}bbq-notebook-logo.png`);
    const size = 130;
    ctx.drawImage(img, (W - size) / 2, 130, size, size);
  } catch {
    // No logo — leave the space empty; brand strip below carries it.
  }

  ctx.font = '700 26px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = ACCENT_LIGHT;
  ctx.fillText('BBQ NOTEBOOK', W / 2, 296);

  ctx.font = '500 18px Arial, sans-serif';
  ctx.fillStyle = TEXT_MUTED;
  ctx.fillText('BY HOLY SMOKES BBQ CO', W / 2, 326);
}

function drawTitle(ctx, cook) {
  // Cook name — wraps to 2 lines max.
  const name = (cook.name || 'Untitled cook').toUpperCase();
  ctx.fillStyle = TEXT_MAIN;
  ctx.font = '900 62px "Arial Black", Impact, sans-serif';
  ctx.textAlign = 'center';
  const lines = wrapText(ctx, name, W - 120);
  let y = 470;
  lines.slice(0, 2).forEach(line => {
    ctx.fillText(line, W / 2, y);
    y += 72;
  });

  // Underline
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(W / 2 - 90, y + 8);
  ctx.lineTo(W / 2 + 90, y + 8);
  ctx.stroke();

  // Meat + date strip
  ctx.fillStyle = TEXT_MUTED;
  ctx.font = '500 26px Arial, sans-serif';
  const subline = [cook.meatType, cook.date].filter(Boolean).join('  ·  ');
  ctx.fillText(subline, W / 2, y + 60);

  // Rating chip if present
  if (cook.rating > 0) {
    ctx.fillStyle = GOLD;
    ctx.font = '900 40px "Arial Black", Impact, sans-serif';
    ctx.fillText(`${cook.rating}/9`, W / 2, y + 130);
  }
}

function drawStats(ctx, cook) {
  // Two big numbers side by side: cook temp / finish temp
  const yTop = 850;
  const cardH = 200;
  const cardW = (W - 200) / 2;
  const gap = 40;

  drawStatCard(ctx, 80,             yTop, cardW, cardH, 'COOK TEMP',   cook.cookTemp ? `${cook.cookTemp}°` : '—');
  drawStatCard(ctx, 80 + cardW + gap, yTop, cardW, cardH, 'FINISH',     cook.targetInternalTemp ? `${cook.targetInternalTemp}°` : '—');

  // Second row — weight + cook time
  const yMid = yTop + cardH + 30;
  drawStatCard(ctx, 80,             yMid, cardW, cardH, 'WEIGHT',      cook.weight ? `${cook.weight} lb` : '—');
  drawStatCard(ctx, 80 + cardW + gap, yMid, cardW, cardH, 'COOK TIME',  formatCookTime(cook));
}

function drawStatCard(ctx, x, y, w, h, label, value) {
  // Card background + border
  ctx.fillStyle = CARD_BG;
  roundRect(ctx, x, y, w, h, 18, true, false);
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 18, false, true);

  // Label
  ctx.fillStyle = TEXT_MUTED;
  ctx.font = '700 20px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + 50);

  // Value — auto-size if too wide.
  const cx = x + w / 2;
  const cy = y + h - 50;
  let fontSize = 76;
  ctx.font = `900 ${fontSize}px "Arial Black", Impact, sans-serif`;
  while (ctx.measureText(value).width > w - 40 && fontSize > 30) {
    fontSize -= 4;
    ctx.font = `900 ${fontSize}px "Arial Black", Impact, sans-serif`;
  }
  ctx.fillStyle = ACCENT_LIGHT;
  ctx.fillText(value, cx, cy);
}

function drawDetails(ctx, cook) {
  const yTop = 1340;
  const rows = [
    ['Rub',     cook.rub || '—'],
    ['Wood',    Array.isArray(cook.woodType) ? cook.woodType.join(' + ') : (cook.woodType || '—')],
    ['Smoker',  cook.smokerType || '—'],
    ['Wrap',    cook.wrapMethod || '—'],
    ['Rest',    cook.restTime ? `${cook.restTime} min` : '—'],
  ];
  // Background panel
  const panelH = 70 * rows.length + 40;
  ctx.fillStyle = CARD_BG;
  roundRect(ctx, 80, yTop, W - 160, panelH, 20, true, false);
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 2;
  roundRect(ctx, 80, yTop, W - 160, panelH, 20, false, true);

  rows.forEach(([k, v], i) => {
    const y = yTop + 50 + i * 70;
    ctx.fillStyle = TEXT_MUTED;
    ctx.font = '600 24px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(k.toUpperCase(), 120, y);
    ctx.fillStyle = TEXT_BODY;
    ctx.font = '700 26px Arial, sans-serif';
    ctx.textAlign = 'right';
    const value = truncate(ctx, v, W - 360);
    ctx.fillText(value, W - 120, y);
    // Row separator
    if (i < rows.length - 1) {
      ctx.strokeStyle = BORDER;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(120, y + 20);
      ctx.lineTo(W - 120, y + 20);
      ctx.stroke();
    }
  });
}

function drawFooter(ctx) {
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(80, H - 180);
  ctx.lineTo(W - 80, H - 180);
  ctx.stroke();

  ctx.fillStyle = ACCENT_LIGHT;
  ctx.font = '700 22px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('FAITH  ·  FAMILY  ·  FIRE', W / 2, H - 110);
}

// ── Helpers ──────────────────────────────────────────────────────

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function truncate(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (ctx.measureText(truncated + '…').width > maxWidth && truncated.length > 1) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '…';
}

function formatCookTime(cook) {
  const h = parseFloat(cook.cookTimeHours) || 0;
  const m = parseFloat(cook.cookTimeMinutes) || 0;
  if (h === 0 && m === 0) return '—';
  if (h === 0) return `${Math.round(m)}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${Math.round(m)}m`;
}

function roundRect(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
  if (fill)   ctx.fill();
  if (stroke) ctx.stroke();
}
