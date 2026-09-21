import React from 'react';
import ReactDOM from 'react-dom/client';
import BoardApp from './App.board.jsx';
import { ErrorBoundary } from './board/ErrorBoundary.jsx';
import { initDiagnostics } from './diagnostics.js';

initDiagnostics();

// The boundary sits outside BoardApp so a throw anywhere in the tree —
// including BoardApp's own render — lands on the fallback panel instead
// of a blank screen.
ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <BoardApp />
  </ErrorBoundary>,
);
