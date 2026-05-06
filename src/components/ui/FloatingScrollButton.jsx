import { useState, useEffect } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
// Floating scroll button component - cache bust
import { Button } from '@/components/ui/button';

const FloatingScrollButton = () => {
  const [visible, setVisible] = useState(true);
  const [atBottom, setAtBottom] = useState(false);
  
  // Draggable state - يحفظ الموقع في localStorage
  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem('floatingButtonPosition');
    return saved ? JSON.parse(saved) : { x: window.innerWidth - 80, y: window.innerHeight - 200 };
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // ✅ مراقبة scroll على main container أو window
  useEffect(() => {
    const getContainer = () => document.querySelector('[data-scroll-container]') || document.querySelector('main');
    const handleScroll = () => {
      const container = getContainer();
      if (container && container.scrollHeight > container.clientHeight + 50) {
        const scrolled = container.scrollTop;
        const scrollableHeight = container.scrollHeight - container.clientHeight;
        if (scrollableHeight < 100) { setVisible(false); return; }
        setVisible(true);
        setAtBottom(scrolled >= scrollableHeight - 100);
        return;
      }
      const scrolled = window.scrollY;
      const docHeight = document.documentElement.scrollHeight;
      const windowHeight = window.innerHeight;
      const scrollableHeight = docHeight - windowHeight;
      if (scrollableHeight < 100) { setVisible(false); return; }
      setVisible(true);
      setAtBottom(scrolled + windowHeight >= docHeight - 100);
    };

    const container = getContainer();
    container?.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => {
      container?.removeEventListener('scroll', handleScroll);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Mouse dragging handlers
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  // Touch dragging handlers
  const handleTouchStart = (e) => {
    setIsDragging(true);
    const touch = e.touches[0];
    setDragOffset({
      x: touch.clientX - position.x,
      y: touch.clientY - position.y
    });
  };

  // Track dragging movement
  useEffect(() => {
    const handleMove = (e) => {
      if (!isDragging) return;
      
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      
      const newX = Math.max(0, Math.min(clientX - dragOffset.x, window.innerWidth - 56));
      const newY = Math.max(0, Math.min(clientY - dragOffset.y, window.innerHeight - 56));
      
      setPosition({ x: newX, y: newY });
    };

    const handleEnd = () => {
      if (isDragging) {
        setIsDragging(false);
        localStorage.setItem('floatingButtonPosition', JSON.stringify(position));
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleMove);
      window.addEventListener('touchend', handleEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, dragOffset, position]);

  const handleClick = () => {
    if (isDragging) return;
    const container = document.querySelector('[data-scroll-container]') || document.querySelector('main');
    if (container && container.scrollHeight > container.clientHeight + 50) {
      if (atBottom) {
        container.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      }
      return;
    }
    if (atBottom) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
    }
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 9999,
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        touchAction: 'none'
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      <Button
        onClick={handleClick}
        size="icon"
        className={`
          w-14 h-14 rounded-2xl
          bg-white/10 dark:bg-black/10
          backdrop-blur-md
          border border-white/20 dark:border-white/10
          shadow-2xl shadow-black/20 dark:shadow-white/10
          transition-all duration-300
          hover:scale-110 hover:bg-white/20 dark:hover:bg-black/20
          active:scale-95
          ${atBottom 
            ? 'text-blue-500 dark:text-blue-400' 
            : 'text-purple-500 dark:text-purple-400'
          }
        `}
        aria-label={atBottom ? 'الصعود للأعلى' : 'النزول للأسفل'}
      >
        {atBottom ? (
          <ArrowUp className="w-6 h-6" />
        ) : (
          <ArrowDown className="w-6 h-6 animate-bounce" />
        )}
      </Button>
    </div>
  );
};

export default FloatingScrollButton;
