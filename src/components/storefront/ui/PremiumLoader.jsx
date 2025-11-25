import React from 'react';

const PremiumLoader = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-purple-50 dark:to-purple-950/20">
      {/* Animated Rings - تصميم عالمي بدون نصوص */}
      <div className="relative w-32 h-32">
        {/* Ring 1 - خارجي */}
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 border-r-purple-500 animate-spin" />
        {/* Ring 2 - وسط */}
        <div 
          className="absolute inset-4 rounded-full border-4 border-transparent border-b-pink-500 border-l-cyan-500 animate-spin" 
          style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} 
        />
        {/* Ring 3 - داخلي */}
        <div 
          className="absolute inset-8 rounded-full border-4 border-transparent border-t-purple-500 border-b-blue-500 animate-spin" 
          style={{ animationDuration: '1s' }} 
        />
        {/* مركز - نقطة متوهجة */}
        <div className="absolute inset-0 m-auto w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 animate-pulse shadow-2xl shadow-purple-500/50" />
      </div>

      {/* Animated Dots - بدون نص */}
      <div className="flex gap-3 mt-12">
        <div 
          className="w-4 h-4 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 animate-bounce shadow-lg" 
          style={{ animationDelay: '0s' }} 
        />
        <div 
          className="w-4 h-4 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 animate-bounce shadow-lg" 
          style={{ animationDelay: '0.15s' }} 
        />
        <div 
          className="w-4 h-4 rounded-full bg-gradient-to-r from-pink-500 to-orange-500 animate-bounce shadow-lg" 
          style={{ animationDelay: '0.3s' }} 
        />
      </div>
    </div>
  );
};

export default PremiumLoader;
