import React, { useState, useEffect } from 'react';
import { History, Loader2, X, Plus, Minus, Package, ShoppingCart, ArrowUpRight, ArrowDownRight, Wrench, Edit3, RefreshCw, Filter, Calendar } from 'lucide-react';
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
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const InventoryOperationsLog = ({ isAdmin }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [showDialog, setShowDialog] = useState(false);
  const [filterType, setFilterType] = useState('all');

  // لا يظهر للموظفين العاديين
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

  const getOperationConfig = (type) => {
    const configs = {
      stock_added: {
        label: 'إضافة مخزون',
        icon: Plus,
        color: 'text-emerald-500',
        bgColor: 'bg-emerald-500/10',
        borderColor: 'border-emerald-500/30',
      },
      stock_reduced: {
        label: 'تقليل مخزون',
        icon: Minus,
        color: 'text-red-500',
        bgColor: 'bg-red-500/10',
        borderColor: 'border-red-500/30',
      },
      reserved: {
        label: 'حجز للطلب',
        icon: Package,
        color: 'text-blue-500',
        bgColor: 'bg-blue-500/10',
        borderColor: 'border-blue-500/30',
      },
      released: {
        label: 'تحرير محجوز',
        icon: ArrowUpRight,
        color: 'text-amber-500',
        bgColor: 'bg-amber-500/10',
        borderColor: 'border-amber-500/30',
      },
      sold: {
        label: 'تسجيل مبيع',
        icon: ShoppingCart,
        color: 'text-purple-500',
        bgColor: 'bg-purple-500/10',
        borderColor: 'border-purple-500/30',
      },
      returned: {
        label: 'إرجاع للمخزون',
        icon: ArrowDownRight,
        color: 'text-cyan-500',
        bgColor: 'bg-cyan-500/10',
        borderColor: 'border-cyan-500/30',
      },
      audit_correction: {
        label: 'تصحيح فحص',
        icon: Wrench,
        color: 'text-orange-500',
        bgColor: 'bg-orange-500/10',
        borderColor: 'border-orange-500/30',
      },
      manual_edit: {
        label: 'تعديل يدوي',
        icon: Edit3,
        color: 'text-gray-500',
        bgColor: 'bg-gray-500/10',
        borderColor: 'border-gray-500/30',
      },
    };
    return configs[type] || configs.manual_edit;
  };

  // تصميم الزر الفاخر
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
      {/* زر السجل - تصميم بنفسجي فاخر */}
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

      {/* Dialog السجل */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden bg-gradient-to-br from-background via-background to-muted/30 border-border/50">
          {/* Header */}
          <div className="relative bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 p-4 sm:p-6">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjIiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIvPjwvZz48L3N2Zz4=')] opacity-50" />
            <DialogHeader className="relative">
              <DialogTitle className="flex items-center gap-3 text-white text-lg sm:text-xl font-bold">
                <div className="p-2 bg-white/20 rounded-full backdrop-blur-sm">
                  <History className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <span>سجل عمليات المخزون</span>
                {logs.length > 0 && (
                  <span className="text-sm font-normal bg-white/20 px-3 py-1 rounded-full">
                    {logs.length} عملية
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>
            
            <button 
              onClick={() => setShowDialog(false)}
              className="absolute top-4 left-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* الفلاتر */}
          <div className="flex items-center gap-3 p-4 border-b bg-muted/30">
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

          {/* المحتوى */}
          <ScrollArea className="flex-1 max-h-[calc(90vh-200px)]">
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
              <div className="p-4 space-y-2">
                {logs.map((log, idx) => {
                  const config = getOperationConfig(log.operation_type);
                  const Icon = config.icon;
                  
                  return (
                    <div 
                      key={log.id || idx}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-xl border transition-all hover:shadow-md",
                        config.bgColor,
                        config.borderColor
                      )}
                    >
                      {/* أيقونة العملية */}
                      <div className={cn(
                        "p-2 rounded-lg shrink-0",
                        config.bgColor
                      )}>
                        <Icon className={cn("w-4 h-4", config.color)} />
                      </div>
                      
                      {/* التفاصيل */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn("font-semibold text-sm", config.color)}>
                            {config.label}
                          </span>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-sm font-medium text-foreground truncate">
                            {log.product_name}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>{log.color_name}</span>
                          <span>-</span>
                          <span>{log.size_value}</span>
                        </div>
                        
                        {/* التغييرات */}
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
                          {log.quantity_before !== null && log.quantity_after !== null && log.quantity_before !== log.quantity_after && (
                            <span className="bg-background/50 px-2 py-1 rounded">
                              مخزون: {log.quantity_before} → {log.quantity_after}
                            </span>
                          )}
                          {log.reserved_before !== null && log.reserved_after !== null && log.reserved_before !== log.reserved_after && (
                            <span className="bg-background/50 px-2 py-1 rounded">
                              محجوز: {log.reserved_before} → {log.reserved_after}
                            </span>
                          )}
                          {log.sold_before !== null && log.sold_after !== null && log.sold_before !== log.sold_after && (
                            <span className="bg-background/50 px-2 py-1 rounded">
                              مباع: {log.sold_before} → {log.sold_after}
                            </span>
                          )}
                        </div>
                        
                        {log.notes && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            {log.notes}
                          </p>
                        )}
                      </div>
                      
                      {/* التوقيت */}
                      <div className="text-left shrink-0">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {log.performed_at && format(new Date(log.performed_at), 'dd/MM', { locale: ar })}
                        </div>
                        <div className="text-xs text-muted-foreground/70 mt-0.5">
                          {log.performed_at && format(new Date(log.performed_at), 'hh:mm a', { locale: ar })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          <div className="flex justify-end p-4 border-t bg-muted/20">
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
