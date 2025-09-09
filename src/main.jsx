import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from '@/App.jsx';
import { AppProviders } from '@/contexts/Providers.jsx';
import '@/index.css';
import '@/print.css';
import 'react-day-picker/dist/style.css';
import { disableReactDevTools } from '@fvilers/disable-react-devtools';
import { setupRealtime } from '@/utils/realtime-setup.js';
import { improvedSystemMonitor } from '@/utils/improvedSystemMonitor.js';
import { enforceEmployeeCodeSystem } from '@/utils/employeeCodeEnforcer.js';

// Performance optimization - disable React DevTools in production
if (import.meta.env.PROD) {
  disableReactDevTools();
}

// Defer non-critical initializations to avoid blocking FCP
const initializeNonCriticalSystems = () => {
  improvedSystemMonitor.initialize();
  enforceEmployeeCodeSystem();
  setupRealtime();
};

// Use requestIdleCallback for deferred initialization, with fallback
if (typeof requestIdleCallback !== 'undefined') {
  requestIdleCallback(initializeNonCriticalSystems, { timeout: 2000 });
} else {
  setTimeout(initializeNonCriticalSystems, 100);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <AppProviders>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </AppProviders>
);