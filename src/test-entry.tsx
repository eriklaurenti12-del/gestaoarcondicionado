console.log('[TEST-VERSION-99] This is a FRESH execution');
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('root');
  if (root) {
    console.log('[TEST-VERSION-99] Mounting App...');
    createRoot(root).render(<App />);
  }
});
