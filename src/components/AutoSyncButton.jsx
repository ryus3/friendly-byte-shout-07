import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
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

  // Handle manual sync - comprehensive sync with all order statuses
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

  // Auto sync when countdown reaches 0 - comprehensive sync
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

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      onClick={handleManualSync}
      disabled={isSyncing}
      className={cn(
        "relative text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-primary/25",
        className
      )}
      title={isActive ? `مزامنة شاملة تلقائية خلال ${countdown} ثانية - جميع حالات الطلبات` : "اضغط للمزامنة الشاملة الفورية - جميع حالات الطلبات"}
    >
      {isActive && !isSyncing ? (
        // Premium countdown circle with gradient
        <div className="relative w-9 h-9 flex items-center justify-center">
          {/* Outer glow */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary/30 to-primary-variant/30 blur-sm"></div>
          
          {/* Background circle */}
          <svg className="absolute w-8 h-8 -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              opacity="0.15"
            />
          </svg>
          
          {/* Progress circle with gradient */}
          <svg className="absolute w-8 h-8 -rotate-90" viewBox="0 0 100 100">
            <defs>
              <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="hsl(var(--primary))" />
                <stop offset="100%" stopColor="hsl(var(--primary-variant))" />
              </linearGradient>
            </defs>
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="url(#progressGradient)"
              strokeWidth="3"
              strokeDasharray="264"
              strokeDashoffset={264 - ((15 - countdown) / 15) * 264}
              className="transition-all duration-1000 ease-out drop-shadow-lg"
              strokeLinecap="round"
              style={{
                filter: 'drop-shadow(0 0 4px hsl(var(--primary) / 0.5))'
              }}
            />
          </svg>
          
          {/* Inner background */}
          <div className="absolute inset-2 rounded-full bg-background/90 backdrop-blur-sm border border-primary/20"></div>
          
          {/* Countdown number with premium styling */}
          <span className="relative text-xs font-bold bg-gradient-to-br from-primary to-primary-variant bg-clip-text text-transparent z-10">
            {countdown}
          </span>
        </div>
      ) : (
        // Premium sync icon with effects
        <div className="relative">
          <div className={cn(
            "absolute inset-0 rounded-full transition-all duration-300",
            isSyncing && "bg-gradient-to-r from-primary/20 to-primary-variant/20 animate-pulse"
          )}></div>
          <RefreshCw 
            className={cn(
              "w-5 h-5 relative z-10 transition-all duration-300",
              isSyncing && "animate-spin text-primary drop-shadow-lg"
            )} 
            style={{
              filter: isSyncing ? 'drop-shadow(0 0 6px hsl(var(--primary) / 0.6))' : 'none'
            }}
          />
        </div>
      )}
    </Button>
  );
};

export default AutoSyncButton;