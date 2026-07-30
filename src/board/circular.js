// Circular OCR shared logic — used by both the Node CLI and the
// in-browser panel so cut/price detection stays consistent across
// both entry points.

import { CUTS } from './schema.js';

// Keyword → cut mapping. Order matters: match more specific phrases
// before falling back to bare cut names.
const CUT_KEYWORDS = [
  { cut: 'brisket_prime',   patterns: [/prime.*brisket/i, /brisket.*prime/i] },
  { cut: 'brisket_choice',  patterns: [/choice.*brisket/i, /brisket.*choice/i] },
  { cut: 'brisket_select',  patterns: [/select.*brisket/i, /brisket.*select/i] },
  { cut: 'brisket_choice',  patterns: [/whole.*brisket/i, /packer.*brisket/i, /\bbrisket\b/i] },
  { cut: 'pork_shoulder',   patterns: [/boston.*butt/i, /pork.*shoulder/i, /pork.*butt/i] },
  { cut: 'spare_ribs',      patterns: [/st\.?\s*louis.*ribs/i, /spare.*ribs/i] },
  { cut: 'baby_back_ribs',  patterns: [/baby.*back.*ribs/i, /back.*ribs/i] },
  { cut: 'whole_chicken',   patterns: [/whole.*chicken/i, /whole.*fryer/i] },
  { cut: 'chicken_breast',  patterns: [/boneless.*skinless.*chicken.*breast/i, /chicken.*breast.*boneless/i, /chicken.*breast/i, /breast.*chicken/i] },
  { cut: 'whole_turkey',    patterns: [/whole.*turkey/i] },
  // Steaks. Order matters — specific cuts first, generic "steak" only as fallback.
  { cut: 'filet_mignon',    patterns: [/filet\s*mignon/i, /\bfilet\b/i, /\btenderloin\s*steak/i] },
  { cut: 'porterhouse',     patterns: [/porterhouse/i] },
  { cut: 'tbone',           patterns: [/\bt[\-\s]?bone\b/i, /\btbone\s*steak/i] },
  { cut: 'ribeye',          patterns: [/rib\s*eye/i, /ribeye/i, /\brib\s*steak/i] },
  { cut: 'flank',           patterns: [/flank\s*steak/i, /\bflank\b/i] },
  { cut: 'sirloin',         patterns: [/top\s*sirloin/i, /sirloin\s*steak/i, /\bsirloin\b/i] },
  { cut: 'chuck_roast',     patterns: [/chuck\s*roast/i, /pot\s*roast/i, /\bchuck\b/i] },
  { cut: 'tri_tip',         patterns: [/tri.?tip/i] },
  { cut: 'ground_beef_80',  patterns: [/ground.*beef.*80/i, /80.*20.*ground/i, /ground.*chuck/i] },
  // "Smoked" before "fresh" so smoked brats win when both words hit.
  // "Bratwurst" and "brats" both trigger; guard against "brat" alone
  // matching random words by requiring the plural "brats" or full word.
  { cut: 'bratwurst_smoked', patterns: [/smoked.*bratwurst/i, /smoked.*brats?\b/i, /cooked.*brats?\b/i] },
  { cut: 'bratwurst_fresh',  patterns: [/fresh.*bratwurst/i, /\bbratwurst\b/i, /\bbrats\b/i] },
];

const PRICE_PATTERNS = [
  /\$?\s*(\d{1,2}\.\d{2})\s*\/?\s*(?:lb|LB|Lb|per\s+(?:pound|lb))/g,
];

function detectCut(context) {
  for (const { cut, patterns } of CUT_KEYWORDS) {
    for (const p of patterns) if (p.test(context)) return cut;
  }
  return null;
}

// Extract per-pound prices from OCR text. Returns an array of
// { cut, pricePerLb, context } where context is the surrounding phrase.
export function extractPricedPhrases(rawText) {
  const results = [];
  const text = (rawText || '').replace(/\s+/g, ' ');
  for (const pattern of PRICE_PATTERNS) {
    const p = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = p.exec(text)) !== null) {
      const price = parseFloat(match[1]);
      if (!(price > 0) || price > 100) continue;
      const start = Math.max(0, match.index - 80);
      const end = Math.min(text.length, match.index + match[0].length + 20);
      const context = text.slice(start, end);
      const cut = detectCut(context);
      if (!cut) continue;
      results.push({ cut, cutLabel: CUTS[cut]?.label, pricePerLb: price, context: context.trim() });
    }
  }
  const seen = new Set();
  return results.filter(r => {
    const key = `${r.cut}::${r.pricePerLb}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
