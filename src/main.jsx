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
// 🚀 تعطيل console.log في Production لتحسين الأداء
import '@/utils/cleanConsole.js';

if (import.meta.env.PROD) {
  disableReactDevTools();
}

// تفعيل نظام إجبار employee_code
enforceEmployeeCodeSystem();

// Real-time subscriptions يتم إدارتها بالكامل في SuperProvider لتجنب التضارب

// ✅ تسجيل Service Worker المحسن
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { 
        scope: '/',
        updateViaCache: 'none' // ✅ عدم استخدام cache للـ SW نفسه
      })
      .then(registration => {
        // ✅ التحقق من التحديثات كل ساعة
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);
        
        // ✅ معالجة SW الجديد
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // ✅ إشعار المستخدم بالتحديث
              if (confirm('يوجد تحديث جديد للتطبيق. هل تريد التحديث الآن؟')) {
                newWorker.postMessage({ type: 'SKIP_WAITING' });
                window.location.reload();
              }
            }
          });
        });
      })
      .catch(() => {
        // Silent fail in production
      });
  });
  
  // ✅ لا إعادة تحميل تلقائية عند تفعيل SW جديد - يحافظ على الجلسة
  // المستخدم سيحصل على آخر نسخة عند فتح صفحة جديدة طبيعياً
  
  // ✅ معالجة رسائل SW
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SYNC_PENDING_ORDERS') {
      // Silent handling - no console log
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