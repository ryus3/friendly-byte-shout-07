import { createClient } from '@supabase/supabase-js';

// إعداد polyfill للـ Headers إذا لم تكن متوفرة
if (typeof globalThis.Headers === 'undefined') {
  globalThis.Headers = class Headers {
    constructor(init) {
      this.map = new Map();
      if (init) {
        if (init instanceof Headers) {
          init.forEach((value, key) => this.map.set(key, value));
        } else if (Array.isArray(init)) {
          init.forEach(([key, value]) => this.map.set(key, value));
        } else if (typeof init === 'object') {
          Object.entries(init).forEach(([key, value]) => this.map.set(key, value));
        }
      }
    }
    
    append(name, value) {
      const existing = this.map.get(name);
      this.map.set(name, existing ? `${existing}, ${value}` : value);
    }
    
    delete(name) {
      this.map.delete(name);
    }
    
    get(name) {
      return this.map.get(name) || null;
    }
    
    has(name) {
      return this.map.has(name);
    }
    
    set(name, value) {
      this.map.set(name, value);
    }
    
    forEach(callback, thisArg) {
      this.map.forEach((value, key) => callback.call(thisArg, value, key, this));
    }
    
    entries() {
      return this.map.entries();
    }
    
    keys() {
      return this.map.keys();
    }
    
    values() {
      return this.map.values();
    }
  };
}

const supabaseUrl = 'https://tkheostkubborwkwzugl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRraGVvc3RrdWJib3J3a3d6dWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNTE4NTEsImV4cCI6MjA2NzkyNzg1MX0.ar867zsTy9JCTaLs9_Hjf5YhKJ9s0rQfUNq7dKpzYfA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {}
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});