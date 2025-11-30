import React from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import offlineManager from '@/utils/offlineManager';

const OfflineIndicator = () => {
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);
  const [syncInProgress, setSyncInProgress] = React.useState(false);
  const [showIndicator, setShowIndicator] = React.useState(!navigator.onLine);
  
  React.useEffect(() => {
    const unsubscribe = offlineManager.addListener(({ event, isOnline: online }) => {
      setIsOnline(online);
      
      if (event === 'offline') {
        setShowIndicator(true);
      } else if (event === 'online') {
        setShowIndicator(true);
        // إخفاء الشريط بعد 3 ثواني من الاتصال
        setTimeout(() => setShowIndicator(false), 3000);
      }
      
      if (event === 'sync-complete') {
        setSyncInProgress(false);
      }
    });
    
    return unsubscribe;
  }, []);
  
  const handleSync = () => {
    setSyncInProgress(true);
    offlineManager.syncPendingOperations();
  };
  
  return (
    <AnimatePresence>
      {showIndicator && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className={`fixed top-0 left-0 right-0 z-50 ${
            isOnline 
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500' 
              : 'bg-gradient-to-r from-amber-500 to-orange-500'
          } text-white shadow-lg`}
        >
          <div className="container mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isOnline ? (
                <Wifi className="w-5 h-5" />
              ) : (
                <WifiOff className="w-5 h-5" />
              )}
              <span className="font-medium">
                {isOnline 
                  ? '✅ تم الاتصال بالإنترنت' 
                  : '⚠️ أنت غير متصل بالإنترنت'}
              </span>
            </div>
            
            {!isOnline && (
              <div className="text-sm opacity-90">
                البيانات من الذاكرة المؤقتة
              </div>
            )}
            
            {isOnline && (
              <button
                onClick={handleSync}
                disabled={syncInProgress}
                className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${syncInProgress ? 'animate-spin' : ''}`} />
                <span className="text-sm">
                  {syncInProgress ? 'جاري المزامنة...' : 'مزامنة الآن'}
                </span>
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OfflineIndicator;
