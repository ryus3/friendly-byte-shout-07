import { useState, useEffect } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';

const FloatingScrollButton = () => {
  const [visible, setVisible] = useState(true);
  const [atBottom, setAtBottom] = useState(false);

  // Draggable state - يحفظ الموقع في localStorage
  const [position, setPosition] = useState(() => {
    try {
      const saved = localStorage.getItem('floatingButtonPosition');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { x: window.innerWidth - 72, y: window.innerHeight - 180 };
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);

  // ✅ مراقبة scroll على main container أو window
  useEffect(() => {
    const getContainer = () =>
      document.querySelector('[data-scroll-container]') || document.querySelector('main');
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

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setHasMoved(false);
    setDragOffset({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleTouchStart = (e) => {
    setIsDragging(true);
    setHasMoved(false);
    const touch = e.touches[0];
    setDragOffset({ x: touch.clientX - position.x, y: touch.clientY - position.y });
  };

  useEffect(() => {
    const handleMove = (e) => {
      if (!isDragging) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const newX = Math.max(8, Math.min(clientX - dragOffset.x, window.innerWidth - 44));
      const newY = Math.max(8, Math.min(clientY - dragOffset.y, window.innerHeight - 44));
      if (Math.abs(newX - position.x) > 3 || Math.abs(newY - position.y) > 3) setHasMoved(true);
      setPosition({ x: newX, y: newY });
    };

    const handleEnd = () => {
      if (isDragging) {
        setIsDragging(false);
        try { localStorage.setItem('floatingButtonPosition', JSON.stringify(position)); } catch {}
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleMove, { passive: false });
      window.addEventListener('touchend', handleEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, dragOffset, position]);

  const handleClick = (e) => {
    if (hasMoved) { e.preventDefault(); return; }
    const container =
      document.querySelector('[data-scroll-container]') || document.querySelector('main');
    if (container && container.scrollHeight > container.clientHeight + 50) {
      container.scrollTo({
        top: atBottom ? 0 : container.scrollHeight,
        behavior: 'smooth'
      });
      return;
    }
    window.scrollTo({
      top: atBottom ? 0 : document.documentElement.scrollHeight,
      behavior: 'smooth'
    });
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
        touchAction: 'none',
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onClick={handleClick}
      role="button"
      aria-label={atBottom ? 'الصعود للأعلى' : 'النزول للأسفل'}
      className="group"
    >
      {/* Outer soft glow */}
      <div
        className={`absolute inset-0 rounded-full blur-xl opacity-40 transition-all duration-500 ${
          atBottom
            ? 'bg-[radial-gradient(circle,hsl(217_91%_60%/0.45),transparent_70%)]'
            : 'bg-[radial-gradient(circle,hsl(270_91%_65%/0.45),transparent_70%)]'
        } group-hover:opacity-70 group-hover:scale-125`}
        style={{ width: 44, height: 44 }}
      />

      {/* Glass capsule */}
      <div
        className={`
          relative w-11 h-11 rounded-full
          bg-white/10 dark:bg-white/[0.04]
          backdrop-blur-2xl backdrop-saturate-150
          border border-white/30 dark:border-white/10
          shadow-[0_6px_24px_-4px_rgba(0,0,0,0.2),inset_0_1px_0_0_rgba(255,255,255,0.35)]
          dark:shadow-[0_6px_24px_-4px_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.12)]
          transition-all duration-300 ease-out
          group-hover:scale-110 group-active:scale-95
          overflow-hidden
          flex items-center justify-center
        `}
      >
        {/* Iridescent gradient sheen */}
        <div
          className={`absolute inset-0 rounded-full opacity-50 transition-all duration-500 ${
            atBottom
              ? 'bg-gradient-to-br from-sky-400/30 via-blue-500/15 to-indigo-600/20'
              : 'bg-gradient-to-br from-fuchsia-400/30 via-violet-500/18 to-indigo-600/20'
          }`}
        />

        {/* Top highlight (glass reflection) */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-2 rounded-b-full bg-gradient-to-b from-white/40 to-transparent blur-[1px]" />

        {/* Conic shimmer ring on hover */}
        <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[conic-gradient(from_0deg,transparent,rgba(255,255,255,0.25),transparent_30%)] animate-[spin_3s_linear_infinite]" />

        {/* Icon */}
        <div className="relative z-10 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">
          {atBottom ? (
            <ArrowUp className="w-5 h-5" strokeWidth={2.5} />
          ) : (
            <ArrowDown className="w-5 h-5 animate-bounce" strokeWidth={2.5} />
          )}
        </div>
      </div>
    </div>
  );
};

export default FloatingScrollButton;
