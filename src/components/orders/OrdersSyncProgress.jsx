import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * مؤشر تقدم احترافي عالمي للمزامنة - مطابق للسبلاش
 * يظهر في أعلى يمين الصفحة بتصميم أنيق وشفاف
 */
export const OrdersSyncProgress = ({ syncing, current, total }) => {
  const progressPercentage = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <AnimatePresence>
      {syncing && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed top-4 right-4 z-50 w-80"
        >
          <Card className="border-primary/20 bg-background/95 backdrop-blur-sm shadow-lg">
            <CardContent className="p-3">
              <div className="flex items-center gap-3 mb-2">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Loader2 className="h-4 w-4 text-primary" />
                </motion.div>
                <div className="flex-1">
                  <h4 className="text-xs font-medium text-foreground">
                    مزامنة جارية...
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {current} من {total} طلب ({progressPercentage}%)
                  </p>
                </div>
              </div>
              
              {/* شريط التقدم بنفس gradient السبلاش */}
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: `${progressPercentage}%` }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 rounded-full relative overflow-hidden"
                >
                  {/* تأثير اللمعان المتحرك - مطابق للسبلاش */}
                  <motion.div
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                  />
                </motion.div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OrdersSyncProgress;
