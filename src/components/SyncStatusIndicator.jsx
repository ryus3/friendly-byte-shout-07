import React from 'react';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { cn } from '@/lib/utils';
import { Loader2, RotateCcw } from 'lucide-react';

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

  const handleClick = () => {
    if (!isSyncing && syncMode === 'standby') {
      fastSyncPendingOrders();
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
        "relative flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300",
        isSyncing ? "cursor-not-allowed" : "cursor-pointer hover:scale-105",
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
      <svg className="absolute w-10 h-10 transform -rotate-90" viewBox="0 0 32 32">
        <circle
          cx="16"
          cy="16"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-muted-foreground/20"
        />
        {/* Progress circle */}
        {syncCountdown > 0 && (
          <circle
            cx="16"
            cy="16"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={cn(
              "transition-all duration-1000 ease-linear",
              isSyncing ? "text-orange-500" : "text-primary"
            )}
          />
        )}
      </svg>

      {/* Center content */}
      <div className="relative z-10 flex items-center justify-center">
        {isSyncing ? (
          <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
        ) : syncCountdown > 0 ? (
          <span className="text-xs font-medium text-primary">
            {syncCountdown}
          </span>
        ) : (
          <RotateCcw className={cn(
            "w-4 h-4 transition-colors",
            syncMode === 'standby' ? "text-muted-foreground hover:text-primary" : "text-primary"
          )} />
        )}
      </div>

      {/* Status indicator dot */}
      <div className={cn(
        "absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-background transition-colors",
        isSyncing 
          ? "bg-orange-500 animate-pulse" 
          : syncMode === 'standby' 
            ? "bg-green-500" 
            : "bg-blue-500"
      )} />
    </div>
  );
};

export default SyncStatusIndicator;