// Generic thermometer-CSV parser.
//
// Most BBQ thermometer apps export sessions as a CSV with one row per
// reading. Column headers vary by brand but the shape is consistent:
//   - exactly one timestamp/datetime column
//   - one or more temperature columns (probe, food, ambient, pit)
//
// We auto-detect the timestamp column, treat every numeric column as a
// probe channel, and derive:
//   - Cook duration  (last timestamp − first timestamp)
//   - Peak food temp (the FOOD-named probe's max, or the lowest-max channel
//                     if no probe is named — food probes peak below pit)
//   - Peak pit/ambient temp (the highest-max channel)
//   - Cook started date/time
//
// We deliberately do NOT try to extract meat type, doneness, or rub —
// those aren't in any of these CSVs and the user picks them in the
// review form anyway.

const TIMESTAMP_HEADERS = [
  'timestamp', 'time', 'datetime', 'date_time', 'date', 'recorded_at', 'utc',
];

const FOOD_PROBE_HINTS = [
  'food', 'meat', 'internal', 'probe', 'product',
];

const PIT_PROBE_HINTS = [
  'pit', 'ambient', 'grill', 'cooker', 'smoker', 'oven', 'chamber',
];

export function parseThermometerCsv(rows, opts = {}) {
  if (!Array.isArray(rows) || rows.length < 2) {
    return { ok: false, reason: 'empty_csv' };
  }
  const headers = rows[0].map((h) => String(h || '').trim());
  const dataRows = rows.slice(1).filter(r => r.some(v => v !== '' && v != null));

  const tsCol = pickTimestampColumn(headers);
  if (tsCol < 0) {
    return { ok: false, reason: 'no_timestamp_column' };
  }

  // Identify temperature columns — anything numeric that isn't the
  // timestamp column. Tracks per-column min/max/mean across all rows.
  // Require at least 2 numeric readings (real cooks have hundreds, but
  // small test cases can be valid too).
  const minReadings = Math.max(2, Math.floor(dataRows.length * 0.1));
  const tempCols = [];
  for (let i = 0; i < headers.length; i++) {
    if (i === tsCol) continue;
    const stats = columnStats(dataRows, i);
    if (stats.count >= minReadings && stats.max > 0 && stats.max < 1000) {
      tempCols.push({ col: i, header: headers[i], ...stats });
    }
  }
  if (tempCols.length === 0) {
    return { ok: false, reason: 'no_temperature_columns' };
  }

  // Parse first + last timestamps to get duration + cook-started.
  const firstTs = parseTimestamp(dataRows[0][tsCol]);
  const lastTs  = parseTimestamp(dataRows[dataRows.length - 1][tsCol]);
  if (!firstTs || !lastTs) {
    return { ok: false, reason: 'unparseable_timestamps' };
  }
  const durationMs = lastTs.getTime() - firstTs.getTime();
  const totalMinutes = Math.max(0, Math.round(durationMs / 60000));

  // Pick food vs pit probe.
  const foodIdx = pickProbeByHint(tempCols, FOOD_PROBE_HINTS);
  const pitIdx  = pickProbeByHint(tempCols, PIT_PROBE_HINTS);

  let foodProbe, pitProbe;
  if (foodIdx >= 0) foodProbe = tempCols[foodIdx];
  if (pitIdx >= 0 && pitIdx !== foodIdx) pitProbe = tempCols[pitIdx];
  // Fallback heuristic — if names didn't disambiguate, the channel with
  // the lowest max is usually the food probe (it stops at the finish
  // temp), and the one with the highest max is the pit.
  if (!foodProbe && !pitProbe) {
    const sorted = [...tempCols].sort((a, b) => a.max - b.max);
    foodProbe = sorted[0];
    if (sorted.length > 1) pitProbe = sorted[sorted.length - 1];
  } else if (!foodProbe && tempCols.length > 1) {
    foodProbe = tempCols.find(c => c !== pitProbe);
  } else if (!pitProbe && tempCols.length > 1) {
    pitProbe = tempCols.find(c => c !== foodProbe);
  }

  return {
    ok: true,
    brand: opts.brandName || 'Thermometer',
    cookStartedDate: toIsoDate(firstTs),
    cookStartedTime: toIsoTime(firstTs),
    totalMinutes,
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
    foodProbe: foodProbe ? { name: foodProbe.header, peak: Math.round(foodProbe.max), avg: Math.round(foodProbe.avg) } : null,
    pitProbe:  pitProbe  ? { name: pitProbe.header,  peak: Math.round(pitProbe.max),  avg: Math.round(pitProbe.avg)  } : null,
    rowCount: dataRows.length,
  };
}

