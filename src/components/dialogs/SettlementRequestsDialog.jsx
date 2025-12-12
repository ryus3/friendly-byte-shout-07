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
  Banknote
} from 'lucide-react';

/**
 * Dialog احترافي لعرض طلبات التحاسب المجمعة حسب الموظف
 */
const SettlementRequestsDialog = ({
  open,
  onOpenChange,
  profits = [],
  orders = [],
  allUsers = [],
  onSelectOrders,
  selectedOrderIds = []
}) => {
  const [expandedEmployees, setExpandedEmployees] = useState({});

  // تجميع طلبات التحاسب حسب الموظف
  const settlementRequestsByEmployee = useMemo(() => {
    const requests = profits?.filter(p => p.status === 'settlement_requested') || [];
    const grouped = {};
    
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
      
      // البحث عن بيانات الطلب
      const order = orders?.find(o => o.id === req.order_id);
      grouped[employeeId].orders.push({
        ...req,
        order
      });
      grouped[employeeId].totalAmount += (req.employee_profit || 0);
    });
    
    return Object.values(grouped);
  }, [profits, orders, allUsers]);

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
      // إلغاء تحديد الكل
      onSelectOrders(selectedOrderIds.filter(id => !orderIds.includes(id)));
    } else {
      // تحديد الكل
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
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden">
        {/* Header مع gradient احترافي */}
        <div className="bg-gradient-to-l from-orange-500 via-amber-500 to-yellow-500 p-6 text-white">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-3 text-white">
              <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                <Bell className="w-6 h-6 animate-pulse" />
              </div>
              طلبات التحاسب
            </DialogTitle>
          </DialogHeader>
          
          {/* إحصائيات سريعة */}
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center">
              <div className="text-2xl font-bold">{settlementRequestsByEmployee.length}</div>
              <div className="text-sm opacity-90">موظف</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center">
              <div className="text-2xl font-bold">{totalRequestsCount}</div>
              <div className="text-sm opacity-90">طلب</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center">
              <div className="text-lg font-bold">{formatCurrency(totalAmount)}</div>
              <div className="text-sm opacity-90">إجمالي</div>
            </div>
          </div>
        </div>

        {/* قائمة الموظفين */}
        <ScrollArea className="max-h-[50vh] p-4">
          {settlementRequestsByEmployee.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">لا توجد طلبات تحاسب معلقة</p>
              <p className="text-sm text-muted-foreground">جميع الطلبات تمت تسويتها</p>
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence>
                {settlementRequestsByEmployee.map((empData, index) => {
                  const isExpanded = expandedEmployees[empData.employee.user_id];
                  const employeeOrderIds = empData.orders.map(o => o.order_id).filter(Boolean);
                  const allSelected = employeeOrderIds.length > 0 && employeeOrderIds.every(id => selectedOrderIds.includes(id));
                  const someSelected = employeeOrderIds.some(id => selectedOrderIds.includes(id));
                  
                  return (
                    <motion.div
                      key={empData.employee.user_id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card className="border-2 border-orange-200 dark:border-orange-800 hover:border-orange-400 transition-colors">
                        <CardContent className="p-0">
                          {/* رأس كارت الموظف */}
                          <div 
                            className="p-4 cursor-pointer hover:bg-orange-50/50 dark:hover:bg-orange-900/20 transition-colors"
                            onClick={() => toggleEmployeeExpand(empData.employee.user_id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <Avatar className="w-12 h-12 border-2 border-orange-300">
                                  <AvatarFallback className="bg-gradient-to-br from-orange-400 to-amber-500 text-white font-bold">
                                    {empData.employee.full_name?.charAt(0) || 'م'}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <h3 className="font-bold text-lg">{empData.employee.full_name || 'موظف غير معروف'}</h3>
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Package className="w-4 h-4" />
                                    <span>{empData.orders.length} طلب</span>
                                    <span>•</span>
                                    <DollarSign className="w-4 h-4" />
                                    <span className="font-medium text-orange-600">{formatCurrency(empData.totalAmount)}</span>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300">
                                  <Bell className="w-3 h-3 ml-1" />
                                  ينتظر التسوية
                                </Badge>
                                {isExpanded ? (
                                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                                )}
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
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <Separator />
                                <div className="p-4 bg-muted/30">
                                  {/* زر تحديد الكل */}
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                      <Checkbox
                                        checked={allSelected}
                                        onCheckedChange={() => handleSelectAll(empData.employee.user_id, empData.orders)}
                                        className="data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                                      />
                                      <span className="text-sm font-medium">تحديد الكل ({empData.orders.length})</span>
                                    </div>
                                    {someSelected && (
                                      <Badge className="bg-green-500">
                                        {employeeOrderIds.filter(id => selectedOrderIds.includes(id)).length} محدد
                                      </Badge>
                                    )}
                                  </div>
                                  
                                  {/* قائمة الطلبات */}
                                  <div className="space-y-2">
                                    {empData.orders.map((orderData) => (
                                      <div 
                                        key={orderData.order_id}
                                        className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                                          selectedOrderIds.includes(orderData.order_id)
                                            ? 'bg-orange-100 border-orange-300 dark:bg-orange-900/30'
                                            : 'bg-background border-border hover:bg-muted/50'
                                        }`}
                                      >
                                        <div className="flex items-center gap-3">
                                          <Checkbox
                                            checked={selectedOrderIds.includes(orderData.order_id)}
                                            onCheckedChange={() => handleSelectOrder(orderData.order_id)}
                                            className="data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                                          />
                                          <div>
                                            <div className="font-mono font-medium">
                                              {orderData.order?.tracking_number || orderData.order?.order_number || '-'}
                                            </div>
                                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                                              <Clock className="w-3 h-3" />
                                              {formatDate(orderData.order?.created_at)}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="text-left font-bold text-orange-600">
                                          {formatCurrency(orderData.employee_profit)}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>

        {/* Footer مع أزرار الإجراءات */}
        {settlementRequestsByEmployee.length > 0 && (
          <div className="p-4 border-t bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {selectedOrderIds.length > 0 ? (
                  <span className="font-medium text-orange-600">
                    {selectedOrderIds.length} طلب محدد للتسوية
                  </span>
                ) : (
                  'حدد الطلبات المراد تسويتها'
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  إغلاق
                </Button>
                <Button
                  disabled={selectedOrderIds.length === 0}
                  className="bg-gradient-to-l from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
                  onClick={() => onOpenChange(false)}
                >
                  <Banknote className="w-4 h-4 ml-2" />
                  متابعة التسوية
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SettlementRequestsDialog;
