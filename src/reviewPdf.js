// PDF export for a BBQ Scorecard review.
//
// Layout: Letter portrait, header with restaurant name + score + stars,
// score grid (BBQ track + Family track side by side), price + return
// preferences, sauce + notes, then each photo on its own page if any.
// Page-numbered footer on every page.
//
// jsPDF is dynamically imported so it stays out of the main bundle —
// only loaded when a user actually taps Export PDF. That keeps the
// landing/scorecard payload small. ~240 KB gz import cost when invoked.
//
// Exports `exportReviewPdf(review, calcScores)` — pass the calcScores
// helper in so this module stays free of upstream dependencies.

const PAGE_WIDTH = 612;   // Letter portrait, points
const PAGE_HEIGHT = 792;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const ACCENT = [212, 120, 47];   // #d4782f
const DARK = [26, 26, 26];        // #1a1a1a
const TEXT = [60, 60, 60];
const MUTED = [136, 136, 136];

// Category list mirrored from src/constants.js CATEGORIES. Kept as a
// local literal (rather than importing constants.js, which pulls in the
// smoker catalog and other unrelated code) — but the KEYS must match the
// review data exactly, or scores[c.key] is undefined and every mismatched
// row prints "—". Previously these had drifted (meat/bark/smokeRing/flavor
// /value) and left half the grid blank. If constants.js CATEGORIES change,
// update these too.
const BBQ_CATS = [
  { key: 'appearance',  label: 'Appearance' },
  { key: 'taste',       label: 'Taste / Flavor' },
  { key: 'tenderness',  label: 'Tenderness / Texture' },
  { key: 'smoke',       label: 'Smoke' },
  { key: 'sides',       label: 'Sides' },
  { key: 'sauce',       label: 'Sauce' },
  { key: 'portions',    label: 'Portions / Value' },
];
const FAM_CATS = [
  { key: 'service',     label: 'Service' },
  { key: 'cleanliness', label: 'Cleanliness' },
  { key: 'amenities',   label: 'Family Amenities' },
];

function setColor(doc, fn, rgb) {
  doc[fn](rgb[0], rgb[1], rgb[2]);
}

