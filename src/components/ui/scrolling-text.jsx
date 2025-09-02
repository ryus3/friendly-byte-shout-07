import React, { useEffect, useRef, useState } from 'react';


const ScrollingText = ({ text, className = "" }) => {
  const textRef = useRef(null);
  const containerRef = useRef(null);
  const [shouldScroll, setShouldScroll] = useState(false);

  useEffect(() => {
    const checkOverflow = () => {
      if (textRef.current && containerRef.current) {
        const textWidth = textRef.current.scrollWidth;
        const containerWidth = containerRef.current.clientWidth;
        setShouldScroll(textWidth > containerWidth);
      }
    };

    checkOverflow();
    
    // إعادة فحص عند تغيير النص أو حجم النافذة
    const resizeObserver = new ResizeObserver(checkOverflow);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [text]);

  if (!shouldScroll) {
    return (
      <div ref={containerRef} className={`${className} min-w-0`}>
        <span ref={textRef} className="truncate">{text}</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`overflow-hidden ${className} min-w-0`}>
      <div 
        ref={textRef}
        className="whitespace-nowrap will-change-transform"
        style={{
          animation: 'scroll-text 8s linear infinite'
        }}
      >
        {text}
      </div>
    </div>
  );
};

export default ScrollingText;