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
          "relative h-10 w-10 rounded-full bg-blue-100 hover:bg-blue-200 border-2 border-blue-300",
          "transition-all duration-300 hover:scale-105",
          isSyncing && "animate-pulse"
        )}
        title={isActive ? `مزامنة تلقائية خلال ${countdown} ثانية` : "اضغط للمزامنة الفورية"}
      >
        {isActive && !isSyncing ? (
          // Countdown mode
          <div className="relative flex items-center justify-center">
            <span className="text-sm font-bold text-blue-700">
              {countdown}
            </span>
          </div>
        ) : (
          // Manual sync mode
          <div className="relative flex items-center justify-center">
            <RefreshCcw 
              className={cn(
                "h-4 w-4 text-blue-700",
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