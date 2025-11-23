import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * مؤشر تقدم احترافي عالمي للمزامنة - مثل السبلاش
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
              
              <Progress 
                value={progressPercentage} 
                className="h-1.5 bg-secondary"
              />
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OrdersSyncProgress;
