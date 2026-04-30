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
import { setupOfflineSync } from '@/utils/offlineSync.js';
// 🚀 تعطيل devLog.log في Production لتحسين الأداء
import '@/utils/cleanConsole.js';
import devLog from '@/lib/devLogger';

if (import.meta.env.PROD) {
  disableReactDevTools();
}

// تفعيل نظام إجبار employee_code
enforceEmployeeCodeSystem();

// Real-time subscriptions يتم إدارتها بالكامل في SuperProvider لتجنب التضارب

// ✅ تسجيل Service Worker — تحديث صامت بدون إزعاج المستخدم
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', {
        scope: '/',
        updateViaCache: 'none'
      })
      .then(registration => {
        // ✅ تحديث كل 6 ساعات (بدلاً من كل ساعة لتقليل العبء)
        setInterval(() => {
          registration.update().catch(() => {});
        }, 6 * 60 * 60 * 1000);

        // ✅ تطبيق التحديث تلقائياً بصمت — يبقى المستخدم مسجلاً، لا confirm() ولا reload
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // طبّق SW الجديد عند فتح الصفحة المرة القادمة طبيعياً
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch(() => {
        // Silent fail in production
      });
  });

  // ✅ معالجة رسائل SW
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SYNC_PENDING_ORDERS') {
      // Silent handling
    }
  });
}

// ✅ تفعيل نظام المزامنة Offline
setupOfflineSync();

ReactDOM.createRoot(document.getElementById('root')).render(
  <AppProviders>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </AppProviders>
);