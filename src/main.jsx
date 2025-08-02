// Polyfill Web APIs for compatibility
if (!globalThis.Headers) {
  globalThis.Headers = class Headers {
    constructor(init) {
      this.map = new Map();
      if (init) {
        if (typeof init === "object") {
          for (const [key, value] of Object.entries(init)) {
            this.map.set(key.toLowerCase(), value);
          }
        }
      }
    }
    get(name) { return this.map.get(name.toLowerCase()) || null; }
    set(name, value) { this.map.set(name.toLowerCase(), value); }
    has(name) { return this.map.has(name.toLowerCase()); }
    delete(name) { return this.map.delete(name.toLowerCase()); }
    forEach(callback) { this.map.forEach((value, key) => callback(value, key, this)); }
    entries() { return this.map.entries(); }
    keys() { return this.map.keys(); }
    values() { return this.map.values(); }
  };
}

if (!globalThis.Request) {
  globalThis.Request = class Request {
    constructor(input, options = {}) {
      this.url = input;
      this.method = options.method || "GET";
      this.headers = new globalThis.Headers(options.headers);
      this.body = options.body;
    }
  };
}

if (!globalThis.Response) {
  globalThis.Response = class Response {
    constructor(body, options = {}) {
      this.body = body;
      this.status = options.status || 200;
      this.statusText = options.statusText || "OK";
      this.headers = new globalThis.Headers(options.headers);
    }
    json() { return Promise.resolve(JSON.parse(this.body)); }
    text() { return Promise.resolve(this.body); }
  };
}

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

if (import.meta.env.PROD) {
  disableReactDevTools();
}

// تفعيل Real-time عند بدء التطبيق (بدون إعادة تحميل)
// setupRealtime(); // معطل مؤقتاً لحل مشكلة التحديث المستمر

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProviders>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppProviders>
  </React.StrictMode>
);