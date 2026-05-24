import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Crown, Medal, Award, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import devLog from '@/lib/devLogger';

const RANK_STYLES = [
  { // 1st - gold
    ring: 'ring-2 ring-amber-400/60 shadow-[0_0_20px_-4px_hsl(45_100%_60%/0.5)]',
    bg: 'bg-gradient-to-br from-amber-400/25 to-yellow-600/15 text-amber-500',
    icon: Crown,
    label: '01',
  },
  { // 2nd - silver
    ring: 'ring-2 ring-slate-300/50',
    bg: 'bg-gradient-to-br from-slate-300/25 to-slate-500/15 text-slate-400',
    icon: Medal,
    label: '02',
  },
  { // 3rd - bronze
    ring: 'ring-2 ring-orange-400/40',
    bg: 'bg-gradient-to-br from-orange-400/25 to-amber-700/15 text-orange-500',
    icon: Award,
    label: '03',
  },
];

const parseNumeric = (v) => {
  if (typeof v === 'number') return v;
  if (!v) return 0;
  const n = parseInt(String(v).replace(/[^\d.-]/g, ''), 10);
  return isNaN(n) ? 0 : n;
};

const TopListCard = ({ title, items, titleIcon: TitleIcon, itemIcon: ItemIcon, sortByPhone = false, onViewAll }) => {
  React.useEffect(() => {
    devLog.log(`📊 TopListCard [${title}] - البيانات:`, {
      count: items?.length || 0,
      hasData: !!(items && items.length > 0)
    });
  }, [title, items?.length]);

  const processedItems = React.useMemo(() => {
    if (!items || items.length === 0) return [];
    const arr = sortByPhone
      ? items.map(item => ({
          ...item,
          label: item.phone && item.phone !== 'غير محدد' ? item.phone : item.label,
          phone: item.phone || 'غير محدد',
        }))
      : items;
    return arr.slice(0, 5);
  }, [items, sortByPhone]);

  const maxValue = React.useMemo(() => {
    if (!processedItems.length) return 1;
    const m = Math.max(...processedItems.map(i => parseNumeric(i.count ?? i.total ?? i.value)));
    return m > 0 ? m : 1;
  }, [processedItems]);

  return (
    <Card className="glass-effect h-full border-border/60 flex flex-col overflow-hidden relative">
      {/* aurora accent */}
      <div className="pointer-events-none absolute -top-12 -left-12 w-48 h-48 rounded-full bg-primary/15 blur-3xl" />
      <CardHeader className="relative">
        <CardTitle className="flex items-center justify-between gap-3 text-lg text-foreground">
          <div className="flex items-center gap-3">
            {TitleIcon && (
              <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                <TitleIcon className="w-5 h-5 text-primary" />
              </div>
            )}
            <span className="font-bold">{title}</span>
          </div>
          {processedItems.length > 0 && (
            <span className="text-[10px] font-semibold tracking-wider text-muted-foreground bg-muted/50 px-2 py-1 rounded-md">
              TOP {processedItems.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-4 pt-0 relative">
        <div className="space-y-3 flex-1">
          {processedItems.length > 0 ? processedItems.map((item, index) => {
            const rank = RANK_STYLES[index];
            const RankIcon = rank?.icon;
            const numericValue = parseNumeric(item.count ?? item.total ?? item.value);
            const pct = Math.max(8, Math.round((numericValue / maxValue) * 100));
            return (
              <motion.div
                key={index}
                className="group relative rounded-xl border border-border/40 bg-card/40 hover:bg-card/70 hover:border-primary/30 p-3 transition-all duration-300"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.07, duration: 0.4 }}
              >
                <div className="flex items-center gap-3">
                  {/* Rank badge */}
                  <div className={cn(
                    "relative flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center",
                    rank ? rank.bg : 'bg-muted/40 text-muted-foreground',
                    rank?.ring
                  )}>
                    {RankIcon ? (
                      <RankIcon className="w-5 h-5" />
                    ) : (
                      <span className="text-sm font-bold">{String(index + 1).padStart(2, '0')}</span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="font-semibold text-foreground truncate">{item.label}</p>
                      <span className="text-sm font-bold text-primary tabular-nums whitespace-nowrap">
                        {sortByPhone ? numericValue.toLocaleString() : (item.value ?? numericValue.toLocaleString())}
                      </span>
                    </div>
                    {sortByPhone && item.phone && item.phone !== item.label && (
                      <p className="text-xs text-muted-foreground mb-1.5 truncate">
                        <span className="font-medium text-primary/80">{item.phone}</span>
                      </p>
                    )}
                    {/* Progress bar */}
                    <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: index * 0.07 + 0.15, duration: 0.7, ease: 'easeOut' }}
                        className={cn(
                          "h-full rounded-full",
                          index === 0 ? 'bg-gradient-to-r from-amber-400 to-yellow-500' :
                          index === 1 ? 'bg-gradient-to-r from-slate-300 to-slate-500' :
                          index === 2 ? 'bg-gradient-to-r from-orange-400 to-amber-600' :
                          'bg-gradient-to-r from-primary/60 to-primary'
                        )}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          }) : (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
              {ItemIcon && <ItemIcon className="w-10 h-10 opacity-30" />}
              <p className="text-sm">لا توجد بيانات لعرضها</p>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          className="mt-4 w-full text-primary hover:bg-primary/10 group"
          onClick={onViewAll}
        >
          مشاهدة الكل
          <ArrowUpRight className="w-4 h-4 mr-1 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Button>
      </CardContent>
    </Card>
  );
};

export default TopListCard;
