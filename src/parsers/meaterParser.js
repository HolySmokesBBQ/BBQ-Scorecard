// MEATER Cook Summary parser — turns raw OCR text from a MEATER app
// screenshot into the fields BBQ Notebook's CookForm expects.
//
// Reference layout (anchors I extract by):
//   "Cook Summary"             — page title (presence = confidence boost)
//   "Rate your cook"           — appears above the stars (we ignore stars)
//   "Peak"  / "Target"         — paired with the temperature circles
//   "<MEAT>" + "<PRESET> NNN-NNN°" — under the DETAILS tab
//   "Cook Started: <date>"
//   "Total Duration: HH:MM:SS"
//
// Each parser returns a confidence score 0-1 alongside the value so the
// review UI can highlight low-confidence extractions for the user to
// double-check.

// Known MEATER meat presets — used to detect meat type from OCR text.
// MEATER uses these specific labels; matching on them is high-confidence.
const MEAT_PRESETS = [
  { meater: 'Beef Brisket',      notebook: 'Brisket' },
  { meater: 'Brisket Flat',      notebook: 'Brisket' },
  { meater: 'Brisket Point',     notebook: 'Brisket' },
  { meater: 'Brisket',           notebook: 'Brisket' },
  { meater: 'Pulled Pork',       notebook: 'Pulled Pork' },
  { meater: 'Pork Shoulder',     notebook: 'Pulled Pork' },
  { meater: 'Pork Butt',         notebook: 'Pulled Pork' },
  { meater: 'Pork Ribs',         notebook: 'St. Louis Ribs' },
  { meater: 'Beef Ribs',         notebook: 'Beef Ribs' },
  { meater: 'Baby Back Ribs',    notebook: 'Baby Back Ribs' },
  { meater: 'Chicken Breast',    notebook: 'Chicken Breast' },
  { meater: 'Chicken Thigh',     notebook: 'Chicken Thigh' },
  { meater: 'Chicken Wing',      notebook: 'Chicken Wings' },
  { meater: 'Whole Chicken',     notebook: 'Chicken (whole)' },
  { meater: 'Chicken',           notebook: 'Chicken (whole)' },
  { meater: 'Turkey Breast',     notebook: 'Turkey Breast' },
  { meater: 'Turkey',            notebook: 'Turkey (whole)' },
  { meater: 'Tri-tip',           notebook: 'Tri-tip' },
  { meater: 'Sausage',           notebook: 'Sausage' },
  { meater: 'Lamb',              notebook: 'Lamb' },
  { meater: 'Pork',              notebook: 'Pork' },
  { meater: 'Beef',              notebook: 'Beef' },
];

// MEATER doneness presets — extracted so we can surface them in notes
// since the Notebook doesn't have a "preset" field of its own.
const PRESETS = [
  'Rare', 'Medium Rare', 'Medium', 'Medium Well', 'Well Done',
  'Fall Apart', 'Fall Off The Bone', 'Slow Cook', 'Sear', 'Roast',
];

export function parseMEATERScreenshot(rawText) {
  // Normalize whitespace + case for matching. Keep original for display.
  const text = rawText.replace(/ /g, ' ');
  const normalized = text.replace(/\s+/g, ' ').trim();

  const targetRange = extractTargetRange(text);
  return {
    isMEATER: detectMEATER(text),
    meatType: extractMeatType(text),
    preset:   extractPreset(text),
    targetRange,
    peakTemp: extractPeakTemp(text, targetRange),
    targetTemp: extractTargetTemp(text, targetRange),
    cookStarted: extractCookStarted(text),
    totalDuration: extractTotalDuration(text),
    rawText,
  };
}

// Confidence boost — if OCR found "Cook Summary" or "MEATER" anywhere,
// we're almost certainly looking at a real MEATER screen. One anchor is
// enough to proceed — the review form handles partial extractions gracefully.
function detectMEATER(text) {
  const t = text.toLowerCase();
  const hits = [
    t.includes('cook summary'),
    t.includes('meater'),
    t.includes('rate your cook'),
    t.includes('total duration'),
    t.includes('cook started'),
    /\bpeak\b/.test(t) && /\btarget\b/.test(t),
  ].filter(Boolean).length;
  return { found: hits >= 1, confidence: Math.min(1, hits / 3) };
}

// OCR commonly misreads digits as letters in temperature/time numerals.
// Normalize a candidate digit substring before parseInt-ing it.
function fixOcrDigits(s) {
  return s
    .replace(/[Oo]/g, '0')
    .replace(/[lI|]/g, '1')
    .replace(/[Ss]/g, '5')
    .replace(/[Bb]/g, '8')
    .replace(/[Zz]/g, '2');
}

