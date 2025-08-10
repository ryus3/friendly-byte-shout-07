import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { X, Bot, FileDown, Trash2, ShieldCheck, Loader2, AlertTriangle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/use-toast';
import AiOrderCard from './AiOrderCard';
import AiOrdersHeaderStats from './AiOrdersHeaderStats';
import { QuickOrderContent } from '@/components/quick-order/QuickOrderContent';
import { useNotifications } from '@/contexts/NotificationsContext';
import { supabase } from '@/lib/customSupabaseClient';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const AiOrdersManager = ({ onClose }) => {
  const { user, hasPermission } = useAuth();
  const { aiOrders, approveAiOrder, deleteOrders } = useInventory();
  const { deleteNotificationByTypeAndData } = useNotifications();
  const [selectedOrders, setSelectedOrders] = React.useState([]);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [editingOrder, setEditingOrder] = React.useState(null);
  const [quickOrderDialogOpen, setQuickOrderDialogOpen] = React.useState(false);
  const [userEmployeeCode, setUserEmployeeCode] = React.useState(null);

  // جلب رمز الموظف للمستخدم الحالي
  React.useEffect(() => {
    const fetchEmployeeCode = async () => {
      if (!user?.user_id) return;
      
      try {
        const { data, error } = await supabase
          .from('telegram_employee_codes')
          .select('employee_code')
          .eq('user_id', user.user_id)
          .maybeSingle();
        
        if (!error && data) {
          setUserEmployeeCode(data.employee_code);
        }
      } catch (err) {
        console.error('Error fetching employee code:', err);
      }
    };
    
    fetchEmployeeCode();
  }, [user?.user_id]);

  const userAiOrders = React.useMemo(() => {
    if (!Array.isArray(aiOrders)) return [];
    
    // للمدير - عرض كل الطلبات
    if (hasPermission('view_all_data')) return aiOrders;
    
    // للموظفين - فلترة حسب رمز الموظف
    if (!userEmployeeCode) return [];
    
    return aiOrders.filter(order => {
      return order.created_by === userEmployeeCode;
    });
}, [aiOrders, userEmployeeCode, hasPermission]);

  const isOrderNeedsReview = React.useCallback((o) => {
    if (!o) return false;
    const status = (o.status || o.order_data?.status || '').toString().toLowerCase();
    if (['needs_review', 'requires_review', 'pending_review', 'review'].includes(status)) return true;
    if (o?.needs_review === true || o?.order_data?.needs_review === true) return true;
    const items = Array.isArray(o.items)
      ? o.items
      : Array.isArray(o.order_data?.items)
      ? o.order_data.items
      : [];
    return items.some((it) => {
      const avail = (it?.availability || '').toString().toLowerCase();
      const unavailableStates = ['out', 'insufficient', 'reserved', 'unavailable', 'hold', 'not_available'];
      const qtyShort =
        typeof it?.available_qty === 'number' &&
        typeof it?.requested_qty === 'number' &&
        it.available_qty < it.requested_qty;
      return it?.available === false || unavailableStates.includes(avail) || qtyShort;
    });
  }, []);

  const needReviewCount = React.useMemo(() => {
    return userAiOrders.filter(isOrderNeedsReview).length;
  }, [userAiOrders, isOrderNeedsReview]);

  const hasAnyUnavailable = needReviewCount > 0;

  const totalCount = userAiOrders.length;

  const telegramCount = React.useMemo(() => {
    const tg = ['telegram', 'tg_bot', 'telegram_bot'];
    return userAiOrders.filter((o) => {
      const src = (
        o?.source ||
        o?.channel ||
        o?.platform ||
        o?.entry ||
        o?.meta?.source ||
        ''
      )
        .toString()
        .toLowerCase();
      return o?.from_telegram === true || tg.includes(src);
    }).length;
  }, [userAiOrders]);

  const aiCount = React.useMemo(() => {
    const aiKeys = ['ai', 'gpt', 'assistant', 'llm'];
    return userAiOrders.filter((o) => {
      const src = (o?.source || o?.origin || o?.meta?.source || '')
        .toString()
        .toLowerCase();
      return o?.ai_generated === true || o?.is_ai === true || o?.meta?.ai === true || aiKeys.includes(src);
    }).length;
  }, [userAiOrders]);
  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedOrders(userAiOrders.map(order => order.id));
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

  const handleBulkApprove = async () => {
    if (!hasPermission('approve_orders')) {
      toast({ 
        title: "ليس لديك صلاحية", 
        description: "ليس لديك صلاحية للموافقة على الطلبات", 
        variant: "destructive" 
      });
      return;
    }
    
    setIsProcessing(true);
    let success = 0, failed = 0;
    for (const orderId of selectedOrders) {
      const res = await approveAiOrder(orderId);
      if (res?.success) success++; else failed++;
    }
    setSelectedOrders([]);
    setIsProcessing(false);
    toast({ title: "تمت المعالجة", description: `تم تحويل ${success} وحصول ${failed} على أخطاء`, variant: failed ? "destructive" : "success" });
  };

  const handleBulkDelete = async () => {
    setIsProcessing(true);
    await deleteOrders(selectedOrders, true);
    setSelectedOrders([]);
    setIsProcessing(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-slate-900/90 backdrop-blur-md z-[1200] flex items-center justify-center p-4 sm:p-6 animate-enter"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-gradient-to-br from-slate-800/95 via-slate-700/95 to-slate-800/95 backdrop-blur-2xl rounded-3xl shadow-2xl ring-1 ring-white/10 w-full max-w-3xl lg:max-w-5xl max-h-[90vh] overflow-y-auto border border-white/5"
        onClick={e => e.stopPropagation()}
      >
        <Card className="border-0 h-full">
          <CardHeader className="border-b border-white/10 bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-pink-600/20 backdrop-blur supports-[backdrop-filter]:bg-background/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bot className="w-6 h-6 text-blue-400" />
                <div>
                  <CardTitle className="text-2xl md:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-purple-300 to-pink-300">إدارة الطلبات الذكية</CardTitle>
                  <CardDescription className="text-sm md:text-base text-white/70">{userAiOrders.length} طلبات ذكية في انتظار المراجعة</CardDescription>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onClose}
                className="rounded-lg w-8 h-8 bg-white/10 backdrop-blur-sm border border-white/20 text-white/80 hover:text-white hover:bg-white/20 transition-all duration-300 hover:scale-110 shadow-lg hover:shadow-xl group hover:border-white/40"
              >
                <X className="w-4 h-4 transition-all duration-300 group-hover:rotate-90 group-hover:scale-110" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0 flex flex-col">
            <div className="p-5 md:p-6 border-b border-white/10 bg-gradient-to-r from-slate-800/50 via-slate-700/50 to-slate-800/50 supports-[backdrop-filter]:backdrop-blur-sm">
              <AiOrdersHeaderStats totalCount={totalCount} telegramCount={telegramCount} aiCount={aiCount} needReviewCount={needReviewCount} />
            </div>
            {userAiOrders.length > 0 && (
              <div className="p-4 md:p-5 border-b border-white/10 bg-gradient-to-r from-slate-800/30 via-slate-700/30 to-slate-800/30 supports-[backdrop-filter]:backdrop-blur">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Checkbox
                      checked={selectedOrders.length === userAiOrders.length}
                      onCheckedChange={handleSelectAll}
                    />
                    <span className="text-sm font-medium text-white/90">
                      تحديد الكل ({selectedOrders.length}/{userAiOrders.length})
                    </span>
                  </div>
                  
                  {selectedOrders.length > 0 && (
                    <div className="flex items-center gap-2">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            size="sm" 
                            disabled={isProcessing}
                          >
                            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <ShieldCheck className="w-4 h-4 ml-2" />}
                            موافقة على المحدد
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>تأكيد تحويل الطلبات المحددة</AlertDialogTitle>
                            <AlertDialogDescription>
                              سيتم تحويل {selectedOrders.length} طلب ذكي إلى طلبات حقيقية مع التحقق من المخزون وحجزه.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                            <AlertDialogAction onClick={handleBulkApprove}>تأكيد التحويل</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={handleBulkDelete}
                        disabled={isProcessing}
                      >
                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Trash2 className="w-4 h-4 ml-2" />}
                        حذف المحدد
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4">
              {needReviewCount > 0 && (
                <div className="mb-6 rounded-2xl p-5 md:p-6 bg-gradient-to-br from-red-500/20 via-red-600/15 to-red-700/20 ring-1 ring-red-400/30 shadow-xl hover-scale animate-enter border border-red-400/20">
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 bg-red-500/25 text-red-300 rounded-xl p-3 ring-1 ring-red-400/30 shadow-lg">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold leading-6 text-red-200 text-lg">هناك {needReviewCount} طلب تحتاج إلى مراجعة</p>
                      <p className="text-sm text-red-300/80 mt-2">يرجى تعديل العناصر غير المتاحة أو اختيار بدائل قبل الموافقة.</p>
                    </div>
                  </div>
                </div>
              )}
              {userAiOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <Bot className="w-20 h-20 text-white/40 mb-6" />
                  <h3 className="text-xl font-bold mb-3 text-white/90">لا توجد طلبات ذكية</h3>
                  <p className="text-white/60 max-w-sm">
                    عندما تصل طلبات ذكية جديدة، ستظهر هنا للمراجعة والموافقة.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {userAiOrders.map(order => (
                    <div key={order.id} className="rounded-2xl bg-gradient-to-br from-slate-700/40 via-slate-600/30 to-slate-700/40 backdrop-blur-sm border border-white/10 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.01] overflow-hidden">
                      <AiOrderCard
                        key={order.id}
                        order={order}
                        isSelected={selectedOrders.includes(order.id)}
                        onSelect={(checked) => handleSelectOrder(order.id, checked)}
                        onEdit={() => {
                          setEditingOrder(order);
                          setQuickOrderDialogOpen(true);
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* استخدام QuickOrderContent بدلاً من EditAiOrderDialog */}
        {quickOrderDialogOpen && editingOrder && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-background rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="text-lg font-semibold">تعديل الطلب الذكي</h2>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => {
                    setQuickOrderDialogOpen(false);
                    setEditingOrder(null);
                  }}
                  className="rounded-lg w-8 h-8 bg-background/90 backdrop-blur-sm border border-border/60 text-muted-foreground hover:text-foreground hover:bg-background transition-all duration-300 hover:scale-110 shadow-lg hover:shadow-xl group hover:border-primary/50"
                >
                  <X className="w-4 h-4 transition-all duration-300 group-hover:rotate-90 group-hover:scale-110" />
                </Button>
              </div>
              <div className="p-4 max-h-[calc(90vh-80px)] overflow-y-auto">
                <QuickOrderContent 
                  isDialog={true}
                  aiOrderData={editingOrder}
                  onOrderCreated={() => {
                    setQuickOrderDialogOpen(false);
                    setEditingOrder(null);
                    toast({ title: "نجاح", description: "تم تحديث الطلب بنجاح" });
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default AiOrdersManager;