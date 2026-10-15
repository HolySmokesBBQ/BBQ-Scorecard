// Review Story Card generator — renders a 1080×1920 (IG Story / Reel
// cover) PNG of a Scorecard review into a Blob for the Web Share API.
//
// This is the social-flywheel format from the 2026-07-20 feature-ideas
// entry: joint name, composite score, top 2 winning categories, top 2
// losing categories (only ones scored below 7), one photo, city tag,
// and a small "Scored on BBQ Scorecard" watermark.
//
// Sibling of generateShareCard() in scoring.js (1080×1350 feed format)
// and cookShareCard.js in Notebook. Canvas-based so it works inside the
// Capacitor WebView with no server round trip.

import { CATEGORIES } from './constants.js';
import { calcScores } from './scoring.js';

const W = 1080;
const H = 1920;

const ACCENT     = '#d4782f'; // Scorecard orange
const GOLD       = '#fbbf24';
const GREEN      = '#4ade80';
const RED        = '#f87171';
const BG         = '#1a1a1a';
const BG_DEEP    = '#111009';
const TEXT_MAIN  = '#f5e6d3';
const TEXT_MUTED = '#999999';
const TEXT_DIM   = '#666666';

function catLabel(c) {
  return c.label.split(' /')[0].split(' ·')[0].toUpperCase();
}

export async function generateReviewStoryCard(r, opts = {}) {
  const sc = calcScores(r.scores);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Load photos FIRST, then reserve the bottom band only for the ones
  // that actually decoded. Cloud photo URLs can fail (no bucket CORS,
  // expired token, offline); reserving 820px before loading left an
  // empty void when they all failed. Now a fully-failed set simply
  // yields a clean text-only card.
  const photoUrls = r.photos?.length ? r.photos : (r.photo ? [r.photo] : []);
  const imgs = await loadPhotos(photoUrls);
  const photoH = imgs.length ? 820 : 0;
  const contentH = H - photoH;

  // ── Background ──
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, BG);
  grad.addColorStop(1, BG_DEEP);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Warm glow behind the score
  const glow = ctx.createRadialGradient(W / 2, 520, 0, W / 2, 520, 620);
  glow.addColorStop(0, 'rgba(212, 120, 47, 0.14)');
  glow.addColorStop(1, 'rgba(212, 120, 47, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, contentH + 200);

  // Top accent bar
  ctx.fillStyle = ACCENT;
  ctx.fillRect(0, 0, W, 10);

  // ── Header ──
  let y = 130;
  ctx.textAlign = 'center';
  ctx.fillStyle = ACCENT;
  ctx.font = '900 54px "Arial Black", Impact, sans-serif';
  ctx.fillText('S C O R E D', W / 2, y);
  y += 42;
  ctx.fillStyle = TEXT_MUTED;
  ctx.font = '500 24px Arial, sans-serif';
  ctx.fillText('BBQ SCORECARD · HOLY SMOKES BBQ CO', W / 2, y);
  y += 110;

  // ── Restaurant name (2 lines max) ──
  ctx.fillStyle = TEXT_MAIN;
  ctx.font = '900 76px "Arial Black", Impact, sans-serif';
  const nameLines = wrapText(ctx, (r.restaurant || 'Untitled').toUpperCase(), W - 140);
  nameLines.slice(0, 2).forEach(line => {
    ctx.fillText(line, W / 2, y);
    y += 88;
  });

  // City tag + date
  ctx.fillStyle = TEXT_MUTED;
  ctx.font = '500 30px Arial, sans-serif';
  const cityLine = [r.location, r.date].filter(Boolean).join('  ·  ');
  if (cityLine) {
    ctx.fillText(cityLine, W / 2, y);
  }
  y += 90;

  // ── Composite, huge ──
  ctx.fillStyle = ACCENT;
  ctx.font = '900 210px "Arial Black", Impact, sans-serif';
  ctx.fillText(sc.composite.toFixed(2), W / 2, y + 150);
  y += 205;

  // Stars
  ctx.fillStyle = GOLD;
  ctx.font = '68px Arial, sans-serif';
  ctx.fillText('★'.repeat(sc.stars) + '☆'.repeat(5 - sc.stars), W / 2, y + 60);
  y += 105;

  // Optional rank badge, same brag mechanic as the feed card.
  if (opts.rankInfo && opts.rankInfo.rank && opts.rankInfo.total > 1) {
    ctx.fillStyle = TEXT_MUTED;
    ctx.font = '700 28px Arial, sans-serif';
    ctx.fillText(`#${opts.rankInfo.rank} OF ${opts.rankInfo.total} JOINTS SCORED`, W / 2, y);
    y += 55;
  }
  y += 25;

  // ── Category call-outs: top 2 winners, up to 2 losers below 7 ──
  const scored = CATEGORIES.bbq
    .map(c => ({ c, v: r.scores[c.key] || 0 }))
    .filter(x => x.v > 0)
    .sort((a, b) => b.v - a.v);
  const winners = scored.slice(0, 2);
  const losers = scored.filter(x => x.v < 7).slice(-2).reverse();

  const rows = [
    ...winners.map(x => ({ ...x, win: true })),
    ...losers.filter(l => !winners.some(w => w.c.key === l.c.key)).map(x => ({ ...x, win: false })),
  ];

  ctx.font = '700 40px Arial, sans-serif';
  // Keep the category rows inside the content region, above the photo
  // band. If a long 2-line name pushed the cursor down, compress the
  // row spacing so the last row never bleeds under the photos.
  const bottomLimit = contentH - 30;
  const avail = bottomLimit - y;
  const rowGap = rows.length > 1
    ? Math.min(62, Math.max(46, avail / rows.length))
    : 62;
  for (const row of rows) {
    const mark = row.win ? '✓' : '✗';
    const color = row.win ? GREEN : RED;
    const text = `${catLabel(row.c)}  ${row.v}/9`;
    const totalW = ctx.measureText(`${mark}  ${text}`).width;
    const x0 = (W - totalW) / 2;
    ctx.textAlign = 'left';
    ctx.fillStyle = color;
    ctx.fillText(mark, x0, y);
    ctx.fillStyle = row.win ? TEXT_MAIN : TEXT_MUTED;
    ctx.fillText(text, x0 + ctx.measureText(`${mark}  `).width, y);
    y += rowGap;
  }
  ctx.textAlign = 'center';

  // ── Photos, bottom block ──
  // Every uploaded food photo earns a spot (up to 4): one fills the
  // block, two split it, three get big-left + stacked-right, four a
  // 2×2 grid. Cover-fit crop per cell.
  if (imgs.length) {
    const yPhoto = H - photoH;
    drawPhotoCollage(ctx, imgs, yPhoto, photoH);
    // Blend the top of the photo block into the card
    const fade = ctx.createLinearGradient(0, yPhoto, 0, yPhoto + 220);
    fade.addColorStop(0, 'rgba(17, 16, 9, 1)');
    fade.addColorStop(1, 'rgba(17, 16, 9, 0)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, yPhoto, W, 220);
    // Darken the bottom for the watermark
    const foot = ctx.createLinearGradient(0, H - 220, 0, H);
    foot.addColorStop(0, 'rgba(0,0,0,0)');
    foot.addColorStop(1, 'rgba(0,0,0,0.78)');
    ctx.fillStyle = foot;
    ctx.fillRect(0, H - 220, W, 220);
  }

  // ── Watermark footer ──
  ctx.fillStyle = imgs.length ? TEXT_MAIN : TEXT_DIM;
  ctx.font = '700 26px Arial, sans-serif';
  ctx.fillText('Scored on BBQ Scorecard', W / 2, H - 96);
  ctx.fillStyle = imgs.length ? TEXT_MUTED : '#444444';
  ctx.font = '500 24px Arial, sans-serif';
  ctx.fillText('holysmokesbbqco.com', W / 2, H - 56);

  // Bottom accent bar
  ctx.fillStyle = ACCENT;
  ctx.fillRect(0, H - 10, W, 10);

  // Reject (not resolve-null) if the browser fails to encode. A null
  // blob would otherwise become `new File([null], …)` = a 4-byte
  // "null" PNG the share sheet accepts — a corrupt image. Rejecting
  // lets the caller fall back or surface an error instead.
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('Canvas toBlob returned null')), 'image/png'));
}

