// PDF polyfill to handle missing Headers in browser environment
if (typeof global === 'undefined') {
  window.global = window;
}

// Polyfill for Headers if not available
if (typeof Headers === 'undefined') {
  window.Headers = class Headers {
    constructor(init) {
      this.map = new Map();
      if (init) {
        if (init instanceof Headers) {
          init.forEach((value, key) => {
            this.map.set(key.toLowerCase(), value);
          });
        } else if (Array.isArray(init)) {
          init.forEach(([key, value]) => {
            this.map.set(key.toLowerCase(), value);
          });
        } else if (typeof init === 'object') {
          Object.entries(init).forEach(([key, value]) => {
            this.map.set(key.toLowerCase(), value);
          });
        }
      }
    }

    append(name, value) {
      const existing = this.map.get(name.toLowerCase());
      this.map.set(name.toLowerCase(), existing ? `${existing}, ${value}` : value);
    }

    delete(name) {
      this.map.delete(name.toLowerCase());
    }

    get(name) {
      return this.map.get(name.toLowerCase()) || null;
    }

    has(name) {
      return this.map.has(name.toLowerCase());
    }

    set(name, value) {
      this.map.set(name.toLowerCase(), value);
    }

    forEach(callback, thisArg) {
      this.map.forEach((value, key) => {
        callback.call(thisArg, value, key, this);
      });
    }

    keys() {
      return this.map.keys();
    }

    values() {
      return this.map.values();
    }

    entries() {
      return this.map.entries();
    }

    [Symbol.iterator]() {
      return this.map.entries();
    }
  };
}

// Polyfill for Request if not available
if (typeof Request === 'undefined') {
  window.Request = class Request {
    constructor(input, options = {}) {
      this.url = typeof input === 'string' ? input : input.url;
      this.method = options.method || 'GET';
      this.headers = new Headers(options.headers);
      this.body = options.body || null;
    }
  };
}

// Polyfill for Response if not available
if (typeof Response === 'undefined') {
  window.Response = class Response {
    constructor(body, options = {}) {
      this.body = body;
      this.status = options.status || 200;
      this.statusText = options.statusText || 'OK';
      this.headers = new Headers(options.headers);
      this.ok = this.status >= 200 && this.status < 300;
    }

    json() {
      return Promise.resolve(JSON.parse(this.body));
    }

    text() {
      return Promise.resolve(this.body);
    }

    clone() {
      return new Response(this.body, {
        status: this.status,
        statusText: this.statusText,
        headers: this.headers
      });
    }
  };
}

export default {};