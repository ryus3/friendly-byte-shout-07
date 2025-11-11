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
      setVisible(true);
      
      // تحديد إذا كان في الأسفل (آخر 50px)
      setAtBottom(scrolled + windowHeight >= docHeight - 50);
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
          relative w-14 h-14 rounded-2xl shadow-2xl text-white 
          border border-white/10 backdrop-blur-md
          transition-all duration-500 ease-out
          hover:scale-110 hover:rotate-6 hover:shadow-[0_20px_60px_rgba(0,0,0,0.4)]
          active:scale-95
          ${atBottom 
            ? 'bg-gradient-to-br from-emerald-500 via-green-500 to-teal-600 hover:from-emerald-600 hover:via-green-600 hover:to-teal-700' 
            : 'bg-gradient-to-br from-blue-500 via-purple-500 to-pink-600 hover:from-blue-600 hover:via-purple-600 hover:to-pink-700'
          }
        `}
        aria-label={atBottom ? 'الصعود للأعلى' : 'النزول للأسفل'}
      >
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-black/20 to-transparent" />
        {atBottom ? (
          <ArrowUp className="w-6 h-6 relative z-10 drop-shadow-lg" />
        ) : (
          <ArrowDown className="w-6 h-6 relative z-10 drop-shadow-lg animate-bounce" />
        )}
      </Button>
    </div>
  );
};

export default FloatingScrollButton;