// ── Helpers ──────────────────────────────────────────────────────

const GUTTER = 6;

// Load up to 4 photos, skipping any that fail to decode. Returns the
// successfully-loaded images so the caller can size the layout to what
// actually rendered (see the dead-zone fix in generateReviewStoryCard).
async function loadPhotos(urls) {
  const imgs = [];
  for (const src of (urls || []).slice(0, 4)) {
    try { imgs.push(await loadImage(src)); } catch { /* skip broken photo */ }
  }
  return imgs;
}

function drawPhotoCollage(ctx, imgs, y0, h) {
  if (!imgs.length) return;

  let cells;
  const half = (W - GUTTER) / 2;
  const halfH = (h - GUTTER) / 2;
  if (imgs.length === 1) {
    cells = [[0, y0, W, h]];
  } else if (imgs.length === 2) {
    cells = [
      [0, y0, half, h],
      [half + GUTTER, y0, half, h],
    ];
  } else if (imgs.length === 3) {
    const bigW = Math.round(W * 0.58);
    const smallW = W - bigW - GUTTER;
    cells = [
      [0, y0, bigW, h],
      [bigW + GUTTER, y0, smallW, halfH],
      [bigW + GUTTER, y0 + halfH + GUTTER, smallW, halfH],
    ];
  } else {
    cells = [
      [0, y0, half, halfH],
      [half + GUTTER, y0, half, halfH],
      [0, y0 + halfH + GUTTER, half, halfH],
      [half + GUTTER, y0 + halfH + GUTTER, half, halfH],
    ];
  }

  imgs.forEach((img, i) => {
    const [x, y, w, ch] = cells[i];
    coverFit(ctx, img, x, y, w, ch);
  });
}

function coverFit(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale, sh = h / scale;
  const sx = (img.width - sw) / 2, sy = (img.height - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

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
