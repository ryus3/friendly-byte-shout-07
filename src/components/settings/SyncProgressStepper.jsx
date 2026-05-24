import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Loader2, AlertCircle, FileText, Package, Link2, Sparkles, Settings2 } from 'lucide-react';

const STAGES = [
  { key: 'init',     label: 'تهيئة',          icon: Settings2 },
  { key: 'invoices', label: 'الفواتير',       icon: FileText },
  { key: 'orders',   label: 'الطلبات',        icon: Package },
  { key: 'linking',  label: 'الربط',          icon: Link2 },
  { key: 'done',     label: 'الإنهاء',        icon: Sparkles },
];

// 🔢 رقم متحرّك ناعم (CountUp)
const useCountUp = (target, duration = 400) => {
  const [val, setVal] = useState(target || 0);
  const fromRef = useRef(target || 0);
  useEffect(() => {
    const from = fromRef.current;
    const to = target || 0;
    if (from === to) return;
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
};



/**
 * 🎯 Stepper احترافي لعرض تقدم المزامنة الشاملة في الوقت الفعلي
 */
const SyncProgressStepper = ({ progress }) => {
  if (!progress) return null;

  const currentIdx = Math.max(0, STAGES.findIndex(s => s.key === progress.stage));
  const isFailed = progress.status === 'failed';
  const isDone = progress.status === 'completed';
  const pct = Math.min(100, Math.max(0, progress.percentage || 0));
  const animatedPct = useCountUp(pct, 350);
  const invCount = useCountUp(progress.invoices_synced || 0, 350);
  const ordCount = useCountUp(progress.orders_updated || 0, 350);
  const linkCount = useCountUp(progress.linked_count || 0, 350);


  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="rounded-2xl border border-primary/20 bg-gradient-to-br from-background via-background to-primary/5 p-4 shadow-lg backdrop-blur-sm"
      >
        {/* الرأس */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {isFailed ? (
              <AlertCircle className="h-5 w-5 text-destructive" />
            ) : isDone ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            ) : (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            )}
            <span className="text-sm font-bold text-foreground">
              {isFailed ? 'فشلت المزامنة' : isDone ? 'اكتملت المزامنة' : 'جاري المزامنة الشاملة...'}
            </span>
          </div>
          <span className="text-sm font-mono font-bold text-primary tabular-nums">{animatedPct}%</span>
        </div>

        {/* شريط التقدم */}
        <div className="relative h-2 bg-secondary/60 rounded-full overflow-hidden mb-4">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={`absolute inset-y-0 right-0 rounded-full ${
              isFailed
                ? 'bg-gradient-to-l from-red-500 to-rose-500'
                : 'bg-gradient-to-l from-blue-400 via-purple-400 to-pink-400'
            }`}
          >
            <motion.div
              animate={{ x: ['100%', '-200%'] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent"
            />
          </motion.div>
        </div>

        {/* مراحل Stepper */}
        <div className="grid grid-cols-5 gap-1 mb-3">
          {STAGES.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === currentIdx && !isDone && !isFailed;
            const isPassed = i < currentIdx || isDone;
            const failed = isFailed && i === currentIdx;
            return (
              <div key={s.key} className="flex flex-col items-center gap-1">
                <motion.div
                  initial={false}
                  animate={{ scale: isActive ? 1.1 : 1 }}
                  className={`relative h-8 w-8 rounded-full flex items-center justify-center transition-colors ${
                    failed
                      ? 'bg-destructive text-destructive-foreground'
                      : isPassed
                      ? 'bg-emerald-500 text-white'
                      : isActive
                      ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                      : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {isPassed && !failed ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : isActive ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </motion.div>
                <span className={`text-[10px] font-medium ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* رسالة الحالة + العنصر الحالي */}
        {(progress.message || progress.current_item) && (
          <motion.div
            key={`${progress.message}-${progress.current_item || ''}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-muted-foreground text-center pt-2 border-t border-border/50 space-y-1"
          >
            {progress.message && <div className="truncate">{progress.message}</div>}
            {progress.current_item && (
              <div className="font-mono text-[10px] text-primary/70 truncate">
                ⟳ {progress.current_item}
              </div>
            )}
          </motion.div>
        )}

        {/* عدّادات بأرقام متحرّكة */}
        {(invCount > 0 || ordCount > 0 || linkCount > 0) && (
          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border/50">
            <div className="text-center">
              <div className="text-lg font-bold text-blue-500 tabular-nums">{invCount}</div>
              <div className="text-[10px] text-muted-foreground">فواتير</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-purple-500 tabular-nums">{ordCount}</div>
              <div className="text-[10px] text-muted-foreground">طلبات</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-emerald-500 tabular-nums">{linkCount}</div>
              <div className="text-[10px] text-muted-foreground">روابط</div>
            </div>
          </div>
        )}

      </motion.div>
    </AnimatePresence>
  );
};

export default SyncProgressStepper;