function drawHeader(doc, review, sc) {
  setColor(doc, 'setFillColor', DARK);
  doc.rect(0, 0, PAGE_WIDTH, 120, 'F');

  setColor(doc, 'setTextColor', [245, 230, 211]); // cream
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(review.restaurant || 'Untitled', MARGIN, 50);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  setColor(doc, 'setTextColor', [200, 200, 200]);
  const meta = [
    review.location,
    review.date,
    review.trip,
  ].filter(Boolean).join(' · ');
  doc.text(meta, MARGIN, 70);

  // Composite score, top-right
  setColor(doc, 'setTextColor', ACCENT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.text(sc.composite.toFixed(2), PAGE_WIDTH - MARGIN, 50, { align: 'right' });

  // Stars
  setColor(doc, 'setTextColor', [251, 191, 36]);
  doc.setFontSize(16);
  const stars = '★'.repeat(sc.stars) + '☆'.repeat(5 - sc.stars);
  doc.text(stars, PAGE_WIDTH - MARGIN, 75, { align: 'right' });
}

function drawScoreColumn(doc, x, top, title, cats, scores) {
  setColor(doc, 'setTextColor', ACCENT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(title, x, top);

  let y = top + 18;
  setColor(doc, 'setTextColor', TEXT);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  for (const c of cats) {
    const v = scores[c.key];
    const label = `${c.label}:`;
    doc.text(label, x, y);
    doc.text(v != null && v > 0 ? `${v} / 9` : '—', x + 130, y, { align: 'right' });
    y += 16;
  }
  return y;
}

function drawSection(doc, title, body, top) {
  if (!body) return top;
  setColor(doc, 'setTextColor', ACCENT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(title, MARGIN, top);

  setColor(doc, 'setTextColor', TEXT);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const lines = doc.splitTextToSize(body, CONTENT_WIDTH);
  doc.text(lines, MARGIN, top + 14);
  return top + 14 + lines.length * 12 + 12;
}

function drawFooter(doc, pageNum, total, review) {
  setColor(doc, 'setTextColor', MUTED);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    `BBQ Scorecard · Holy Smokes BBQ Co · ${review.restaurant || 'review'} · Page ${pageNum} of ${total}`,
    PAGE_WIDTH / 2,
    PAGE_HEIGHT - 24,
    { align: 'center' }
  );
}

async function loadImageAsDataURL(src) {
  // Photos in a review may be data URLs (local), https URLs (cloud), or
  // null. Convert anything we can to a dataURL for embedding.
  if (!src) return null;
  if (src.startsWith('data:')) return src;
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function exportReviewPdf(review, calcScores) {
  const { default: jsPDF } = await import('jspdf');

  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const sc = calcScores(review.scores);

  drawHeader(doc, review, sc);

  // Score columns — BBQ left, Family right
  const scoreTop = 150;
  drawScoreColumn(doc, MARGIN, scoreTop, 'BBQ Track', BBQ_CATS, review.scores);
  drawScoreColumn(doc, MARGIN + CONTENT_WIDTH / 2 + 20, scoreTop, 'Family Track', FAM_CATS, review.scores);

  let y = scoreTop + 18 + Math.max(BBQ_CATS.length, FAM_CATS.length) * 16 + 24;

  // Price + return + sauce
  setColor(doc, 'setTextColor', MUTED);
  doc.setFontSize(10);
  const meta = [];
  if (review.price) {
    const pp = review.priceSplit > 1 ? ` ($${(review.price / review.priceSplit).toFixed(2)}/person × ${review.priceSplit})` : '';
    meta.push(`Price: $${review.price}${pp}`);
  }
  if (review.sauceDep) meta.push(`Sauce: ${review.sauceDep}`);
  if (review.wouldReturn) meta.push(`Would return: ${review.wouldReturn}`);
  if (meta.length) {
    doc.text(meta.join('    '), MARGIN, y);
    y += 24;
  }

  // Notes log + free-form notes
  if (review.notesLog && review.notesLog.length) {
    y = drawSection(doc, 'Notes', review.notesLog.join('\n'), y);
  }
  if (review.notes) {
    y = drawSection(doc, 'Additional Notes', review.notes, y);
  }

  // Photos — one per page after the cover
  const photos = (review.photos || []).filter(Boolean);
  const photoData = [];
  for (const p of photos.slice(0, 5)) {
    const data = await loadImageAsDataURL(p);
    if (data) photoData.push(data);
  }

  const totalPages = 1 + photoData.length;
  drawFooter(doc, 1, totalPages, review);

  photoData.forEach((data, i) => {
    doc.addPage();
    try {
      // Fit photo inside content area while preserving aspect ratio
      const maxW = CONTENT_WIDTH;
      const maxH = PAGE_HEIGHT - MARGIN * 2 - 40;
      doc.addImage(data, 'JPEG', MARGIN, MARGIN, maxW, maxH, undefined, 'FAST');
    } catch {
      // Image failed; render a placeholder note
      setColor(doc, 'setTextColor', MUTED);
      doc.setFontSize(10);
      doc.text('Photo could not be embedded.', MARGIN, MARGIN + 20);
    }
    drawFooter(doc, i + 2, totalPages, review);
  });

  const filename = `${(review.restaurant || 'review').replace(/[^a-zA-Z0-9]/g, '-')}-${review.date || 'undated'}.pdf`;

  // Save path splits by platform:
  //
  // - Web / PWA: jsPDF's `doc.save()` triggers a browser download the
  //   same way the website version does. This is the path that worked.
  //
  // - Capacitor Android: `doc.save()` writes into a WebView-only sandbox
  //   the user can never see or share (the app was the failing case
  //   users have been reporting since v3.2.0). Instead we:
  //     1. Get the PDF as a base64 string,
  //     2. Write it to the app's public documents directory via
  //        Capacitor Filesystem (survives updates, visible to file
  //        managers),
  //     3. Open the system share sheet via Capacitor Share so the file
  //        can go to Drive, email, print, WhatsApp, etc.
  //   That gives the app-side export parity with the website version.
  const isNative = typeof window !== 'undefined'
    && window.Capacitor?.isNativePlatform?.();

  if (!isNative) {
    doc.save(filename);
    return;
  }

  try {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ]);

    // jsPDF's output('datauristring') gives us "data:application/pdf;base64,XXX".
    // Capacitor Filesystem's writeFile wants the raw base64 body only.
    const dataUri = doc.output('datauristring');
    const base64 = dataUri.slice(dataUri.indexOf(',') + 1);

    const written = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Documents,
      recursive: true,
    });

    await Share.share({
      title: 'BBQ Scorecard review',
      text: `${review.restaurant || 'BBQ review'} — ${review.date || ''}`.trim(),
      url: written.uri,
      dialogTitle: 'Share PDF',
    });
  } catch (e) {
    // Fall back to the browser download path so users still get SOMETHING
    // rather than a silent failure. Log the specific error so a support
    // ping can trace it.
    console.error('Native PDF share failed, falling back to download:', e);
    doc.save(filename);
  }
}
