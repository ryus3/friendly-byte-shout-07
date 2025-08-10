import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { X, Bot, ShieldCheck, Loader2, AlertTriangle, Inbox, MessageSquare, Clock, Trash2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/use-toast';
import AiOrderCard from './AiOrderCard';
import { QuickOrderContent } from '@/components/quick-order/QuickOrderContent';
import { useNotifications } from '@/contexts/NotificationsContext';
import { supabase } from '@/lib/customSupabaseClient';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const StatsCard = ({ icon: Icon, title, value, color, bgColor }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    whileHover={{ scale: 1.05 }}
    className={`${bgColor} rounded-xl p-4 shadow-lg hover:shadow-xl transition-all duration-300 border border-white/20`}
  >
    <div className="flex items-center justify-between">
      <div>
        <p className="text-white/90 text-sm font-medium">{title}</p>
        <p className={`${color} text-2xl font-bold mt-1`}>{value}</p>
      </div>
      <Icon className={`${color} w-8 h-8`} />
    </div>
  </motion.div>
);

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
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1200] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-background rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden border"
        onClick={e => e.stopPropagation()}
      >
        <Card className="border-0 h-full">
          {/* Header */}
          <CardHeader className="border-b bg-gradient-to-r from-primary/10 to-secondary/10 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <Bot className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold">إدارة الطلبات الذكية</CardTitle>
                  <CardDescription>نظام إدارة طلبات التليغرام والذكاء الاصطناعي</CardDescription>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onClose}
                className="h-8 w-8 rounded-lg"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0 h-[calc(85vh-80px)] overflow-y-auto">
            {/* Stats Grid */}
            <div className="p-4 border-b bg-muted/30">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatsCard
                  icon={Inbox}
                  title="إجمالي الطلبات"
                  value={totalCount}
                  color="text-blue-400"
                  bgColor="bg-gradient-to-br from-blue-500 to-blue-600"
                />
                <StatsCard
                  icon={Clock}
                  title="في الانتظار"
                  value={telegramCount}
                  color="text-orange-400"
                  bgColor="bg-gradient-to-br from-orange-500 to-red-500"
                />
                <StatsCard
                  icon={AlertTriangle}
                  title="تحتاج مراجعة"
                  value={needReviewCount}
                  color="text-red-400"
                  bgColor="bg-gradient-to-br from-red-500 to-red-600"
                />
                <StatsCard
                  icon={MessageSquare}
                  title="من التليغرام"
                  value={telegramCount}
                  color="text-cyan-400"
                  bgColor="bg-gradient-to-br from-cyan-500 to-blue-500"
                />
              </div>
            </div>

            {/* Bulk Actions */}
            {userAiOrders.length > 0 && (
              <div className="p-4 border-b bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={selectedOrders.length === userAiOrders.length}
                      onCheckedChange={handleSelectAll}
                    />
                    <span className="text-sm font-medium">
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
                            className="bg-green-600 hover:bg-green-700"
                          >
                            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <ShieldCheck className="w-4 h-4 ml-2" />}
                            موافقة ({selectedOrders.length})
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>تأكيد تحويل الطلبات</AlertDialogTitle>
                            <AlertDialogDescription>
                              سيتم تحويل {selectedOrders.length} طلب ذكي إلى طلبات حقيقية.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                            <AlertDialogAction onClick={handleBulkApprove}>تأكيد</AlertDialogAction>
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
                        حذف ({selectedOrders.length})
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Alert */}
            {needReviewCount > 0 && (
              <div className="m-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
                  <div>
                    <p className="font-semibold text-destructive">
                      هناك {needReviewCount} طلب تحتاج مراجعة
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      يرجى تعديل العناصر غير المتاحة قبل الموافقة.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Orders List */}
            <div className="p-4">
              {userAiOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <Bot className="w-16 h-16 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">لا توجد طلبات ذكية</h3>
                  <p className="text-muted-foreground">
                    عندما تصل طلبات جديدة، ستظهر هنا للمراجعة.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {userAiOrders.map(order => (
                    <motion.div
                      key={order.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="border rounded-lg hover:shadow-md transition-shadow"
                    >
                      <AiOrderCard
                        order={order}
                        isSelected={selectedOrders.includes(order.id)}
                        onSelect={(checked) => handleSelectOrder(order.id, checked)}
                        onEdit={() => {
                          setEditingOrder(order);
                          setQuickOrderDialogOpen(true);
                        }}
                      />
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        {quickOrderDialogOpen && editingOrder && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-background rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="text-lg font-semibold">تعديل الطلب الذكي</h2>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setQuickOrderDialogOpen(false);
                    setEditingOrder(null);
                  }}
                  className="h-8 w-8 rounded-lg"
                >
                  <X className="w-4 h-4" />
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