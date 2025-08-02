import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Archive, Package, Calendar, Users, Clock, ShoppingCart, Building2, DollarSign, FileText, PackageOpen } from 'lucide-react';
import { formatDistanceToNow, isValid, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import usePermissions from '@/hooks/usePermissions';
import { useInventory } from '@/contexts/InventoryContext';
import { supabase } from '@/lib/customSupabaseClient';



const ReservedStockDialog = ({ open, onOpenChange }) => {
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [employees, setEmployees] = useState([]);
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
  const { orders } = useInventory();

  // تحميل بيانات الموظفين فوراً عند فتح النافذة
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('user_id, full_name, username, email, employee_code')
          .eq('is_active', true);
        
        if (error) throw error;
        setEmployees(data || []);
      } catch (error) {
        console.error('خطأ في تحميل بيانات الموظفين:', error);
      }
    };

    if (open && employees.length === 0) {
      fetchEmployees();
    }
  }, [open, employees.length]);


  // الطلبات المحجوزة (pending, shipped, delivery)
  const reservedOrders = useMemo(() => {
    return orders?.filter(order => ['pending', 'shipped', 'delivery'].includes(order.status)) || [];
  }, [orders]);

  // الموظفون المشاركون في الطلبات المحجوزة
  const employeesInvolved = useMemo(() => {
    if (!reservedOrders.length || !employees?.length) return [];
    
    const employeeIds = [...new Set(reservedOrders.map(order => order.created_by))];
    return employees.filter(emp => employeeIds.includes(emp.user_id));
  }, [reservedOrders, employees]);

  // فلترة الطلبات حسب الصلاحيات
  const filteredOrders = useMemo(() => {
    if (!reservedOrders.length) return [];
    
    if (isAdmin) {
      // المدير يرى كل الطلبات أو طلبات موظف محدد
      if (selectedEmployee === 'all') {
        return reservedOrders;
      } else {
        return reservedOrders.filter(order => order.created_by === selectedEmployee);
      }
    } else {
      // الموظف يرى طلباته فقط - استخدام user.id الموحد
      return reservedOrders.filter(order => order.created_by === user?.id);
    }
  }, [reservedOrders, selectedEmployee, isAdmin, user]);

  const formatDate = (dateString) => {
    if (!dateString) return 'لا يوجد تاريخ';
    const date = parseISO(dateString);
    if (!isValid(date)) return 'تاريخ غير صالح';
    return formatDistanceToNow(date, { addSuffix: true, locale: ar });
  };

  const totalReservedItems = filteredOrders.reduce((total, order) => {
    return total + (order.items?.length || 0);
  }, 0);

  const totalReservedQuantity = filteredOrders.reduce((total, order) => {
    return total + (order.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0);
  }, 0);

  const totalReservedValue = filteredOrders.reduce((total, order) => {
    return total + (order.total_amount || 0);
  }, 0);

  const getEmployeeName = (employeeId) => {
    const employee = employees?.find(emp => emp.user_id === employeeId);
    if (employee) {
      return employee.full_name || employee.username || 'موظف غير معروف';
    }
    return 'موظف غير معروف';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[95vh] flex flex-col p-2 md:p-4">
        <ScrollArea className="h-full">
          <div className="p-2 md:p-6 space-y-4 md:space-y-6">
            <DialogHeader className="pb-3 md:pb-6 border-b border-gradient-to-r from-violet-200 to-purple-200">
              <DialogTitle className="flex items-center gap-3 text-xl md:text-3xl font-bold">
                <div className="p-2 md:p-4 bg-gradient-to-br from-purple-600 via-violet-600 to-indigo-600 rounded-xl md:rounded-2xl shadow-lg">
                  <Archive className="w-5 h-5 md:w-8 md:h-8 text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 bg-clip-text text-transparent">
                    المخزون المحجوز
                  </span>
                  <span className="text-sm md:text-lg font-normal text-muted-foreground">
                    الطلبات في حالة التجهيز والمعالجة
                  </span>
                </div>
              </DialogTitle>
            </DialogHeader>

            {/* كروت الإحصائيات */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
              <Card className="group cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl relative overflow-hidden border-0">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-blue-600 to-cyan-600 opacity-90"></div>
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-transparent to-cyan-500/20"></div>
                <CardContent className="relative p-2 md:p-4 text-white text-center">
                  <div className="flex justify-center mb-1 md:mb-3">
                    <div className="p-1.5 md:p-3 bg-white/20 backdrop-blur-sm rounded-lg md:rounded-xl border border-white/30">
                      <ShoppingCart className="w-4 h-4 md:w-6 md:h-6" />
                    </div>
                  </div>
                  <div className="space-y-0.5 md:space-y-1">
                    <h3 className="text-lg md:text-2xl font-bold">{filteredOrders.length}</h3>
                    <p className="text-white/90 font-medium text-xs md:text-sm">طلب محجوز</p>
                    <p className="text-white/70 text-xs hidden md:block">قيد التجهيز</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="group cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl relative overflow-hidden border-0">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 opacity-90"></div>
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 via-transparent to-pink-500/20"></div>
                <CardContent className="relative p-2 md:p-4 text-white text-center">
                  <div className="flex justify-center mb-1 md:mb-3">
                    <div className="p-1.5 md:p-3 bg-white/20 backdrop-blur-sm rounded-lg md:rounded-xl border border-white/30">
                      <Package className="w-4 h-4 md:w-6 md:h-6" />
                    </div>
                  </div>
                  <div className="space-y-0.5 md:space-y-1">
                    <h3 className="text-lg md:text-2xl font-bold">{totalReservedItems}</h3>
                    <p className="text-white/90 font-medium text-xs md:text-sm">منتج مختلف</p>
                    <p className="text-white/70 text-xs hidden md:block">محجوز</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="group cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl relative overflow-hidden border-0">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500 via-violet-600 to-indigo-600 opacity-90"></div>
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 via-transparent to-indigo-500/20"></div>
                <CardContent className="relative p-2 md:p-4 text-white text-center">
                  <div className="flex justify-center mb-1 md:mb-3">
                    <div className="p-1.5 md:p-3 bg-white/20 backdrop-blur-sm rounded-lg md:rounded-xl border border-white/30">
                      <PackageOpen className="w-4 h-4 md:w-6 md:h-6" />
                    </div>
                  </div>
                  <div className="space-y-0.5 md:space-y-1">
                    <h3 className="text-lg md:text-2xl font-bold">{totalReservedQuantity}</h3>
                    <p className="text-white/90 font-medium text-xs md:text-sm">قطعة</p>
                    <p className="text-white/70 text-xs hidden md:block">إجمالي الكمية</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="group cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl relative overflow-hidden border-0">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 via-teal-600 to-green-600 opacity-90"></div>
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 via-transparent to-green-500/20"></div>
                <CardContent className="relative p-2 md:p-4 text-white text-center">
                  <div className="flex justify-center mb-1 md:mb-3">
                    <div className="p-1.5 md:p-3 bg-white/20 backdrop-blur-sm rounded-lg md:rounded-xl border border-white/30">
                      <DollarSign className="w-4 h-4 md:w-6 md:h-6" />
                    </div>
                  </div>
                  <div className="space-y-0.5 md:space-y-1">
                    <h3 className="text-sm md:text-lg font-bold">{totalReservedValue.toLocaleString()}</h3>
                    <p className="text-white/90 font-medium text-xs md:text-sm">د.ع</p>
                    <p className="text-white/70 text-xs hidden md:block">القيمة الإجمالية</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* فلتر الموظفين - للمدير فقط */}
            {isAdmin && (
              <Card className="border-2 border-violet-200/60 bg-gradient-to-r from-violet-50/50 to-purple-50/50 dark:from-violet-950/20 dark:to-purple-950/20">
                <CardContent className="p-3 md:p-6">
                  <div className="flex flex-col gap-3 md:gap-4">
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className="w-6 h-6 md:w-10 md:h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg md:rounded-xl flex items-center justify-center shadow-lg">
                        <Users className="w-3 h-3 md:w-5 md:h-5 text-white" />
                      </div>
                      <span className="text-sm md:text-lg font-bold text-foreground">فلترة حسب الموظف:</span>
                    </div>
                    <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                      <SelectTrigger className="w-full h-8 md:h-12 bg-background border-2 border-violet-200 hover:border-violet-400 transition-all duration-300 rounded-lg md:rounded-xl text-xs md:text-base font-medium">
                        <SelectValue placeholder="اختر الموظف لعرض طلباته المحجوزة" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-2 border-violet-200 shadow-2xl z-[9999] rounded-lg md:rounded-xl max-h-[300px] overflow-y-auto">
                        <SelectItem value="all" className="hover:bg-violet-50 dark:hover:bg-violet-950/30 p-2 md:p-4 rounded-lg m-1">
                          <div className="flex items-center gap-2 md:gap-3">
                            <div className="w-2 h-2 md:w-3 md:h-3 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full"></div>
                            <span className="font-medium text-xs md:text-base">جميع الموظفين ({reservedOrders?.length || 0} طلب)</span>
                          </div>
                        </SelectItem>
                        {employeesInvolved.map(emp => {
                          const empOrdersCount = reservedOrders?.filter(o => o.created_by === emp.user_id).length || 0;
                          return (
                            <SelectItem key={emp.user_id} value={emp.user_id} className="hover:bg-violet-50 dark:hover:bg-violet-950/30 p-2 md:p-4 rounded-lg m-1">
                              <div className="flex items-center gap-2 md:gap-3">
                                <div className="w-2 h-2 md:w-3 md:h-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex-shrink-0"></div>
                                <span className="font-medium text-xs md:text-base">
                                  {emp.full_name || emp.username} ({empOrdersCount} طلب)
                                </span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* قائمة الطلبات */}
            <div className="space-y-3 md:space-y-6">
              {filteredOrders && filteredOrders.length > 0 ? (
                filteredOrders.map((order, index) => (
                  <Card key={order.id} className="group relative overflow-hidden border-2 border-violet-200/60 hover:border-violet-400/80 transition-all duration-500 hover:shadow-2xl hover:shadow-violet-500/20">
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-purple-500/5 to-indigo-500/5"></div>
                    <CardContent className="p-3 md:p-8 relative">
                      {/* رأس الطلب */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between mb-3 md:mb-6">
                        <div className="flex items-center gap-2 md:gap-4 mb-2 md:mb-4 xl:mb-0">
                          <div className="p-2 md:p-4 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl md:rounded-2xl shadow-xl">
                            <FileText className="w-4 h-4 md:w-6 md:h-6 text-white" />
                          </div>
                          <div className="space-y-1 md:space-y-2">
                            <div className="flex items-center gap-2 md:gap-3">
                              <h3 className="font-black text-base md:text-2xl bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                                {order.order_number}
                              </h3>
                            </div>
                            <div className="flex items-center gap-1 md:gap-2 text-xs md:text-sm text-muted-foreground">
                              <Calendar className="w-3 h-3 md:w-4 md:h-4" />
                              <span className="font-medium">{formatDate(order.created_at)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 md:gap-3">
                          <Badge className="bg-gradient-to-r from-amber-400 to-orange-500 text-white border-0 shadow-lg px-2 md:px-4 py-1 md:py-2 text-xs md:text-sm">
                            <Clock className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                            قيد التجهيز
                          </Badge>
                          <Badge variant="outline" className="text-xs md:text-sm px-2 md:px-3 py-1">
                            #{index + 1}
                          </Badge>
                        </div>
                      </div>

                      <Separator className="my-3 md:my-6 bg-gradient-to-r from-transparent via-violet-300 to-transparent" />

                      {/* معلومات الموظف المسؤول - للمدير فقط */}
                      {isAdmin && (
                        <Card className="border-2 border-green-200/60 hover:border-green-400/80 transition-all duration-300 bg-gradient-to-br from-green-50/50 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/20 mb-3 md:mb-6">
                          <CardContent className="p-2 md:p-4">
                            <div className="flex items-center gap-2 md:gap-4">
                              <div className="w-6 h-6 md:w-8 md:h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg md:rounded-xl flex items-center justify-center">
                                <Building2 className="w-3 h-3 md:w-4 md:h-4 text-white" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-1 md:gap-2">
                                  <span className="text-xs md:text-sm font-medium text-muted-foreground">الموظف المسؤول:</span>
                                  <span className="font-bold text-foreground text-xs md:text-base">{getEmployeeName(order.created_by)}</span>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* إجمالي المبلغ فقط - بدون معلومات العميل */}
                      <Card className="border-2 border-violet-200/60 hover:border-violet-400/80 transition-all duration-300 bg-gradient-to-br from-violet-50/50 to-purple-50/50 dark:from-violet-950/20 dark:to-purple-950/20 mb-3 md:mb-6">
                        <CardContent className="p-2 md:p-4">
                          <div className="flex items-center gap-2 md:gap-3">
                            <div className="w-6 h-6 md:w-8 md:h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg md:rounded-xl flex items-center justify-center">
                              <DollarSign className="w-3 h-3 md:w-4 md:h-4 text-white" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-1 md:gap-2">
                                <span className="text-xs md:text-sm font-medium text-muted-foreground">المبلغ الإجمالي:</span>
                                <span className="font-bold text-sm md:text-xl text-green-600">{order.total_amount?.toLocaleString()} د.ع</span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* قائمة المنتجات - تصميم أنيق وصغير */}
                      {order.items && order.items.length > 0 && (
                        <div className="space-y-3 md:space-y-4">
                          <h4 className="text-sm md:text-lg font-bold text-foreground flex items-center gap-2">
                            <Package className="w-4 h-4 md:w-5 md:h-5 text-violet-600" />
                            المنتجات المحجوزة ({order.items.length})
                          </h4>
                          <div className="grid gap-2 md:gap-3">
                            {order.items.map((item, itemIndex) => (
                              <Card key={itemIndex} className="border border-violet-200/40 hover:border-violet-400/60 transition-all duration-300 bg-gradient-to-r from-violet-50/30 to-purple-50/30 dark:from-violet-950/20 dark:to-purple-950/20 hover:shadow-lg hover:shadow-violet-500/10">
                                <CardContent className="p-2 md:p-3">
                                  <div className="flex items-center gap-2 md:gap-3">
                                    {/* أيقونة المنتج */}
                                    <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-violet-400 to-purple-500 rounded-lg flex items-center justify-center shadow-md flex-shrink-0">
                                      <Package className="w-4 h-4 md:w-5 md:h-5 text-white" />
                                    </div>
                                    
                                    {/* تفاصيل المنتج - تخطيط مبسط ومرن */}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4">
                                        {/* اسم المنتج */}
                                        <div className="flex-1 min-w-0">
                                          <p className="font-bold text-sm md:text-base text-foreground truncate">{item.name}</p>
                                          {(item.color || item.size) && (
                                            <p className="text-xs md:text-sm text-muted-foreground">
                                              {item.color && `${item.color}`}
                                              {item.color && item.size && ' • '}
                                              {item.size && item.size}
                                            </p>
                                          )}
                                        </div>
                                        
                                        {/* العدد والسعر والمجموع - نص كامل وواضح */}
                                        <div className="flex items-center gap-2 text-xs">
                                          <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 px-2 py-1 text-xs">
                                            العدد: {item.quantity}
                                          </Badge>
                                          <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 px-2 py-1 text-xs">
                                            السعر: {item.price?.toLocaleString()} د.ع
                                          </Badge>
                                          <Badge variant="secondary" className="bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-300 px-2 py-1 text-xs font-semibold">
                                            المجموع: {(item.price * item.quantity)?.toLocaleString()} د.ع
                                          </Badge>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="border-2 border-dashed border-gray-300 bg-gray-50/50 dark:bg-gray-900/50 dark:border-gray-600">
                  <CardContent className="p-12 text-center">
                    <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-full flex items-center justify-center">
                      <Archive className="w-12 h-12 text-gray-400" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-500 mb-2">
                      {isAdmin 
                        ? (selectedEmployee === 'all' ? 'لا توجد طلبات محجوزة' : 'لا توجد طلبات محجوزة لهذا الموظف')
                        : 'لا توجد طلبات محجوزة لك'
                      }
                    </h3>
                    <p className="text-gray-400">
                      {isAdmin 
                        ? 'سيتم عرض الطلبات هنا عند وجود طلبات قيد التجهيز'
                        : 'ستظهر طلباتك قيد التجهيز هنا'
                      }
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default ReservedStockDialog;