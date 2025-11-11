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
      
      // يظهر فوراً عند أي تمرير
      setVisible(scrolled > 0);
      
      // تحديد إذا كان في الأسفل (آخر 100px)
      setAtBottom(scrolled + windowHeight >= docHeight - 100);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // تحديث أولي
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToBottom = () => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
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
    <div className="fixed left-6 bottom-24 z-50">
      <Button
        onClick={atBottom ? scrollToTop : scrollToBottom}
        size="icon"
        className={`
          w-12 h-12 rounded-full shadow-2xl text-white border-2 border-white/20 
          backdrop-blur-sm transition-all duration-300 hover:scale-110
          ${atBottom 
            ? 'bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700' 
            : 'bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
          }
        `}
        aria-label={atBottom ? 'الصعود للأعلى' : 'النزول للأسفل'}
      >
        {atBottom ? (
          <ArrowUp className="w-5 h-5" />
        ) : (
          <ArrowDown className="w-5 h-5" />
        )}
      </Button>
    </div>
  );
};

export default FloatingScrollButton;
