import { useState, useCallback } from 'react';

function useLocalStorage(key, initialValue) {
  // Get value from localStorage or use initial value
  const [storedValue, setStoredValue] = useState(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    
    try {
      const item = window.localStorage.getItem(key);
      if (!item) return initialValue;
      
      // ✅ محاولة parse كـ JSON أولاً
      try {
        return JSON.parse(item);
      } catch (parseError) {
        // ✅ إذا فشل، افترض أنها قيمة نصية مباشرة وقم بحفظها بشكل صحيح
        console.warn(`localStorage key "${key}" is not valid JSON, using raw value:`, item);
        window.localStorage.setItem(key, JSON.stringify(item));
        return item;
      }
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Update localStorage when state changes
  const setValue = useCallback((value) => {
    try {
      // Allow value to be a function so we have the same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  return [storedValue, setValue];
}

export { useLocalStorage };
export default useLocalStorage;