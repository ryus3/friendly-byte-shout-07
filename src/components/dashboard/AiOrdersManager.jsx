import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Bot, 
  MessageSquare, 
  Clock, 
  AlertTriangle, 
  CheckCircle2,
  XCircle,
  Send,
  Eye,
  X,
  Brain,
  Zap,
  Smartphone,
  Users,
  TrendingUp,
  Activity,
  Trash2,
  ShoppingCart
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSuper } from '@/contexts/SuperProvider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import AiOrderCard from './AiOrderCard';
import { useUnifiedUserData } from '@/hooks/useUnifiedUserData';

const AiOrdersManager = ({ onClose }) => {
  const { aiOrders = [], loading, refreshAll, products = [], approveAiOrder } = useSuper();
  const ordersFromContext = Array.isArray(aiOrders) ? aiOrders : [];
  const [orders, setOrders] = useState(ordersFromContext);
  const [selectedOrders, setSelectedOrders] = useState([]);

  // صلاحيات وهوية المستخدم لفلترة الطلبات الذكية
  const { isAdmin, userUUID, employeeCode } = useUnifiedUserData();
  const matchesCurrentUser = useCallback((order) => {
    const by = order?.created_by ?? order?.user_id ?? order?.created_by_employee_code ?? order?.order_data?.created_by;
    const candidates = [employeeCode, userUUID].filter(Boolean);
    return by ? candidates.some(v => v === by) : false;
  }, [employeeCode, userUUID]);

  const visibleOrders = useMemo(() => (
    isAdmin ? orders : orders.filter(matchesCurrentUser)
  ), [orders, isAdmin, matchesCurrentUser]);

  useEffect(() => {
    setOrders(ordersFromContext);
  }, [ordersFromContext]);

  // Force refresh when opening to fetch latest ai_orders even if cache is warm
  useEffect(() => {
    refreshAll?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleDeleted = (e) => {
      const id = e?.detail?.id;
      if (id) setOrders(prev => prev.filter(o => o.id !== id));
    };
    const handleApproved = (e) => {
      const id = e?.detail?.id;
      if (id) setOrders(prev => prev.filter(o => o.id !== id));
    };
    window.addEventListener('aiOrderDeleted', handleDeleted);
    window.addEventListener('aiOrderApproved', handleApproved);
    return () => {
      window.removeEventListener('aiOrderDeleted', handleDeleted);
      window.removeEventListener('aiOrderApproved', handleApproved);
    };
  }, []);

  // Realtime updates for ai_orders: insert/update/delete
  useEffect(() => {
    try {
      const channel = supabase
        .channel('ai-orders-realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ai_orders' }, (payload) => {
          const newOrder = payload.new;
          setOrders((prev) => {
            if (prev.some(o => o.id === newOrder.id)) return prev;
            if (!isAdmin && !matchesCurrentUser(newOrder)) return prev;
            return [newOrder, ...prev];
          });
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ai_orders' }, (payload) => {
          const updated = payload.new;
          setOrders((prev) => prev.map(o => (o.id === updated.id ? updated : o)));
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'ai_orders' }, (payload) => {
          const removed = payload.old;
          setOrders((prev) => prev.filter(o => o.id !== removed.id));
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (e) {
      // no-op
    }
  }, [isAdmin, matchesCurrentUser]);

  // Availability helpers based on products
  const variants = useMemo(() => {
    const v = [];
    (products || []).forEach(p => {
      const list = Array.isArray(p.variants) ? p.variants : (p.product_variants || []);
      list.forEach(vi => v.push({ ...vi, product_id: p.id, product_name: p.name }));
    });
    return v;
  }, [products]);

  const availabilityOf = (order) => {
    const items = Array.isArray(order?.items) ? order.items : (order?.order_data?.items || []);
    if (!items.length) return 'unknown';
    const lower = (v) => (v || '').toString().trim().toLowerCase();
    const findByVariantId = (id) => variants.find(v => v.id === id);
    const findByProductId = (pid) => variants.find(v => v.product_id === pid);
    const findByName = (name, color, size) => {
      const vname = lower(name);
      const matches = variants.filter(v => lower(v.product_name) === vname || lower(v.product_name).includes(vname));
      if (!matches.length) return null;
      if (color || size) {
        return matches.find(v => lower(v.color || v.color_name) === lower(color) && lower(v.size || v.size_name) === lower(size))
          || matches.find(v => lower(v.color || v.color_name) === lower(color))
          || matches.find(v => lower(v.size || v.size_name) === lower(size))
          || matches[0];
      }
      return matches[0];
    };

    let allMatched = true;
    let allAvailable = true;

    for (const it of items) {
      const qty = Number(it.quantity || 1);
      let variant = null;
      if (it.variant_id) variant = findByVariantId(it.variant_id);
      else if (it.product_id) variant = findByProductId(it.product_id);
      else variant = findByName(it.product_name || it.name || it.product, it.color, it.size);
      if (!variant) { allMatched = false; continue; }
      const available = (Number(variant.quantity ?? 0) - Number(variant.reserved_quantity ?? 0));
      if (available < qty) { allAvailable = false; }
    }
    if (!allMatched) return 'unknown';
    return allAvailable ? 'available' : 'out';
  };

  const totalCount = visibleOrders.length;
  const pendingCount = visibleOrders.filter(order => order.status === 'pending').length;
  const needsReviewStatuses = ['needs_review','review','error','failed'];
  const needsReviewCount = visibleOrders.filter(order => needsReviewStatuses.includes(order.status) || availabilityOf(order) !== 'available').length;
  const telegramCount = visibleOrders.filter(order => order.source === 'telegram').length;
  const aiChatCount = visibleOrders.filter(order => order.source === 'ai_chat').length;
  const storeCount = visibleOrders.filter(order => order.source === 'web' || order.source === 'store').length;

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedOrders(visibleOrders.map(order => order.id));
    } else {
      setSelectedOrders([]);
    }
  };

  const handleSelectOrder = (orderId, checked) => {
    if (checked) {
      setSelectedOrders(prev => [...prev, orderId]);
    } else {
      setSelectedOrders(prev => prev.filter(id => id !== orderId));
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedOrders.length === 0) return;
    try {
      if (action === 'approve') {
        const results = await Promise.all(selectedOrders.map(id => approveAiOrder?.(id)));
        const okIds = selectedOrders.filter((_, i) => results[i]?.success);
        okIds.forEach(id => window.dispatchEvent(new CustomEvent('aiOrderApproved', { detail: { id } })));
        setOrders(prev => prev.filter(o => !okIds.includes(o.id)));
        toast({ title: 'تمت الموافقة', description: `تمت الموافقة على ${okIds.length} طلب`, variant: 'success' });
      } else if (action === 'delete') {
        const results = await Promise.all(selectedOrders.map(id => supabase.rpc('delete_ai_order_safe', { p_order_id: id })));
        const okIds = results.map((r, i) => (!r.error ? selectedOrders[i] : null)).filter(Boolean);
        okIds.forEach(id => window.dispatchEvent(new CustomEvent('aiOrderDeleted', { detail: { id } })));
        setOrders(prev => prev.filter(o => !okIds.includes(o.id)));
        toast({ title: 'تم الحذف', description: `تم حذف ${okIds.length} طلب`, variant: 'success' });
      }
    } catch (e) {
      toast({ title: 'خطأ', description: 'حدث خطأ أثناء تنفيذ العملية', variant: 'destructive' });
    } finally {
      setSelectedOrders([]);
      try { await refreshAll?.(); } catch (_) {}
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-lg z-[1200] flex items-center justify-center p-4" onClick={onClose}>
      <ScrollArea className="h-full w-full max-w-5xl mx-auto" onClick={(e) => e.stopPropagation()}>
        <div 
          className="bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-blue-900/20 dark:to-indigo-900/20 rounded-lg shadow-2xl min-h-[90vh] overflow-hidden mx-4 my-8"
          onClick={e => e.stopPropagation()}
          dir="rtl"
        >
          {/* Header */}
          <div className="relative p-4 pb-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white rounded-t-lg overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 left-0 w-32 h-32 bg-white/20 rounded-full -translate-x-16 -translate-y-16"></div>
              <div className="absolute bottom-0 right-0 w-24 h-24 bg-white/10 rounded-full translate-x-12 translate-y-12"></div>
              <div className="absolute top-1/2 left-1/3 w-16 h-16 bg-white/15 rounded-full"></div>
            </div>
            
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  onClick={onClose}
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/10 rounded-lg p-2 h-auto"
                >
                  <X className="w-4 h-4" />
                </Button>
                
                <div className="relative">
                  <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-sm border border-white/20">
                    <Brain className="w-6 h-6 text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white"></div>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white mb-0.5">إدارة الطلبات الذكية</h2>
                  <p className="text-blue-100 text-xs">نظام ذكي متطور لإدارة طلبات التليغرام والذكاء الاصطناعي</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4">
            {/* Stats Overview */}
            <div className="grid grid-cols-5 gap-3 mb-4" dir="ltr">
              {/* Needs Review Card */}
              <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-red-500 to-red-700 text-white min-h-[100px]">
                <CardContent className="p-3">
                  <div className="text-center space-y-1">
                    <div className="flex justify-center">
                      <div className="p-1.5 bg-white/10 rounded-full backdrop-blur-sm">
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-xs">تحتاج مراجعة</h4>
                      <p className="text-red-100 text-xs">مراجعة عاجلة</p>
                    </div>
                    <div className="pt-1 border-t border-white/20">
                      <p className="text-lg font-bold">{needsReviewCount} طلب</p>
                    </div>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white/5 rounded-full"></div>
                  <div className="absolute top-1 right-3 w-3 h-3 bg-white/10 rounded-full"></div>
                  <div className="absolute top-3 left-1 w-2 h-2 bg-white/15 rounded-full"></div>
                </CardContent>
              </Card>

              {/* AI Chat Orders Card */}
              <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-purple-500 to-pink-600 text-white min-h-[100px]">
                <CardContent className="p-3">
                  <div className="text-center space-y-1">
                    <div className="flex justify-center">
                      <div className="p-1.5 bg-white/10 rounded-full backdrop-blur-sm">
                        <Brain className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-xs">الذكاء الاصطناعي</h4>
                      <p className="text-purple-100 text-xs">مساعد ذكي</p>
                    </div>
                    <div className="pt-1 border-t border-white/20">
                      <p className="text-lg font-bold">{aiChatCount} طلب</p>
                    </div>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white/5 rounded-full"></div>
                  <div className="absolute top-2 left-1 w-5 h-5 bg-white/8 rounded-full"></div>
                  <div className="absolute top-1 right-2 w-2 h-2 bg-white/15 rounded-full"></div>
                </CardContent>
              </Card>

              {/* Store Orders Card */}
              <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white min-h-[100px]">
                <CardContent className="p-3">
                  <div className="text-center space-y-1">
                    <div className="flex justify-center">
                      <div className="p-1.5 bg-white/10 rounded-full backdrop-blur-sm">
                        <ShoppingCart className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-xs">من المتجر</h4>
                      <p className="text-amber-100 text-xs">طلبات الموقع</p>
                    </div>
                    <div className="pt-1 border-t border-white/20">
                      <p className="text-lg font-bold">{storeCount} طلب</p>
                    </div>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white/5 rounded-full"></div>
                  <div className="absolute top-1 left-3 w-3 h-3 bg-white/12 rounded-full"></div>
                  <div className="absolute top-4 right-1 w-2 h-2 bg-white/20 rounded-full"></div>
                </CardContent>
              </Card>

              {/* Telegram Orders Card */}
              <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white min-h-[100px]">
                <CardContent className="p-3">
                  <div className="text-center space-y-1">
                    <div className="flex justify-center">
                      <div className="p-1.5 bg-white/10 rounded-full backdrop-blur-sm">
                        <Smartphone className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-xs">من التليغرام</h4>
                      <p className="text-cyan-100 text-xs">تليغرام بوت</p>
                    </div>
                    <div className="pt-1 border-t border-white/20">
                      <p className="text-lg font-bold">{telegramCount} طلب</p>
                    </div>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white/5 rounded-full"></div>
                  <div className="absolute top-1 left-3 w-3 h-3 bg-white/12 rounded-full"></div>
                  <div className="absolute top-4 right-1 w-2 h-2 bg-white/20 rounded-full"></div>
                </CardContent>
              </Card>

              {/* Total Orders Card */}
              <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-emerald-500 to-teal-700 text-white min-h-[100px]">
                <CardContent className="p-3">
                  <div className="text-center space-y-1">
                    <div className="flex justify-center">
                      <div className="p-1.5 bg-white/10 rounded-full backdrop-blur-sm">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-xs">إجمالي الطلبات</h4>
                      <p className="text-emerald-100 text-xs">طلبات واردة</p>
                    </div>
                    <div className="pt-1 border-t border-white/20">
                      <p className="text-lg font-bold">{totalCount} طلب</p>
                    </div>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white/5 rounded-full"></div>
                  <div className="absolute top-2 left-2 w-6 h-6 bg-white/10 rounded-full"></div>
                  <div className="absolute top-1 right-1 w-3 h-3 bg-white/15 rounded-full"></div>
                </CardContent>
              </Card>
            </div>

            {/* Needs Review Alert */}
            {needsReviewCount > 0 && (
              <div className="mb-4 p-3 bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  <div>
                    <h4 className="font-bold text-sm text-red-800 dark:text-red-200">
                      لديك {needsReviewCount} طلب يحتاج مراجعة عاجلة!
                    </h4>
                    <p className="text-xs text-red-700 dark:text-red-300">
                      هذه الطلبات تحتاج إلى اهتمام فوري ومراجعة يدوية
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Orders List */}
            <Card className="bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700">
              <CardHeader className="p-3 border-b border-slate-200 dark:border-slate-700">
                <div dir="rtl">
                  <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 mb-3">
                    <MessageSquare className="w-4 h-4 text-blue-600" />
                    قائمة الطلبات الذكية ({visibleOrders.length})
                  </CardTitle>
                  
                  {visibleOrders.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={selectedOrders.length === visibleOrders.length}
                          onCheckedChange={handleSelectAll}
                        />
                        <span className="text-xs text-slate-600 dark:text-slate-400">تحديد الكل</span>
                      </div>
                      
                      {selectedOrders.length > 0 && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleBulkAction('approve')}
                            className="h-7 text-xs bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white"
                          >
                            <CheckCircle2 className="w-3 h-3 ml-1" />
                            موافقة على المحدد ({selectedOrders.length})
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleBulkAction('delete')}
                            className="h-7 text-xs bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white"
                          >
                            <Trash2 className="w-3 h-3 ml-1" />
                            حذف المحدد ({selectedOrders.length})
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="p-3 space-y-3">
                {visibleOrders.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 mx-auto mb-3 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
                      <Bot className="w-6 h-6 text-slate-400" />
                    </div>
                    <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                      لا توجد طلبات ذكية
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-500">
                      سيتم عرض الطلبات الواردة من التليغرام والذكاء الاصطناعي هنا
                    </p>
                  </div>
                ) : (
                  [...visibleOrders].sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).map((order) => (
                    <AiOrderCard 
                      key={order.id} 
                      order={order}
                      isSelected={selectedOrders.includes(order.id)}
                      onSelect={(checked) => handleSelectOrder(order.id, checked)}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default AiOrdersManager;