// ── Helpers ────────────────────────────────────────────────────

function pickTimestampColumn(headers) {
  const lower = headers.map(h => h.toLowerCase());
  for (const hint of TIMESTAMP_HEADERS) {
    const idx = lower.findIndex(h => h === hint || h.includes(hint));
    if (idx >= 0) return idx;
  }
  // Fallback — assume column 0 is the timestamp (most exports lead with it).
  return 0;
}

function pickProbeByHint(tempCols, hints) {
  const lower = tempCols.map(c => (c.header || '').toLowerCase());
  for (const hint of hints) {
    const idx = lower.findIndex(h => h.includes(hint));
    if (idx >= 0) return idx;
  }
  return -1;
}

function columnStats(rows, col) {
  let count = 0, sum = 0, max = -Infinity, min = Infinity;
  for (const r of rows) {
    const v = parseFloat(r[col]);
    if (Number.isFinite(v)) {
      count++;
      sum += v;
      if (v > max) max = v;
      if (v < min) min = v;
    }
  }
  return { count, max: max === -Infinity ? 0 : max, min: min === Infinity ? 0 : min, avg: count ? sum / count : 0 };
}

function parseTimestamp(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  // Reject bare numbers / very short strings — those aren't timestamps
  // even though Date.parse will happily turn "1" into Jan 1 of some
  // year. Require a date-like separator (-, /, T, :, space) to consider
  // it a timestamp candidate.
  if (!/[-/T: ]/.test(s)) return null;
  // Try Date.parse first — handles ISO 8601 and most common formats.
  const t = Date.parse(s);
  if (!Number.isNaN(t)) return new Date(t);
  // Fallback: "MM/DD/YYYY HH:MM:SS" or "YYYY-MM-DD HH:MM"
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[\sT](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  }
  const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m2) {
    let yr = +m2[3]; if (yr < 100) yr += 2000;
    return new Date(yr, +m2[1] - 1, +m2[2], +m2[4], +m2[5], +(m2[6] || 0));
  }
  return null;
}

function toIsoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toIsoTime(d) {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

// ── Output mapper ──────────────────────────────────────────────

export function csvResultToCookPatch(parsed) {
  if (!parsed.ok) {
    return {
      suggestedName: 'Imported cook',
      fields: {},
      confidence: {},
      error: parsed.reason,
    };
  }
  const dateLabel = parsed.cookStartedDate ? ` — ${formatDateShort(parsed.cookStartedDate)}` : '';
  const suggestedName = `${parsed.brand} cook${dateLabel}`;

  const fields = {};
  if (parsed.cookStartedDate) fields.date = parsed.cookStartedDate;
  if (parsed.foodProbe) fields.targetInternalTemp = String(parsed.foodProbe.peak);
  if (parsed.totalMinutes != null) {
    fields.cookTimeHours = String(parsed.hours);
    fields.cookTimeMinutes = String(parsed.minutes);
  }
  if (parsed.pitProbe) fields.cookTemp = String(parsed.pitProbe.avg);

  const notesLines = [`Imported from ${parsed.brand} (CSV).`];
  if (parsed.foodProbe) notesLines.push(`Food probe (${parsed.foodProbe.name}): peak ${parsed.foodProbe.peak}°F, avg ${parsed.foodProbe.avg}°F`);
  if (parsed.pitProbe)  notesLines.push(`Pit probe (${parsed.pitProbe.name}): peak ${parsed.pitProbe.peak}°F, avg ${parsed.pitProbe.avg}°F`);
  if (parsed.totalMinutes != null) notesLines.push(`Total time: ${parsed.hours}h ${parsed.minutes}m`);
  if (parsed.rowCount) notesLines.push(`${parsed.rowCount} temperature readings`);
  fields.notes = notesLines.join('\n');

  return {
    suggestedName,
    fields,
    confidence: {
      date: 0.95,
      finishTemp: parsed.foodProbe ? 0.85 : 0,
      cookTemp: parsed.pitProbe ? 0.85 : 0,
      duration: 0.95,
    },
  };
}

function formatDateShort(iso) {
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y.slice(2)}`;
}
