import { useEffect } from 'react';
import { scrollToTopInstant } from '@/utils/scrollToTop';

// Hook لتطبيق scroll-to-top تلقائياً على أي صفحة
export const useScrollToTop = () => {
  useEffect(() => {
    scrollToTopInstant();
  }, []);
};

export default useScrollToTop;