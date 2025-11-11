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
      
      // يظهر دائماً
      setVisible(scrolled > 0);
      
      // إذا كانت الصفحة قصيرة جداً (ارتفاع أقل من 200px)
      const scrollableHeight = docHeight - windowHeight;
      if (scrollableHeight < 200) {
        // الصفحة قصيرة - اعرض سهم للأعلى دائماً
        setAtBottom(true);
      } else {
        // الصفحة طويلة - تحديد الموقع بذكاء
        setAtBottom(scrolled + windowHeight >= docHeight - 50);
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // تحديث أولي
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToBottom = () => {
    const scrollHeight = document.documentElement.scrollHeight;
    const windowHeight = window.innerHeight;
    window.scrollTo({
      top: scrollHeight - windowHeight,
      behavior: 'smooth'
    });
  };

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  if (!visible) return null;

  return (
    <div className="fixed right-6 bottom-24 z-50">
      <Button
        onClick={atBottom ? scrollToTop : scrollToBottom}
        size="icon"
        className={`
          relative w-11 h-11 rounded-xl shadow-lg
          bg-primary/10 backdrop-blur-lg border-2 border-primary/30
          transition-all duration-300 ease-out
          hover:scale-110 hover:shadow-xl hover:bg-primary/20 hover:border-primary/50
          active:scale-95
          ${atBottom ? 'text-green-600 dark:text-green-400' : 'text-primary'}
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
