import React, { useLayoutEffect, useRef, useState, useCallback } from 'react';

const ScrollingText = ({ text, className = "" }) => {
  const textRef = useRef(null);
  const containerRef = useRef(null);
  const [shouldScroll, setShouldScroll] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const checkScrollNeed = useCallback(() => {
    if (textRef.current && containerRef.current) {
      // انتظار إضافي للتأكد من عرض كامل للنصوص العربية
      setTimeout(() => {
        const textWidth = textRef.current?.scrollWidth || 0;
        const containerWidth = containerRef.current?.clientWidth || 0;
        setShouldScroll(textWidth > containerWidth + 15); // هامش أكبر للنصوص العربية
        setIsReady(true);
      }, 100);
    }
  }, []);

  useLayoutEffect(() => {
    checkScrollNeed();
    
    // ResizeObserver لمراقبة تغييرات الحجم بدقة أكبر
    const resizeObserver = new ResizeObserver(() => {
      checkScrollNeed();
    });
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    const handleResize = () => checkScrollNeed();
    window.addEventListener('resize', handleResize);
    
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [text, checkScrollNeed]);

  const maxWidth = '280px'; // عرض أكبر للنصوص العربية الطويلة

  if (!isReady) {
    return (
      <div ref={containerRef} className={className} style={{ maxWidth }}>
        <span ref={textRef} className="whitespace-nowrap text-gray-950 dark:text-gray-50">{text}</span>
      </div>
    );
  }

  if (!shouldScroll) {
    return (
      <div ref={containerRef} className={className} style={{ maxWidth }}>
        <span ref={textRef} className="whitespace-nowrap text-gray-950 dark:text-gray-50">{text}</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`overflow-hidden relative ${className}`} style={{ maxWidth }}>
      <div 
        ref={textRef}
        className="animate-scroll-text whitespace-nowrap inline-block text-gray-950 dark:text-gray-50"
        style={{
          animationDelay: '1s'
        }}
      >
        {text}
      </div>
    </div>
  );
};

export default ScrollingText;