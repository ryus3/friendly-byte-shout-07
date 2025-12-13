import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Search, Loader2, CheckCircle, AlertTriangle, Wrench, Package, 
  TrendingUp, AlertCircle, Sparkles, ShoppingCart, Box, Warehouse,
  FileCheck, BadgeCheck, RefreshCw, ArrowRight
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
import { cn } from '@/lib/utils';

const InventoryAuditDialog = ({ isAdmin }) => {
  const [isAuditing, setIsAuditing] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [auditResults, setAuditResults] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [summaryStats, setSummaryStats] = useState(null);

  if (!isAdmin) return null;

  const handleAuditInventory = async () => {
    setIsAuditing(true);
    try {
      // جلب الفحص + الإحصائيات معاً
      const [auditResponse, statsResponse] = await Promise.all([
        supabase.rpc('audit_inventory_accuracy'),
        supabase.rpc('get_inventory_summary_stats')
      ]);
      
      if (auditResponse.error) throw auditResponse.error;
      if (statsResponse.error) throw statsResponse.error;
      
      // تصفية الفروقات فقط (issue_type !== 'ok')
      const allResults = auditResponse.data || [];
      const discrepancies = allResults.filter(item => item.issue_type !== 'ok');
      
      setAuditResults(discrepancies);
      setSummaryStats(statsResponse.data?.[0] || null);
      setShowResults(true);
      
      if (discrepancies.length === 0) {
        toast({
          title: "✅ المخزون صحيح 100%",
          description: `جميع ${allResults.length} منتج متطابقة مع الطلبات الفعلية`,
        });
      } else {
        toast({
          title: "⚠️ تم اكتشاف فروقات",
          description: `${discrepancies.length} منتج يحتاج مراجعة من أصل ${allResults.length}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Audit error:', error);
      toast({
        title: "خطأ في الفحص",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsAuditing(false);
    }
  };

  const handleFixDiscrepancies = async () => {
    setIsFixing(true);
    try {
      const { data, error } = await supabase.rpc('fix_inventory_discrepancies');
      
      if (error) throw error;
      
      toast({
        title: "✅ تم الإصلاح بنجاح",
        description: `تم تصحيح ${data?.length || 0} منتج وتسجيلهم في سجل العمليات`,
      });
      
      // إعادة الفحص لتأكيد النتيجة
      handleAuditInventory();
    } catch (error) {
      console.error('Fix error:', error);
      toast({
        title: "خطأ في الإصلاح",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsFixing(false);
    }
  };

  // إحصائيات الفروقات المُصنّفة
  const issueStats = useMemo(() => {
    if (!auditResults) return { reserved: 0, sold: 0, negative: 0, complex: 0, total: 0 };
    return {
      reserved: auditResults.filter(i => i.issue_type === 'reserved_mismatch' || i.issue_type === 'reserved_only').length,
      sold: auditResults.filter(i => i.issue_type === 'sold_mismatch' || i.issue_type === 'sold_only').length,
      negative: auditResults.filter(i => i.issue_type?.includes('negative')).length,
      complex: auditResults.filter(i => i.issue_type === 'reserved_and_sold').length,
      total: auditResults.length,
    };
  }, [auditResults]);

  const getIssueConfig = (type) => {
    const configs = {
      reserved_mismatch: { 
        label: 'فرق محجوز', 
        icon: Package,
        color: 'text-amber-600',
        bgColor: 'bg-amber-50 dark:bg-amber-950/30',
        borderColor: 'border-amber-200 dark:border-amber-800',
        dotColor: 'bg-amber-500',
      },
      reserved_only: { 
        label: 'فرق محجوز', 
        icon: Package,
        color: 'text-amber-600',
        bgColor: 'bg-amber-50 dark:bg-amber-950/30',
        borderColor: 'border-amber-200 dark:border-amber-800',
        dotColor: 'bg-amber-500',
      },
      sold_mismatch: { 
        label: 'فرق مباع', 
        icon: ShoppingCart,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50 dark:bg-blue-950/30',
        borderColor: 'border-blue-200 dark:border-blue-800',
        dotColor: 'bg-blue-500',
      },
      sold_only: { 
        label: 'فرق مباع', 
        icon: ShoppingCart,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50 dark:bg-blue-950/30',
        borderColor: 'border-blue-200 dark:border-blue-800',
        dotColor: 'bg-blue-500',
      },
      reserved_and_sold: { 
        label: 'فرق مركب', 
        icon: AlertCircle,
        color: 'text-purple-600',
        bgColor: 'bg-purple-50 dark:bg-purple-950/30',
        borderColor: 'border-purple-200 dark:border-purple-800',
        dotColor: 'bg-purple-500',
      },
      negative_available: { 
        label: 'متاح سالب', 
        icon: AlertTriangle,
        color: 'text-red-600',
        bgColor: 'bg-red-50 dark:bg-red-950/30',
        borderColor: 'border-red-200 dark:border-red-800',
        dotColor: 'bg-red-500',
      },
      negative_reserved: { 
        label: 'محجوز سالب', 
        icon: AlertTriangle,
        color: 'text-red-600',
        bgColor: 'bg-red-50 dark:bg-red-950/30',
        borderColor: 'border-red-200 dark:border-red-800',
        dotColor: 'bg-red-500',
      },
      negative_sold: { 
        label: 'مباع سالب', 
        icon: AlertTriangle,
        color: 'text-red-600',
        bgColor: 'bg-red-50 dark:bg-red-950/30',
        borderColor: 'border-red-200 dark:border-red-800',
        dotColor: 'bg-red-500',
      },
      consistency_error: { 
        label: 'خطأ تناسق', 
        icon: AlertCircle,
        color: 'text-orange-600',
        bgColor: 'bg-orange-50 dark:bg-orange-950/30',
        borderColor: 'border-orange-200 dark:border-orange-800',
        dotColor: 'bg-orange-500',
      },
    };
    return configs[type] || configs.reserved_mismatch;
  };

  const luxuryButtonStyle = {
    background: 'linear-gradient(135deg, #10b981 0%, #0d9488 50%, #06b6d4 100%)',
    color: 'white',
    fontWeight: '600',
    padding: '10px 20px',
    borderRadius: '12px',
    border: 'none',
    boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4), 0 0 40px rgba(6, 182, 212, 0.2)',
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
      {/* زر الفحص الفاخر */}
      <button
        onClick={handleAuditInventory}
        disabled={isAuditing}
        style={luxuryButtonStyle}
        className="group hover:scale-105 hover:shadow-[0_6px_30px_rgba(16,185,129,0.5)] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'linear-gradient(135deg, #059669 0%, #0f766e 50%, #0891b2 100%)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'linear-gradient(135deg, #10b981 0%, #0d9488 50%, #06b6d4 100%)';
        }}
      >
        <span 
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
            animation: 'shimmer 2s infinite',
          }}
        />
        {isAuditing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Search className="w-4 h-4 group-hover:scale-110 transition-transform" />
        )}
        <span>فحص دقة المخزون</span>
        <Sparkles className="w-3 h-3 opacity-70" />
      </button>

      {/* Dialog الفاخر */}
      <Dialog open={showResults} onOpenChange={setShowResults}>
        <DialogContent className="max-w-5xl max-h-[90vh] p-0 bg-background border-border">
          {/* Header مع تدرج فيروزي */}
          <div className="relative bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 p-4 sm:p-6 rounded-t-lg">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjIiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIvPjwvZz48L3N2Zz4=')] opacity-50 rounded-t-lg" />
            <DialogHeader className="relative">
              <DialogTitle className="flex items-center gap-3 text-white text-lg sm:text-xl font-bold">
                {auditResults?.length === 0 ? (
                  <>
                    <div className="p-2 bg-white/20 rounded-full backdrop-blur-sm">
                      <BadgeCheck className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <span>فحص دقة المخزون - صحيح 100%</span>
                  </>
                ) : (
                  <>
                    <div className="p-2 bg-white/20 rounded-full backdrop-blur-sm animate-pulse">
                      <FileCheck className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <span>فحص دقة المخزون - {auditResults?.length || 0} فرق</span>
                  </>
                )}
              </DialogTitle>
            </DialogHeader>
            
            {/* إحصائيات سريعة في Header */}
            {summaryStats && (
              <div className="flex flex-wrap items-center gap-3 mt-4 text-white/90 text-sm">
                <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5">
                  <Warehouse className="w-4 h-4" />
                  <span>{summaryStats.total_quantity} مخزون</span>
                </div>
                <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5">
                  <Package className="w-4 h-4" />
                  <span>{summaryStats.total_reserved} محجوز</span>
                </div>
                <div className="flex items-center gap-2 bg-emerald-400/30 rounded-lg px-3 py-1.5">
                  <Box className="w-4 h-4" />
                  <span>{summaryStats.total_available} متاح</span>
                </div>
                <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5">
                  <ShoppingCart className="w-4 h-4" />
                  <span>{summaryStats.total_sold} مباع</span>
                </div>
              </div>
            )}
          </div>
          
          {auditResults?.length === 0 ? (
            /* حالة المخزون صحيح 100% */
            <div className="text-center py-16 px-6">
              <div className="relative inline-block mb-6">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full blur-2xl opacity-30 animate-pulse scale-150" />
                <div className="relative p-6 bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 rounded-full">
                  <CheckCircle className="w-20 h-20 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
              
              <h3 className="text-2xl font-bold text-foreground mb-2">
                المخزون متطابق 100% ✨
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                جميع أرقام المخزون (المحجوز والمباع والمتاح) متطابقة مع الطلبات الفعلية في النظام
              </p>
              
              {/* ملخص الإحصائيات */}
              {summaryStats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 max-w-2xl mx-auto">
                  <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                    <Warehouse className="w-6 h-6 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{summaryStats.total_quantity}</div>
                    <div className="text-xs text-muted-foreground">إجمالي المخزون</div>
                  </div>
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
                    <Package className="w-6 h-6 text-amber-600 dark:text-amber-400 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">{summaryStats.total_reserved}</div>
                    <div className="text-xs text-muted-foreground">محجوز للطلبات</div>
                  </div>
                  <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4">
                    <Box className="w-6 h-6 text-emerald-600 dark:text-emerald-400 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{summaryStats.total_available}</div>
                    <div className="text-xs text-muted-foreground">متاح للبيع</div>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30 border border-purple-200 dark:border-purple-800 rounded-xl p-4">
                    <ShoppingCart className="w-6 h-6 text-purple-600 dark:text-purple-400 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">{summaryStats.total_sold}</div>
                    <div className="text-xs text-muted-foreground">مباع (مُسلّم)</div>
                  </div>
                </div>
              )}
              
              <Button 
                onClick={() => setShowResults(false)}
                className="mt-8 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
              >
                إغلاق
              </Button>
            </div>
          ) : (
            /* حالة وجود فروقات */
            <div className="flex flex-col h-full max-h-[calc(90vh-200px)]">
              {/* لوحة إحصائيات الفروقات - سطر واحد مصغر مع كتابة */}
              <div className="flex items-center justify-center gap-3 p-3 bg-gradient-to-r from-muted/20 via-muted/40 to-muted/20 border-b">
                <div className="flex flex-col items-center gap-0.5 bg-gradient-to-br from-amber-100 to-orange-50 dark:from-amber-950/50 dark:to-orange-950/30 border border-amber-300 dark:border-amber-700 rounded-xl px-3 py-2 min-w-[60px] shadow-sm hover:shadow-md transition-shadow">
                  <Package className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-lg font-bold text-amber-700 dark:text-amber-300">{issueStats.reserved}</span>
                  <span className="text-[9px] text-amber-600/80 dark:text-amber-400/80 font-medium">محجوز</span>
                </div>
                <div className="flex flex-col items-center gap-0.5 bg-gradient-to-br from-blue-100 to-cyan-50 dark:from-blue-950/50 dark:to-cyan-950/30 border border-blue-300 dark:border-blue-700 rounded-xl px-3 py-2 min-w-[60px] shadow-sm hover:shadow-md transition-shadow">
                  <ShoppingCart className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-lg font-bold text-blue-700 dark:text-blue-300">{issueStats.sold}</span>
                  <span className="text-[9px] text-blue-600/80 dark:text-blue-400/80 font-medium">مباع</span>
                </div>
                <div className="flex flex-col items-center gap-0.5 bg-gradient-to-br from-red-100 to-rose-50 dark:from-red-950/50 dark:to-rose-950/30 border border-red-300 dark:border-red-700 rounded-xl px-3 py-2 min-w-[60px] shadow-sm hover:shadow-md transition-shadow">
                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <span className="text-lg font-bold text-red-700 dark:text-red-300">{issueStats.negative}</span>
                  <span className="text-[9px] text-red-600/80 dark:text-red-400/80 font-medium">سالبة</span>
                </div>
                <div className="flex flex-col items-center gap-0.5 bg-gradient-to-br from-purple-100 to-violet-50 dark:from-purple-950/50 dark:to-violet-950/30 border border-purple-300 dark:border-purple-700 rounded-xl px-3 py-2 min-w-[60px] shadow-sm hover:shadow-md transition-shadow">
                  <AlertCircle className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-lg font-bold text-purple-700 dark:text-purple-300">{issueStats.complex}</span>
                  <span className="text-[9px] text-purple-600/80 dark:text-purple-400/80 font-medium">مركب</span>
                </div>
              </div>
              
              {/* بطاقات المنتجات - تصميم عالمي مبهر Grid */}
              <ScrollArea className="flex-1 p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {auditResults?.map((item, idx) => {
                    const config = getIssueConfig(item.issue_type);
                    const Icon = config.icon;
                    
                    return (
                      <div 
                        key={item.out_variant_id || idx}
                        className="group relative overflow-hidden rounded-2xl border-2 bg-gradient-to-br from-background via-background to-muted/30 hover:shadow-2xl transition-all duration-500 hover:scale-[1.02] hover:-translate-y-1"
                        style={{
                          borderColor: config.dotColor.replace('bg-', 'hsl(var(--') + '))',
                        }}
                      >
                        {/* شريط علوي ملون */}
                        <div className={cn(
                          "absolute top-0 left-0 right-0 h-1.5",
                          config.dotColor
                        )} />
                        
                        {/* خلفية متوهجة عند hover */}
                        <div className={cn(
                          "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none",
                          "bg-gradient-to-br",
                          config.issue_type?.includes('reserved') ? "from-amber-500/5 to-orange-500/10" :
                          config.issue_type?.includes('sold') ? "from-blue-500/5 to-cyan-500/10" :
                          config.issue_type?.includes('negative') ? "from-red-500/5 to-rose-500/10" :
                          "from-purple-500/5 to-violet-500/10"
                        )} />
                        
                        <div className="relative p-4">
                          {/* رأس البطاقة */}
                          <div className="flex items-start justify-between gap-3 mb-4">
                            <div className="flex items-center gap-3">
                              {/* أيقونة الحالة مع تأثير pulse */}
                              <div className={cn(
                                "relative p-2.5 rounded-xl shadow-lg",
                                config.bgColor
                              )}>
                                <Icon className={cn("w-5 h-5", config.color)} />
                                <div className={cn(
                                  "absolute -top-1 -right-1 w-3 h-3 rounded-full animate-pulse",
                                  config.dotColor
                                )} />
                              </div>
                              
                              <div className="flex-1">
                                {/* شارة نوع الفرق */}
                                <div className={cn(
                                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold mb-1",
                                  config.bgColor,
                                  config.color
                                )}>
                                  <Sparkles className="w-3 h-3" />
                                  {config.label}
                                </div>
                                
                                {/* اسم المنتج */}
                                <h4 className="font-bold text-foreground text-sm leading-tight line-clamp-2">
                                  {item.product_name}
                                </h4>
                              </div>
                            </div>
                          </div>
                          
                          {/* معلومات اللون والقياس */}
                          <div className="flex items-center gap-2 mb-4">
                            <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-muted to-muted/50 px-3 py-1 rounded-full text-xs font-medium">
                              <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-gray-400 to-gray-600" />
                              {item.color_name}
                            </span>
                            <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-muted to-muted/50 px-3 py-1 rounded-full text-xs font-medium">
                              📏 {item.size_value}
                            </span>
                          </div>
                          
                          {/* شبكة الأرقام - تصميم عالمي */}
                          <div className="grid grid-cols-4 gap-2">
                            {/* المخزون */}
                            <div className="relative overflow-hidden bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 rounded-xl p-2 text-center group/stat">
                              <div className="absolute inset-0 bg-gradient-to-t from-slate-200/50 to-transparent dark:from-slate-700/50 opacity-0 group-hover/stat:opacity-100 transition-opacity" />
                              <Warehouse className="w-3.5 h-3.5 mx-auto mb-1 text-slate-500" />
                              <div className="text-[10px] text-muted-foreground">المخزون</div>
                              <div className="font-bold text-foreground">{item.current_quantity}</div>
                            </div>
                            
                            {/* المحجوز */}
                            <div className={cn(
                              "relative overflow-hidden rounded-xl p-2 text-center group/stat",
                              item.reserved_diff !== 0 
                                ? "bg-gradient-to-br from-amber-100 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/20 ring-2 ring-amber-400/50" 
                                : "bg-gradient-to-br from-emerald-100 to-green-50 dark:from-emerald-900/30 dark:to-green-900/20"
                            )}>
                              <Package className={cn("w-3.5 h-3.5 mx-auto mb-1", item.reserved_diff !== 0 ? "text-amber-600" : "text-emerald-600")} />
                              <div className="text-[10px] text-muted-foreground">المحجوز</div>
                              {item.reserved_diff !== 0 ? (
                                <div className="space-y-0.5">
                                  <div className="text-xs text-red-500 line-through opacity-70">{item.current_reserved}</div>
                                  <div className="flex items-center justify-center gap-1">
                                    <ArrowRight className="w-2.5 h-2.5 text-amber-500 animate-pulse" />
                                    <span className="font-bold text-emerald-600 text-sm">{item.calculated_reserved}</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="font-bold text-emerald-600 flex items-center justify-center gap-1">
                                  <CheckCircle className="w-3 h-3" />
                                  {item.current_reserved}
                                </div>
                              )}
                            </div>
                            
                            {/* المتاح */}
                            <div className={cn(
                              "relative overflow-hidden rounded-xl p-2 text-center group/stat",
                              item.current_available < 0 
                                ? "bg-gradient-to-br from-red-100 to-rose-50 dark:from-red-900/30 dark:to-rose-900/20 ring-2 ring-red-400/50"
                                : "bg-gradient-to-br from-teal-100 to-cyan-50 dark:from-teal-900/30 dark:to-cyan-900/20"
                            )}>
                              <Box className={cn("w-3.5 h-3.5 mx-auto mb-1", item.current_available < 0 ? "text-red-600" : "text-teal-600")} />
                              <div className="text-[10px] text-muted-foreground">المتاح</div>
                              <div className={cn(
                                "font-bold",
                                item.current_available < 0 ? "text-red-600 animate-pulse" : "text-teal-700"
                              )}>
                                {item.current_available}
                              </div>
                            </div>
                            
                            {/* المباع */}
                            <div className={cn(
                              "relative overflow-hidden rounded-xl p-2 text-center group/stat",
                              item.sold_diff !== 0 
                                ? "bg-gradient-to-br from-blue-100 to-cyan-50 dark:from-blue-900/30 dark:to-cyan-900/20 ring-2 ring-blue-400/50" 
                                : "bg-gradient-to-br from-emerald-100 to-green-50 dark:from-emerald-900/30 dark:to-green-900/20"
                            )}>
                              <ShoppingCart className={cn("w-3.5 h-3.5 mx-auto mb-1", item.sold_diff !== 0 ? "text-blue-600" : "text-emerald-600")} />
                              <div className="text-[10px] text-muted-foreground">المباع</div>
                              {item.sold_diff !== 0 ? (
                                <div className="space-y-0.5">
                                  <div className="text-xs text-red-500 line-through opacity-70">{item.current_sold}</div>
                                  <div className="flex items-center justify-center gap-1">
                                    <ArrowRight className="w-2.5 h-2.5 text-blue-500 animate-pulse" />
                                    <span className="font-bold text-emerald-600 text-sm">{item.calculated_sold}</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="font-bold text-emerald-600 flex items-center justify-center gap-1">
                                  <CheckCircle className="w-3 h-3" />
                                  {item.current_sold}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* شريط سفلي يوضح الفرق */}
                          {(item.reserved_diff !== 0 || item.sold_diff !== 0) && (
                            <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-center gap-4 text-[10px]">
                              {item.reserved_diff !== 0 && (
                                <span className="flex items-center gap-1 text-amber-600 font-medium">
                                  <TrendingUp className="w-3 h-3" />
                                  فرق محجوز: {item.reserved_diff > 0 ? '+' : ''}{item.reserved_diff}
                                </span>
                              )}
                              {item.sold_diff !== 0 && (
                                <span className="flex items-center gap-1 text-blue-600 font-medium">
                                  <TrendingUp className="w-3 h-3" />
                                  فرق مباع: {item.sold_diff > 0 ? '+' : ''}{item.sold_diff}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
              
              {/* أزرار الإجراءات */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 p-4 border-t bg-muted/20">
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{issueStats.total}</span> منتج يحتاج تصحيح
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowResults(false)}
                  >
                    إغلاق
                  </Button>
                  <Button 
                    onClick={handleAuditInventory}
                    variant="outline"
                    disabled={isAuditing}
                  >
                    <RefreshCw className={cn("w-4 h-4 ml-1", isAuditing && "animate-spin")} />
                    إعادة الفحص
                  </Button>
                  <Button 
                    onClick={handleFixDiscrepancies}
                    disabled={isFixing}
                    className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold shadow-lg relative overflow-hidden group"
                  >
                    <span 
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                      style={{
                        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                        animation: 'shimmer 2s infinite',
                      }}
                    />
                    {isFixing ? (
                      <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    ) : (
                      <Wrench className="w-4 h-4 ml-2" />
                    )}
                    إصلاح تلقائي
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* CSS للـ shimmer */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </>
  );
};

export default InventoryAuditDialog;