import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Search, Loader2, CheckCircle, AlertTriangle, Wrench, X, Package, TrendingDown, TrendingUp, AlertCircle, Sparkles } from 'lucide-react';
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

  // لا يظهر للموظفين العاديين
  if (!isAdmin) return null;

  const handleAuditInventory = async () => {
    setIsAuditing(true);
    try {
      const { data, error } = await supabase.rpc('audit_inventory_accuracy');
      
      if (error) throw error;
      
      setAuditResults(data || []);
      setShowResults(true);
      
      if (!data || data.length === 0) {
        toast({
          title: "✅ المخزون صحيح",
          description: "جميع الأرقام متطابقة مع الطلبات الفعلية",
        });
      } else {
        toast({
          title: "⚠️ تم اكتشاف فروقات",
          description: `${data.length} منتج يحتاج مراجعة`,
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
        description: `تم تصحيح ${data?.length || 0} منتج`,
      });
      
      setShowResults(false);
      setAuditResults(null);
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

  // إحصائيات الفروقات
  const stats = {
    reserved: auditResults?.filter(i => i.issue_type?.includes('reserved')).length || 0,
    sold: auditResults?.filter(i => i.issue_type?.includes('sold')).length || 0,
    negative: auditResults?.filter(i => i.issue_type?.includes('negative')).length || 0,
    complex: auditResults?.filter(i => i.issue_type === 'reserved_and_sold').length || 0,
  };

  const getIssueLabel = (type) => {
    switch (type) {
      case 'reserved_only': return { text: 'محجوز', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
      case 'sold_only': return { text: 'مباع', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
      case 'reserved_and_sold': return { text: 'مركب', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' };
      case 'negative_available': return { text: 'سالب', color: 'bg-red-500/20 text-red-400 border-red-500/30' };
      case 'negative_reserved': return { text: 'محجوز سالب', color: 'bg-red-500/20 text-red-400 border-red-500/30' };
      case 'negative_sold': return { text: 'مباع سالب', color: 'bg-red-500/20 text-red-400 border-red-500/30' };
      default: return { text: 'غير محدد', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };
    }
  };

  // تصميم الزر الفاخر بـ inline style لضمان التطبيق
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
      {/* زر الفحص - تصميم فاخر عالمي */}
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
        {/* Shimmer effect */}
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

      {/* Dialog احترافي */}
      <Dialog open={showResults} onOpenChange={setShowResults}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden bg-gradient-to-br from-background via-background to-muted/30 border-border/50">
          {/* Header مع تدرج لوني */}
          <div className="relative bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 p-4 sm:p-6">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjIiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIvPjwvZz48L3N2Zz4=')] opacity-50" />
            <DialogHeader className="relative">
              <DialogTitle className="flex items-center gap-3 text-white text-lg sm:text-xl font-bold">
                {auditResults?.length === 0 ? (
                  <>
                    <div className="p-2 bg-white/20 rounded-full backdrop-blur-sm">
                      <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <span>المخزون صحيح 100%</span>
                  </>
                ) : (
                  <>
                    <div className="p-2 bg-white/20 rounded-full backdrop-blur-sm animate-pulse">
                      <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <span>فروقات في المخزون ({auditResults?.length || 0})</span>
                  </>
                )}
              </DialogTitle>
            </DialogHeader>
            
            {/* زر الإغلاق */}
            <button 
              onClick={() => setShowResults(false)}
              className="absolute top-4 left-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          {auditResults?.length === 0 ? (
            /* حالة المخزون صحيح */
            <div className="text-center py-12 px-6">
              <div className="relative inline-block">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full blur-xl opacity-30 animate-pulse" />
                <CheckCircle className="relative w-20 h-20 mx-auto text-emerald-500" />
              </div>
              <h3 className="text-xl font-bold mt-6 text-foreground">ممتاز! المخزون متطابق</h3>
              <p className="text-muted-foreground mt-2">جميع أرقام المخزون متطابقة مع الطلبات الفعلية</p>
              <Button 
                onClick={() => setShowResults(false)}
                className="mt-6 bg-gradient-to-r from-emerald-500 to-teal-600"
              >
                إغلاق
              </Button>
            </div>
          ) : (
            /* حالة وجود فروقات */
            <div className="flex flex-col h-full max-h-[calc(90vh-120px)]">
              {/* إحصائيات Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 p-3 sm:p-4 bg-muted/30">
                <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
                  <div className="text-xl sm:text-2xl font-bold text-amber-500">{stats.reserved}</div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1">
                    <Package className="w-3 h-3" />
                    محجوز
                  </div>
                </div>
                <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-3 text-center">
                  <div className="text-xl sm:text-2xl font-bold text-blue-500">{stats.sold}</div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1">
                    <TrendingUp className="w-3 h-3" />
                    مباع
                  </div>
                </div>
                <div className="bg-gradient-to-br from-red-500/10 to-rose-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                  <div className="text-xl sm:text-2xl font-bold text-red-500">{stats.negative}</div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1">
                    <TrendingDown className="w-3 h-3" />
                    سالب
                  </div>
                </div>
                <div className="bg-gradient-to-br from-purple-500/10 to-violet-500/10 border border-purple-500/20 rounded-xl p-3 text-center">
                  <div className="text-xl sm:text-2xl font-bold text-purple-500">{stats.complex}</div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3" />
                    مركب
                  </div>
                </div>
              </div>
              
              {/* جدول النتائج */}
              <ScrollArea className="flex-1 p-3 sm:p-4">
                <div className="rounded-xl border border-border/50 overflow-hidden bg-card/50 backdrop-blur-sm">
                  {/* رأس الجدول - مخفي على الهاتف */}
                  <div className="hidden sm:grid grid-cols-12 gap-2 p-3 bg-muted/50 text-xs font-semibold text-muted-foreground border-b">
                    <div className="col-span-4">المنتج</div>
                    <div className="col-span-3 text-center">المحجوز (حالي → صحيح)</div>
                    <div className="col-span-3 text-center">المباع (حالي → صحيح)</div>
                    <div className="col-span-2 text-center">النوع</div>
                  </div>
                  
                  {/* صفوف البيانات */}
                  <div className="divide-y divide-border/30">
                    {auditResults?.map((item, idx) => {
                      const issue = getIssueLabel(item.issue_type);
                      return (
                        <div 
                          key={idx} 
                          className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-3 hover:bg-muted/30 transition-colors"
                        >
                          {/* المنتج */}
                          <div className="sm:col-span-4">
                            <div className="font-medium text-foreground text-sm">{item.product_name}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {item.color_name} - {item.size_value}
                            </div>
                          </div>
                          
                          {/* بيانات الهاتف - مضغوطة */}
                          <div className="sm:hidden flex items-center justify-between gap-2 mt-2">
                            <div className="flex items-center gap-3 text-xs">
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">محجوز:</span>
                                {item.reserved_diff !== 0 ? (
                                  <span className="text-red-400 font-medium">
                                    {item.current_reserved} → {item.calculated_reserved}
                                  </span>
                                ) : (
                                  <span className="text-emerald-400">✓</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">مباع:</span>
                                {item.sold_diff !== 0 ? (
                                  <span className="text-red-400 font-medium">
                                    {item.current_sold} → {item.calculated_sold}
                                  </span>
                                ) : (
                                  <span className="text-emerald-400">✓</span>
                                )}
                              </div>
                            </div>
                            <span className={cn("px-2 py-0.5 rounded-full text-xs border", issue.color)}>
                              {issue.text}
                            </span>
                          </div>
                          
                          {/* بيانات الديسكتوب */}
                          <div className="hidden sm:flex sm:col-span-3 items-center justify-center">
                            {item.reserved_diff !== 0 ? (
                              <span className="text-red-400 font-medium text-sm">
                                {item.current_reserved} → {item.calculated_reserved}
                              </span>
                            ) : (
                              <span className="text-emerald-400 text-lg">✓</span>
                            )}
                          </div>
                          
                          <div className="hidden sm:flex sm:col-span-3 items-center justify-center">
                            {item.sold_diff !== 0 ? (
                              <span className="text-red-400 font-medium text-sm">
                                {item.current_sold} → {item.calculated_sold}
                              </span>
                            ) : (
                              <span className="text-emerald-400 text-lg">✓</span>
                            )}
                          </div>
                          
                          <div className="hidden sm:flex sm:col-span-2 items-center justify-center">
                            <span className={cn("px-2 py-1 rounded-full text-xs border", issue.color)}>
                              {issue.text}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </ScrollArea>
              
              {/* أزرار الإجراءات */}
              <div className="flex flex-col sm:flex-row justify-end gap-2 p-4 border-t bg-muted/20">
                <Button 
                  variant="outline" 
                  onClick={() => setShowResults(false)}
                  className="order-2 sm:order-1"
                >
                  إغلاق
                </Button>
                <Button 
                  onClick={handleFixDiscrepancies}
                  disabled={isFixing}
                  className="order-1 sm:order-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold shadow-lg"
                >
                  {isFixing ? (
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  ) : (
                    <Wrench className="w-4 h-4 ml-2" />
                  )}
                  إصلاح الفروقات تلقائياً
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* CSS للـ shimmer animation */}
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
