import React from 'react';

const PremiumLoader = ({ message = 'جاري التحميل...' }) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-purple-50 dark:to-purple-950/20">
      {/* Animated Logo or Icon */}
      <div className="relative mb-8">
        <div className="w-24 h-24 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 animate-pulse" />
        <div className="absolute inset-0 w-24 h-24 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 animate-ping opacity-20" />
      </div>

      {/* Loading Text */}
      <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
        {message}
      </h2>

      {/* Animated Progress Bar */}
      <div className="w-64 h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 animate-loading" />
      </div>

      {/* Floating Dots */}
      <div className="flex gap-2 mt-8">
        <div className="w-3 h-3 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0s' }} />
        <div className="w-3 h-3 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '0.2s' }} />
        <div className="w-3 h-3 rounded-full bg-pink-500 animate-bounce" style={{ animationDelay: '0.4s' }} />
      </div>
    </div>
  );
};

export default PremiumLoader;
