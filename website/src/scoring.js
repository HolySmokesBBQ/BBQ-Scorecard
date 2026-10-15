import { CATEGORIES, DESCRIPTORS } from './constants.js';

/* ── Scoring ── */
export function calcScores(scores) {
  const bbqKeys = CATEGORIES.bbq.map(c => c.key);
  const famKeys = CATEGORIES.family.map(c => c.key);
  const bbqVals = bbqKeys.map(k => scores[k]).filter(v => v > 0);
  const famVals = famKeys.map(k => scores[k]).filter(v => v > 0);
  const bbqAvg = bbqVals.length ? bbqVals.reduce((a,b) => a+b, 0) / bbqVals.length : 0;
  const famAvg = famVals.length ? famVals.reduce((a,b) => a+b, 0) / famVals.length : 0;
  let bonus = 0;
  if (famAvg >= 8) bonus = 1.25;
  else if (famAvg >= 7) bonus = 1.00;
  else if (famAvg >= 6) bonus = 0.75;
  else if (famAvg >= 5) bonus = 0.50;
  else if (famAvg >= 4) bonus = 0.25;
  const composite = bbqAvg + bonus;
  let stars = 1;
  if (composite >= 5.75) stars = 5;
  else if (composite >= 4.75) stars = 4;
  else if (composite >= 3.75) stars = 3;
  else if (composite >= 2.75) stars = 2;
  return { bbqAvg, famAvg, bonus, composite, stars };
}

// Cryptographically-secure random ID for documents stored under
// `{userId}_{id}` paths. Prefer randomUUID (32 hex chars) when available;
// otherwise fall back to getRandomValues. Math.random is NOT acceptable
// — its xorshift128+ output is observable and predictable from the page.
export function genId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '');
  }
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const buf = new Uint8Array(16);
    crypto.getRandomValues(buf);
    return Array.from(buf, b => b.toString(16).padStart(2, '0')).join('');
  }
  // Should never hit this in any modern browser — keep insecure fallback
  // out of the path entirely.
  throw new Error('Web Crypto API unavailable — cannot generate secure ID');
}

export function emptyReview() {
  return {
    id: genId(), restaurant: '', date: new Date().toISOString().split('T')[0],
    location: '', meats: [], meatOther: '', sides: [], sideOther: '', dessert: '',
    drinks: '', orderStyle: '',
    scores: {}, sauceDep: '', wouldReturn: '', notes: '', notesLog: [],
    price: '', priceSplit: '1', trip: '', googleReviewUrl: '', photo: null,
    photos: [], friends: [], lastEdited: null,
  };
}

/* ── Migrate old reviews (photo -> photos) ── */
export function migrateReview(r) {
  const migrated = { ...r };
  if (!migrated.photos) migrated.photos = [];
  if (!migrated.friends) migrated.friends = [];
  if (migrated.photo && migrated.photos.length === 0) {
    migrated.photos = [migrated.photo];
  }
  return migrated;
}

