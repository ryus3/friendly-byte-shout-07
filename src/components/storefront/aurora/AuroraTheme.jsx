import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Sun, Moon } from 'lucide-react';

const AuroraThemeContext = createContext({ theme: 'dark', toggle: () => {}, setTheme: () => {} });

export const useAuroraTheme = () => useContext(AuroraThemeContext);

const STORAGE_KEY = 'storefront-aurora-theme';

export const AuroraThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(() => {
    if (typeof window === 'undefined') return 'dark';
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {}
    return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  const setTheme = useCallback((t) => {
    setThemeState(t);
    try { localStorage.setItem(STORAGE_KEY, t); } catch {}
  }, []);

  const toggle = useCallback(() => {
    setThemeState(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(STORAGE_KEY, next); } catch {}
      return next;
    });
  }, []);

  return (
    <AuroraThemeContext.Provider value={{ theme, toggle, setTheme }}>
      <div className="storefront-aurora" data-aurora={theme}>
        {children}
      </div>
    </AuroraThemeContext.Provider>
  );
};

export const ThemeToggle = ({ className = '' }) => {
  const { theme, toggle } = useAuroraTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'تفعيل الوضع النهاري' : 'تفعيل الوضع الليلي'}
      className={`aurora-toggle ${className}`}
    >
      <span className="aurora-toggle__knob">
        {theme === 'dark' ? <Moon className="w-3 h-3" /> : <Sun className="w-3 h-3" />}
      </span>
    </button>
  );
};
