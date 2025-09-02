import React, { useLayoutEffect, useRef, useState, useCallback, useEffect } from 'react';

const ScrollingText = ({ text, className = "" }) => {
  const textRef = useRef(null);
  const containerRef = useRef(null);
  const [shouldScroll, setShouldScroll] = useState(false);
  const resizeObserverRef = useRef(null);

  const checkScrollNeed = useCallback(() => {
    if (textRef.current && containerRef.current) {
      // قياس فوري
      const textWidth = textRef.current.scrollWidth;
      const containerWidth = containerRef.current.clientWidth;
      
      // للنصوص العربية الطويلة - استخدام margin أكبر
      const shouldScrollValue = textWidth > (containerWidth - 5);
      setShouldScroll(shouldScrollValue);
      
      // قياس مؤجل للتأكد
      setTimeout(() => {
        if (textRef.current && containerRef.current) {
          const newTextWidth = textRef.current.scrollWidth;
          const newContainerWidth = containerRef.current.clientWidth;
          setShouldScroll(newTextWidth > (newContainerWidth - 5));
        }
      }, 100);
    }
  }, []);

  useLayoutEffect(() => {
    checkScrollNeed();
  }, [text, checkScrollNeed]);

  useEffect(() => {
    // مراقبة تغييرات الحجم مع ResizeObserver
    if (containerRef.current && window.ResizeObserver) {
      resizeObserverRef.current = new ResizeObserver(checkScrollNeed);
      resizeObserverRef.current.observe(containerRef.current);
    }

    // مراقبة تغييرات حجم النافذة
    const handleResize = () => {
      setTimeout(checkScrollNeed, 50);
    };
    window.addEventListener('resize', handleResize);
    
    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [checkScrollNeed]);

  if (!shouldScroll) {
    return (
      <div ref={containerRef} className={`${className}`} style={{ maxWidth: '260px', minWidth: '120px' }}>
        <span ref={textRef} className="whitespace-nowrap">{text}</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`overflow-hidden relative ${className}`} style={{ maxWidth: '260px', minWidth: '120px' }}>
      <div 
        ref={textRef}
        className="animate-scroll-text whitespace-nowrap inline-block"
        style={{
          animationDelay: '1.5s',
          animationDuration: '8s'
        }}
      >
        {text}
      </div>
    </div>
  );
};

export default ScrollingText;