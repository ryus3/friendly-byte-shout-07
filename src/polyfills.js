// Polyfills for Web APIs that might not be available
if (typeof global !== 'undefined') {
  global.Headers = globalThis.Headers || class Headers {
    constructor(init) {
      this._headers = new Map();
      if (init) {
        if (init instanceof Headers) {
          for (const [key, value] of init._headers) {
            this._headers.set(key.toLowerCase(), value);
          }
        } else if (typeof init === 'object') {
          for (const [key, value] of Object.entries(init)) {
            this._headers.set(key.toLowerCase(), value);
          }
        }
      }
    }
    
    append(name, value) {
      const existing = this._headers.get(name.toLowerCase());
      this._headers.set(name.toLowerCase(), existing ? `${existing}, ${value}` : value);
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
      this._headers.set(name.toLowerCase(), value);
    }
    
    [Symbol.iterator]() {
      return this._headers[Symbol.iterator]();
    }
  };
}

// Ensure Headers is available globally
if (typeof globalThis !== 'undefined' && !globalThis.Headers) {
  globalThis.Headers = Headers || class Headers {
    constructor(init) {
      this._headers = new Map();
      if (init) {
        if (init instanceof Headers) {
          for (const [key, value] of init._headers) {
            this._headers.set(key.toLowerCase(), value);
          }
        } else if (typeof init === 'object') {
          for (const [key, value] of Object.entries(init)) {
            this._headers.set(key.toLowerCase(), value);
          }
        }
      }
    }
    
    append(name, value) {
      const existing = this._headers.get(name.toLowerCase());
      this._headers.set(name.toLowerCase(), existing ? `${existing}, ${value}` : value);
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
      this._headers.set(name.toLowerCase(), value);
    }
    
    [Symbol.iterator]() {
      return this._headers[Symbol.iterator]();
    }
  };
}