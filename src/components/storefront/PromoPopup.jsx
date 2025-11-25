import React, { useState, useEffect } from 'react';
import { X, Gift, Copy, Check } from 'lucide-react';
import GradientText from './ui/GradientText';
import GradientButton from './ui/GradientButton';

const PromoPopup = ({ code = 'WELCOME20', discount = '20%', delay = 3000 }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // عرض الـ popup بعد التأخير المحدد
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in duration-300"
        onClick={() => setIsVisible(false)}
      />

      {/* Popup */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div 
          className="relative bg-background rounded-3xl shadow-2xl max-w-md w-full p-8 pointer-events-auto animate-in zoom-in-95 duration-500"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            onClick={() => setIsVisible(false)}
            className="absolute top-4 left-4 p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="p-4 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg">
              <Gift className="w-12 h-12 text-white" />
            </div>
          </div>

          {/* Title */}
          <GradientText 
            gradient="from-purple-600 via-pink-600 to-blue-600" 
            className="text-2xl sm:text-3xl font-black text-center mb-3"
          >
            حصري للعملاء الجدد!
          </GradientText>

          {/* Description */}
          <p className="text-center text-lg text-muted-foreground mb-6">
            احصل على <span className="font-black text-purple-600">{discount}</span> خصم على أول طلب
          </p>

          {/* Code Box */}
          <div className="relative mb-6">
            <div className="p-4 rounded-xl bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-950/30 dark:to-pink-950/30 border-2 border-dashed border-purple-300 dark:border-purple-700">
              <p className="text-sm text-muted-foreground text-center mb-2">استخدم الكود:</p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-3xl font-black tracking-wider text-purple-600">
                  {code}
                </span>
                <button
                  onClick={handleCopy}
                  className="p-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white transition-colors"
                >
                  {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>

          {/* CTA Button */}
          <GradientButton
            variant="primary"
            size="lg"
            onClick={() => setIsVisible(false)}
            className="w-full"
          >
            ابدأ التسوق الآن
          </GradientButton>

          {/* Footer */}
          <p className="text-xs text-muted-foreground text-center mt-4">
            * العرض ساري لفترة محدودة
          </p>
        </div>
      </div>
    </>
  );
};

export default PromoPopup;
