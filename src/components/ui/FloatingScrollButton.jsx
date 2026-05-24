import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';

/**
 * 🧭 زر سكرول عائم احترافي:
 * - يكتشف الحاوية المتمرّرة فعلياً (window, document.scrollingElement, main, [data-scroll-container], أي عنصر بـoverflow auto/scroll له ارتفاع قابل للتمرير).
 * - السحب لا يبتلع النقرة (عتبة 8px).
 * - مخفي حتى يثبت وجود ارتفاع قابل للتمرير.
 */
const FloatingScrollButton = () => {
  const [visible, setVisible] = useState(false);
  const [atBottom, setAtBottom] = useState(false);
  const scrollTargetRef = useRef(null); // العنصر/النافذة التي نتمرّر عليها

  const [position, setPosition] = useState(() => {
    try {
      const saved = localStorage.getItem('floatingButtonPosition');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { x: window.innerWidth - 60, y: window.innerHeight - 160 };
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);

  // 🔍 كشف الحاوية المتمررة فعلياً
  const detectScrollTarget = useCallback(() => {
    const candidates = [];
    const explicit = document.querySelector('[data-scroll-container]');
    if (explicit) candidates.push(explicit);
    const mainEl = document.querySelector('main');
    if (mainEl) candidates.push(mainEl);
    // عناصر بـoverflow auto/scroll
    document.querySelectorAll('div').forEach((el) => {
      if (candidates.length > 8) return;
      const cs = getComputedStyle(el);
      if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight - el.clientHeight > 100) {
        candidates.push(el);
      }
    });
    for (const el of candidates) {
      if (el && el.scrollHeight - el.clientHeight > 100) return el;
    }
    // افتراضي: window
    const docEl = document.scrollingElement || document.documentElement;
    if (docEl && docEl.scrollHeight - window.innerHeight > 100) return window;
    return null;
  }, []);

  const getMetrics = useCallback((target) => {
    if (!target) return null;
    if (target === window) {
      const docEl = document.scrollingElement || document.documentElement;
      const scrollTop = window.scrollY || docEl.scrollTop;
      const scrollable = docEl.scrollHeight - window.innerHeight;
      return { scrollTop, scrollable };
    }
    return { scrollTop: target.scrollTop, scrollable: target.scrollHeight - target.clientHeight };
  }, []);

  useEffect(() => {
    let target = detectScrollTarget();
    scrollTargetRef.current = target;

    const update = () => {
      // إعادة الكشف إن لم يعد ساري المفعول
      if (!target || (target !== window && !document.body.contains(target))) {
        target = detectScrollTarget();
        scrollTargetRef.current = target;
      }
      const m = getMetrics(target);
      if (!m || m.scrollable < 100) { setVisible(false); return; }
      setVisible(true);
      setAtBottom(m.scrollTop >= m.scrollable - 100);
    };

    const attach = (t) => {
      if (!t) return;
      (t === window ? window : t).addEventListener('scroll', update, { passive: true });
    };
    const detach = (t) => {
      if (!t) return;
      (t === window ? window : t).removeEventListener('scroll', update);
    };

    attach(target);
    window.addEventListener('resize', update);
    update();

    // إعادة الكشف الدوري للحالات التي تتغير فيها بنية DOM (تغيير صفحة)
    const interval = setInterval(() => {
      const next = detectScrollTarget();
      if (next !== scrollTargetRef.current) {
        detach(scrollTargetRef.current);
        scrollTargetRef.current = next;
        target = next;
        attach(next);
      }
      update();
    }, 1500);

    return () => {
      detach(scrollTargetRef.current);
      window.removeEventListener('resize', update);
      clearInterval(interval);
    };
  }, [detectScrollTarget, getMetrics]);

  const startDrag = (clientX, clientY) => {
    setIsDragging(true);
    hasMovedRef.current = false;
    setDragOffset({ x: clientX - position.x, y: clientY - position.y });
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    startDrag(e.clientX, e.clientY);
  };
  const handleTouchStart = (e) => {
    const t = e.touches[0];
    startDrag(t.clientX, t.clientY);
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (e) => {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const newX = Math.max(8, Math.min(clientX - dragOffset.x, window.innerWidth - 40));
      const newY = Math.max(8, Math.min(clientY - dragOffset.y, window.innerHeight - 40));
      if (Math.abs(newX - position.x) > 8 || Math.abs(newY - position.y) > 8) hasMovedRef.current = true;
      setPosition({ x: newX, y: newY });
    };
    const handleEnd = () => {
      setIsDragging(false);
      try { localStorage.setItem('floatingButtonPosition', JSON.stringify(position)); } catch {}
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, dragOffset, position]);

  const handleClick = (e) => {
    if (hasMovedRef.current) { e.preventDefault(); return; }
    const target = scrollTargetRef.current || detectScrollTarget();
    if (!target) return;
    const m = getMetrics(target);
    if (!m) return;
    const dest = atBottom ? 0 : (target === window
      ? (document.scrollingElement || document.documentElement).scrollHeight
      : target.scrollHeight);
    if (target === window) {
      window.scrollTo({ top: atBottom ? 0 : dest, behavior: 'smooth' });
    } else {
      target.scrollTo({ top: atBottom ? 0 : target.scrollHeight, behavior: 'smooth' });
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
        touchAction: 'none',
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onClick={handleClick}
      role="button"
      aria-label={atBottom ? 'الصعود للأعلى' : 'النزول للأسفل'}
      className="group"
    >
      {/* Outer soft glow — أصغر وأشف */}
      <div
        className={`absolute inset-0 rounded-full blur-lg opacity-25 transition-all duration-500 ${
          atBottom
            ? 'bg-[radial-gradient(circle,hsl(217_91%_60%/0.40),transparent_70%)]'
            : 'bg-[radial-gradient(circle,hsl(270_91%_65%/0.40),transparent_70%)]'
        } group-hover:opacity-50 group-hover:scale-110`}
        style={{ width: 40, height: 40 }}
      />

      {/* Glass capsule — أصغر وأشف */}
      <div
        className={`
          relative w-10 h-10 rounded-full
          bg-white/[0.06] dark:bg-white/[0.03]
          backdrop-blur-2xl backdrop-saturate-150
          border border-white/20 dark:border-white/10
          shadow-[0_4px_16px_-4px_rgba(0,0,0,0.15),inset_0_1px_0_0_rgba(255,255,255,0.25)]
          dark:shadow-[0_4px_16px_-4px_rgba(0,0,0,0.4),inset_0_1px_0_0_rgba(255,255,255,0.08)]
          transition-all duration-300 ease-out
          group-hover:scale-110 group-active:scale-95
          overflow-hidden
          flex items-center justify-center
        `}
      >
        {/* تدرج رقيق */}
        <div
          className={`absolute inset-0 rounded-full opacity-35 transition-all duration-500 ${
            atBottom
              ? 'bg-gradient-to-br from-sky-400/25 via-blue-500/10 to-indigo-600/15'
              : 'bg-gradient-to-br from-fuchsia-400/25 via-violet-500/12 to-indigo-600/15'
          }`}
        />

        {/* Highlight علوي */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-7 h-1.5 rounded-b-full bg-gradient-to-b from-white/30 to-transparent blur-[1px]" />

        {/* Icon */}
        <div className="relative z-10 text-white/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
          {atBottom ? (
            <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
          ) : (
            <ArrowDown className="w-4 h-4 animate-bounce" strokeWidth={2.5} />
          )}
        </div>
      </div>
    </div>
  );
};

export default FloatingScrollButton;
