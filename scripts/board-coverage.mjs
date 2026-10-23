// Board's coverage counts for static HTML (the pre-render that shows before
// the app loads, and what crawlers read). Ruling of record (Security auditor,
// 2026-10-23): schema.js at build time is the single source of truth for
// every Board count site-wide. The pre-render used to hand-list the 8
// launch cities while schema.js had grown to 109 cities in 24 states.
//
// HTML carries %BOARD_CITY_COUNT% and %BOARD_STATE_COUNT%; the Vite plugin
// below fills them from the CITIES export of whichever schema.js that build
// uses (src/board for native, website/src/board for the website).

export const COVERAGE_TOKENS = {
  cities: '%BOARD_CITY_COUNT%',
  states: '%BOARD_STATE_COUNT%',
};

export function boardCoverage(cities) {
  const list = Object.values(cities);
  return {
    cityCount: list.length,
    stateCount: new Set(list.map((c) => c.state)).size,
  };
}

export function fillCoverageTokens(html, { cityCount, stateCount }) {
  return html
    .replaceAll(COVERAGE_TOKENS.cities, String(cityCount))
    .replaceAll(COVERAGE_TOKENS.states, String(stateCount));
}

// schemaUrl: an absolute file URL or path Vite can import.
export function boardCoveragePlugin(schemaPath) {
  return {
    name: 'board-coverage',
    async transformIndexHtml(html) {
      const { CITIES } = await import(/* @vite-ignore */ schemaPath);
      return fillCoverageTokens(html, boardCoverage(CITIES));
    },
  };
}
