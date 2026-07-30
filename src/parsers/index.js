// Brand registry — single source of truth for the Import flow.
// Each entry tells the UI: which import method this brand uses, what
// to label it, what to tell the user about how to get the file, and
// which parser function to call.

import { parseMEATERScreenshot, meaterResultToCookPatch } from './meaterParser.js';
import { parseThermometerCsv, csvResultToCookPatch } from './genericCsvParser.js';

export const BRANDS = [
  {
    id: 'meater',
    label: 'MEATER',
    method: 'ocr',
    fileAccept: 'image/*',
    description: 'Screenshot of the MEATER Cook Summary screen',
    guide: [
      'Open the MEATER app and find the cook in your Cook Library.',
      'Tap to open the Cook Summary — the screen with the temperature graph, “Peak” and “Target” circles, “Cook Started” date, and “Total Duration” at the bottom.',
      'Screenshot the whole screen (Power + Volume Down on most Androids).',
      'Come back here and pick the screenshot from your gallery.',
    ],
    parse: (text) => meaterResultToCookPatch(parseMEATERScreenshot(text)),
  },
  {
    id: 'fireboard',
    label: 'FireBoard',
    method: 'csv',
    fileAccept: '.csv,text/csv',
    description: 'Session CSV exported from the FireBoard app',
    guide: [
      'Open the FireBoard app → Sessions tab.',
      'Tap the session you want to import.',
      'Tap the share/export icon → choose CSV.',
      'Save or share to your phone, then pick the CSV here.',
    ],
    csvHints: { brandName: 'FireBoard' },
    parse: (rows) => csvResultToCookPatch(parseThermometerCsv(rows, { brandName: 'FireBoard' })),
  },
  {
    id: 'thermoworks',
    label: 'ThermoWorks',
    method: 'csv',
    fileAccept: '.csv,text/csv',
    description: 'Session CSV exported from ThermoWorks Cloud',
    guide: [
      'Open ThermoWorks Cloud in a browser (cloud.thermoworks.com).',
      'Pick the session under Sessions or Saved Sessions.',
      'Use the top-right menu → Export → CSV.',
      'Get the CSV onto your phone (email, drive, AirDrop), then pick it here.',
    ],
    csvHints: { brandName: 'ThermoWorks' },
    parse: (rows) => csvResultToCookPatch(parseThermometerCsv(rows, { brandName: 'ThermoWorks' })),
  },
  {
    id: 'weber',
    label: 'Weber Connect',
    method: 'csv',
    fileAccept: '.csv,text/csv',
    description: 'Graph data CSV exported from the Weber Connect app',
    guide: [
      'Open the Weber Connect app and find the live or recent cook.',
      'Tap the graph → share / export → CSV.',
      'Save to your phone, then pick the CSV here.',
    ],
    csvHints: { brandName: 'Weber Connect' },
    parse: (rows) => csvResultToCookPatch(parseThermometerCsv(rows, { brandName: 'Weber Connect' })),
  },
  {
    id: 'inkbird',
    label: 'Inkbird',
    method: 'ocr',
    fileAccept: 'image/*',
    description: 'Screenshot of the Inkbird app cook history graph',
    guide: [
      'Open the Inkbird app and tap the cook you want to import.',
      'Scroll down so the temperature graph and the date/duration are visible.',
      'Screenshot the screen and pick it here.',
      'Heads up: Inkbird stores limited history (~30 min for some models), so it may only work right after the cook.',
    ],
    parse: (text) => meaterResultToCookPatch(parseMEATERScreenshot(text)),
  },
  {
    id: 'combustion',
    label: 'Combustion',
    method: 'ocr',
    fileAccept: 'image/*',
    description: 'Screenshot of a Combustion Predictive Thermometer cook session',
    guide: [
      'Open the Combustion app and find the cook in your session history.',
      'Scroll to the screen showing the temperature gradient card with cook duration and final temp.',
      'Screenshot the screen and pick it here.',
    ],
    parse: (text) => meaterResultToCookPatch(parseMEATERScreenshot(text)),
  },
  {
    id: 'thermopro',
    label: 'ThermoPro',
    method: 'ocr',
    fileAccept: 'image/*',
    description: 'Screenshot of the ThermoPro app cook history graph',
    guide: [
      'Open the ThermoPro app (TempSpike, Twin TempSpike, TP-25, TP-27, etc.).',
      'Find the cook in your history and open the graph view.',
      'Screenshot the screen with the graph + duration visible and pick it here.',
    ],
    parse: (text) => meaterResultToCookPatch(parseMEATERScreenshot(text)),
  },
  {
    id: 'govee',
    label: 'Govee',
    method: 'ocr',
    fileAccept: 'image/*',
    description: 'Screenshot of the Govee Home app cook history graph',
    guide: [
      'Open the Govee Home app and tap your BBQ thermometer device.',
      'Open the data history / graph view for the cook.',
      'Screenshot the screen with temperature + duration visible and pick it here.',
    ],
    parse: (text) => meaterResultToCookPatch(parseMEATERScreenshot(text)),
  },
  {
    id: 'maverick',
    label: 'Maverick',
    method: 'ocr',
    fileAccept: 'image/*',
    description: 'Screenshot of the Maverick app cook history graph (XR-50, ET-735, etc.)',
    guide: [
      'Open the Maverick app and find the cook in your history.',
      'Open the temperature graph for the session.',
      'Screenshot the screen with the graph + cook details visible and pick it here.',
    ],
    parse: (text) => meaterResultToCookPatch(parseMEATERScreenshot(text)),
  },
  {
    id: 'chefstemp',
    label: 'ChefsTemp',
    method: 'ocr',
    fileAccept: 'image/*',
    description: 'Screenshot of the ChefsTemp app cook history (ProTemp Plus, Finaltouch X10, etc.)',
    guide: [
      'Open the ChefsTemp app and find the cook in your history.',
      'Open the temperature graph view for the session.',
      'Screenshot the screen with the temperature graph + duration + finish temp visible.',
      'Pick the screenshot here — we extract what we can read.',
    ],
    parse: (text) => meaterResultToCookPatch(parseMEATERScreenshot(text)),
  },
  {
    id: 'other',
    label: 'Other / generic CSV',
    method: 'csv',
    fileAccept: '.csv,text/csv',
    description: 'Any CSV with a timestamp column + one or more temperature columns',
    guide: [
      'Export a CSV from your thermometer app or device.',
      'Make sure there is a column with timestamps (date+time) and at least one temperature column.',
      'Pick the CSV here — we will extract cook duration and peak temps.',
    ],
    csvHints: {},
    parse: (rows) => csvResultToCookPatch(parseThermometerCsv(rows, {})),
  },
];

export function getBrand(id) {
  return BRANDS.find(b => b.id === id) || null;
}
