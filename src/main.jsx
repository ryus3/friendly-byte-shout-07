// إعداد polyfill للـ Web APIs قبل كل شيء
(() => {
  // Headers polyfill
  if (typeof globalThis !== 'undefined' && !globalThis.Headers) {
    globalThis.Headers = class Headers {
      constructor(init) {
        this._headers = new Map();
        if (init) {
          if (init instanceof Headers) {
            init.forEach((value, key) => this.set(key, value));
          } else if (Array.isArray(init)) {
            init.forEach(([key, value]) => this.set(key, value));
          } else if (init && typeof init === 'object') {
            Object.entries(init).forEach(([key, value]) => this.set(key, value));
          }
        }
      }
      
      append(name, value) {
        const existing = this._headers.get(name.toLowerCase());
        this._headers.set(name.toLowerCase(), existing ? `${existing}, ${value}` : String(value));
      }
      
      delete(name) {
        this._headers.delete(name.toLowerCase());
      }
      
      get(name) {
        return this._headers.get(name.toLowerCase()) || null;
      }
      
      has(name) {
        return this._headers.has(name.toLowerCase());
      }
      
      set(name, value) {
        this._headers.set(name.toLowerCase(), String(value));
      }
      
      forEach(callback, thisArg) {
        this._headers.forEach((value, key) => callback.call(thisArg, value, key, this));
      }
      
      *entries() {
        yield* this._headers.entries();
      }
      
      *keys() {
        yield* this._headers.keys();
      }
      
      *values() {
        yield* this._headers.values();
      }
      
      [Symbol.iterator]() {
        return this.entries();
      }
    };
  }

  // Request polyfill
  if (typeof globalThis !== 'undefined' && !globalThis.Request) {
    globalThis.Request = class Request {
      constructor(input, options = {}) {
        this.url = typeof input === 'string' ? input : input.url;
        this.method = options.method || 'GET';
        this.headers = new globalThis.Headers(options.headers);
        this.body = options.body || null;
        this.credentials = options.credentials || 'same-origin';
        this.cache = options.cache || 'default';
        this.redirect = options.redirect || 'follow';
        this.referrer = options.referrer || 'about:client';
        this.mode = options.mode || 'cors';
      }
      
      clone() {
        return new Request(this.url, {
          method: this.method,
          headers: this.headers,
          body: this.body,
          credentials: this.credentials,
          cache: this.cache,
          redirect: this.redirect,
          referrer: this.referrer,
          mode: this.mode
        });
      }
    };
  }

  // Response polyfill
  if (typeof globalThis !== 'undefined' && !globalThis.Response) {
    globalThis.Response = class Response {
      constructor(body, options = {}) {
        this.body = body;
        this.status = options.status || 200;
        this.statusText = options.statusText || 'OK';
        this.headers = new globalThis.Headers(options.headers);
        this.ok = this.status >= 200 && this.status < 300;
        this.redirected = false;
        this.type = 'basic';
        this.url = '';
      }
      
      clone() {
        return new Response(this.body, {
          status: this.status,
          statusText: this.statusText,
          headers: this.headers
        });
      }
      
      async json() {
        return JSON.parse(this.body);
      }
      
      async text() {
        return String(this.body);
      }
      
      async blob() {
        return new Blob([this.body]);
      }
      
      async arrayBuffer() {
        return new ArrayBuffer(this.body.length);
      }
    };
  }
})();

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';

import App from './App.jsx';
import './index.css';
import './print.css';

import Providers from './contexts/Providers.jsx';

// تمكين React DevTools في بيئة التطوير فقط
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  if (typeof window.__REACT_DEVTOOLS_GLOBAL_HOOK__ === 'undefined') {
    const script = document.createElement('script');
    script.src = 'http://localhost:8097';
    document.head.appendChild(script);
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <Providers>
          <App />
        </Providers>
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>
);