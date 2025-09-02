import React, { useLayoutEffect, useRef, useState, useCallback } from 'react';

const ScrollingText = ({ text, className = "", maxWidth = "150px" }) => {
  const textRef = useRef(null);
  const containerRef = useRef(null);
  const [shouldScroll, setShouldScroll] = useState(false);

  const checkScrollNeed = useCallback(() => {
    if (textRef.current && containerRef.current) {
      // انتظار صغير للتأكد من جهوزية DOM
      setTimeout(() => {
        const textWidth = textRef.current?.scrollWidth || 0;
        const containerWidth = containerRef.current?.clientWidth || 0;
        setShouldScroll(textWidth > containerWidth + 5); // هامش أصغر
      }, 100);
    }
  }, []);

  useLayoutEffect(() => {
    checkScrollNeed();
    
    // مراقبة تغييرات حجم النافذة
    const handleResize = () => checkScrollNeed();
    window.addEventListener('resize', handleResize);
    
    // مراقبة التغييرات في حجم النص
    let resizeObserver;
    if (textRef.current) {
      resizeObserver = new ResizeObserver(() => {
        checkScrollNeed();
      });
      resizeObserver.observe(textRef.current);
    }
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [text, checkScrollNeed]);

  if (!shouldScroll) {
    return (
      <div ref={containerRef} className={className} style={{ maxWidth }}>
        <span ref={textRef} className="whitespace-nowrap">{text}</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`overflow-hidden relative ${className}`} style={{ maxWidth }}>
      <div 
        ref={textRef}
        className="animate-scroll-text whitespace-nowrap absolute top-0 right-0"
        style={{
          animationDelay: '0.5s'
        }}
      >
        {text}
      </div>
    </div>
  );
};

export default ScrollingText;