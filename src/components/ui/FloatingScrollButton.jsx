import { useState, useEffect } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

const FloatingScrollButton = () => {
  const [visible, setVisible] = useState(false);
  const [atBottom, setAtBottom] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY;
      const docHeight = document.documentElement.scrollHeight;
      const windowHeight = window.innerHeight;
      
      // حساب ارتفاع المحتوى القابل للتمرير
      const scrollableHeight = docHeight - windowHeight;
      
      if (scrollableHeight < 100) {
        // صفحة قصيرة جداً - لا نعرض الزر أصلاً
        setVisible(false);
      } else {
        // يظهر دائماً للصفحات الطويلة
        setVisible(true);
        
        // تحديد atBottom بدقة
        setAtBottom(scrolled + windowHeight >= docHeight - 100);
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // تحديث فوري عند التحميل
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleClick = () => {
    if (atBottom) {
      // scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // scroll to bottom
      const scrollHeight = document.documentElement.scrollHeight;
      const windowHeight = window.innerHeight;
      window.scrollTo({ top: scrollHeight - windowHeight, behavior: 'smooth' });
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed right-6 bottom-24 z-50">
      <Button
        onClick={handleClick}
        size="icon"
        className={`
          w-11 h-11 rounded-xl
          bg-white/10 dark:bg-black/10
          backdrop-blur-md
          border border-white/20 dark:border-white/10
          shadow-xl shadow-black/10 dark:shadow-white/5
          transition-all duration-300
          hover:scale-110 hover:bg-white/20 dark:hover:bg-black/20
          active:scale-95
          ${atBottom 
            ? 'text-blue-600 dark:text-blue-400' 
            : 'text-purple-600 dark:text-purple-400'
          }
        `}
        aria-label={atBottom ? 'الصعود للأعلى' : 'النزول للأسفل'}
      >
        {atBottom ? (
          <ArrowUp className="w-5 h-5" />
        ) : (
          <ArrowDown className="w-5 h-5 animate-bounce" />
        )}
      </Button>
    </div>
  );
};

export default FloatingScrollButton;
