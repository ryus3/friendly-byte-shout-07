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
    <div className={cn("relative group", className)}>
      {/* طبقة الخلفية المتحركة */}
      <div className="absolute -inset-2 rounded-full opacity-70 blur-sm animate-pulse">
        <div className="w-full h-full rounded-full bg-gradient-to-r from-primary via-purple-500 to-blue-500 animate-[spin_3s_linear_infinite]"></div>
      </div>
      
      {/* الحلقات الهولوغرافية */}
      <div className="absolute -inset-1 rounded-full">
        <div className="w-full h-full rounded-full border-2 border-gradient-to-r from-transparent via-primary/40 to-transparent animate-[spin_2s_linear_infinite]"></div>
      </div>
      <div className="absolute -inset-1 rounded-full">
        <div className="w-full h-full rounded-full border border-gradient-to-r from-primary/30 via-transparent to-blue-500/30 animate-[spin_4s_linear_infinite_reverse]"></div>
      </div>
      
      {/* تأثير الوهج الديناميكي */}
      <div className={cn(
        "absolute -inset-3 rounded-full transition-all duration-500",
        "opacity-0 group-hover:opacity-100",
        isSyncing ? "animate-pulse opacity-100" : "",
        isActive ? "bg-gradient-radial from-primary/20 via-primary/10 to-transparent" : "bg-gradient-radial from-blue-500/20 via-blue-500/10 to-transparent"
      )}></div>
      
      {/* نظام الجسيمات */}
      <div className="absolute inset-0 rounded-full overflow-hidden">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className={cn(
              "absolute w-1 h-1 bg-white/60 rounded-full",
              "animate-[particle_2s_linear_infinite]"
            )}
            style={{
              top: '50%',
              left: '50%',
              transform: `rotate(${i * 45}deg) translateY(-20px)`,
              animationDelay: `${i * 0.25}s`,
              animationDuration: `${2 + i * 0.1}s`
            }}
          ></div>
        ))}
      </div>
      
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={handleManualSync}
        disabled={isSyncing}
        className={cn(
          "relative h-12 w-12 rounded-full overflow-hidden",
          "bg-gradient-to-br from-primary/90 via-primary to-blue-600/90",
          "backdrop-blur-md border border-white/20",
          "text-white shadow-2xl",
          "transition-all duration-500 ease-out",
          "hover:scale-110 hover:shadow-[0_0_30px_rgba(59,130,246,0.5)]",
          "active:scale-95",
          "group-hover:border-white/40",
          isSyncing && "animate-[breathing_2s_ease-in-out_infinite]",
          !isSyncing && isActive && "animate-[breathing_3s_ease-in-out_infinite]",
          "before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/20 before:to-transparent",
          "before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300"
        )}
        title={isActive ? `مزامنة تلقائية خلال ${countdown} ثانية` : "اضغط للمزامنة الفورية"}
      >
        {/* تأثير الموجات عند الضغط */}
        <div className="absolute inset-0 rounded-full">
          <div className={cn(
            "absolute inset-0 rounded-full border-2 border-white/50",
            "scale-0 opacity-0",
            "group-active:animate-[ripple_0.6s_ease-out]"
          )}></div>
        </div>
        
        {/* العداد التنازلي ثلاثي الأبعاد */}
        {isActive && !isSyncing && (
          <div className="absolute -inset-1 rounded-full">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 44 44">
              {/* الحلقة الخلفية */}
              <circle
                cx="22"
                cy="22"
                r="20"
                fill="none"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="2"
              />
              {/* حلقة التقدم المتقدمة */}
              <circle
                cx="22"
                cy="22"
                r="20"
                fill="none"
                stroke="url(#progressGradient)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${(15 - countdown) * (125.6 / 15)}, 125.6`}
                className="transition-all duration-1000 ease-out drop-shadow-lg"
                style={{
                  filter: 'drop-shadow(0 0 5px rgba(255,255,255,0.8))'
                }}
              />
              <defs>
                <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="rgba(255,255,255,1)" />
                  <stop offset="50%" stopColor="rgba(147,197,253,1)" />
                  <stop offset="100%" stopColor="rgba(59,130,246,1)" />
                </linearGradient>
              </defs>
            </svg>
            
            {/* نقطة التقدم المتحركة */}
            <div 
              className="absolute w-2 h-2 bg-white rounded-full shadow-lg"
              style={{
                top: '50%',
                left: '50%',
                transform: `rotate(${((15 - countdown) / 15) * 360 - 90}deg) translateY(-20px) translateX(-50%)`,
                transformOrigin: '50% 20px',
                transition: 'transform 1s ease-out'
              }}
            ></div>
          </div>
        )}
        
        {isActive && !isSyncing ? (
          // وضع العداد التنازلي المحسن
          <div className="relative flex items-center justify-center z-10">
            <span className={cn(
              "text-lg font-bold text-white drop-shadow-lg",
              "animate-[countdownPulse_1s_ease-in-out_infinite]"
            )}>
              {countdown}
            </span>
          </div>
        ) : (
          // وضع المزامنة اليدوية المحسن
          <div className="relative flex items-center justify-center z-10">
            <RefreshCcw 
              className={cn(
                "h-5 w-5 text-white drop-shadow-lg",
                isSyncing && "animate-[syncSpin_1s_linear_infinite]",
                !isSyncing && "group-hover:animate-[wiggle_0.5s_ease-in-out]"
              )}
            />
          </div>
        )}
      </Button>
      
      {/* تأثير المغناطيسية على الحافة */}
      <div className={cn(
        "absolute -inset-4 rounded-full pointer-events-none",
        "bg-gradient-radial from-transparent via-primary/5 to-transparent",
        "opacity-0 group-hover:opacity-100 transition-opacity duration-500",
        "animate-[magneticField_3s_ease-in-out_infinite]"
      )}></div>
    </div>
  );
};

export default AutoSyncButton;