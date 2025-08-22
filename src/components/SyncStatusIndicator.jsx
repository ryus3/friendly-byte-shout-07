import React, { useState } from 'react';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { cn } from '@/lib/utils';
import { Loader2, RefreshCw } from 'lucide-react';

const SyncStatusIndicator = ({ className }) => {
  const { 
    isSyncing, 
    syncCountdown, 
    syncMode, 
    lastSyncAt, 
    fastSyncPendingOrders,
    isLoggedIn,
    activePartner 
  } = useAlWaseet();

  // Only show for Al-Waseet when logged in
  if (!isLoggedIn || activePartner !== 'alwaseet') {
    return null;
  }

  const [isSpinning, setIsSpinning] = useState(false);

  const handleClick = () => {
    if (!isSyncing && syncMode === 'standby') {
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
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const progress = syncCountdown > 0 ? (15 - syncCountdown) / 15 : 0;
  const strokeDashoffset = circumference - (progress * circumference);

  return (
    <div 
      className={cn(
        "relative flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300",
        "shadow-lg border-2 border-primary/30 backdrop-blur-sm bg-white/10",
        isSyncing ? "cursor-not-allowed" : "cursor-pointer hover:scale-105 hover:shadow-xl",
        syncMode === 'standby' && !isSyncing && "animate-pulse",
        className
      )}
      onClick={handleClick}
      title={
        isSyncing 
          ? "جاري المزامنة..." 
          : syncCountdown > 0 
            ? `المزامنة التالية خلال ${syncCountdown} ثانية`
            : lastSyncAt 
              ? `آخر مزامنة: ${formatLastSync(lastSyncAt)}`
              : "اضغط للمزامنة السريعة"
      }
    >
      {/* Background circle */}
      <svg className="absolute w-12 h-12 transform -rotate-90" viewBox="0 0 48 48">
        <defs>
          <linearGradient id="syncGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(199, 89%, 48%)" />
            <stop offset="100%" stopColor="hsl(280, 87%, 47%)" />
          </linearGradient>
        </defs>
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-muted-foreground/20"
        />
        {/* Progress circle */}
        {syncCountdown > 0 && (
          <circle
            cx="24"
            cy="24"
            r={radius}
            fill="none"
            stroke="url(#syncGradient)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-linear drop-shadow-lg"
          />
        )}
      </svg>

      {/* Center content */}
      <div className="relative z-10 flex items-center justify-center">
        {isSyncing ? (
          <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
        ) : syncCountdown > 0 ? (
          <span className="text-lg font-bold text-white drop-shadow-lg animate-pulse">
            {syncCountdown}
          </span>
        ) : (
          <RefreshCw className={cn(
            "w-5 h-5 transition-all duration-300",
            isSpinning && "animate-spin",
            syncMode === 'standby' ? "text-muted-foreground hover:text-primary" : "text-primary"
          )} />
        )}
      </div>
    </div>
  );
};

export default SyncStatusIndicator;