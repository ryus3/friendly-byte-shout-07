import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Edit } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { ScrollArea } from '@/components/ui/scroll-area';

const gradientMap = {
  'green-500': 'from-green-500',
  'emerald-500': 'to-emerald-500',
  'yellow-500': 'from-yellow-500',
  'amber-500': 'to-amber-500',
  'blue-500': 'from-blue-500',
  'sky-500': 'to-sky-500',
  'purple-500': 'from-purple-500',
  'violet-500': 'to-violet-500',
  'red-500': 'from-red-500',
  'orange-500': 'to-orange-500',
  'rose-500': 'from-rose-500',
  'pink-600': 'to-pink-600',
  'teal-500': 'from-teal-500',
  'cyan-500': 'to-cyan-600',
  'indigo-500': 'from-indigo-500',
  'slate-500': 'from-slate-500',
  'gray-600': 'to-gray-600',
};


const StatCard = ({ title, value, icon: Icon, colors, format, onPeriodChange, currentPeriod, onClick, periods, onEdit, children, subtitle }) => {
  // تحويل القيمة إلى رقم آمن مع التعامل مع null وundefined
  const safeValue = value == null || value === undefined || value === '' ? 0 : value;
  const displayValue = isNaN(Number(safeValue)) ? (format === 'text' ? safeValue : 0) : Number(safeValue);
  
  let formattedValue;
  let currencyUnit = null;
  
  if (format === 'currency') {
      formattedValue = displayValue.toLocaleString();
      currencyUnit = 'د.ع';
  } else if (format === 'number') {
      formattedValue = displayValue.toLocaleString();
  } else {
      formattedValue = displayValue;
  }

  const defaultPeriods = {
    today: 'اليوم',
    week: 'أسبوع',
    month: 'شهر',
    year: 'سنة',
    all: 'الكل',
  };

  const availablePeriods = periods || defaultPeriods;
  
  return (
    <motion.div 
      className={cn(
        "h-full group",
        "relative",
        onClick && "cursor-pointer"
      )}
      whileHover={{ y: -5, transition: { type: 'spring', stiffness: 300, damping: 10 } }}
      onClick={onClick}
    >
      <Card className={cn(
        "overflow-hidden h-full flex flex-col",
        "shadow-lg shadow-black/10 dark:shadow-black/30",
        "hover:shadow-2xl hover:shadow-primary/10",
        "dark:hover:shadow-primary/20",
      )}>
         <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/10 to-transparent rounded-xl pointer-events-none"></div>
         <div 
           className="absolute inset-px rounded-xl opacity-60"
           style={{
             backgroundImage: `radial-gradient(circle at 40% 30%, hsl(var(--card-foreground) / 0.03), transparent), radial-gradient(circle at 90% 80%, hsl(var(--primary) / 0.05), transparent)`
           }}
         ></div>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2 relative z-10">
          <div className="flex-1 space-y-1">
            <CardTitle className="text-sm font-medium text-muted-foreground leading-tight">
                {title}
            </CardTitle>
          </div>
          <div className="flex gap-1 ml-2">
            {onEdit && (
              <Button variant="ghost" size="icon" className="w-6 h-6 text-muted-foreground hover:bg-muted/50" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                <Edit className="w-3 h-3" />
              </Button>
            )}
            {onPeriodChange && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="w-6 h-6 text-muted-foreground hover:bg-muted/50" onClick={(e) => e.stopPropagation()}>
                    <MoreHorizontal className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {Object.entries(availablePeriods).map(([key, label]) => (
                    <DropdownMenuItem key={key} onSelect={() => onPeriodChange(key)}>
                      {label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-grow flex flex-col justify-between relative z-10">
            {children ? (
              <ScrollArea className="flex-grow h-24">
                {children}
              </ScrollArea>
            ) : (
              <motion.div 
                className="flex-1 flex items-end justify-between"
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                <div className="flex-1">
                  <div className="flex items-baseline gap-2 text-2xl sm:text-3xl font-bold text-foreground break-words">
                    <span>{formattedValue}</span>
                    {currencyUnit && (
                      <span className="text-sm text-muted-foreground font-normal">{currencyUnit}</span>
                    )}
                  </div>
                  {currentPeriod && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {availablePeriods[currentPeriod]}
                    </p>
                  )}
                  {subtitle && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {subtitle}
                    </p>
                  )}
                </div>
                {Icon && colors && (
                <motion.div 
                  className={cn(
                      "w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-lg flex items-center justify-center text-white transition-all duration-300",
                      "bg-gradient-to-br",
                      gradientMap[colors[0]],
                      gradientMap[colors[1]],
                      "group-hover:scale-110 group-hover:rotate-[15deg]"
                  )}
                  transition={{ type: 'spring', stiffness: 400, damping: 10 }}
                >
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                </motion.div>
              )}
              </motion.div>
            )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default StatCard;