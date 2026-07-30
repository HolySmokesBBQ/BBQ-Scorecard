import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

// Scorecard doesn't use OCR — the tesseract WASM/traineddata blobs
// in public/ are for the Notebook build only. Vite's default copies
// everything from public/ into every build's outDir. Left alone,
// the tesseract files add ~24 MB of dead weight to every Scorecard
// AAB (~9 MB → ~29 MB, tripling install size for zero user value).
// This plugin nukes them from dist-native after Vite copies them.
function stripTesseract() {
  return {
    name: 'strip-tesseract',
    closeBundle() {
      try { rmSync(resolve('dist-native/tesseract'), { recursive: true, force: true }); } catch {}
    },
  };
}

// Vite config for the Capacitor (Android) build of BBQ Scorecard.
//
// Why a separate config from the web one (vite.config.js):
//   - Web Scorecard now lives at holysmokesbbqco.com/scorecard/ — so
//     its bundle references /scorecard/main.js etc.
//   - Android's Capacitor webview loads from https://localhost/ via
//     the WebViewLocalServer. Asset URLs need to be root-relative
//     (no /scorecard/ prefix) so the webview can find them inside
//     android/app/src/main/assets/public/.
//
// This config outputs to dist-native/ which is what
// `capacitor.config.ts` points at via `webDir: 'dist-native'`.
// Run with `npm run build:native` before `npx cap sync android`.

export default defineConfig(({ mode }) => ({
  base: '/',
  plugins: [
    preact(),
    stripTesseract(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icon-192.png', 'icon-512.png', 'holy-smokes-logo.png'],
      manifest: {
        name: 'BBQ Scorecard by Holy Smokes BBQ Co',
        short_name: 'BBQ Scorecard',
        description: 'Competition-style BBQ restaurant review system.',
        theme_color: '#1a1a1a',
        background_color: '#1a1a1a',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        orientation: 'any',
        categories: ['food', 'lifestyle'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
  build: {
    outDir: 'dist-native',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        entryFileNames: '[name].[hash].js',
        chunkFileNames: '[name].[hash].js',
        assetFileNames: '[name].[hash][extname]',
        manualChunks: {
          preact:   ['preact', 'preact/hooks', 'preact/compat'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage', 'firebase/app-check', 'firebase/performance'],
          leaflet:  ['leaflet'],
        },
      },
    },
  },
}));
