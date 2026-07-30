import React from 'react';
import ReactDOM from 'react-dom/client';
import BoardApp from './App.board.jsx';
import { initDiagnostics } from './diagnostics.js';

initDiagnostics();

ReactDOM.createRoot(document.getElementById('root')).render(<BoardApp />);
