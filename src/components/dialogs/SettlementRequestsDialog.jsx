import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Bell, 
  User, 
  DollarSign, 
  Package, 
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Banknote,
  Sparkles,
  TrendingUp,
  Wallet,
  Loader2
} from 'lucide-react';

/**
 * Dialog احترافي ثوري لعرض طلبات التحاسب المجمعة حسب الموظف
 */
const SettlementRequestsDialog = ({
  open,
  onOpenChange,
  profits = [],
  orders = [],
  allUsers = [],
  onSelectOrders,
  selectedOrderIds = [],
  settlementRequests = [],
  onProcessSettlement, // دالة معالجة التسوية
  isProcessing = false // حالة التحميل
}) => {
  const [expandedEmployees, setExpandedEmployees] = useState({});

  // تجميع طلبات التحاسب حسب الموظف - استخدام notifications أولاً ثم profits كـ fallback
  const settlementRequestsByEmployee = useMemo(() => {
    const grouped = {};
    
    // ✅ أولاً: استخدام طلبات التحاسب من notifications (الأدق)
    if (settlementRequests && settlementRequests.length > 0) {
      settlementRequests.forEach(notification => {
        // ✅ استخدام employee_id من data أولاً (الأصح)
        const employeeId = notification.data?.employee_id || notification.user_id;
        const employeeName = notification.data?.employee_name;
        const orderIds = notification.data?.order_ids || [];
        const totalProfit = notification.data?.total_profit || 0;
        
        if (!grouped[employeeId]) {
          const employee = allUsers?.find(u => u.user_id === employeeId);
          grouped[employeeId] = {
            // استخدام اسم الموظف من notification.data أولاً
            employee: employee || { 
              full_name: employeeName || 'موظف غير معروف', 
              user_id: employeeId 
            },
            orders: [],
            totalAmount: 0,
            notificationId: notification.id
          };
        }
        
        // إضافة الطلبات من notification
        orderIds.forEach(orderId => {
          const order = orders?.find(o => o.id === orderId);
          const profitRecord = profits?.find(p => p.order_id === orderId);
          grouped[employeeId].orders.push({
            order_id: orderId,
            employee_profit: profitRecord?.employee_profit || 0,
            order,
            profitRecord,
            created_at: notification.created_at
          });
        });
        grouped[employeeId].totalAmount = totalProfit;
      });
    } else {
      // ⚠️ Fallback: استخدام profits إذا لم تتوفر notifications
      const requests = profits?.filter(p => p.status === 'settlement_requested') || [];
      
      requests.forEach(req => {
        const employeeId = req.employee_id;
        if (!grouped[employeeId]) {
          const employee = allUsers?.find(u => u.user_id === employeeId);
          grouped[employeeId] = {
            employee: employee || { full_name: 'موظف غير معروف', user_id: employeeId },
            orders: [],
            totalAmount: 0
          };
        }
        
        const order = orders?.find(o => o.id === req.order_id);
        grouped[employeeId].orders.push({
          ...req,
          order
        });
        grouped[employeeId].totalAmount += (req.employee_profit || 0);
      });
    }
    
    return Object.values(grouped);
  }, [profits, orders, allUsers, settlementRequests]);

  const totalRequestsCount = settlementRequestsByEmployee.reduce((sum, emp) => sum + emp.orders.length, 0);
  const totalAmount = settlementRequestsByEmployee.reduce((sum, emp) => sum + emp.totalAmount, 0);

  const toggleEmployeeExpand = (employeeId) => {
    setExpandedEmployees(prev => ({
      ...prev,
      [employeeId]: !prev[employeeId]
    }));
  };

  const handleSelectAll = (employeeId, employeeOrders) => {
    const orderIds = employeeOrders.map(o => o.order_id).filter(Boolean);
    const allSelected = orderIds.every(id => selectedOrderIds.includes(id));
    
    if (allSelected) {
      onSelectOrders(selectedOrderIds.filter(id => !orderIds.includes(id)));
    } else {
      const newSelection = [...new Set([...selectedOrderIds, ...orderIds])];
      onSelectOrders(newSelection);
    }
  };

  const handleSelectOrder = (orderId) => {
    if (selectedOrderIds.includes(orderId)) {
      onSelectOrders(selectedOrderIds.filter(id => id !== orderId));
    } else {
      onSelectOrders([...selectedOrderIds, orderId]);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ar-IQ').format(amount || 0) + ' د.ع';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ar-IQ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden border-0 bg-transparent">
        {/* الخلفية الرئيسية مع تأثيرات glass morphism */}
        <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl overflow-hidden shadow-2xl">
          {/* تأثيرات الخلفية المتحركة */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-amber-500/30 to-orange-600/20 rounded-full blur-3xl animate-pulse" />
            <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-gradient-to-tr from-yellow-500/20 to-amber-500/10 rounded-full blur-3xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500/5 via-transparent to-transparent" />
          </div>

          {/* Header مع تصميم ثوري */}
          <div className="relative z-10 p-6 pb-4">
            <DialogHeader className="mb-0">
              <DialogTitle className="text-2xl font-bold flex items-center gap-3 text-white">
                <motion.div 
                  initial={{ rotate: -10 }}
                  animate={{ rotate: [0, -10, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                  className="relative"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-orange-500 rounded-xl blur-lg opacity-60 animate-pulse" />
                  <div className="relative p-2.5 bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 rounded-xl shadow-lg">
                    <Wallet className="w-6 h-6 text-white" />
                  </div>
                </motion.div>
                <span className="bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-200 bg-clip-text text-transparent">
                  طلبات التحاسب
                </span>
                <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
              </DialogTitle>
            </DialogHeader>
            
            {/* إحصائيات متحركة مع تصميم premium */}
            <div className="mt-5 grid grid-cols-3 gap-3">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 to-orange-600/10 rounded-xl blur-sm group-hover:blur-0 transition-all" />
                <div className="relative bg-white/5 backdrop-blur-xl rounded-xl p-3 text-center border border-amber-500/20 hover:border-amber-400/40 transition-all hover:scale-105">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <User className="w-4 h-4 text-amber-400" />
                    <span className="text-2xl font-bold text-white">{settlementRequestsByEmployee.length}</span>
                  </div>
                  <div className="text-xs text-amber-200/70">موظف</div>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-red-600/10 rounded-xl blur-sm group-hover:blur-0 transition-all" />
                <div className="relative bg-white/5 backdrop-blur-xl rounded-xl p-3 text-center border border-orange-500/20 hover:border-orange-400/40 transition-all hover:scale-105">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Package className="w-4 h-4 text-orange-400" />
                    <span className="text-2xl font-bold text-white">{totalRequestsCount}</span>
                  </div>
                  <div className="text-xs text-orange-200/70">طلب</div>
                </div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/20 to-amber-600/10 rounded-xl blur-sm group-hover:blur-0 transition-all" />
                <div className="relative bg-white/5 backdrop-blur-xl rounded-xl p-3 text-center border border-yellow-500/20 hover:border-yellow-400/40 transition-all hover:scale-105">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <TrendingUp className="w-4 h-4 text-yellow-400" />
                  </div>
                  <div className="text-sm font-bold text-white truncate">{formatCurrency(totalAmount)}</div>
                  <div className="text-xs text-yellow-200/70">إجمالي</div>
                </div>
              </motion.div>
            </div>
          </div>

          {/* قائمة الموظفين */}
          <ScrollArea className="h-[45vh] px-4 pb-2">
            {settlementRequestsByEmployee.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-12 px-6"
              >
                <div className="relative inline-block">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-green-500 rounded-full blur-xl opacity-50 animate-pulse" />
                  <CheckCircle className="w-20 h-20 mx-auto text-emerald-400 relative" />
                </div>
                <p className="text-lg font-medium text-white/90 mt-4">لا توجد طلبات تحاسب معلقة</p>
                <p className="text-sm text-white/50 mt-1">جميع الطلبات تمت تسويتها ✨</p>
              </motion.div>
            ) : (
              <div className="space-y-3 pb-2">
                <AnimatePresence>
                  {settlementRequestsByEmployee.map((empData, index) => {
                    const isExpanded = expandedEmployees[empData.employee.user_id];
                    const employeeOrderIds = empData.orders.map(o => o.order_id).filter(Boolean);
                    const allSelected = employeeOrderIds.length > 0 && employeeOrderIds.every(id => selectedOrderIds.includes(id));
                    const someSelected = employeeOrderIds.some(id => selectedOrderIds.includes(id));
                    
                    return (
                      <motion.div
                        key={empData.employee.user_id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.08 }}
                        layout
                      >
                        <div className={`relative overflow-hidden rounded-xl transition-all duration-300 ${
                          isExpanded 
                            ? 'bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border-amber-500/30' 
                            : 'bg-white/5 hover:bg-white/10 border-white/10'
                        } border backdrop-blur-sm`}>
                          {/* رأس كارت الموظف */}
                          <div 
                            className="p-4 cursor-pointer transition-colors"
                            onClick={() => toggleEmployeeExpand(empData.employee.user_id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="relative">
                                  <div className="absolute inset-0 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full blur opacity-60" />
                                  <Avatar className="w-12 h-12 border-2 border-amber-400/50 relative">
                                    <AvatarFallback className="bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 text-white font-bold">
                                      {empData.employee.full_name?.charAt(0) || 'م'}
                                    </AvatarFallback>
                                  </Avatar>
                                  {/* نقطة الإشعار */}
                                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-900 animate-pulse" />
                                </div>
                                <div>
                                  <h3 className="font-bold text-white text-lg">{empData.employee.full_name || 'موظف غير معروف'}</h3>
                                  <div className="flex items-center gap-3 text-sm text-white/60">
                                    <span className="flex items-center gap-1">
                                      <Package className="w-3.5 h-3.5" />
                                      {empData.orders.length} طلب
                                    </span>
                                    <span className="flex items-center gap-1 text-amber-400 font-medium">
                                      <DollarSign className="w-3.5 h-3.5" />
                                      {formatCurrency(empData.totalAmount)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <Badge className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border-amber-500/30 hover:from-amber-500/30 hover:to-orange-500/30">
                                  <Bell className="w-3 h-3 ml-1 animate-pulse" />
                                  ينتظر
                                </Badge>
                                <motion.div
                                  animate={{ rotate: isExpanded ? 180 : 0 }}
                                  transition={{ duration: 0.2 }}
                                >
                                  <ChevronDown className="w-5 h-5 text-white/50" />
                                </motion.div>
                              </div>
                            </div>
                          </div>
                          
                          {/* قائمة الطلبات المنسدلة */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25 }}
                                className="overflow-hidden"
                              >
                                <div className="px-4 pb-4">
                                  <div className="h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent mb-3" />
                                  
                                  {/* زر تحديد الكل */}
                                  <div className="flex items-center justify-between mb-3 bg-white/5 rounded-lg p-2.5">
                                    <div className="flex items-center gap-2">
                                      <Checkbox
                                        checked={allSelected}
                                        onCheckedChange={() => handleSelectAll(empData.employee.user_id, empData.orders)}
                                        className="border-amber-500 data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-amber-500 data-[state=checked]:to-orange-500 data-[state=checked]:border-0"
                                      />
                                      <span className="text-sm font-medium text-white/80">تحديد الكل ({empData.orders.length})</span>
                                    </div>
                                    {someSelected && (
                                      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                                        ✓ {employeeOrderIds.filter(id => selectedOrderIds.includes(id)).length} محدد
                                      </Badge>
                                    )}
                                  </div>
                                  
                                  {/* قائمة الطلبات */}
                                  <div className="space-y-2">
                                    {empData.orders.map((orderData, orderIndex) => (
                                      <motion.div 
                                        key={orderData.order_id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: orderIndex * 0.05 }}
                                        className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                                          selectedOrderIds.includes(orderData.order_id)
                                            ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/10 border-amber-500/40 shadow-lg shadow-amber-500/10'
                                            : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                                        }`}
                                        onClick={() => handleSelectOrder(orderData.order_id)}
                                      >
                                        <div className="flex items-center gap-3">
                                          <Checkbox
                                            checked={selectedOrderIds.includes(orderData.order_id)}
                                            onCheckedChange={() => handleSelectOrder(orderData.order_id)}
                                            className="border-amber-500 data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-amber-500 data-[state=checked]:to-orange-500 data-[state=checked]:border-0"
                                          />
                                          <div>
                                            <div className="font-mono font-medium text-white">
                                              {orderData.order?.tracking_number || orderData.order?.order_number || '-'}
                                            </div>
                                            <div className="text-xs text-white/50 flex items-center gap-1">
                                              <Clock className="w-3 h-3" />
                                              {formatDate(orderData.order?.created_at)}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="text-left">
                                          <span className="font-bold text-amber-400">{formatCurrency(orderData.employee_profit)}</span>
                                        </div>
                                      </motion.div>
                                    ))}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </ScrollArea>

          {/* Footer مع أزرار الإجراءات */}
          {settlementRequestsByEmployee.length > 0 && (
            <div className="relative z-10 p-4 border-t border-white/10 bg-slate-900/50 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  {selectedOrderIds.length > 0 ? (
                    <span className="font-medium text-amber-400 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      {selectedOrderIds.length} طلب محدد للتسوية
                    </span>
                  ) : (
                    <span className="text-white/50">حدد الطلبات المراد تسويتها</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    className="border-white/20 text-white/70 hover:bg-white/10 hover:text-white"
                  >
                    إغلاق
                  </Button>
                  <Button
                    disabled={selectedOrderIds.length === 0 || isProcessing}
                    className="relative overflow-hidden bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-600 hover:via-orange-600 hover:to-red-600 text-white border-0 shadow-lg shadow-orange-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={async () => {
                      if (onProcessSettlement) {
                        await onProcessSettlement(selectedOrderIds);
                      }
                    }}
                  >
                    <span className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 hover:opacity-100 transition-opacity" />
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    ) : (
                      <Banknote className="w-4 h-4 ml-2" />
                    )}
                    {isProcessing ? 'جارٍ المعالجة...' : 'متابعة التسوية'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SettlementRequestsDialog;
