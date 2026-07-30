// Per-cook PDF export — renders the full cook log (meta, prep, cook,
// outcome, notes, photos) to a portrait Letter PDF the user can save,
// AirDrop, or print. Uses jsPDF for layout. Photos render inline at
// reasonable size with each cook overflow paginated automatically.
//
// Triggered from the cook detail page "Export PDF" button. The PDF
// downloads to the user's device via jsPDF's save(). On Android web
// view this surfaces as a normal download into the user's Downloads
// folder; on iOS PWAs it offers the share sheet.

const ACCENT = '#4A6741';
const DARK = '#1a1a1a';
const MUTED = '#888888';
const TEXT = '#333333';

// US Letter portrait. jsPDF uses pt by default — 72pt/inch.
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 48;
const COL_W = PAGE_W - MARGIN * 2;

export async function exportCookToPdf(cook) {
  if (!cook) return false;
  try {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });

    let y = MARGIN;
    y = drawHeader(doc, cook, y);
    y = drawMeta(doc, cook, y);
    y = drawSection(doc, 'Cook details', cook, [
      ['Meat',          cook.meatType],
      ['Cut',           cook.cut],
      ['Weight',        cook.weight ? `${cook.weight} lbs` : null],
      ['Smoker',        cook.smoker],
      ['Wood',          cook.wood],
      ['Rub',           cook.rub],
      ['Sauce',         cook.sauce],
      ['Brine',         cook.brine],
      ['Cook temp',     cook.cookTemp ? `${cook.cookTemp}°F` : null],
      ['Finish temp',   cook.targetInternalTemp ? `${cook.targetInternalTemp}°F` : null],
      ['Cook time',     formatDuration(cook.cookTimeHours, cook.cookTimeMinutes)],
      ['Wrap',          cook.wrap],
      ['Rest',          cook.restMinutes ? `${cook.restMinutes} min` : null],
      ['Weather',       cook.weather],
      ['Outdoor temp',  cook.outdoorTemp ? `${cook.outdoorTemp}°F` : null],
    ], y);

    if (cook.notes && cook.notes.trim()) {
      y = drawNotes(doc, 'Notes', cook.notes, y);
    }
    if (cook.notesLog && cook.notesLog.length) {
      y = drawNotesLog(doc, cook.notesLog, y);
    }
    if (cook.whatIdChange && cook.whatIdChange.trim()) {
      y = drawNotes(doc, 'What I\'d change next time', cook.whatIdChange, y);
    }

    // Photos (if present) — render one per page, fit-to-width.
    if (Array.isArray(cook.photos)) {
      for (const photo of cook.photos) {
        if (!photo || typeof photo !== 'string') continue;
        try {
          doc.addPage();
          drawPhotoPage(doc, photo);
        } catch (e) {
          // OK to skip a single bad photo without nuking the whole PDF.
          console.warn('Skipping photo in PDF export:', e);
        }
      }
    }

    drawFooter(doc);
    const safeName = (cook.name || 'cook')
      .replace(/[^A-Za-z0-9 _-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 60);
    doc.save(`BBQ-Notebook-${safeName}.pdf`);
    return true;
  } catch (err) {
    console.error('PDF export failed:', err);
    return false;
  }
}

// ── Layout helpers ──────────────────────────────────────────────

function drawHeader(doc, cook, y) {
  doc.setFillColor(DARK);
  doc.rect(0, 0, PAGE_W, 80, 'F');
  doc.setTextColor('#f5e6d3');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('BBQ NOTEBOOK', MARGIN, 38);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor('#aaaaaa');
  doc.text('by Holy Smokes BBQ Co', MARGIN, 56);
  return 110; // y cursor after header band
}

