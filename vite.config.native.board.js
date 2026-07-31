import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import { renameSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Vite config for the Capacitor (Android) build of BBQ Board.
//
// Native counterpart to vite.config.board.js — same source code, but
// outputs root-relative asset paths (base='/') and emits to
// dist-board-native/ which is the webDir for the Board's Capacitor
// project at android-board/.

// The source HTML/CSS uses /board/-prefixed paths for the web build
// (which is served from holysmokesbbqco.com/board/). In the native
// build the WebView serves assets from the root, so those prefixes
// must be stripped or fonts + preload hints 404 silently and the app
// falls back to system fonts. The Notebook native build has the same
// bug in production (see index.html font paths); when that gets
// patched, mirror this rewrite there.
function fixupNativePaths() {
  return {
    name: 'fixup-board-native-paths',
    closeBundle() {
      const htmlPath = resolve('dist-board-native/index.board.html');
      if (existsSync(htmlPath)) {
        let html = readFileSync(htmlPath, 'utf8');
        html = html.replace(/\/board\//g, '/');
        writeFileSync(htmlPath, html);
      }
    },
  };
}

function renameBoardIndex() {
  return {
    name: 'rename-board-index',
    closeBundle() {
      const oldPath = resolve('dist-board-native/index.board.html');
      const newPath = resolve('dist-board-native/index.html');
      if (existsSync(oldPath)) {
        renameSync(oldPath, newPath);
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: '/',
  publicDir: 'public',
  define: {
    'import.meta.env.VITE_BOARD_BUILD': 'true',
  },
  plugins: [
    preact(),
    fixupNativePaths(),
    renameBoardIndex(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['bbq-board-logo.png', 'favicon.ico', 'board-icon-192.png', 'board-icon-512.png'],
      manifest: {
        name: 'BBQ Board by Holy Smokes BBQ Co',
        short_name: 'BBQ Board',
        description: 'Crowdsourced meat prices from local butchers, grocery counters, and warehouse clubs.',
        theme_color: '#1a1a1a',
        background_color: '#1a1a1a',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        orientation: 'any',
        categories: ['food', 'lifestyle', 'shopping'],
        icons: [
          { src: 'board-icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'board-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'board-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
  build: {
    outDir: 'dist-board-native',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: 'index.board.html',
      output: {
        entryFileNames: '[name].[hash].js',
        chunkFileNames: '[name].[hash].js',
        assetFileNames: '[name].[hash][extname]',
        manualChunks: {
          preact:   ['preact', 'preact/hooks', 'preact/compat'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
        },
      },
    },
  },
}));
