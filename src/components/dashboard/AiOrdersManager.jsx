import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { X, Bot, Trash2, ShieldCheck, Loader2, AlertTriangle, Sparkles, MessageCircle, Zap, Brain, CheckCircle2, Clock, Package, Users } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';
import AiOrderCard from './AiOrderCard';
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

  const hasAnyUnavailable = React.useMemo(() => {
    return userAiOrders.some(o => Array.isArray(o.items) && o.items.some(it => it?.available === false || it?.availability === 'out' || it?.availability === 'insufficient'));
  }, [userAiOrders]);

  // إحصائيات مبهرة
  const stats = React.useMemo(() => {
    const total = userAiOrders.length;
    const unavailable = userAiOrders.filter(o => Array.isArray(o.items) && o.items.some(it => it?.available === false)).length;
    const available = total - unavailable;
    const telegram = userAiOrders.filter(o => o.source === 'telegram').length;
    const whatsapp = userAiOrders.filter(o => o.source === 'whatsapp').length;
    const totalValue = userAiOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    
    return { total, unavailable, available, telegram, whatsapp, totalValue };
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
      className="fixed inset-0 bg-black/60 backdrop-blur-lg z-[1200] flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="bg-gradient-to-br from-background/95 via-background to-background/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-primary/20 w-full max-w-7xl max-h-[95vh] overflow-hidden relative"
        onClick={e => e.stopPropagation()}
      >
        {/* خلفية متدرجة ساحرة */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-blue-500/5 to-purple-500/5 opacity-50" />
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 via-purple-500 via-pink-500 to-orange-500" />
        
        {/* نقاط مضيئة متحركة */}
        <div className="absolute top-10 right-20 w-3 h-3 bg-blue-400 rounded-full opacity-60 animate-pulse" />
        <div className="absolute top-32 right-32 w-2 h-2 bg-purple-400 rounded-full opacity-40 animate-ping" />
        <div className="absolute bottom-20 left-20 w-4 h-4 bg-pink-400 rounded-full opacity-50 animate-bounce" />
        
        <Card className="border-0 h-full bg-transparent">
          {/* Header مبهر مع إحصائيات */}
          <CardHeader className="border-b border-primary/10 bg-gradient-to-r from-primary/10 via-blue-500/10 to-purple-500/10 backdrop-blur-xl sticky top-0 z-20 pb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl blur-lg opacity-60 animate-pulse" />
                  <div className="relative bg-gradient-to-br from-blue-500 to-purple-600 p-3 rounded-2xl shadow-xl">
                    <Brain className="w-8 h-8 text-white" />
                  </div>
                </div>
                <div>
                  <CardTitle className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary via-blue-600 to-purple-600 flex items-center gap-3">
                    إدارة الطلبات الذكية
                    <Sparkles className="w-8 h-8 text-yellow-500 animate-pulse" />
                  </CardTitle>
                  <CardDescription className="text-lg text-muted-foreground/80 flex items-center gap-2 mt-1">
                    <Zap className="w-5 h-5 text-orange-500" />
                    منصة الذكاء الاصطناعي لمعالجة الطلبات
                  </CardDescription>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onClose}
                className="rounded-xl w-12 h-12 bg-red-500/10 hover:bg-red-500/20 text-red-600 hover:text-red-700 transition-all duration-300 hover:scale-110 shadow-lg hover:shadow-xl border border-red-200/50"
              >
                <X className="w-6 h-6" />
              </Button>
            </div>

            {/* إحصائيات مبهرة */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-4">
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 backdrop-blur-sm border border-blue-300/30 rounded-2xl p-4 text-center shadow-lg"
              >
                <Package className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-blue-700">{stats.total}</div>
                <div className="text-xs text-blue-600">إجمالي الطلبات</div>
              </motion.div>
              
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="bg-gradient-to-br from-green-500/20 to-emerald-600/20 backdrop-blur-sm border border-green-300/30 rounded-2xl p-4 text-center shadow-lg"
              >
                <CheckCircle2 className="w-6 h-6 text-green-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-green-700">{stats.available}</div>
                <div className="text-xs text-green-600">جاهز للموافقة</div>
              </motion.div>
              
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="bg-gradient-to-br from-red-500/20 to-pink-600/20 backdrop-blur-sm border border-red-300/30 rounded-2xl p-4 text-center shadow-lg"
              >
                <AlertTriangle className="w-6 h-6 text-red-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-red-700">{stats.unavailable}</div>
                <div className="text-xs text-red-600">يحتاج مراجعة</div>
              </motion.div>
              
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="bg-gradient-to-br from-purple-500/20 to-indigo-600/20 backdrop-blur-sm border border-purple-300/30 rounded-2xl p-4 text-center shadow-lg"
              >
                <MessageCircle className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-purple-700">{stats.telegram}</div>
                <div className="text-xs text-purple-600">من التليغرام</div>
              </motion.div>
              
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="bg-gradient-to-br from-orange-500/20 to-amber-600/20 backdrop-blur-sm border border-orange-300/30 rounded-2xl p-4 text-center shadow-lg"
              >
                <Users className="w-6 h-6 text-orange-600 mx-auto mb-2" />
                <div className="text-2xl font-bold text-orange-700">{stats.whatsapp}</div>
                <div className="text-xs text-orange-600">من الواتساب</div>
              </motion.div>
              
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 backdrop-blur-sm border border-yellow-300/30 rounded-2xl p-4 text-center shadow-lg"
              >
                <Clock className="w-6 h-6 text-yellow-600 mx-auto mb-2" />
                <div className="text-xl font-bold text-yellow-700">{stats.totalValue.toLocaleString()}</div>
                <div className="text-xs text-yellow-600">القيمة الإجمالية</div>
              </motion.div>
            </div>

            {/* تنبيه بارز عند وجود طلبات غير متاحة */}
            {hasAnyUnavailable && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-red-500/20 via-pink-500/20 to-orange-500/20 backdrop-blur-sm border-2 border-red-400/50 rounded-2xl p-6 mb-4 shadow-2xl"
              >
                <div className="flex items-start gap-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-red-500 rounded-full blur-lg opacity-60 animate-pulse" />
                    <AlertTriangle className="relative w-8 h-8 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-red-700 mb-2 flex items-center gap-2">
                      ⚠️ تنبيه: طلبات تحتاج مراجعة
                      <Badge className="bg-red-500 text-white animate-bounce">
                        {stats.unavailable}
                      </Badge>
                    </h3>
                    <p className="text-red-600 text-sm leading-relaxed">
                      هناك طلبات تحتوي على منتجات غير متاحة أو محجوزة. يرجى تعديل هذه الطلبات واختيار منتجات بديلة قبل الموافقة عليها.
                      <br />
                      <span className="font-semibold">لا يمكن الموافقة على الطلبات التي تحتوي منتجات غير متاحة.</span>
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </CardHeader>

          <CardContent className="p-0 flex flex-col h-[calc(95vh-200px)]">
            {/* شريط التحكم السريع */}
            {userAiOrders.length > 0 && (
              <div className="p-6 border-b border-primary/10 bg-gradient-to-r from-muted/30 to-background/50 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Checkbox
                      checked={selectedOrders.length === userAiOrders.length}
                      onCheckedChange={handleSelectAll}
                      className="scale-125"
                    />
                    <span className="text-lg font-semibold text-foreground">
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
                            className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
                          >
                            {isProcessing ? <Loader2 className="w-5 h-5 animate-spin ml-2" /> : <ShieldCheck className="w-5 h-5 ml-2" />}
                            موافقة على المحدد ({selectedOrders.length})
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-gradient-to-br from-background via-background to-green-50/20 border-2 border-green-200/50 rounded-2xl shadow-2xl">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-2xl font-bold text-green-700 flex items-center gap-2">
                              <ShieldCheck className="w-6 h-6" />
                              تأكيد تحويل الطلبات
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-lg text-green-600 leading-relaxed">
                              سيتم تحويل <span className="font-bold">{selectedOrders.length}</span> طلب ذكي إلى طلبات حقيقية مع التحقق من المخزون وحجزه تلقائياً.
                              <br />
                              <span className="text-sm text-muted-foreground mt-2 block">هذا الإجراء غير قابل للتراجع</span>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="gap-3">
                            <AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={handleBulkApprove}
                              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-xl"
                            >
                              تأكيد التحويل
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="destructive" 
                            size="lg" 
                            disabled={isProcessing}
                            className="bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
                          >
                            {isProcessing ? <Loader2 className="w-5 h-5 animate-spin ml-2" /> : <Trash2 className="w-5 h-5 ml-2" />}
                            حذف المحدد ({selectedOrders.length})
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-gradient-to-br from-background via-background to-red-50/20 border-2 border-red-200/50 rounded-2xl shadow-2xl">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-2xl font-bold text-red-700 flex items-center gap-2">
                              <Trash2 className="w-6 h-6" />
                              تأكيد حذف الطلبات
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-lg text-red-600 leading-relaxed">
                              هل أنت متأكد من حذف <span className="font-bold">{selectedOrders.length}</span> طلب ذكي؟
                              <br />
                              <span className="text-sm text-muted-foreground mt-2 block">هذا الإجراء غير قابل للتراجع</span>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="gap-3">
                            <AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={handleBulkDelete}
                              className="bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 rounded-xl"
                            >
                              تأكيد الحذف
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* المحتوى الرئيسي */}
            <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-br from-muted/10 to-transparent">
              {userAiOrders.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center h-full text-center bg-gradient-to-br from-primary/5 to-blue-500/5 rounded-3xl border-2 border-dashed border-primary/20 p-12"
                >
                  <div className="relative mb-6">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full blur-2xl opacity-30 animate-pulse" />
                    <Bot className="relative w-24 h-24 text-primary" />
                  </div>
                  <h3 className="text-3xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600">
                    لا توجد طلبات ذكية
                  </h3>
                  <p className="text-lg text-muted-foreground leading-relaxed max-w-md">
                    عندما تصل طلبات ذكية جديدة من التليغرام أو الواتساب، ستظهر هنا للمراجعة والموافقة.
                  </p>
                  <div className="flex items-center gap-4 mt-6 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-5 h-5 text-blue-500" />
                      <span>التليغرام</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-green-500" />
                      <span>الواتساب</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Brain className="w-5 h-5 text-purple-500" />
                      <span>الذكاء الاصطناعي</span>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="grid gap-6">
                  <AnimatePresence>
                    {userAiOrders.map((order, index) => (
                      <motion.div
                        key={order.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: index * 0.1 }}
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
                  </AnimatePresence>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* نافذة تعديل الطلب */}
        <AnimatePresence>
          {quickOrderDialogOpen && editingOrder && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-lg z-50 flex items-center justify-center p-4"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-background rounded-2xl shadow-2xl border border-primary/20 w-full max-w-6xl max-h-[90vh] overflow-hidden"
              >
                <div className="p-6 border-b border-primary/10 flex items-center justify-between bg-gradient-to-r from-primary/10 to-blue-500/10">
                  <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600 flex items-center gap-2">
                    <Bot className="w-6 h-6 text-primary" />
                    تعديل الطلب الذكي
                  </h2>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => {
                      setQuickOrderDialogOpen(false);
                      setEditingOrder(null);
                    }}
                    className="rounded-xl w-10 h-10 hover:bg-red-500/10 text-red-600"
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
                      toast({ 
                        title: "تم بنجاح", 
                        description: "تم تحديث الطلب بنجاح", 
                        variant: "success" 
                      });
                    }}
                  />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};

export default AiOrdersManager;