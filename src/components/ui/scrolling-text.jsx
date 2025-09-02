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
      <div ref={containerRef} className={`${className}`} style={{ maxWidth: '150px' }}>
        <span ref={textRef} className="whitespace-nowrap text-sm font-bold">{text}</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`overflow-hidden relative ${className}`} style={{ maxWidth: '150px', minHeight: '20px' }}>
      <div 
        ref={textRef}
        className="animate-scroll-text whitespace-nowrap absolute top-0 right-0 text-sm font-bold"
        style={{
          animationDelay: '2s',
          animationPlayState: 'running'
        }}
      >
        {text}
      </div>
    </div>
  );
};

export default ScrollingText;