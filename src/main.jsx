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

if (import.meta.env.PROD) {
  disableReactDevTools();
}

// تفعيل نظام المراقبة المحسن ونظام إجبار employee_code
improvedSystemMonitor.initialize();
enforceEmployeeCodeSystem();

// تفعيل Real-time عند بدء التطبيق (بدون إعادة تحميل)
setupRealtime(); // مفعّل لضمان التحديث اللحظي بدون إعادة تحميل

ReactDOM.createRoot(document.getElementById('root')).render(
  <AppProviders>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </AppProviders>
);