import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// Using Preact via preact/compat aliasing. Preact (~3 KB gz) is a drop-in
// replacement for React (~45 KB gz). Same API surface for typical apps;
// only edge-case React 18 concurrent features differ — we don't use them.
// 42 KB bundle savings on initial load.

export default defineConfig(({ mode }) => ({
  // Web build serves the Scorecard at holysmokesbbqco.com/scorecard/ now,
  // alongside the Notebook at /notebook/, with a brand landing at /.
  // The native (Capacitor) build uses vite.config.native.js with base='/'
  // because the Android webview shouldn't have a /scorecard/ prefix in
  // its internal URLs.
  base: '/scorecard/',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icon-192.png', 'icon-512.png', 'holy-smokes-logo.png'],
      // The Scorecard service worker now lives at /scorecard/ scope so
      // it only intercepts navigations inside its own app, not the
      // brand landing at / or the Notebook at /notebook/.
      scope: '/scorecard/',
      base: '/scorecard/',
      workbox: {
        // Belt-and-suspenders: also exclude the brand root and the
        // Notebook path explicitly, in case the SW gets installed and
        // tries to claim a broader scope.
        navigateFallbackDenylist: [/^\/notebook(\/|$)/, /^\/$/],
      },
      manifest: {
        name: 'BBQ Scorecard by Holy Smokes BBQ Co',
        short_name: 'BBQ Scorecard',
        description: 'Competition-style BBQ restaurant review system. Score restaurants on 10 categories, track visits, add friends, and compare on the leaderboard.',
        theme_color: '#1a1a1a',
        background_color: '#1a1a1a',
        display: 'standalone',
        start_url: '/scorecard/',
        scope: '/scorecard/',
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
  // Strip console.* and debugger statements from production builds.
  // Keeps logs in dev for debugging; removes them from shipped bundles
  // so internal errors and user IDs aren't exposed in browser consoles.
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
  build: {
    outDir: 'dist/scorecard',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        entryFileNames: '[name].[hash].js',
        chunkFileNames: '[name].[hash].js',
        assetFileNames: '[name].[hash][extname]',
        // Manual chunking — splits heavy shared dependencies so the
        // browser can cache them independently and parallelize downloads.
        // The landing page (Site) only needs `react`; everything else
        // lazy-loads as needed.
        manualChunks: {
          // Preact's compat layer satisfies all `import ... from 'react'`
          // calls in our codebase; the chunk is just the runtime.
          preact:   ['preact', 'preact/hooks', 'preact/compat'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage', 'firebase/app-check', 'firebase/performance'],
          leaflet:  ['leaflet'],
        },
      },
    },
  },
}));
