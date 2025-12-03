import React, { useLayoutEffect, useRef, useState, useCallback } from 'react';

const ScrollingText = ({ text, className = "", maxWidth = "150px" }) => {
  const textRef = useRef(null);
  const containerRef = useRef(null);
  const [shouldScroll, setShouldScroll] = useState(false);

  const checkScrollNeed = useCallback(() => {
    if (textRef.current && containerRef.current) {
      setTimeout(() => {
        const textWidth = textRef.current?.scrollWidth || 0;
        const containerWidth = containerRef.current?.clientWidth || 0;
        setShouldScroll(textWidth > containerWidth + 5);
      }, 50);
    }
  }, []);

  useLayoutEffect(() => {
    checkScrollNeed();
    
    const handleResize = () => checkScrollNeed();
    window.addEventListener('resize', handleResize);
    
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
        <span ref={textRef} className="whitespace-nowrap truncate block">{text}</span>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className={`overflow-hidden relative ${className}`} 
      style={{ maxWidth }}
    >
      <span 
        ref={textRef}
        className="animate-scroll-text whitespace-nowrap inline-block"
        style={{
          animationDuration: '8s',
          animationDelay: '0s',
          animationIterationCount: 'infinite',
          animationTimingFunction: 'linear'
        }}
      >
        {text}
        <span className="mx-8">&nbsp;&nbsp;&nbsp;</span>
        {text}
      </span>
    </div>
  );
};

export default ScrollingText;