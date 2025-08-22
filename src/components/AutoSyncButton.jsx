import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCcw, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { cn } from '@/lib/utils';

const AutoSyncButton = ({ className }) => {
  const { syncAndApplyOrders, isLoggedIn, activePartner } = useAlWaseet();
  const [countdown, setCountdown] = useState(15);
  const [isActive, setIsActive] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Reset timer
  const resetTimer = useCallback(() => {
    setCountdown(15);
    setIsActive(true);
  }, []);

  // Handle manual sync
  const handleManualSync = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isSyncing || activePartner === 'local' || !isLoggedIn) return;
    
    setIsSyncing(true);
    setIsActive(false);
    
    try {
      await syncAndApplyOrders();
      resetTimer();
    } catch (error) {
      console.error('خطأ في المزامنة اليدوية:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [syncAndApplyOrders, isLoggedIn, activePartner, isSyncing, resetTimer]);

  // Auto sync when countdown reaches 0
  const handleAutoSync = useCallback(async () => {
    if (activePartner === 'local' || !isLoggedIn) {
      resetTimer();
      return;
    }
    
    setIsSyncing(true);
    try {
      await syncAndApplyOrders();
    } catch (error) {
      console.error('خطأ في المزامنة التلقائية:', error);
    } finally {
      setIsSyncing(false);
      resetTimer();
    }
  }, [syncAndApplyOrders, isLoggedIn, activePartner, resetTimer]);

  // Countdown effect
  useEffect(() => {
    if (!isActive || activePartner === 'local' || !isLoggedIn) return;

    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setIsActive(false);
          handleAutoSync();
          return 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, activePartner, isLoggedIn, handleAutoSync]);

  // Don't show for local delivery
  if (activePartner === 'local' || !isLoggedIn) {
    return null;
  }

  return (
    <div className={cn("relative", className)}>
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={handleManualSync}
        disabled={isSyncing}
        className={cn(
          "relative h-10 w-10 rounded-full bg-gradient-to-r from-primary to-blue-500",
          "hover:shadow-lg hover:shadow-primary/50 text-primary-foreground shadow-md",
          "transition-all duration-300 hover:scale-105 hover:-translate-y-0.5",
          "border border-primary/20 backdrop-blur-sm",
          isSyncing && "animate-pulse"
        )}
        title={isActive ? `مزامنة تلقائية خلال ${countdown} ثانية` : "اضغط للمزامنة الفورية"}
      >
        {/* دائرة التقدم للعداد التنازلي */}
        {isActive && !isSyncing && (
          <div className="absolute inset-0 rounded-full">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                d="m18,2.0845 a 15.9155,15.9155 0 0,1 0,31.831 a 15.9155,15.9155 0 0,1 0,-31.831"
                fill="none"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="2"
              />
              <path
                d="m18,2.0845 a 15.9155,15.9155 0 0,1 0,31.831 a 15.9155,15.9155 0 0,1 0,-31.831"
                fill="none"
                stroke="rgba(255,255,255,0.8)"
                strokeWidth="2"
                strokeDasharray={`${(15 - countdown) * (100 / 15)}, 100`}
                className="transition-all duration-1000 ease-linear"
              />
            </svg>
          </div>
        )}
        
        {isActive && !isSyncing ? (
          // Countdown mode
          <div className="relative flex items-center justify-center z-10">
            <span className="text-sm font-bold text-white drop-shadow-sm">
              {countdown}
            </span>
          </div>
        ) : (
          // Manual sync mode
          <div className="relative flex items-center justify-center z-10">
            <RefreshCcw 
              className={cn(
                "h-4 w-4 text-white drop-shadow-sm",
                isSyncing && "animate-spin"
              )}
            />
          </div>
        )}
      </Button>
    </div>
  );
};

export default AutoSyncButton;