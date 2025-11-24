import { useEffect, useState, useRef } from 'react';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { useTheme } from '@/contexts/ThemeContext';
import { RefreshCw, Loader2 } from 'lucide-react';
import OrdersSyncProgress from '@/components/orders/OrdersSyncProgress';

const SyncStatusIndicator = ({ className }) => {
  const {
    isSyncing,
    syncCountdown,
    syncMode,
    lastSyncAt,
    performSyncWithCountdown,
    isLoggedIn,
    activePartner,
    autoSyncEnabled
  } = useAlWaseet();
  
  const { theme } = useTheme();

  // Show when logged into AlWaseet or MODON
  if (!isLoggedIn || (activePartner !== 'alwaseet' && activePartner !== 'modon')) {
    return null;
  }

  const [isSpinning, setIsSpinning] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0, syncing: false });

  const handleClick = async () => {
    if (isSyncing || syncMode === 'countdown') return;

    setSyncProgress({ syncing: true, current: 0, total: 0 });

    try {
      await performSyncWithCountdown(null, (progress) => {
        setSyncProgress({ 
          syncing: true, 
          current: progress?.processedOrders || 0, 
          total: progress?.totalOrders || 0 
        });
      });
    } catch (error) {
      console.error('[SyncStatusIndicator] خطأ في المزامنة:', error);
    }
    // لا حاجة لـ finally - useEffect سيتولى إيقاف isSpinning
  };

  const prevIsSyncingRef = useRef(isSyncing);

  // ربط isSpinning مباشرة بـ isSyncing لإيقاف فوري
  useEffect(() => {
    if (isSyncing) {
      setIsSpinning(true);
    } else if (!isSyncing && isSpinning) {
      const timer = setTimeout(() => setIsSpinning(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isSyncing, isSpinning]);

  // إخفاء شريط التقدم بسرعة عند الانتهاء
  useEffect(() => {
    if (prevIsSyncingRef.current && !isSyncing && syncProgress.syncing) {
      // إخفاء فوري عند 100%
      const delay = (syncProgress.current === syncProgress.total && syncProgress.total > 0) ? 150 : 250;
      const timer = setTimeout(() => {
        setSyncProgress({ syncing: false, current: 0, total: 0 });
      }, delay);
      
      prevIsSyncingRef.current = isSyncing;
      return () => clearTimeout(timer);
    }
    
    prevIsSyncingRef.current = isSyncing;
  }, [isSyncing, syncProgress]);

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
  const progress = syncCountdown > 0 ? (5 - syncCountdown) / 5 : 0;
  const strokeDashoffset = circumference - (progress * circumference);

  // Get number color based on theme
  const getNumberColor = () => {
    if (theme === 'dark') return 'text-white';
    if (theme === 'light') return 'bg-gradient-to-br from-sky-500 via-blue-500 to-purple-500 bg-clip-text text-transparent';
    // System theme - check actual applied theme
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return isDark ? 'text-white' : 'bg-gradient-to-br from-sky-500 via-blue-500 to-purple-500 bg-clip-text text-transparent';
  };

  return (
    <>
      {/* شريط التقدم العائم */}
      <OrdersSyncProgress 
        syncing={syncProgress.syncing}
        current={syncProgress.current}
        total={syncProgress.total}
      />
      
      <div 
        className={`relative flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300 backdrop-blur-sm bg-white/90 dark:bg-gray-800/90 shadow-lg border ${
          autoSyncEnabled 
            ? "border-border/50" 
            : "border-orange-300 dark:border-orange-600 bg-orange-50/80 dark:bg-orange-950/50"
        } ${
          syncMode === 'countdown' || syncMode === 'syncing' ? "cursor-not-allowed opacity-80" : "cursor-pointer hover:scale-105"
        } ${className}`}
        onClick={handleClick}
        title={
          syncMode === 'syncing'
            ? "جاري المزامنة..." 
            : syncMode === 'countdown'
              ? `المزامنة خلال ${syncCountdown} ثانية`
              : lastSyncAt 
                ? `آخر مزامنة: ${formatLastSync(lastSyncAt)}${autoSyncEnabled ? '' : ' (المزامنة التلقائية معطلة)'}`
                : `اضغط للمزامنة السريعة${autoSyncEnabled ? '' : ' (المزامنة التلقائية معطلة)'}`
        }
      >
      {/* Background and Progress circles */}
      <svg className="absolute w-10 h-10 transform -rotate-90" viewBox="0 0 40 40">
        <defs>
          <linearGradient id="syncGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(199, 89%, 58%)" />
            <stop offset="50%" stopColor="hsl(220, 70%, 55%)" />
            <stop offset="100%" stopColor="hsl(280, 87%, 57%)" />
          </linearGradient>
        </defs>
        
        {/* Background track - always visible */}
        <circle
          cx="20"
          cy="20"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="text-muted-foreground/30"
        />
        
        {/* Progress circle - only shown during countdown */}
        {syncMode === 'countdown' && syncCountdown > 0 && (
          <circle
            cx="20"
            cy="20"
            r={radius}
            fill="none"
            stroke="url(#syncGradient)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-linear"
          />
        )}
      </svg>

      {/* Center content */}
      <div className="relative z-10 flex items-center justify-center">
        {syncMode === 'syncing' ? (
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
        ) : syncMode === 'countdown' && syncCountdown > 0 ? (
          <span className={`text-sm font-medium ${getNumberColor()}`}>
            {syncCountdown}
          </span>
        ) : (
          <RefreshCw className={`w-4 h-4 transition-all duration-500 ${
            autoSyncEnabled 
              ? "text-muted-foreground" 
              : "text-orange-500 dark:text-orange-400"
          } ${isSpinning && "animate-[spin_1.5s_ease-in-out]"}`} />
        )}
      </div>
      </div>
    </>
  );
};

export default SyncStatusIndicator;
