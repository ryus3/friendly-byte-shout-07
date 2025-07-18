import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/UnifiedAuthContext';

/**
 * Hook محسن للكاش الذكي للصلاحيات
 * يقلل من استهلاك البيانات ويحسن الأداء
 */
export const usePermissionsCache = () => {
  const { user } = useAuth();
  const [cache, setCache] = useState(new Map());
  const [lastUpdate, setLastUpdate] = useState(0);
  
  // مدة الكاش بالميلي ثانية (5 دقائق)
  const CACHE_DURATION = 5 * 60 * 1000;
  
  // تنظيف الكاش التلقائي
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      setCache(prevCache => {
        const newCache = new Map();
        for (const [key, value] of prevCache.entries()) {
          if (now - value.timestamp < CACHE_DURATION) {
            newCache.set(key, value);
          }
        }
        return newCache;
      });
    }, 60000); // تنظيف كل دقيقة
    
    return () => clearInterval(cleanup);
  }, []);
  
  // حفظ البيانات في الكاش
  const setCacheData = useCallback((key, data) => {
    setCache(prev => new Map(prev).set(key, {
      data,
      timestamp: Date.now()
    }));
  }, []);
  
  // جلب البيانات من الكاش
  const getCacheData = useCallback((key) => {
    const cached = cache.get(key);
    if (!cached) return null;
    
    const now = Date.now();
    if (now - cached.timestamp > CACHE_DURATION) {
      setCache(prev => {
        const newCache = new Map(prev);
        newCache.delete(key);
        return newCache;
      });
      return null;
    }
    
    return cached.data;
  }, [cache]);
  
  // مسح الكاش للمستخدم الحالي
  const clearUserCache = useCallback(() => {
    if (!user?.user_id) return;
    
    setCache(prev => {
      const newCache = new Map();
      for (const [key, value] of prev.entries()) {
        if (!key.includes(user.user_id)) {
          newCache.set(key, value);
        }
      }
      return newCache;
    });
  }, [user?.user_id]);
  
  return {
    setCacheData,
    getCacheData,
    clearUserCache,
    cacheSize: cache.size
  };
};

export default usePermissionsCache;