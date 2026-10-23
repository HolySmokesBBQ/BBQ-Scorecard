import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { renameSync, existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { boardCoveragePlugin } from '../scripts/board-coverage.mjs';

function renameBoardIndex() {
  return {
    name: 'rename-board-index',
    closeBundle() {
      const oldPath = resolve('dist/board/index.board.web.html');
      const newPath = resolve('dist/board/index.html');
      if (existsSync(oldPath)) renameSync(oldPath, newPath);
    },
  };
}

// `publicDir: 'public'` copies every file from public/ into dist/board/,
// which means sibling apps' policy/changelog pages end up served under
// /board/ (e.g. /board/privacy-notebook.html serving Notebook's content).
// A Play reviewer following a stale link into another app's policy is a
// listing-review risk. Mirror scripts/sync-board.mjs DEAD_ASSETS.
function cleanBoardDist() {
  const DEAD_ASSETS = [
    'changelog.html',
    'changelog-notebook.html',
    'privacy.html',
    'privacy-notebook.html',
    'delete-account.html',
    'delete-account-notebook.html',
  ];
  return {
    name: 'clean-board-dist',
    closeBundle() {
      for (const name of DEAD_ASSETS) {
        const file = resolve('dist/board', name);
        if (existsSync(file)) unlinkSync(file);
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: '/board/',
  publicDir: 'public',
  plugins: [preact(), renameBoardIndex(), cleanBoardDist(), boardCoveragePlugin(new URL('./src/board/schema.js', import.meta.url).href)],
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
  build: {
    outDir: 'dist/board',
    emptyOutDir: true,
    rollupOptions: {
      input: 'index.board.web.html',
      output: {
        entryFileNames: '[name].[hash].js',
        chunkFileNames: '[name].[hash].js',
        assetFileNames: '[name].[hash][extname]',
        manualChunks: {
          preact: ['preact', 'preact/hooks', 'preact/compat'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
        },
      },
    },
  },
}));
