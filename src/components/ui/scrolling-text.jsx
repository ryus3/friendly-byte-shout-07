import React, { useLayoutEffect, useRef, useState, useCallback } from 'react';

const ScrollingText = ({ text, className = "" }) => {
  const textRef = useRef(null);
  const containerRef = useRef(null);
  const [shouldScroll, setShouldScroll] = useState(false);

  const checkScrollNeed = useCallback(() => {
    if (textRef.current && containerRef.current) {
      // انتظار صغير للتأكد من جهوزية DOM
      setTimeout(() => {
        const textWidth = textRef.current?.scrollWidth || 0;
        const containerWidth = containerRef.current?.clientWidth || 0;
        setShouldScroll(textWidth > containerWidth + 10); // هامش صغير
      }, 50);
    }
  }, []);

  useLayoutEffect(() => {
    checkScrollNeed();
    
    // مراقبة تغييرات حجم النافذة
    const handleResize = () => checkScrollNeed();
    window.addEventListener('resize', handleResize);
    
    return () => window.removeEventListener('resize', handleResize);
  }, [text, checkScrollNeed]);

  if (!shouldScroll) {
    return (
      <div ref={containerRef} className={`${className}`} style={{ maxWidth: '200px' }}>
        <span ref={textRef} className="whitespace-nowrap">{text}</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`overflow-hidden relative ${className}`} style={{ maxWidth: '200px' }}>
      <div 
        ref={textRef}
        className="animate-scroll-text whitespace-nowrap inline-block"
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