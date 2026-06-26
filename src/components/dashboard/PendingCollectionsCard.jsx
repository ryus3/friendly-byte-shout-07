import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HandCoins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useOffChannelCollections } from '@/hooks/useOffChannelCollections';

/**
 * كرت "تحصيلات بانتظار التأكيد" — يظهر في الداشبورد بنفس تصميم StatCard.
 * يعرض عدد التحصيلات المعلقة بـ Badge ويفتح صفحة الـ inbox عند النقر.
 */
const PendingCollectionsCard = () => {
  const navigate = useNavigate();
  const { rows, loading } = useOffChannelCollections({ scope: 'inbox' });
  const count = rows.length;

  return (
    <motion.div
      className="h-full group relative cursor-pointer"
      whileHover={{ y: -5, transition: { type: 'spring', stiffness: 300, damping: 10 } }}
      onClick={() => navigate('/off-channel-inbox')}
    >
      <Card className="overflow-hidden h-full flex flex-col shadow-lg shadow-black/10 dark:shadow-black/30 hover:shadow-2xl hover:shadow-primary/10 dark:hover:shadow-primary/20">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/10 to-transparent rounded-xl pointer-events-none" />
        <div
          className="absolute inset-px rounded-xl opacity-60"
          style={{
            backgroundImage: `radial-gradient(circle at 40% 30%, hsl(var(--card-foreground) / 0.03), transparent), radial-gradient(circle at 90% 80%, hsl(var(--primary) / 0.05), transparent)`
          }}
        />
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 relative z-10">
          <CardTitle className="text-sm font-medium text-muted-foreground leading-tight flex-1">
            تحصيلات بانتظار التأكيد
          </CardTitle>
          {count > 0 && (
            <span className="relative flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white shadow-md">
              {count}
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 animate-ping rounded-full bg-red-400" />
            </span>
          )}
        </CardHeader>
        <CardContent className="flex-grow flex flex-col justify-between relative z-10">
          <motion.div className="flex-1 flex items-end justify-between" initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
            <div className="flex-1">
              <div className="flex items-baseline gap-2 text-2xl sm:text-3xl font-bold text-foreground break-words">
                <span>{loading ? '…' : count}</span>
                <span className="text-sm text-muted-foreground font-normal">
                  {count === 0 ? 'لا يوجد' : count === 1 ? 'تحصيل' : 'تحصيل'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {count > 0 ? 'اضغط للمراجعة والتأكيد' : 'كل التحصيلات مؤكدة'}
              </p>
            </div>
            <motion.div
              className={cn(
                'w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-lg flex items-center justify-center text-white transition-all duration-300',
                'bg-gradient-to-br from-amber-500 to-orange-600',
                'group-hover:scale-110 group-hover:rotate-[15deg]'
              )}
              transition={{ type: 'spring', stiffness: 400, damping: 10 }}
            >
              <HandCoins className="w-5 h-5 sm:w-6 sm:h-6" />
            </motion.div>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default PendingCollectionsCard;
