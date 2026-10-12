// Board's Android project is wired by hand: android-board/capacitor.settings.gradle
// and app/capacitor.build.gradle carry "DO NOT EDIT, generated" headers, but
// Board's custom sync (scripts/sync-board.mjs) never regenerates them. When a
// plugin Board's code imports is missing from them, nothing fails: every
// call site falls back quietly. That is how Report a problem's native share
// (src/diagnostics.js imports @capacitor/filesystem and @capacitor/share)
// degraded to a mailto draft in every Board build until 2.4.7. A plugin
// listed but not compiled would at least fail the build; this test covers
// the silent direction.

import { test, expect } from 'vitest';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { BOARD_NATIVE_PLUGINS } from '../../scripts/board-native-assets.mjs';

const ROOT = resolve(__dirname, '../..');
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');

// '@capacitor/share' -> 'capacitor-share'; '@capacitor-firebase/analytics' -> 'capacitor-firebase-analytics'
const gradleName = (pkg) => pkg.replace(/^@/, '').replace('/', '-');

function importedCapacitorPlugins() {
  const seen = new Set();
  const pkgs = new Set();
  const walk = (f) => {
    if (seen.has(f)) return;
    seen.add(f);
    for (const m of readFileSync(f, 'utf8').matchAll(/(?:from\s*|import\s*\(\s*)['"]([^'"]+)['"]/g)) {
      const spec = m[1];
      if (/^@capacitor(-firebase)?\/[\w-]+$/.test(spec)) { pkgs.add(spec); continue; }
      if (!spec.startsWith('.')) continue;
      const base = resolve(dirname(f), spec);
      const hit = [base, base + '.js', base + '.jsx', join(base, 'index.js')].find(c => existsSync(c) && statSync(c).isFile());
      if (hit) walk(hit);
    }
  };
  walk(resolve(ROOT, 'src/main.board.jsx'));
  // @capacitor/core is the bridge itself, not a plugin.
  pkgs.delete('@capacitor/core');
  return [...pkgs].sort();
}

const listed = BOARD_NATIVE_PLUGINS.map(p => p.pkg).sort();

test('every Capacitor plugin Board imports is compiled into the Android build', () => {
  const missing = importedCapacitorPlugins().filter(p => !listed.includes(p));
  expect(missing, 'add to BOARD_NATIVE_PLUGINS and both gradle files').toEqual([]);
});

test('capacitor.settings.gradle includes exactly the listed plugins', () => {
  const included = [...read('android-board/capacitor.settings.gradle').matchAll(/include ':(capacitor-[\w-]+)'/g)]
    .map(m => m[1]).filter(n => n !== 'capacitor-android').sort();
  expect(included).toEqual(listed.map(gradleName).sort());
});

test('app/capacitor.build.gradle implements exactly the listed plugins', () => {
  const impl = [...read('android-board/app/capacitor.build.gradle').matchAll(/implementation project\(':(capacitor-[\w-]+)'\)/g)]
    .map(m => m[1]).sort();
  expect(impl).toEqual(listed.map(gradleName).sort());
});

test('each listed plugin is installed and its classpath names a real plugin class', () => {
  for (const { pkg, classpath } of BOARD_NATIVE_PLUGINS) {
    const androidDir = resolve(ROOT, 'node_modules', pkg, 'android');
    expect(existsSync(androidDir), `${pkg} has no android/ project`).toBe(true);
    const className = classpath.split('.').pop();
    const found = (function search(dir) {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) { if (search(p)) return true; }
        else if (e.name === `${className}.java` || e.name === `${className}.kt`) return true;
      }
      return false;
    })(androidDir);
    expect(found, `${classpath} not found in ${pkg}`).toBe(true);
  }
});
