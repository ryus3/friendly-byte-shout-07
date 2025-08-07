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
import { initializeImprovedSystem } from '@/utils/improvedSystemMonitor.js';

if (import.meta.env.PROD) {
  disableReactDevTools();
}

// تفعيل النظام المحسن والحماية من الطلبات المنفصلة
initializeImprovedSystem();

// تفعيل Real-time عند بدء التطبيق (بدون إعادة تحميل)
// setupRealtime(); // معطل مؤقتاً لحل مشكلة التحديث المستمر

ReactDOM.createRoot(document.getElementById('root')).render(
  <AppProviders>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </AppProviders>
);