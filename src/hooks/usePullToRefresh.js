import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * 🚀 Pull-to-refresh hook (تطبيق هاتف عالمي)
 * يعمل على شاشات اللمس فقط، يتجاهل الماوس على الديسكتوب.
 */
export function usePullToRefresh(onRefresh, { threshold = 70, scrollContainerSelector = '[data-scroll-container]' } = {}) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef(0);
  const isPullingRef = useRef(false);

  const getContainer = useCallback(() => {
    return document.querySelector(scrollContainerSelector) || document.scrollingElement || document.documentElement;
  }, [scrollContainerSelector]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('ontouchstart' in window)) return;

    const handleTouchStart = (e) => {
      const c = getContainer();
      if (!c || c.scrollTop > 0) return;
      startYRef.current = e.touches[0].clientY;
      isPullingRef.current = true;
    };

    const handleTouchMove = (e) => {
      if (!isPullingRef.current || isRefreshing) return;
      const dy = e.touches[0].clientY - startYRef.current;
      if (dy > 0) {
        const damped = Math.min(dy * 0.5, threshold * 1.5);
        setPullDistance(damped);
      }
    };

    const handleTouchEnd = async () => {
      if (!isPullingRef.current) return;
      isPullingRef.current = false;
      if (pullDistance >= threshold && !isRefreshing) {
        setIsRefreshing(true);
        try { await onRefresh?.(); } catch {}
        setTimeout(() => {
          setIsRefreshing(false);
          setPullDistance(0);
        }, 350);
      } else {
        setPullDistance(0);
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onRefresh, threshold, pullDistance, isRefreshing, getContainer]);

  return { pullDistance, isRefreshing };
}

export default usePullToRefresh;