/* ── Photo compression ── */
export function compressPhoto(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 800;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ══════════════════════════════════════════
   Analytics — GA4 (per-app measurement ID)
   ══════════════════════════════════════════
   Wraps gtag with:
   - Auto context enrichment (every event gets the current `view`)
   - User properties for segmentation (app_mode, signed_in, review_count, etc.)
   - User ID for cross-device stitching when signed in
   - Page view firing for SPA navigations
*/

const GA_MEASUREMENT_ID = window.GA_MEASUREMENT_ID || 'G-5JZJ75VWR3';
const _gaContext = {
  // Auto-attached to every event:
  _view: 'site',
  // User properties (sent via gtag('set', 'user_properties', ...)):
  user_id: null,
  signed_in: false,
  app_mode: 'restaurants',
  review_count: 0,
  friend_count: 0,
  cook_count: 0,
  recipe_count: 0,
  theme: 'system',
};

function _flushUserProperties() {
  if (typeof window.gtag !== 'function') return;
  // user_id goes through config, not user_properties
  const { user_id, _view, ...userProps } = _gaContext;
  try {
    window.gtag('set', 'user_properties', userProps);
    // Re-config with user_id so it attaches to subsequent events
    window.gtag('config', GA_MEASUREMENT_ID, {
      user_id: user_id || undefined,
      send_page_view: false,  // we fire page_view manually on SPA navigations
    });
  } catch {}
}

/* Update GA context. Call from AppContext effects whenever signed-in state,
   app mode, or counts change. Safe to call before gtag has loaded — the
   context is buffered and flushed on the first event. */
export function setGaContext(updates) {
  Object.assign(_gaContext, updates);
  _flushUserProperties();
}

/* Fire a custom event with auto-injected `view` context. */
export function track(event, params) {
  if (typeof window.gtag !== 'function') return;
  try {
    window.gtag('event', event, { view: _gaContext._view, ...params });
  } catch {}
}

/* Fire a page_view event for an SPA navigation. Updates _view in context
   so subsequent events know where the user is. */
export function trackPageView(viewName) {
  _gaContext._view = viewName;
  if (typeof window.gtag !== 'function') return;
  try {
    window.gtag('event', 'page_view', {
      page_title: viewName,
      page_path: typeof location !== 'undefined' ? location.pathname + '#' + viewName : viewName,
      view: viewName,
    });
  } catch {}
}

/* ── Share Card Generator (Canvas API) ── */
// Optional `opts` — { rankInfo: { rank: N, total: M } } paints a small
// "#N of M" badge under the composite score. Lets the share card brag
// naturally: "brisket was so good it went straight to #2 of 47." No
// badge if opts.rankInfo is missing, so old callers keep working.
export function generateShareCard(r, opts = {}) {
  return new Promise((resolve) => {
    const sc = calcScores(r.scores);
    const W = 1080, H = 1350;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, W, H);

    // Accent bar at top
    ctx.fillStyle = '#d4782f';
    ctx.fillRect(0, 0, W, 8);

    const drawContent = () => {
      let y = 80;

      // Logo/brand
      ctx.fillStyle = '#d4782f';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('HOLY SMOKES BBQ', W / 2, y);
      y += 24;
      ctx.fillStyle = '#888';
      ctx.font = '16px sans-serif';
      ctx.fillText('HOLY SMOKES BBQ CO', W / 2, y);
      y += 60;

      // Restaurant name
      ctx.fillStyle = '#f5e6d3';
      ctx.font = 'bold 52px sans-serif';
      const name = r.restaurant.toUpperCase();
      const words = name.split(' ');
      let line = '';
      const lines = [];
      for (const word of words) {
        const test = line + (line ? ' ' : '') + word;
        if (ctx.measureText(test).width > W - 120) {
          lines.push(line);
          line = word;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
      for (const l of lines) {
        ctx.fillText(l, W / 2, y);
        y += 62;
      }
      y += 10;

      // Location & date
      ctx.fillStyle = '#888';
      ctx.font = '24px sans-serif';
      const locDate = [r.location, r.date].filter(Boolean).join('  |  ');
      ctx.fillText(locDate, W / 2, y);
      y += 60;

      // Stars
      ctx.font = '64px sans-serif';
      ctx.fillStyle = '#fbbf24';
      const starStr = '★'.repeat(sc.stars) + '☆'.repeat(5 - sc.stars);
      ctx.fillText(starStr, W / 2, y);
      y += 50;

      // Composite score
      ctx.fillStyle = '#d4782f';
      ctx.font = 'bold 80px sans-serif';
      ctx.fillText(sc.composite.toFixed(2), W / 2, y);
      y += 30;
      ctx.fillStyle = '#888';
      ctx.font = '20px sans-serif';
      ctx.fillText(`BBQ ${sc.bbqAvg.toFixed(2)}  +  Family Bonus ${sc.bonus.toFixed(2)}`, W / 2, y);
      y += 30;

      // Rank badge — only when caller passed rankInfo.
      if (opts.rankInfo && opts.rankInfo.rank && opts.rankInfo.total) {
        ctx.fillStyle = '#4A6741';
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText(`RANK #${opts.rankInfo.rank} OF ${opts.rankInfo.total}`, W / 2, y);
        y += 30;
      }
      y += 30;

      // Divider
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(100, y);
      ctx.lineTo(W - 100, y);
      ctx.stroke();
      y += 40;

      // Category scores
      ctx.textAlign = 'left';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillStyle = '#d4782f';
      ctx.fillText('BBQ TRACK', 100, y);
      ctx.textAlign = 'right';
      ctx.fillText('FAMILY TRACK', W - 100, y);
      y += 35;

      const bbqCats = CATEGORIES.bbq;
      const famCats = CATEGORIES.family;
      const maxRows = Math.max(bbqCats.length, famCats.length);

      ctx.font = '22px sans-serif';
      for (let i = 0; i < maxRows; i++) {
        if (i < bbqCats.length) {
          const c = bbqCats[i];
          const v = r.scores[c.key] || 0;
          ctx.textAlign = 'left';
          ctx.fillStyle = '#ccc';
          ctx.fillText(c.label.split(' /')[0], 100, y);
          ctx.textAlign = 'right';
          ctx.fillStyle = v >= 7 ? '#4ade80' : v >= 5 ? '#f5e6d3' : v > 0 ? '#f87171' : '#555';
          ctx.fillText(v > 0 ? `${v}/9` : '-', W / 2 - 40, y);
        }
        if (i < famCats.length) {
          const c = famCats[i];
          const v = r.scores[c.key] || 0;
          ctx.textAlign = 'left';
          ctx.fillStyle = '#ccc';
          ctx.fillText(c.label, W / 2 + 40, y);
          ctx.textAlign = 'right';
          ctx.fillStyle = v >= 7 ? '#4ade80' : v >= 5 ? '#f5e6d3' : v > 0 ? '#f87171' : '#555';
          ctx.fillText(v > 0 ? `${v}/9` : '-', W - 100, y);
        }
        y += 34;
      }
      y += 20;

      // Would return
      if (r.wouldReturn) {
        ctx.textAlign = 'center';
        ctx.fillStyle = '#888';
        ctx.font = '22px sans-serif';
        ctx.fillText(`Would return: ${r.wouldReturn}`, W / 2, y);
        y += 40;
      }

      // Footer — light nudge toward the Play Store rather than a bare
      // URL. People who see the card and want the same tool now know
      // what to search for.
      ctx.textAlign = 'center';
      ctx.fillStyle = '#666';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('BBQ SCORECARD  |  ANDROID', W / 2, H - 55);
      ctx.fillStyle = '#444';
      ctx.font = '14px sans-serif';
      ctx.fillText('holysmokesbbqco.com', W / 2, H - 32);

      // Bottom accent bar
      ctx.fillStyle = '#d4782f';
      ctx.fillRect(0, H - 8, W, 8);

      canvas.toBlob((blob) => resolve(blob), 'image/png');
    };

    // If there's a photo, draw it at the top
    const photos = r.photos?.length ? r.photos : (r.photo ? [r.photo] : []);
    if (photos.length > 0) {
      const img = new Image();
      img.onload = () => {
        const imgH = 400;
        ctx.drawImage(img, 0, 0, W, imgH);
        const grad = ctx.createLinearGradient(0, imgH - 150, 0, imgH);
        grad.addColorStop(0, 'rgba(26,26,26,0)');
        grad.addColorStop(1, 'rgba(26,26,26,1)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, imgH - 150, W, 150);
        drawContent();
      };
      img.onerror = drawContent;
      img.src = photos[0];
    } else {
      drawContent();
    }
  });
}

/* ── Google Review Draft Generator ── */
// Google review draft. Rewritten 2026-07-18: the previous version was
// bullet-y and ignored the notesLog entirely, which left drafts skeletal
// even when the reviewer had written a full observation stream. Now
// notes ARE the body of the draft — timestamps stripped, joined as
// prose paragraphs. Score data gets woven in as context (highlight /
// weak link / sauce dependency), not as a trailing ratings row. Voice
// follows Joel's guide: no em dashes, no rule-of-three, no signposts.

function stripNoteDate(n) {
  return (n || '').replace(/^\d{4}-\d{2}-\d{2}:\s*/, '').trim();
}
function joinAnd(items) {
  const arr = items.filter(Boolean);
  if (arr.length <= 1) return arr.join('');
  if (arr.length === 2) return `${arr[0]} and ${arr[1]}`;
  return `${arr.slice(0, -1).join(', ')}, and ${arr[arr.length - 1]}`;
}

export function generateGoogleDraft(r) {
  const sc = calcScores(r.scores);

  // TL;DR — one line, verdict tied to composite band. No hard rating
  // block at the top or bottom of the draft; Google's own UI handles
  // stars separately.
  let verdict;
  if (sc.composite >= 8) verdict = 'Top tier BBQ. Worth the trip.';
  else if (sc.composite >= 7) verdict = 'A really solid spot.';
  else if (sc.composite >= 6) verdict = 'Good BBQ that does the job.';
  else if (sc.composite >= 5) verdict = 'Middle of the road.';
  else if (sc.composite >= 4) verdict = 'Below average.';
  else if (sc.composite >= 3) verdict = 'Disappointing.';
  else verdict = 'Hard pass.';

  const paragraphs = [];
  paragraphs.push(`TL;DR: ${verdict}`);

  // Opening context — stopped in for lunch, with the family, on the road
  // to X. Only builds a sentence if we have at least one specific to say.
  const openParts = [];
  const hasFriends = Array.isArray(r.friends) && r.friends.length > 0;
  if (r.location) openParts.push(`Stopped in ${r.location.split(',')[0].trim()}`);
  if (r.trip) openParts.push(`on our ${r.trip.trim().toLowerCase()}`);
  if (hasFriends) openParts.push('with the family');
  if (openParts.length) paragraphs.push(openParts.join(' ') + '.');

  // Order line — what we actually ate. Kept plain so notes don't have
  // to reintroduce the meat names.
  const ordered = [...(r.meats || []), r.meatOther].filter(Boolean);
  const sidesList = [...(r.sides || []), r.sideOther].filter(Boolean);
  const orderBits = [];
  if (ordered.length) orderBits.push(`We ordered the ${joinAnd(ordered.map(x => x.toLowerCase()))}`);
  if (sidesList.length) orderBits.push(`${orderBits.length ? 'with ' : 'Sides were '}${joinAnd(sidesList.map(x => x.toLowerCase()))}`);
  if (r.dessert) orderBits.push(`and ${r.dessert.toLowerCase()} for dessert`);
  if (r.drinks) orderBits.push(`${orderBits.length ? 'and ' : 'We had '}${r.drinks.toLowerCase()} to drink`);
  if (orderBits.length) paragraphs.push(orderBits.join(' ') + '.');

  // The reviewer's own notes ARE the body of the draft. Strip the date
  // prefixes so they read as prose rather than a log. Each note becomes
  // its own paragraph — most reviewers write one thought per note, and
  // that groups naturally into topic paragraphs downstream.
  const noteBlocks = (r.notesLog || [])
    .map(stripNoteDate)
    .filter(Boolean);
  if (noteBlocks.length) {
    for (const b of noteBlocks) paragraphs.push(b);
  } else if (r.notes && r.notes.trim()) {
    paragraphs.push(r.notes.trim());
  }

  // Score-derived observation. Picks the single highest and single
  // lowest BBQ category (if the gap is real) so the draft has an
  // opinion instead of a shrug.
  const bbqCats = CATEGORIES.bbq;
  const scored = bbqCats
    .map(c => ({ c, v: r.scores[c.key] || 0 }))
    .filter(x => x.v > 0)
    .sort((a, b) => b.v - a.v);
  if (scored.length >= 2 && scored[0].v - scored[scored.length - 1].v >= 3) {
    const bestLabel = scored[0].c.label.split(' /')[0].split(' ·')[0].toLowerCase();
    const worstLabel = scored[scored.length - 1].c.label.split(' /')[0].split(' ·')[0].toLowerCase();
    paragraphs.push(`${cap(bestLabel)} was the highlight. ${cap(worstLabel)} was the weak link.`);
  }

  // Sauce dependency + service + cleanliness callouts, each only when
  // meaningful. Woven as a small closing paragraph rather than a bullet list.
  const closing = [];
  if (r.sauceDep) {
    const lc = r.sauceDep.toLowerCase();
    if (lc.includes('need')) closing.push('The meat needed the sauce to get through.');
    else if (lc.includes('optional')) closing.push('Sauce was optional. The meat stood up on its own.');
  }
  const svc = r.scores.service || 0;
  if (svc >= 7) closing.push('Service was friendly and attentive.');
  else if (svc > 0 && svc <= 4) closing.push('Service was a soft spot.');
  const clean = r.scores.cleanliness || 0;
  if (clean >= 7) closing.push('Place was clean and well kept.');
  else if (clean > 0 && clean <= 4) closing.push('Cleanliness could use some work.');
  if (closing.length) paragraphs.push(closing.join(' '));

  // Recommendation + return. Ends the draft on something actionable.
  const primaryMeat = ordered[0];
  if (primaryMeat && sc.composite >= 5) {
    paragraphs.push(`If you stop in, get the ${primaryMeat.toLowerCase()}.`);
  }
  if (r.wouldReturn) {
    const lc = r.wouldReturn.toLowerCase();
    if (lc === 'yes') paragraphs.push('We would be back.');
    else if (lc === 'no') paragraphs.push("Won't be a return trip for us.");
    else paragraphs.push('We might be back, but it would not be our first choice.');
  }

  return paragraphs.filter(Boolean).join('\n\n');
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ── CSV Export ── */
export function exportCSV(reviews) {
  const headers = [
    'Restaurant','Date','Location','Trip','Price','Split','Price Per Person',
    'Appearance','Taste','Tenderness','Smoke','Sides','Sauce','Portions',
    'Service','Cleanliness','Amenities',
    'BBQ Avg','Family Avg','Bonus','Composite','Stars',
    'Sauce Dependency','Would Return','Meats Ordered','Sides Ordered','Dessert','Notes',
  ];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = reviews.map(r => {
    const sc = calcScores(r.scores);
    const pp = r.price && r.priceSplit > 0 ? (Number(r.price) / Number(r.priceSplit)).toFixed(2) : '';
    return [
      r.restaurant, r.date, r.location || '', r.trip || '', r.price || '', r.priceSplit || '1', pp,
      r.scores.appearance || '', r.scores.taste || '', r.scores.tenderness || '',
      r.scores.smoke || '', r.scores.sides || '', r.scores.sauce || '', r.scores.portions || '',
      r.scores.service || '', r.scores.cleanliness || '', r.scores.amenities || '',
      sc.bbqAvg.toFixed(2), sc.famAvg.toFixed(2), sc.bonus.toFixed(2), sc.composite.toFixed(2), sc.stars,
      r.sauceDep || '', r.wouldReturn || '',
      (r.meats || []).join('; '), (r.sides || []).join('; '),
      r.dessert || '', (r.notesLog || []).join(' | ') || r.notes || '',
    ].map(esc).join(',');
  });
  const csv = [headers.map(esc).join(','), ...rows].join('\n');
  track('csv_exported', { review_count: reviews.length });
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bbq-reviews-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
