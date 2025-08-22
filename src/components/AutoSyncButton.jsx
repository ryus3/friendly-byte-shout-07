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
          "relative p-0 h-12 w-12 rounded-full border-0 bg-transparent overflow-hidden group transition-all duration-500",
          "hover:scale-110 hover:shadow-2xl",
          !isSyncing && "hover:shadow-blue-500/40"
        )}
        title={isActive ? `مزامنة شاملة تلقائية خلال ${countdown} ثانية - جميع حالات الطلبات` : "اضغط للمزامنة الشاملة الفورية - جميع حالات الطلبات"}
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500 via-purple-600 to-emerald-500 opacity-90 group-hover:opacity-100 transition-opacity duration-300"></div>
        
        {/* Animated border gradient */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-400 via-purple-500 to-emerald-400 blur-sm opacity-60 group-hover:opacity-80 transition-opacity duration-300"></div>
        
        {/* Inner content container */}
        <div className="relative w-full h-full rounded-full bg-background/20 backdrop-blur-sm border border-white/20 flex items-center justify-center">
          {isActive && !isSyncing ? (
            // Countdown mode with circular progress
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Background circle */}
              <svg className="absolute w-10 h-10 -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="4"
                />
              </svg>
              
              {/* Progress circle */}
              <svg className="absolute w-10 h-10 -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="rgba(255,255,255,0.9)"
                  strokeWidth="4"
                  strokeDasharray="264"
                  strokeDashoffset={264 - ((15 - countdown) / 15) * 264}
                  className="transition-all duration-1000 ease-out"
                  strokeLinecap="round"
                  style={{
                    filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.6))'
                  }}
                />
              </svg>
              
              {/* Countdown number */}
              <span className="relative text-sm font-bold text-white z-10 drop-shadow-lg">
                {countdown}
              </span>
            </div>
          ) : (
            // Manual sync mode with double arrow icon
            <div className="relative">
              {isSyncing ? (
                // Syncing animation
                <div className="relative">
                  <RefreshCcw 
                    className="w-6 h-6 text-white animate-spin drop-shadow-lg" 
                    style={{
                      filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.8))'
                    }}
                  />
                  {/* Rotating particles */}
                  <div className="absolute inset-0 animate-pulse">
                    <div className="absolute top-0 left-1/2 w-1 h-1 bg-white rounded-full transform -translate-x-1/2 animate-ping"></div>
                    <div className="absolute bottom-0 left-1/2 w-1 h-1 bg-white rounded-full transform -translate-x-1/2 animate-ping" style={{ animationDelay: '0.5s' }}></div>
                    <div className="absolute left-0 top-1/2 w-1 h-1 bg-white rounded-full transform -translate-y-1/2 animate-ping" style={{ animationDelay: '0.25s' }}></div>
                    <div className="absolute right-0 top-1/2 w-1 h-1 bg-white rounded-full transform -translate-y-1/2 animate-ping" style={{ animationDelay: '0.75s' }}></div>
                  </div>
                </div>
              ) : (
                // Manual sync icon with glow effect
                <ArrowRightLeft 
                  className="w-6 h-6 text-white drop-shadow-lg group-hover:scale-110 transition-transform duration-300" 
                  style={{
                    filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.7))'
                  }}
                />
              )}
            </div>
          )}
        </div>
        
        {/* Hover glow effect */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-400/50 via-purple-500/50 to-emerald-400/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-md"></div>
      </Button>
    </div>
  );
};

export default AutoSyncButton;