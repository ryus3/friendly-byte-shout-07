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
      className="fixed inset-0 z-[1200] flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
      style={{
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 50%, rgba(15, 23, 42, 0.95) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)'
      }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: "spring", duration: 0.5 }}
        className="w-full max-w-7xl max-h-[95vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
        style={{
          background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.95) 0%, rgba(51, 65, 85, 0.95) 50%, rgba(30, 41, 59, 0.95) 100%)',
          backdropFilter: 'blur(25px)',
          WebkitBackdropFilter: 'blur(25px)',
          borderRadius: '24px',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 100px rgba(59, 130, 246, 0.1)'
        }}
      >
        <Card className="border-0 h-full bg-transparent shadow-none">
          {/* Header */}
          <CardHeader 
            className="border-b border-white/15 p-4 md:p-6 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.15) 0%, rgba(59, 130, 246, 0.15) 25%, rgba(99, 102, 241, 0.15) 50%, rgba(139, 92, 246, 0.15) 75%, rgba(168, 85, 247, 0.15) 100%)',
              backdropFilter: 'blur(20px)'
            }}
          >
            <div className="absolute inset-0">
              <div className="absolute inset-0 bg-gradient-to-r from-sky-500/10 via-blue-500/10 to-indigo-500/10" />
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-sky-400 via-blue-400 to-indigo-400" />
            </div>
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3 md:gap-5">
                <div 
                  className="p-3 md:p-4 rounded-2xl border border-sky-300/30 shadow-2xl backdrop-blur-sm"
                  style={{
                    background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.4) 0%, rgba(59, 130, 246, 0.4) 50%, rgba(99, 102, 241, 0.4) 100%)',
                    boxShadow: '0 20px 40px rgba(56, 189, 248, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                  }}
                >
                  <Bot className="w-7 h-7 md:w-9 md:h-9 text-sky-100 drop-shadow-2xl" />
                </div>
                <div className="space-y-1">
                  <CardTitle 
                    className="text-xl md:text-3xl lg:text-4xl font-black tracking-tight drop-shadow-2xl"
                    style={{
                      background: 'linear-gradient(135deg, #87CEEB 0%, #4FC3F7 15%, #29B6F6 30%, #03A9F4 45%, #0288D1 60%, #0277BD 75%, #01579B 90%, #1A237E 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      filter: 'drop-shadow(0 4px 8px rgba(56, 189, 248, 0.3))'
                    }}
                  >
                    إدارة الطلبات الذكية
                  </CardTitle>
                  <CardDescription 
                    className="text-sm md:text-lg text-sky-100/90 font-medium drop-shadow-lg"
                    style={{
                      textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
                    }}
                  >
                    نظام ذكي متطور لإدارة طلبات التليغرام والذكاء الاصطناعي
                  </CardDescription>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onClose}
                className="rounded-2xl w-11 h-11 md:w-14 md:h-14 text-sky-100/80 hover:text-sky-50 transition-all duration-500 hover:scale-110 border border-sky-300/30 backdrop-blur-sm shadow-xl hover:shadow-2xl group"
                style={{
                  background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%)',
                  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                }}
              >
                <X className="w-5 h-5 md:w-7 md:h-7 drop-shadow-xl transition-transform duration-300 group-hover:rotate-90" />
              </Button>
            </div>
            <div className="absolute -top-6 -left-6 w-32 h-32 rounded-full bg-sky-400/20 blur-3xl animate-pulse" />
            <div className="absolute -bottom-6 -right-6 w-32 h-32 rounded-full bg-blue-400/20 blur-3xl animate-pulse" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-indigo-400/10 blur-[100px]" />
          </CardHeader>

          <CardContent className="p-0 h-[calc(95vh-120px)] overflow-y-auto custom-scrollbar">
            {/* Stats Header */}
            <div 
              className="p-6 border-b border-white/10"
              style={{
                background: 'linear-gradient(180deg, rgba(51, 65, 85, 0.3) 0%, rgba(30, 41, 59, 0.3) 100%)',
                backdropFilter: 'blur(10px)'
              }}
            >
              <AiOrdersHeaderStats totalCount={totalCount} telegramCount={telegramCount} aiCount={aiCount} needReviewCount={needReviewCount} />
            </div>

            {/* Bulk Actions */}
            {userAiOrders.length > 0 && (
              <div 
                className="p-5 border-b border-white/10"
                style={{
                  background: 'linear-gradient(90deg, rgba(30, 41, 59, 0.4) 0%, rgba(51, 65, 85, 0.4) 100%)',
                  backdropFilter: 'blur(10px)'
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Checkbox
                      checked={selectedOrders.length === userAiOrders.length}
                      onCheckedChange={handleSelectAll}
                      className="border-white/30 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                    />
                    <span className="text-lg font-bold text-white/90">
                      تحديد الكل ({selectedOrders.length}/{userAiOrders.length})
                    </span>
                  </div>
                  
                  {selectedOrders.length > 0 && (
                  <div className="flex items-center gap-3">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            size="lg"
                            disabled={isProcessing}
                            className="bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600 hover:from-emerald-600 hover:via-green-600 hover:to-emerald-700 text-white border-0 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 rounded-xl px-6 py-3 font-bold"
                          >
                            {isProcessing ? <Loader2 className="w-5 h-5 animate-spin ml-2" /> : <ShieldCheck className="w-5 h-5 ml-2" />}
                            موافقة على المحدد ({selectedOrders.length})
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent 
                          className="rounded-2xl border border-white/20"
                          style={{
                            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(51, 65, 85, 0.95) 100%)',
                            backdropFilter: 'blur(20px)'
                          }}
                        >
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-white text-xl">تأكيد تحويل الطلبات المحددة</AlertDialogTitle>
                            <AlertDialogDescription className="text-white/80 text-lg">
                              سيتم تحويل {selectedOrders.length} طلب ذكي إلى طلبات حقيقية مع التحقق من المخزون وحجزه.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="bg-white/10 text-white border-white/20 hover:bg-white/20">إلغاء</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={handleBulkApprove}
                              className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700"
                            >
                              تأكيد التحويل
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <Button 
                        variant="destructive" 
                        size="lg"
                        onClick={handleBulkDelete}
                        disabled={isProcessing}
                        className="bg-gradient-to-r from-red-500 via-rose-500 to-red-600 hover:from-red-600 hover:via-rose-600 hover:to-red-700 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 rounded-xl px-6 py-3 font-bold"
                      >
                        {isProcessing ? <Loader2 className="w-5 h-5 animate-spin ml-2" /> : <Trash2 className="w-5 h-5 ml-2" />}
                        حذف المحدد ({selectedOrders.length})
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Content */}
            <div 
              className="flex-1 p-6"
              style={{
                background: 'linear-gradient(180deg, rgba(15, 23, 42, 0.2) 0%, rgba(30, 41, 59, 0.2) 100%)'
              }}
            >
              {needReviewCount > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: -20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", duration: 0.8, bounce: 0.3 }}
                  className="mb-8 rounded-3xl p-6 md:p-8 border border-red-300/40 shadow-2xl hover:shadow-red-500/30 transition-all duration-700 group relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.25) 0%, rgba(185, 28, 28, 0.25) 30%, rgba(153, 27, 27, 0.25) 70%, rgba(127, 29, 29, 0.25) 100%)',
                    backdropFilter: 'blur(25px)',
                    boxShadow: '0 25px 50px rgba(220, 38, 38, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-red-400/10 via-transparent to-red-400/10 group-hover:from-red-300/15 group-hover:to-red-300/15 transition-all duration-700" />
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-400 via-red-500 to-red-600" />
                  <div className="relative flex items-start gap-5 md:gap-6">
                    <div 
                      className="shrink-0 p-4 md:p-5 rounded-2xl border border-red-300/50 shadow-2xl backdrop-blur-sm group-hover:scale-110 transition-transform duration-500"
                      style={{
                        background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.4) 0%, rgba(185, 28, 28, 0.4) 100%)',
                        boxShadow: '0 15px 30px rgba(220, 38, 38, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
                      }}
                    >
                      <AlertTriangle className="w-8 h-8 md:w-10 md:h-10 text-red-100 drop-shadow-2xl" />
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🚨</span>
                        <p className="font-black text-xl md:text-2xl text-red-100 drop-shadow-xl">
                          هناك {needReviewCount} طلب تحتاج إلى مراجعة عاجلة
                        </p>
                      </div>
                      <p className="text-red-100/90 text-lg md:text-xl leading-relaxed font-medium drop-shadow-md">
                        يرجى تعديل العناصر غير المتاحة أو اختيار بدائل قبل الموافقة على هذه الطلبات للمتابعة.
                      </p>
                    </div>
                  </div>
                  <div className="absolute -top-8 -left-8 w-24 h-24 rounded-full bg-red-400/20 blur-3xl animate-pulse" />
                  <div className="absolute -bottom-8 -right-8 w-24 h-24 rounded-full bg-rose-400/20 blur-3xl animate-pulse" />
                </motion.div>
              )}

              {userAiOrders.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center justify-center h-96 text-center"
                >
                  <div className="p-8 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-600/20 border border-white/20 mb-8">
                    <Bot className="w-24 h-24 text-blue-400" />
                  </div>
                  <h3 className="text-3xl font-black text-white/90 mb-4">لا توجد طلبات ذكية</h3>
                  <p className="text-white/60 text-xl max-w-md">
                    عندما تصل طلبات ذكية جديدة من التليغرام أو الذكاء الاصطناعي، ستظهر هنا للمراجعة والموافقة.
                  </p>
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-6"
                >
                  {userAiOrders.map((order, index) => (
                    <motion.div
                      key={order.id}
                      initial={{ opacity: 0, y: 30, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: index * 0.15, type: "spring", duration: 0.8, bounce: 0.2 }}
                      className="rounded-3xl overflow-hidden border border-white/25 shadow-2xl hover:shadow-blue-500/20 transition-all duration-700 hover:scale-[1.03] group relative"
                      style={{
                        background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.4) 0%, rgba(30, 41, 59, 0.4) 30%, rgba(51, 65, 85, 0.4) 70%, rgba(30, 58, 138, 0.4) 100%)',
                        backdropFilter: 'blur(30px)',
                        boxShadow: '0 25px 50px rgba(30, 58, 138, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                      }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/8 via-sky-500/8 to-indigo-500/8 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-sky-400 via-blue-400 to-indigo-400" />
                      <div className="relative backdrop-blur-sm">
                        <AiOrderCard
                          order={order}
                          isSelected={selectedOrders.includes(order.id)}
                          onSelect={(checked) => handleSelectOrder(order.id, checked)}
                          onEdit={() => {
                            setEditingOrder(order);
                            setQuickOrderDialogOpen(true);
                          }}
                        />
                      </div>
                      <div className="absolute -top-6 -left-6 w-20 h-20 rounded-full bg-sky-400/20 blur-2xl group-hover:bg-sky-400/30 transition-all duration-700" />
                      <div className="absolute -bottom-6 -right-6 w-20 h-20 rounded-full bg-blue-400/20 blur-2xl group-hover:bg-blue-400/30 transition-all duration-700" />
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        {quickOrderDialogOpen && editingOrder && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-3xl border border-white/20 shadow-2xl"
              style={{
                background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.95) 0%, rgba(51, 65, 85, 0.95) 100%)',
                backdropFilter: 'blur(25px)'
              }}
            >
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <h2 className="text-2xl font-black text-white">تعديل الطلب الذكي</h2>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => {
                    setQuickOrderDialogOpen(false);
                    setEditingOrder(null);
                  }}
                  className="rounded-2xl w-10 h-10 text-white/80 hover:text-white hover:bg-white/10 border border-white/20"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <div className="p-6 max-h-[calc(90vh-120px)] overflow-y-auto">
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
            </motion.div>
          </motion.div>
        )}
      </motion.div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, rgba(59, 130, 246, 0.6), rgba(147, 51, 234, 0.6));
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(to bottom, rgba(59, 130, 246, 0.8), rgba(147, 51, 234, 0.8));
        }
      `}</style>
    </motion.div>
  );
};

export default AiOrdersManager;