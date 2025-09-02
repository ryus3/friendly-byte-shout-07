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
      <span ref={containerRef} className={className}>
        <span ref={textRef}>{text}</span>
      </span>
    );
  }

  return (
    <div ref={containerRef} className={`overflow-hidden ${className}`}>
      <div 
        ref={textRef}
        className="animate-scroll whitespace-nowrap"
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