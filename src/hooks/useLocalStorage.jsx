import React, { useState, useEffect, useCallback, useRef } from 'react';

function useLocalStorage(key, initialValue) {
  const writeTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);
  
  // Get value from localStorage or use initial value
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Flag to prevent multiple writes during navigation
  const isNavigatingRef = useRef(false);
  
  // Debounced localStorage write to prevent memory leaks
  const debouncedWrite = useCallback((value) => {
    // Skip writes during navigation to prevent memory corruption
    if (isNavigatingRef.current) return;
    
    if (writeTimeoutRef.current) {
      clearTimeout(writeTimeoutRef.current);
    }
    
    writeTimeoutRef.current = setTimeout(() => {
      if (!isMountedRef.current || isNavigatingRef.current) return;
      
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        console.error(`❌ Error setting localStorage key "${key}":`, error);
      }
    }, 50); // Reduced debounce time for faster responsiveness
  }, [key]);

  // Update localStorage when state changes
  const setValue = useCallback((value) => {
    if (!isMountedRef.current) return;
    
    try {
      // Allow value to be a function so we have the same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      debouncedWrite(valueToStore);
    } catch (error) {
      console.error(`❌ Error setting localStorage key "${key}":`, error);
      // Fallback: just update state without localStorage
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
    }
  }, [key, storedValue, debouncedWrite]);

  // Navigation state monitoring
  useEffect(() => {
    const handleNavStart = () => {
      isNavigatingRef.current = true;
    };
    
    const handleNavEnd = () => {
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 100);
    };
    
    window.addEventListener('beforeunload', handleNavStart);
    window.addEventListener('popstate', handleNavStart);
    window.addEventListener('load', handleNavEnd);
    
    return () => {
      window.removeEventListener('beforeunload', handleNavStart);
      window.removeEventListener('popstate', handleNavStart);
      window.removeEventListener('load', handleNavEnd);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      isNavigatingRef.current = true; // Prevent writes during unmount
      if (writeTimeoutRef.current) {
        clearTimeout(writeTimeoutRef.current);
      }
    };
  }, []);

  return [storedValue, setValue];
}

export { useLocalStorage };
export default useLocalStorage;