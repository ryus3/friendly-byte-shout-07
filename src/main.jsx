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
import { enforceEmployeeCodeSystem } from '@/utils/employeeCodeEnforcer.js';

if (import.meta.env.PROD) {
  disableReactDevTools();
}

// تفعيل نظام إجبار employee_code
enforceEmployeeCodeSystem();

// Real-time subscriptions يتم إدارتها بالكامل في SuperProvider لتجنب التضارب

ReactDOM.createRoot(document.getElementById('root')).render(
  <AppProviders>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </AppProviders>
);