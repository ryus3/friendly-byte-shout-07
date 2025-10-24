/**
 * ⚡ Performance Optimizer - مُحسّن الأداء الشامل
 * يحتوي على utilities لتحسين الأداء في جميع أنحاء التطبيق
 */

import { useCallback, useEffect, useRef, useMemo } from 'react';

/**
 * ⚡ Debounce - تأخير تنفيذ دالة لتحسين الأداء
 */
export const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

/**
 * ⚡ Throttle - تحديد معدل تنفيذ الدالة
 */
export const throttle = (func, limit) => {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

/**
 * ⚡ useDebounce Hook - لتأخير القيم
 */
export const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

/**
 * ⚡ useMemoizedCallback - مزيج من useCallback و useMemo
 */
export const useMemoizedCallback = (callback, dependencies) => {
  return useCallback(callback, dependencies);
};

/**
 * ⚡ useIntersectionObserver - للتحميل الكسول (Lazy Loading)
 */
export const useIntersectionObserver = (
  elementRef,
  { threshold = 0, root = null, rootMargin = '0%', freezeOnceVisible = false }
) => {
  const [entry, setEntry] = React.useState();

  const frozen = entry?.isIntersecting && freezeOnceVisible;

  const updateEntry = ([entry]) => {
    setEntry(entry);
  };

  useEffect(() => {
    const node = elementRef?.current;
    const hasIOSupport = !!window.IntersectionObserver;

    if (!hasIOSupport || frozen || !node) return;

    const observerParams = { threshold, root, rootMargin };
    const observer = new IntersectionObserver(updateEntry, observerParams);

    observer.observe(node);

    return () => observer.disconnect();
  }, [elementRef, threshold, root, rootMargin, frozen]);

  return entry;
};

/**
 * ⚡ memoizeOne - Memoization بسيط للنتائج
 */
export const memoizeOne = (fn) => {
  let lastArgs = [];
  let lastResult;

  return (...args) => {
    if (args.length !== lastArgs.length || args.some((arg, i) => arg !== lastArgs[i])) {
      lastArgs = args;
      lastResult = fn(...args);
    }
    return lastResult;
  };
};

/**
 * ⚡ Virtual Scroll Helper - للقوائم الطويلة
 */
export const useVirtualScroll = (items, itemHeight, containerHeight) => {
  const [scrollTop, setScrollTop] = React.useState(0);

  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(startIndex + visibleCount + 1, items.length);

  const visibleItems = items.slice(startIndex, endIndex);
  const offsetY = startIndex * itemHeight;

  return {
    visibleItems,
    offsetY,
    totalHeight: items.length * itemHeight,
    onScroll: (e) => setScrollTop(e.target.scrollTop),
  };
};

/**
 * ⚡ Image Lazy Loader - تحميل الصور بشكل كسول
 */
export const LazyImage = ({ src, alt, className, placeholder = '' }) => {
  const imgRef = useRef();
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [isInView, setIsInView] = React.useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <img
      ref={imgRef}
      src={isInView ? src : placeholder}
      alt={alt}
      className={className}
      onLoad={() => setIsLoaded(true)}
      loading="lazy"
      style={{ opacity: isLoaded ? 1 : 0.5, transition: 'opacity 0.3s' }}
    />
  );
};

/**
 * ⚡ بدائل console في Production
 */
export const createPerformanceLogger = () => {
  const isDev = import.meta.env.DEV;
  
  return {
    time: isDev ? console.time.bind(console) : () => {},
    timeEnd: isDev ? console.timeEnd.bind(console) : () => {},
    measure: (label, fn) => {
      if (!isDev) return fn();
      const start = performance.now();
      const result = fn();
      const duration = performance.now() - start;
      console.log(`⚡ ${label}: ${duration.toFixed(2)}ms`);
      return result;
    }
  };
};

/**
 * ⚡ تحسين إعادة الرسم (Re-renders)
 */
export const shouldComponentUpdate = (prevProps, nextProps) => {
  return Object.keys(nextProps).some(key => prevProps[key] !== nextProps[key]);
};

export default {
  debounce,
  throttle,
  useDebounce,
  useMemoizedCallback,
  useIntersectionObserver,
  memoizeOne,
  useVirtualScroll,
  LazyImage,
  createPerformanceLogger,
  shouldComponentUpdate
};
