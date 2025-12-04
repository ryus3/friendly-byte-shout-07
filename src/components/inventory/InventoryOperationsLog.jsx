import React, { useState, useEffect, useMemo } from 'react';
import { 
  History, Loader2, X, Plus, Minus, Package, ShoppingCart, 
  ArrowUpRight, ArrowDownRight, Wrench, Edit3, RefreshCw, 
  Filter, Calendar, TrendingUp, TrendingDown, Clock, User,
  Hash, FileText
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday, differenceInDays, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';

const InventoryOperationsLog = ({ isAdmin }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [showDialog, setShowDialog] = useState(false);
  const [filterType, setFilterType] = useState('all');

  if (!isAdmin) return null;

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('get_inventory_operations_log', {
          p_limit: 200,
          p_operation_type: filterType === 'all' ? null : filterType
        });
      
      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
      toast({
        title: "خطأ في جلب السجل",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (showDialog) {
      fetchLogs();
    }
  }, [showDialog, filterType]);

  // تجميع السجلات حسب التاريخ
  const groupedLogs = useMemo(() => {
    const groups = {};
    
    logs.forEach(log => {
      if (!log.performed_at) return;
      
      const date = parseISO(log.performed_at);
      let dateKey;
      
      if (isToday(date)) {
        dateKey = 'اليوم';
      } else if (isYesterday(date)) {
        dateKey = 'أمس';
      } else if (differenceInDays(new Date(), date) < 7) {
        dateKey = format(date, 'EEEE', { locale: ar });
      } else {
        dateKey = format(date, 'dd MMMM yyyy', { locale: ar });
      }
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(log);
    });
    
    return groups;
  }, [logs]);

  // إحصائيات سريعة
  const stats = useMemo(() => {
    const todayLogs = logs.filter(log => log.performed_at && isToday(parseISO(log.performed_at)));
    
    return {
      totalToday: todayLogs.length,
      soldToday: todayLogs.filter(l => l.operation_type === 'sold').length,
      reservedToday: todayLogs.filter(l => l.operation_type === 'reserved').length,
    };
  }, [logs]);

  const getOperationConfig = (type, quantityChange) => {
    const configs = {
      stock_added: {
        label: 'إضافة مخزون',
        icon: Plus,
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
        borderColor: 'border-emerald-200 dark:border-emerald-800',
        dotColor: 'bg-emerald-500',
      },
      stock_reduced: {
        label: 'تقليل مخزون',
        icon: Minus,
        color: 'text-red-600',
        bgColor: 'bg-red-50 dark:bg-red-950/30',
        borderColor: 'border-red-200 dark:border-red-800',
        dotColor: 'bg-red-500',
      },
      reserved: {
        label: 'حجز للطلب',
        icon: Package,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50 dark:bg-blue-950/30',
        borderColor: 'border-blue-200 dark:border-blue-800',
        dotColor: 'bg-blue-500',
      },
      released: {
        label: 'تحرير محجوز',
        icon: ArrowUpRight,
        color: 'text-amber-600',
        bgColor: 'bg-amber-50 dark:bg-amber-950/30',
        borderColor: 'border-amber-200 dark:border-amber-800',
        dotColor: 'bg-amber-500',
      },
      sold: {
        label: 'تسجيل مبيع',
        icon: ShoppingCart,
        color: 'text-purple-600',
        bgColor: 'bg-purple-50 dark:bg-purple-950/30',
        borderColor: 'border-purple-200 dark:border-purple-800',
        dotColor: 'bg-purple-500',
      },
      returned: {
        label: 'إرجاع للمخزون',
        icon: ArrowDownRight,
        color: 'text-cyan-600',
        bgColor: 'bg-cyan-50 dark:bg-cyan-950/30',
        borderColor: 'border-cyan-200 dark:border-cyan-800',
        dotColor: 'bg-cyan-500',
      },
      audit_correction: {
        label: 'تصحيح فحص',
        icon: Wrench,
        color: 'text-orange-600',
        bgColor: 'bg-orange-50 dark:bg-orange-950/30',
        borderColor: 'border-orange-200 dark:border-orange-800',
        dotColor: 'bg-orange-500',
      },
      manual_edit: {
        label: 'تعديل يدوي',
        icon: Edit3,
        color: 'text-gray-600',
        bgColor: 'bg-gray-50 dark:bg-gray-950/30',
        borderColor: 'border-gray-200 dark:border-gray-800',
        dotColor: 'bg-gray-500',
      },
    };
    return configs[type] || configs.manual_edit;
  };

  // حساب التغيير بوضوح
  const formatChange = (before, after, label) => {
    if (before === null || after === null || before === after) return null;
    
    const diff = after - before;
    const isPositive = diff > 0;
    
    return {
      label,
      diff,
      isPositive,
      display: isPositive ? `+${diff}` : `${diff}`,
      before,
      after
    };
  };

  const luxuryButtonStyle = {
    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 50%, #6d28d9 100%)',
    color: 'white',
    fontWeight: '600',
    padding: '10px 20px',
    borderRadius: '12px',
    border: 'none',
    boxShadow: '0 4px 20px rgba(139, 92, 246, 0.4), 0 0 40px rgba(124, 58, 237, 0.2)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.3s ease',
    fontSize: '14px',
    position: 'relative',
    overflow: 'hidden',
  };

  return (
    <>
      <button
        onClick={() => setShowDialog(true)}
        style={luxuryButtonStyle}
        className="group hover:scale-105 hover:shadow-[0_6px_30px_rgba(139,92,246,0.5)] active:scale-95"
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 50%, #5b21b6 100%)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 50%, #6d28d9 100%)';
        }}
      >
        <span 
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
            animation: 'shimmer 2s infinite',
          }}
        />
        <History className="w-4 h-4 group-hover:rotate-12 transition-transform" />
        <span>سجل العمليات</span>
      </button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden bg-background border-border">
          {/* Header */}
          <div className="relative bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 p-4 sm:p-6">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjIiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIvPjwvZz48L3N2Zz4=')] opacity-50" />
            <DialogHeader className="relative">
              <DialogTitle className="flex items-center gap-3 text-white text-lg sm:text-xl font-bold">
                <div className="p-2 bg-white/20 rounded-full backdrop-blur-sm">
                  <History className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <span>سجل عمليات المخزون</span>
              </DialogTitle>
            </DialogHeader>
            
            {/* إحصائيات سريعة */}
            {logs.length > 0 && (
              <div className="flex items-center gap-4 mt-4 text-white/90 text-sm">
                <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5">
                  <FileText className="w-4 h-4" />
                  <span>{logs.length} عملية</span>
                </div>
                {stats.totalToday > 0 && (
                  <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5">
                    <Clock className="w-4 h-4" />
                    <span>{stats.totalToday} اليوم</span>
                  </div>
                )}
                {stats.soldToday > 0 && (
                  <div className="flex items-center gap-2 bg-purple-400/30 rounded-lg px-3 py-1.5">
                    <ShoppingCart className="w-4 h-4" />
                    <span>{stats.soldToday} مبيع</span>
                  </div>
                )}
              </div>
            )}
            
            <button 
              onClick={() => setShowDialog(false)}
              className="absolute top-4 left-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* الفلاتر */}
          <div className="flex items-center gap-3 p-4 border-b border-border bg-muted/30">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="نوع العملية" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع العمليات</SelectItem>
                <SelectItem value="stock_added">إضافة مخزون</SelectItem>
                <SelectItem value="stock_reduced">تقليل مخزون</SelectItem>
                <SelectItem value="reserved">حجز للطلب</SelectItem>
                <SelectItem value="released">تحرير محجوز</SelectItem>
                <SelectItem value="sold">تسجيل مبيع</SelectItem>
                <SelectItem value="returned">إرجاع للمخزون</SelectItem>
                <SelectItem value="audit_correction">تصحيح فحص</SelectItem>
                <SelectItem value="manual_edit">تعديل يدوي</SelectItem>
              </SelectContent>
            </Select>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchLogs}
              disabled={isLoading}
              className="mr-auto"
            >
              <RefreshCw className={cn("w-4 h-4 ml-1", isLoading && "animate-spin")} />
              تحديث
            </Button>
          </div>

          {/* المحتوى - Timeline */}
          <ScrollArea className="flex-1 max-h-[calc(90vh-280px)]">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-20">
                <History className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground">لا توجد عمليات مسجلة</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  سيتم تسجيل أي تغيير في المخزون تلقائياً
                </p>
              </div>
            ) : (
              <div className="p-4">
                {Object.entries(groupedLogs).map(([dateGroup, groupLogs]) => (
                  <div key={dateGroup} className="mb-6">
                    {/* عنوان المجموعة */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-sm font-semibold">
                        <Calendar className="w-4 h-4" />
                        {dateGroup}
                      </div>
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-xs text-muted-foreground">
                        {groupLogs.length} عملية
                      </span>
                    </div>
                    
                    {/* Timeline */}
                    <div className="relative pr-4">
                      {/* خط Timeline */}
                      <div className="absolute right-[7px] top-2 bottom-2 w-0.5 bg-border" />
                      
                      {groupLogs.map((log, idx) => {
                        const config = getOperationConfig(log.operation_type);
                        const Icon = config.icon;
                        
                        // حساب التغييرات
                        const changes = [
                          formatChange(log.quantity_before, log.quantity_after, 'مخزون'),
                          formatChange(log.reserved_before, log.reserved_after, 'محجوز'),
                          formatChange(log.sold_before, log.sold_after, 'مباع'),
                        ].filter(Boolean);
                        
                        return (
                          <div 
                            key={log.id || idx}
                            className="relative pr-8 pb-4 last:pb-0"
                          >
                            {/* نقطة Timeline */}
                            <div className={cn(
                              "absolute right-0 top-1 w-[14px] h-[14px] rounded-full border-2 border-background z-10",
                              config.dotColor
                            )} />
                            
                            {/* بطاقة العملية */}
                            <div className={cn(
                              "rounded-xl border p-4 transition-all hover:shadow-md",
                              config.bgColor,
                              config.borderColor
                            )}>
                              {/* الصف العلوي */}
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "p-2 rounded-lg",
                                    "bg-white/50 dark:bg-black/20"
                                  )}>
                                    <Icon className={cn("w-5 h-5", config.color)} />
                                  </div>
                                  <div>
                                    <div className={cn("font-bold text-sm", config.color)}>
                                      {config.label}
                                    </div>
                                    <div className="text-foreground font-medium mt-0.5">
                                      {log.product_name}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                      <span className="bg-background/60 px-2 py-0.5 rounded">
                                        {log.color_name}
                                      </span>
                                      <span className="bg-background/60 px-2 py-0.5 rounded">
                                        {log.size_value}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                
                                {/* التوقيت */}
                                <div className="text-left shrink-0">
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Clock className="w-3.5 h-3.5" />
                                    {log.performed_at && format(parseISO(log.performed_at), 'hh:mm a', { locale: ar })}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground/70 mt-1 text-left">
                                    {log.performed_at && format(parseISO(log.performed_at), 'dd/MM/yyyy', { locale: ar })}
                                  </div>
                                </div>
                              </div>
                              
                              {/* التغييرات - بتصميم احترافي */}
                              {changes.length > 0 && (
                                <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-border/50">
                                  {changes.map((change, i) => (
                                    <div 
                                      key={i}
                                      className={cn(
                                        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium",
                                        change.isPositive 
                                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                      )}
                                    >
                                      {change.isPositive ? (
                                        <TrendingUp className="w-4 h-4" />
                                      ) : (
                                        <TrendingDown className="w-4 h-4" />
                                      )}
                                      <span>{change.label}:</span>
                                      <span className="font-bold">{change.display}</span>
                                      <span className="text-xs opacity-70">
                                        ({change.before} → {change.after})
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              {/* الحالة بعد العملية */}
                              <div className="mt-3 pt-3 border-t border-border/50">
                                <div className="text-xs text-muted-foreground mb-2 font-medium">📊 الحالة بعد العملية:</div>
                                <div className="grid grid-cols-4 gap-2 text-center">
                                  <div className={cn(
                                    "bg-background/60 rounded-lg p-2",
                                    log.operation_type === 'stock_added' || log.operation_type === 'stock_reduced' ? "ring-2 ring-primary/50" : ""
                                  )}>
                                    <div className="text-[10px] text-muted-foreground">المخزون</div>
                                    <div className="font-bold text-sm">
                                      {log.quantity_after ?? '-'}
                                      {(log.operation_type === 'stock_added' || log.operation_type === 'stock_reduced') && ' ✨'}
                                    </div>
                                  </div>
                                  <div className={cn(
                                    "bg-background/60 rounded-lg p-2",
                                    log.operation_type === 'reserved' || log.operation_type === 'released' ? "ring-2 ring-primary/50" : ""
                                  )}>
                                    <div className="text-[10px] text-muted-foreground">المتاح</div>
                                    <div className="font-bold text-sm">
                                      {(log.quantity_after ?? 0) - (log.reserved_after ?? 0)}
                                      {(log.operation_type === 'reserved' || log.operation_type === 'released') && ' ✨'}
                                    </div>
                                  </div>
                                  <div className={cn(
                                    "bg-background/60 rounded-lg p-2",
                                    log.operation_type === 'reserved' || log.operation_type === 'released' ? "ring-2 ring-amber-500/50" : ""
                                  )}>
                                    <div className="text-[10px] text-muted-foreground">المحجوز</div>
                                    <div className="font-bold text-sm">
                                      {log.reserved_after ?? 0}
                                      {(log.operation_type === 'reserved' || log.operation_type === 'released') && ' ✨'}
                                    </div>
                                  </div>
                                  <div className={cn(
                                    "bg-background/60 rounded-lg p-2",
                                    log.operation_type === 'sold' || log.operation_type === 'returned' ? "ring-2 ring-purple-500/50" : ""
                                  )}>
                                    <div className="text-[10px] text-muted-foreground">المباع</div>
                                    <div className="font-bold text-sm">
                                      {log.sold_after ?? 0}
                                      {(log.operation_type === 'sold' || log.operation_type === 'returned') && ' ✨'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              {/* معلومات إضافية */}
                              <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
                                {log.tracking_number && (
                                  <div className="flex items-center gap-1.5 bg-background/60 px-2 py-1 rounded">
                                    <Hash className="w-3.5 h-3.5" />
                                    <span>رقم التتبع: {log.tracking_number}</span>
                                  </div>
                                )}
                                {log.order_id && !log.tracking_number && (
                                  <div className="flex items-center gap-1.5 bg-background/60 px-2 py-1 rounded">
                                    <FileText className="w-3.5 h-3.5" />
                                    <span>طلب مرتبط</span>
                                  </div>
                                )}
                                {log.performed_by_name && (
                                  <div className="flex items-center gap-1.5 bg-background/60 px-2 py-1 rounded">
                                    <User className="w-3.5 h-3.5" />
                                    <span>{log.performed_by_name}</span>
                                  </div>
                                )}
                                {log.source_type && (
                                  <div className="flex items-center gap-1.5 bg-background/60 px-2 py-1 rounded">
                                    <span>المصدر: {
                                      log.source_type === 'system' ? 'النظام (تلقائي)' :
                                      log.source_type === 'order' ? 'طلب' :
                                      log.source_type === 'manual' ? 'يدوي' :
                                      log.source_type === 'audit' ? 'فحص' :
                                      log.source_type === 'return' ? 'إرجاع للتاجر' :
                                      log.source_type
                                    }</span>
                                  </div>
                                )}
                              </div>
                              
                              {log.notes && (
                                <div className="mt-2 text-xs text-muted-foreground italic bg-background/40 px-2 py-1 rounded">
                                  💬 {log.notes}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          <div className="flex justify-end p-4 border-t border-border bg-muted/20">
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              إغلاق
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </>
  );
};

export default InventoryOperationsLog;
