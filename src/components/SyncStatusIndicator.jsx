import React, { useState, useEffect } from 'react';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { Loader2, RefreshCw } from 'lucide-react';

const SyncStatusIndicator = ({ className, debugMode = false }) => {
  const { 
    isSyncing, 
    syncCountdown, 
    syncMode, 
    lastSyncAt, 
    fastSyncPendingOrders,
    isLoggedIn,
    activePartner 
  } = useAlWaseet();
  
  const { theme } = useTheme();

  // Debug mode for testing - shows component always
  const shouldShow = debugMode || (isLoggedIn && activePartner === 'alwaseet');
  
  if (!shouldShow) {
    return null;
  }

  const [isSpinning, setIsSpinning] = useState(false);
  const [debugCountdown, setDebugCountdown] = useState(debugMode ? 15 : 0);

  // Debug mode countdown for testing
  useEffect(() => {
    if (debugMode && debugCountdown > 0) {
      const timer = setTimeout(() => {
        setDebugCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [debugMode, debugCountdown]);

  // Use debug countdown if in debug mode, otherwise use real countdown
  const currentCountdown = debugMode ? debugCountdown : syncCountdown;
  const currentIsSyncing = debugMode ? false : isSyncing;

  const handleClick = () => {
    if (debugMode) {
      setIsSpinning(true);
      // Start countdown after animation completes
      setTimeout(() => {
        setDebugCountdown(15);
        setIsSpinning(false);
      }, 1500);
    } else if (!currentIsSyncing && syncMode === 'standby') {
      setIsSpinning(true);
      // Start sync after animation completes
      setTimeout(() => {
        fastSyncPendingOrders();
        setIsSpinning(false);
      }, 1500);
    }
  };

  const formatLastSync = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffMinutes < 1) return 'منذ لحظات';
    if (diffMinutes < 60) return `منذ ${diffMinutes} دقيقة`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;
    return 'منذ أكثر من يوم';
  };

  // SVG Circle properties  
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const progress = currentCountdown > 0 ? (15 - currentCountdown) / 15 : 0;
  const strokeDashoffset = circumference - (progress * circumference);

  // Get number color based on theme
  const getNumberColor = () => {
    if (theme === 'dark') return 'text-white';
    if (theme === 'light') return 'bg-gradient-to-br from-sky-500 via-blue-500 to-purple-500 bg-clip-text text-transparent';
    // System theme - check actual applied theme
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return isDark ? 'text-white' : 'bg-gradient-to-br from-sky-500 via-blue-500 to-purple-500 bg-clip-text text-transparent';
  };

  return (
    <div 
      className={cn(
        "relative flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300",
        "bg-background shadow-md",
        currentIsSyncing ? "cursor-not-allowed opacity-80" : "cursor-pointer hover:scale-105",
        className
      )}
      onClick={handleClick}
      title={
        debugMode 
          ? `وضع الاختبار - العد: ${currentCountdown}`
          : currentIsSyncing 
            ? "جاري المزامنة..." 
            : currentCountdown > 0 
              ? `المزامنة التالية خلال ${currentCountdown} ثانية`
              : lastSyncAt 
                ? `آخر مزامنة: ${formatLastSync(lastSyncAt)}`
                : "اضغط للمزامنة السريعة"
      }
    >
      {/* Background and Progress circles */}
      <svg className="absolute w-10 h-10 transform -rotate-90" viewBox="0 0 40 40">
        <defs>
          <linearGradient id="syncGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(199, 89%, 58%)" />
            <stop offset="50%" stopColor="hsl(220, 70%, 55%)" />
            <stop offset="100%" stopColor="hsl(280, 87%, 57%)" />
          </linearGradient>
        </defs>
        
        {/* Background track - always visible */}
        <circle
          cx="20"
          cy="20"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="text-muted-foreground/50"
        />
        
        {/* Progress circle - only shown during countdown */}
        {currentCountdown > 0 && (
          <circle
            cx="20"
            cy="20"
            r={radius}
            fill="none"
            stroke="url(#syncGradient)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-linear"
          />
        )}
      </svg>

      {/* Center content */}
      <div className="relative z-10 flex items-center justify-center">
        {currentIsSyncing ? (
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
        ) : currentCountdown > 0 ? (
          <span className={cn("text-sm font-medium", getNumberColor())}>
            {currentCountdown}
          </span>
        ) : (
          <RefreshCw className={cn(
            "w-4 h-4 transition-all duration-500 text-muted-foreground",
            isSpinning && "animate-[spin_1.5s_ease-in-out]"
          )} />
        )}
      </div>
    </div>
  );
};

export default SyncStatusIndicator;