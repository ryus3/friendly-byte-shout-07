import React, { useEffect, useRef, useState } from 'react';


const ScrollingText = ({ text, className = "" }) => {
  const textRef = useRef(null);
  const containerRef = useRef(null);
  const [shouldScroll, setShouldScroll] = useState(false);

  useEffect(() => {
    if (textRef.current && containerRef.current) {
      const textWidth = textRef.current.scrollWidth;
      const containerWidth = containerRef.current.clientWidth;
      setShouldScroll(textWidth > containerWidth);
    }
  }, [text]);

  if (!shouldScroll) {
    return (
      <div ref={containerRef} className={`${className}`}>
        <span ref={textRef}>{text}</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`overflow-hidden relative ${className}`}>
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