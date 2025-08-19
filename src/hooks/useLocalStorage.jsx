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

  // Debounced localStorage write to prevent memory leaks
  const debouncedWrite = useCallback((value) => {
    if (writeTimeoutRef.current) {
      clearTimeout(writeTimeoutRef.current);
    }
    
    writeTimeoutRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;
      
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        console.error(`❌ Error setting localStorage key "${key}":`, error);
      }
    }, 25);
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (writeTimeoutRef.current) {
        clearTimeout(writeTimeoutRef.current);
      }
    };
  }, []);

  return [storedValue, setValue];
}

export { useLocalStorage };
export default useLocalStorage;