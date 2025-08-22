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
    <Button 
      variant="ghost" 
      size="icon" 
      onClick={handleManualSync}
      disabled={isSyncing}
      className={cn(
        "relative h-8 w-8 rounded-full",
        "bg-card/80 backdrop-blur-sm",
        "border border-border",
        "shadow-sm",
        "transition-all duration-200 ease-out",
        "hover:bg-accent hover:border-border",
        "text-muted-foreground",
        className
      )}
      title={isActive ? `مزامنة تلقائية خلال ${countdown} ثانية` : "اضغط للمزامنة الفورية"}
    >
      {/* دائرة التقدم البسيطة */}
      {isActive && !isSyncing && (
        <div className="absolute inset-0 rounded-full">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 32 32">
            {/* الحلقة الخلفية */}
            <circle
              cx="16"
              cy="16"
              r="14"
              fill="none"
              stroke="hsl(var(--border))"
              strokeWidth="1.5"
            />
            {/* حلقة التقدم */}
            <circle
              cx="16"
              cy="16"
              r="14"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray={`${(15 - countdown) * (87.96 / 15)}, 87.96`}
              className="transition-all duration-1000 ease-out"
            />
          </svg>
        </div>
      )}
      
      {isActive && !isSyncing ? (
        // العداد التنازلي
        <div className="relative flex items-center justify-center text-sm font-semibold">
          {countdown}
        </div>
      ) : (
        // أيقونة المزامنة
        <RefreshCcw 
          className={cn(
            "h-4 w-4",
            isSyncing && "animate-spin"
          )}
        />
      )}
    </Button>
  );
};

export default AutoSyncButton;