function drawMeta(doc, cook, y) {
  doc.setTextColor(TEXT);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(cook.name || 'Untitled cook', MARGIN, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(MUTED);
  const meta = [
    cook.date,
    cook.meatType,
    cook.rating != null ? `${cook.rating}/9` : null,
  ].filter(Boolean).join(' · ');
  if (meta) {
    doc.text(meta, MARGIN, y);
    y += 14;
  }
  if (Array.isArray(cook.tags) && cook.tags.length) {
    doc.text(cook.tags.map(t => `#${t}`).join('  '), MARGIN, y);
    y += 14;
  }
  return y + 14;
}

function drawSection(doc, title, cook, rows, y) {
  y = ensureSpace(doc, y, 100);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(ACCENT);
  doc.text(title.toUpperCase(), MARGIN, y);
  y += 6;
  doc.setDrawColor(220);
  doc.line(MARGIN, y, MARGIN + COL_W, y);
  y += 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);

  const labelW = 110;
  for (const [label, val] of rows) {
    if (val == null || val === '') continue;
    y = ensureSpace(doc, y, 18);
    doc.setTextColor(MUTED);
    doc.text(label, MARGIN, y);
    doc.setTextColor(TEXT);
    const valLines = doc.splitTextToSize(String(val), COL_W - labelW);
    doc.text(valLines, MARGIN + labelW, y);
    y += Math.max(14, valLines.length * 14);
  }
  return y + 8;
}

function drawNotes(doc, title, body, y) {
  y = ensureSpace(doc, y, 80);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(ACCENT);
  doc.text(title.toUpperCase(), MARGIN, y);
  y += 6;
  doc.setDrawColor(220);
  doc.line(MARGIN, y, MARGIN + COL_W, y);
  y += 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(TEXT);
  const lines = doc.splitTextToSize(body, COL_W);
  for (const line of lines) {
    y = ensureSpace(doc, y, 16);
    doc.text(line, MARGIN, y);
    y += 14;
  }
  return y + 8;
}

function drawNotesLog(doc, log, y) {
  y = ensureSpace(doc, y, 80);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(ACCENT);
  doc.text('TIMESTAMPED NOTES', MARGIN, y);
  y += 6;
  doc.setDrawColor(220);
  doc.line(MARGIN, y, MARGIN + COL_W, y);
  y += 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  for (const entry of log) {
    if (!entry) continue;
    const ts = entry.timestamp || entry.time || '';
    const temp = entry.temp != null ? ` · ${entry.temp}°F` : '';
    const text = entry.text || entry.note || '';
    if (!text) continue;
    const head = `${ts}${temp}`;
    y = ensureSpace(doc, y, 20);
    doc.setTextColor(MUTED);
    doc.text(head, MARGIN, y);
    doc.setTextColor(TEXT);
    const lines = doc.splitTextToSize(text, COL_W);
    for (const line of lines) {
      y += 13;
      y = ensureSpace(doc, y, 16);
      doc.text(line, MARGIN + 8, y);
    }
    y += 10;
  }
  return y + 6;
}

function drawPhotoPage(doc, dataUrl) {
  // Photos stored as data URLs (base64). jsPDF auto-detects format.
  const maxW = PAGE_W - MARGIN * 2;
  const maxH = PAGE_H - MARGIN * 2 - 30;
  // We don't know intrinsic dimensions without decoding; pass fit-to-width
  // and let jsPDF preserve aspect via getImageProperties.
  try {
    const props = doc.getImageProperties(dataUrl);
    const ratio = props.height / props.width;
    let w = maxW;
    let h = w * ratio;
    if (h > maxH) {
      h = maxH;
      w = h / ratio;
    }
    const x = (PAGE_W - w) / 2;
    const y = MARGIN + 20;
    doc.setTextColor(MUTED);
    doc.setFontSize(10);
    doc.text('Photo', MARGIN, MARGIN + 10);
    doc.addImage(dataUrl, props.fileType || 'JPEG', x, y, w, h);
  } catch {
    // Fallback — render a placeholder note.
    doc.setTextColor(MUTED);
    doc.text('(Photo could not be embedded)', MARGIN, PAGE_H / 2);
  }
}

function drawFooter(doc) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(MUTED);
    doc.text(`Page ${i} of ${pages}  ·  holysmokesbbqco.com/notebook`, MARGIN, PAGE_H - 24);
  }
}

function ensureSpace(doc, y, needed) {
  if (y + needed > PAGE_H - MARGIN) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

function formatDuration(h, m) {
  const hours = parseInt(h, 10);
  const minutes = parseInt(m, 10);
  if (!hours && !minutes) return null;
  const parts = [];
  if (hours)   parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  return parts.join(' ');
}
