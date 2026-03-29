import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Apply dark mode synchronously before React renders to avoid flash
const saved = localStorage.getItem('theme');
if (saved === 'dark') {
  document.documentElement.classList.add('dark');
} else if (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.documentElement.classList.add('dark');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
