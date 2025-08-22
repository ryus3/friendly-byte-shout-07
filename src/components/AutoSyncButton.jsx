import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCcw, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { cn } from '@/lib/utils';

const AutoSyncButton = ({ className }) => {
  const { syncAndApplyOrders, isLoggedIn, activePartner } = useAlWaseet();
  const [countdown, setCountdown] = useState(15);
  const [isActive, setIsActive] = useState(false); // Start in standby
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInStandbyMode, setIsInStandbyMode] = useState(true);
  const periodicIntervalRef = useRef(null);

  // Start sync countdown
  const startSyncCountdown = useCallback(() => {
    setIsInStandbyMode(false);
    setIsActive(true);
    setCountdown(15);
  }, []);

  // Enter standby mode
  const enterStandbyMode = useCallback(() => {
    setIsActive(false);
    setIsInStandbyMode(true);
  }, []);

  // Handle manual sync
  const handleManualSync = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isSyncing || activePartner === 'local' || !isLoggedIn) return;
    
    setIsSyncing(true);
    setIsActive(false);
    setIsInStandbyMode(false);
    
    try {
      await syncAndApplyOrders();
      enterStandbyMode();
    } catch (error) {
      console.error('خطأ في المزامنة اليدوية:', error);
      enterStandbyMode();
    } finally {
      setIsSyncing(false);
    }
  }, [syncAndApplyOrders, isLoggedIn, activePartner, isSyncing, enterStandbyMode]);

  // Auto sync when countdown reaches 0
  const handleAutoSync = useCallback(async () => {
    if (activePartner === 'local' || !isLoggedIn) {
      enterStandbyMode();
      return;
    }
    
    setIsSyncing(true);
    try {
      await syncAndApplyOrders();
    } catch (error) {
      console.error('خطأ في المزامنة التلقائية:', error);
    } finally {
      setIsSyncing(false);
      enterStandbyMode();
    }
  }, [syncAndApplyOrders, isLoggedIn, activePartner, enterStandbyMode]);

  // Periodic sync effect (every 10 minutes)
  useEffect(() => {
    if (activePartner === 'local' || !isLoggedIn) return;

    // Start first sync countdown after 10 minutes
    periodicIntervalRef.current = setInterval(() => {
      if (!isSyncing) {
        startSyncCountdown();
      }
    }, 10 * 60 * 1000); // 10 minutes

    return () => {
      if (periodicIntervalRef.current) {
        clearInterval(periodicIntervalRef.current);
      }
    };
  }, [activePartner, isLoggedIn, isSyncing, startSyncCountdown]);

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
        "border-2 border-border",
        "shadow-md",
        "transition-all duration-200 ease-out",
        "hover:bg-accent hover:border-accent",
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
              stroke="hsl(var(--muted-foreground))"
              strokeWidth="2"
              strokeLinecap="round"
              strokeOpacity="0.3"
            />
            {/* حلقة التقدم */}
            <circle
              cx="16"
              cy="16"
              r="14"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="2"
              strokeLinecap="round"
              strokeOpacity="0.9"
              strokeDasharray="87.96"
              strokeDashoffset="87.96"
              style={{
                animation: `progress-countdown 15s linear infinite`,
                animationPlayState: isActive ? 'running' : 'paused'
              }}
            />
          </svg>
        </div>
      )}
      
      {isActive && !isSyncing ? (
        // العداد التنازلي
        <div className="relative flex items-center justify-center text-sm font-semibold">
          {countdown}
        </div>
      ) : isSyncing ? (
        // أيقونة المزامنة النشطة
        <RefreshCcw 
          className={cn(
            "h-4 w-4",
            "animate-spin"
          )}
        />
      ) : (
        // سهمين في حالة الاستعداد
        <ArrowRightLeft 
          className="h-4 w-4"
        />
      )}
    </Button>
  );
};

export default AutoSyncButton;