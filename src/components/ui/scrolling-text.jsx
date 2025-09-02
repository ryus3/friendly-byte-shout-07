import React, { useLayoutEffect, useRef, useState, useCallback } from 'react';

const ScrollingText = ({ text, className = "", maxWidth = "280px" }) => {
  const textRef = useRef(null);
  const containerRef = useRef(null);
  const [shouldScroll, setShouldScroll] = useState(false);

  const checkScrollNeed = useCallback(() => {
    if (textRef.current && containerRef.current) {
      // انتظار للتأكد من جهوزية DOM وقياس العرض بدقة
      requestAnimationFrame(() => {
        setTimeout(() => {
          const textWidth = textRef.current?.scrollWidth || 0;
          const containerWidth = containerRef.current?.clientWidth || 0;
          setShouldScroll(textWidth > containerWidth + 5);
        }, 100);
      });
    }
  }, []);

  useLayoutEffect(() => {
    checkScrollNeed();
    
    // إعداد ResizeObserver لمراقبة تغييرات حجم الحاوية
    let resizeObserver;
    if (containerRef.current && window.ResizeObserver) {
      resizeObserver = new ResizeObserver(checkScrollNeed);
      resizeObserver.observe(containerRef.current);
    }
    
    // مراقبة تغييرات حجم النافذة كبديل
    const handleResize = () => checkScrollNeed();
    window.addEventListener('resize', handleResize);
    
    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [text, checkScrollNeed]);

  if (!shouldScroll) {
    return (
      <div ref={containerRef} className={`w-full ${className}`} style={{ maxWidth }}>
        <span ref={textRef} className="whitespace-nowrap text-gray-950 dark:text-gray-50">
          {text}
        </span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`overflow-hidden relative w-full ${className}`} style={{ maxWidth }}>
      <div 
        ref={textRef}
        className="animate-scroll-text whitespace-nowrap inline-block text-gray-950 dark:text-gray-50"
        style={{
          animationDelay: '1s',
          animationDuration: '8s'
        }}
      >
        {text}
      </div>
    </div>
  );
};

export default ScrollingText;