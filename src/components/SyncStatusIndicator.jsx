import React, { useState, useEffect } from 'react';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
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
      setDebugCountdown(15); // Reset countdown in debug mode
      setTimeout(() => setIsSpinning(false), 1000);
    } else if (!currentIsSyncing && syncMode === 'standby') {
      setIsSpinning(true);
      fastSyncPendingOrders();
      setTimeout(() => setIsSpinning(false), 1000);
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
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const progress = currentCountdown > 0 ? (15 - currentCountdown) / 15 : 0;
  const strokeDashoffset = circumference - (progress * circumference);

  return (
    <div 
      className={cn(
        "relative flex items-center justify-center w-14 h-14 rounded-full transition-all duration-500",
        "shadow-xl border-3 border-primary/40 backdrop-blur-md bg-gradient-to-br from-sky-400/20 to-purple-600/20",
        currentIsSyncing ? "cursor-not-allowed opacity-80" : "cursor-pointer hover:scale-110 hover:shadow-2xl hover:border-primary/60",
        !currentIsSyncing && currentCountdown === 0 && "animate-pulse",
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
      {/* Background circle */}
      <svg className="absolute w-14 h-14 transform -rotate-90" viewBox="0 0 56 56">
        <defs>
          <linearGradient id="syncGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(199, 89%, 58%)" />
            <stop offset="50%" stopColor="hsl(220, 70%, 55%)" />
            <stop offset="100%" stopColor="hsl(280, 87%, 57%)" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge> 
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        {/* Background track */}
        <circle
          cx="28"
          cy="28"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-muted-foreground/15"
        />
        {/* Progress circle */}
        {currentCountdown > 0 && (
          <circle
            cx="28"
            cy="28"
            r={radius}
            fill="none"
            stroke="url(#syncGradient)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-linear"
            filter="url(#glow)"
          />
        )}
      </svg>

      {/* Center content */}
      <div className="relative z-10 flex items-center justify-center">
        {currentIsSyncing ? (
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-sky-400 to-purple-600 opacity-20 animate-ping"></div>
            <Loader2 className="w-6 h-6 animate-spin text-transparent bg-gradient-to-r from-sky-400 to-purple-600 bg-clip-text" />
          </div>
        ) : currentCountdown > 0 ? (
          <span className="text-2xl font-bold text-transparent bg-gradient-to-r from-sky-400 to-purple-600 bg-clip-text drop-shadow-2xl animate-pulse">
            {currentCountdown}
          </span>
        ) : (
          <RefreshCw className={cn(
            "w-6 h-6 transition-all duration-500 text-transparent bg-gradient-to-r from-sky-400 to-purple-600 bg-clip-text",
            isSpinning && "animate-[spin_0.8s_ease-in-out]",
            !currentIsSyncing && "hover:scale-110 hover:rotate-180"
          )} />
        )}
      </div>
    </div>
  );
};

export default SyncStatusIndicator;