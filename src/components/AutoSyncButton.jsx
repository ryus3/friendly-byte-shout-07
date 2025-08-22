import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { cn } from '@/lib/utils';

const AutoSyncButton = ({ className }) => {
  const { fastSyncPendingOrders, isLoggedIn, activePartner } = useAlWaseet();
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
      await fastSyncPendingOrders();
      resetTimer();
    } catch (error) {
      console.error('خطأ في المزامنة اليدوية:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [fastSyncPendingOrders, isLoggedIn, activePartner, isSyncing, resetTimer]);

  // Auto sync when countdown reaches 0
  const handleAutoSync = useCallback(async () => {
    if (activePartner === 'local' || !isLoggedIn) {
      resetTimer();
      return;
    }
    
    setIsSyncing(true);
    try {
      await fastSyncPendingOrders();
    } catch (error) {
      console.error('خطأ في المزامنة التلقائية:', error);
    } finally {
      setIsSyncing(false);
      resetTimer();
    }
  }, [fastSyncPendingOrders, isLoggedIn, activePartner, resetTimer]);

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
    return (
      <Button 
        variant="ghost" 
        size="icon" 
        className={cn("text-muted-foreground/50 cursor-not-allowed", className)}
        disabled
        title="غير متاح للتوصيل المحلي"
      >
        <RefreshCw className="w-5 h-5" />
      </Button>
    );
  }

  // Calculate progress for circle animation
  const progress = ((15 - countdown) / 15) * 283; // 283 is circumference of circle with radius 45

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      onClick={handleManualSync}
      disabled={isSyncing}
      className={cn(
        "relative text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors",
        className
      )}
      title={isActive ? `مزامنة تلقائية خلال ${countdown} ثانية` : "اضغط للمزامنة الفورية"}
    >
      {isActive && !isSyncing ? (
        // Countdown circle
        <div className="relative w-8 h-8 flex items-center justify-center">
          {/* Background circle */}
          <svg className="absolute w-8 h-8 -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              opacity="0.2"
            />
          </svg>
          
          {/* Progress circle */}
          <svg className="absolute w-8 h-8 -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeDasharray="283"
              strokeDashoffset={283 - progress}
              className="transition-all duration-1000 ease-linear text-primary"
              strokeLinecap="round"
            />
          </svg>
          
          {/* Countdown number */}
          <span className="text-xs font-bold text-foreground">
            {countdown}
          </span>
        </div>
      ) : (
        // Sync arrows
        <RefreshCw 
          className={cn(
            "w-5 h-5",
            isSyncing && "animate-spin"
          )} 
        />
      )}
    </Button>
  );
};

export default AutoSyncButton;