function extractMeatType(text) {
  // Match longest-first so "Beef Brisket" wins over plain "Beef".
  const sorted = [...MEAT_PRESETS].sort((a, b) => b.meater.length - a.meater.length);
  for (const { meater, notebook } of sorted) {
    const re = new RegExp(`\\b${escapeRegex(meater)}\\b`, 'i');
    if (re.test(text)) {
      return { value: notebook, source: meater, confidence: 0.95 };
    }
  }
  // Fallback — the line immediately before the doneness preset is the
  // meat name (often a user-customized label like "Flat (Bottom Rack").
  // Use it verbatim so the user keeps their own naming.
  const presetPattern = PRESETS.map(p => escapeRegex(p)).join('|');
  const re = new RegExp(`([^\\n]{2,40})\\n\\s*(?:${presetPattern})`, 'i');
  const m = text.match(re);
  if (m) {
    let raw = m[1]
      .replace(/^[^A-Za-z]+/, '')   // strip leading icon/emoji noise
      .replace(/[^A-Za-z0-9 ()\-'.]+$/, '')
      .trim();
    // OCR commonly truncates the closing paren on names like "Flat (Bottom Rack".
    // Auto-close so the saved cook name reads cleanly.
    const opens = (raw.match(/\(/g) || []).length;
    const closes = (raw.match(/\)/g) || []).length;
    if (opens > closes) raw += ')'.repeat(opens - closes);
    if (raw.length >= 2 && raw.length <= 40) {
      return { value: raw, source: 'custom', confidence: 0.55 };
    }
  }
  return { value: null, source: null, confidence: 0 };
}

function extractPreset(text) {
  for (const preset of PRESETS) {
    const re = new RegExp(`\\b${escapeRegex(preset)}\\b`, 'i');
    if (re.test(text)) {
      return { value: preset, confidence: 0.9 };
    }
  }
  return { value: null, confidence: 0 };
}

// "Fall Apart 200-205°" — pull the temperature range that follows the preset.
// OCR may read the dash as "—", "–", "~", or even a space; accept all.
function extractTargetRange(text) {
  const re = /(\d{2,3})\s*[-–—~]\s*(\d{2,3})\s*°?/;
  const m = text.match(re);
  if (m) return { low: +m[1], high: +m[2], confidence: 0.85 };
  return { low: null, high: null, confidence: 0 };
}

// "Peak 201°" — the circle in the top right. OCR for the circle digits is
// flaky and the graph y-axis labels (e.g. 247°, 281°) sit nearby in the OCR
// output, so we constrain the number to be plausible relative to the target
// range when we have it (within ±100° of mid-range). The screenshot itself
// is attached to the cook as a photo, so the user can read the exact value
// off the graph even if we mark this as uncertain.
function extractPeakTemp(text, targetRange) {
  return extractCircleTemp(text, /Peak/i, targetRange);
}

function extractTargetTemp(text, targetRange) {
  return extractCircleTemp(text, /Target/i, targetRange);
}

function extractCircleTemp(text, anchorRe, targetRange) {
  const idx = text.search(anchorRe);
  if (idx < 0) return { value: null, confidence: 0 };
  // Look BOTH before and after the anchor — MEATER's circles sit above
  // their labels, so OCR sometimes reads numbers earlier in the text.
  const around = text.slice(Math.max(0, idx - 80), idx + 80);
  const matches = [...around.matchAll(/([0-9OoIlSsBbZz]{2,3})\s*°/g)];
  const sane = (n) => {
    if (n < 60 || n > 400) return false;
    if (targetRange && targetRange.low && targetRange.high) {
      const mid = (targetRange.low + targetRange.high) / 2;
      return Math.abs(n - mid) <= 100;
    }
    return true;
  };
  for (const m of matches) {
    const n = parseInt(fixOcrDigits(m[1]), 10);
    if (sane(n)) return { value: n, confidence: 0.7 };
  }
  return { value: null, confidence: 0 };
}

// "Cook Started Mar 30, 2026 15:09" — normalize to ISO date.
function extractCookStarted(text) {
  // Match "Mar 30, 2026 15:09" style. MEATER displays "MMM DD, YYYY HH:MM".
  // OCR may drop the space after the comma ("Apr 19,2026") so make whitespace
  // around the comma fully optional.
  const re = /Cook\s+Started[\s:]*([A-Za-z]{3,9})\s+(\d{1,2})\s*,?\s*(\d{4})\s+(\d{1,2}):(\d{2})/i;
  const m = text.match(re);
  if (!m) {
    const fb = text.match(/([A-Za-z]{3,9})\s+(\d{1,2})\s*,?\s*(\d{4})\s+(\d{1,2}):(\d{2})/);
    if (fb) {
      const iso = toIsoDate(fb[1], +fb[2], +fb[3]);
      return iso ? { date: iso, time: `${String(fb[4]).padStart(2, '0')}:${fb[5]}`, confidence: 0.65 } : { date: null, time: null, confidence: 0 };
    }
    return { date: null, time: null, confidence: 0 };
  }
  const iso = toIsoDate(m[1], +m[2], +m[3]);
  return iso
    ? { date: iso, time: `${String(m[4]).padStart(2, '0')}:${m[5]}`, confidence: 0.9 }
    : { date: null, time: null, confidence: 0 };
}

// "Total Duration 03:41:20" → { hours: 3, minutes: 41, seconds: 20 }.
// Accept HH:MM:SS, HH:MM, or H:MM. OCR may read ":" as ";" or ".".
function extractTotalDuration(text) {
  const reFull = /Total\s+Duration[\s:]*(\d{1,2})[:;.](\d{2})[:;.](\d{2})/i;
  const m = text.match(reFull);
  if (m) return { hours: +m[1], minutes: +m[2], seconds: +m[3], confidence: 0.9 };
  // Fallback — accept HH:MM with no seconds.
  const reShort = /Total\s+Duration[\s:]*(\d{1,2})[:;.](\d{2})\b/i;
  const m2 = text.match(reShort);
  if (m2) return { hours: +m2[1], minutes: +m2[2], seconds: 0, confidence: 0.75 };
  return { hours: null, minutes: null, seconds: null, confidence: 0 };
}

// ── Helpers ──────────────────────────────────────────────────────

const MONTHS = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

function toIsoDate(month, day, year) {
  const mm = MONTHS[month.slice(0, 3).toLowerCase()];
  if (!mm) return null;
  return `${year}-${mm}-${String(day).padStart(2, '0')}`;
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Notebook field assembler ────────────────────────────────────

// Compose a CookForm-ready patch from the parsed result. Caller does
// the merge with currentCook (since "name" is suggested only — user can
// edit before the underlying form is shown).
export function meaterResultToCookPatch(parsed) {
  const meat = parsed.meatType.value;
  const date = parsed.cookStarted.date;
  const suggestedName = composeName(meat, date);

  const finishTemp = parsed.peakTemp.value || parsed.targetTemp.value;

  const totalMinutes =
    parsed.totalDuration.hours != null
      ? parsed.totalDuration.hours * 60 + parsed.totalDuration.minutes
      : null;

  const notes = composeNotes(parsed);

  return {
    suggestedName,
    fields: {
      ...(meat                   ? { meatType: meat }                                          : {}),
      ...(date                   ? { date }                                                    : {}),
      ...(finishTemp             ? { targetInternalTemp: String(finishTemp) }                  : {}),
      ...(totalMinutes != null   ? {
        cookTimeHours:   String(parsed.totalDuration.hours),
        cookTimeMinutes: String(parsed.totalDuration.minutes),
      } : {}),
      ...(notes                  ? { notes }                                                   : {}),
    },
    confidence: {
      meatType:      parsed.meatType.confidence,
      date:          parsed.cookStarted.confidence,
      finishTemp:    Math.max(parsed.peakTemp.confidence, parsed.targetTemp.confidence),
      duration:      parsed.totalDuration.confidence,
    },
  };
}

function composeName(meat, date) {
  if (meat && date) return `${meat} — ${formatDateShort(date)}`;
  if (meat) return `${meat} cook`;
  return 'Imported cook';
}

function formatDateShort(iso) {
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y.slice(2)}`;
}

function composeNotes(parsed) {
  const lines = [];
  lines.push('Imported from MEATER.');
  if (parsed.preset.value) {
    const range = parsed.targetRange.low && parsed.targetRange.high
      ? ` (${parsed.targetRange.low}-${parsed.targetRange.high}°F)`
      : '';
    lines.push(`Preset: ${parsed.preset.value}${range}`);
  }
  if (parsed.cookStarted.time) {
    lines.push(`Cook started: ${parsed.cookStarted.time}`);
  }
  if (parsed.totalDuration.seconds != null) {
    const { hours, minutes, seconds } = parsed.totalDuration;
    lines.push(`Total time: ${hours}h ${minutes}m ${seconds}s`);
  }
  if (parsed.peakTemp.value)   lines.push(`Peak temp: ${parsed.peakTemp.value}°F`);
  if (parsed.targetTemp.value) lines.push(`Target temp: ${parsed.targetTemp.value}°F`);
  return lines.join('\n');
}
