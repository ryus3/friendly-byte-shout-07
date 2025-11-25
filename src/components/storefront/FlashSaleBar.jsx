import React, { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';

const FlashSaleBar = () => {
  const [timeLeft, setTimeLeft] = useState({
    hours: 23,
    minutes: 45,
    seconds: 30
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        let { hours, minutes, seconds } = prev;
        
        if (seconds > 0) {
          seconds--;
        } else {
          seconds = 59;
          if (minutes > 0) {
            minutes--;
          } else {
            minutes = 59;
            if (hours > 0) {
              hours--;
            } else {
              hours = 23;
            }
          }
        }
        
        return { hours, minutes, seconds };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 py-3">
      <div className="container mx-auto px-4">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-white">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse fill-yellow-300 text-yellow-300" />
            <span className="text-base sm:text-lg font-black">عرض محدود!</span>
          </div>
          
          <span className="text-sm sm:text-base font-bold">خصم يصل إلى 70% - ينتهي خلال:</span>
          
          <div className="flex items-center gap-2">
            <div className="bg-white/20 backdrop-blur-sm rounded-lg px-2 py-1 min-w-[40px] text-center">
              <span className="text-lg sm:text-xl font-black">{String(timeLeft.hours).padStart(2, '0')}</span>
            </div>
            <span className="font-black">:</span>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg px-2 py-1 min-w-[40px] text-center">
              <span className="text-lg sm:text-xl font-black">{String(timeLeft.minutes).padStart(2, '0')}</span>
            </div>
            <span className="font-black">:</span>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg px-2 py-1 min-w-[40px] text-center">
              <span className="text-lg sm:text-xl font-black">{String(timeLeft.seconds).padStart(2, '0')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FlashSaleBar;
