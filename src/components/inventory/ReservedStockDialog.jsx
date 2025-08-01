import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Archive, Package, User, Calendar, Phone, MapPin, Users, Clock, ShoppingCart, Building2, DollarSign, FileText, Shirt, PackageOpen, Hash } from 'lucide-react';
import { formatDistanceToNow, isValid, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import usePermissions from '@/hooks/usePermissions';

const ReservedStockDialog = ({ open, onOpenChange, reservedOrders, allUsers }) => {
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
  const [employees, setEmployees] = useState([]);

  // 🔧 جلب بيانات الموظفين من قاعدة البيانات مباشرة
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const { supabase } = await import('@/lib/customSupabaseClient');
        const { data, error } = await supabase
          .from('profiles')
          .select('user_id, full_name, username, employee_code, email')
          .eq('is_active', true)
          .order('full_name');
        
        if (error) throw error;
        
        // تحويل البيانات للشكل المطلوب
        const formattedEmployees = data.map(emp => ({
          id: emp.user_id,
          full_name: emp.full_name,
          username: emp.username,
          employee_code: emp.employee_code,
          email: emp.email
        }));
        
        setEmployees(formattedEmployees);
        console.log('✅ EMPLOYEES LOADED:', formattedEmployees);
      } catch (error) {
        console.error('❌ Error loading employees:', error);
      }
    };

    if (open) {
      fetchEmployees();
    }
  }, [open]);

  // تشخيص البيانات
  console.log('🔍 RESERVED STOCK DEBUG:', {
    isDialogOpen: open,
    currentUserId: user?.id,
    currentUserDetails: user,
    isUserAdmin: isAdmin,
    reservedOrdersCount: reservedOrders?.length || 0,
    reservedOrdersDetails: reservedOrders?.map(o => ({
      id: o.id,
      order_number: o.order_number,
      created_by: o.created_by,
      status: o.status,
      customer_name: o.customer_name
    })) || [],
    employeesCount: employees?.length || 0,
    employees: employees.map(e => ({ id: e.id, name: e.full_name, code: e.employee_code }))
  });


  // الموظفون المشاركون في الطلبات المحجوزة
  const employeesInvolved = useMemo(() => {
    console.log('🎯 CALCULATING EMPLOYEES INVOLVED:', {
      reservedOrders: reservedOrders?.length || 0,
      employees: employees?.length || 0,
      reservedOrdersCreatedBy: reservedOrders?.map(o => o.created_by) || []
    });
    
    if (!reservedOrders || !employees) {
      console.log('❌ Missing reservedOrders or employees');
      return [];
    }
    
    const employeeIds = [...new Set(reservedOrders.map(o => o.created_by))];
    console.log('📋 UNIQUE EMPLOYEE IDS IN ORDERS:', employeeIds);
    
    const involvedEmployees = employees.filter(u => {
      const isInvolved = employeeIds.includes(u.id);
      console.log(`👤 Employee ${u.full_name} (${u.id}): ${isInvolved ? 'INVOLVED' : 'NOT INVOLVED'}`);
      return isInvolved;
    });
    
    console.log('🎯 EMPLOYEES INVOLVED RESULT:', {
      uniqueEmployeeIds: employeeIds,
      foundEmployees: involvedEmployees.map(e => ({
        id: e.id,
        name: e.full_name,
        code: e.employee_code,
        ordersCount: reservedOrders.filter(o => o.created_by === e.id).length
      }))
    });
    
    return involvedEmployees;
  }, [reservedOrders, employees]);

  // فلترة الطلبات حسب الموظف المختار
  const filteredDisplayOrders = useMemo(() => {
    console.log('🔍 FILTERING ORDERS:', {
      reservedOrdersCount: reservedOrders?.length || 0,
      isAdmin: isAdmin,
      selectedEmployee: selectedEmployee,
      currentUserId: user?.id
    });
    
    if (!reservedOrders || reservedOrders.length === 0) {
      console.log('❌ No orders to filter');
      return [];
    }
    
    let filtered = [];
    
    if (isAdmin) {
      if (selectedEmployee === 'all') {
        filtered = reservedOrders;
        console.log('👑 Admin viewing ALL orders:', filtered.length);
      } else {
        filtered = reservedOrders.filter(o => o.created_by === selectedEmployee);
        console.log('👑 Admin viewing orders for employee:', selectedEmployee, 'Count:', filtered.length);
      }
    } else {
      // للموظف العادي - يرى طلباته فقط
      filtered = reservedOrders.filter(o => {
        const match = o.created_by === user?.id;
        console.log(`👤 Employee order check: Order ${o.order_number} created_by ${o.created_by} === user ${user?.id} = ${match}`);
        return match;
      });
      console.log('👤 Employee viewing own orders:', {
        userId: user?.id,
        foundOrders: filtered.length,
        orderNumbers: filtered.map(o => o.order_number),
        allOrdersCreatedBy: reservedOrders.map(o => ({ number: o.order_number, created_by: o.created_by }))
      });
    }
    
    console.log('✅ FINAL FILTERED ORDERS:', filtered.map(o => ({
      id: o.id,
      number: o.order_number,
      createdBy: o.created_by,
      status: o.status
    })));
    
    return filtered;
  }, [reservedOrders, selectedEmployee, isAdmin, user?.id]);

  const formatDate = (dateString) => {
    if (!dateString) return 'لا يوجد تاريخ';
    const date = parseISO(dateString);
    if (!isValid(date)) return 'تاريخ غير صالح';
    return formatDistanceToNow(date, { addSuffix: true, locale: ar });
  };

  const totalReservedItems = filteredDisplayOrders.reduce((total, order) => {
    return total + (order.items?.length || 0);
  }, 0);

  const totalReservedQuantity = filteredDisplayOrders.reduce((total, order) => {
    return total + (order.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0);
  }, 0);

  const totalReservedValue = filteredDisplayOrders.reduce((total, order) => {
    return total + (order.items?.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0) || 0);
  }, 0);

  // دوال مساعدة مبسطة
  const getEmployeeCode = (employeeId) => {
    const employee = employees?.find(u => u.id === employeeId);
    return employee?.employee_code || 'غير محدد';
  };

  const getEmployeeName = (employeeId) => {
    const employee = employees?.find(u => u.id === employeeId);
    const name = employee?.full_name || employee?.username || 'موظف غير معروف';
    console.log(`🏷️ Getting name for employee ${employeeId}:`, { found: !!employee, name });
    return name;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl h-[95vh] flex flex-col">
        <ScrollArea className="h-full">
          <div className="p-8 space-y-8">
            <DialogHeader className="pb-6 border-b border-gradient-to-r from-violet-200 to-purple-200">
              <DialogTitle className="flex items-center gap-4 text-3xl font-bold">
                <div className="p-4 bg-gradient-to-br from-purple-600 via-violet-600 to-indigo-600 rounded-2xl shadow-2xl">
                  <Archive className="w-8 h-8 text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 bg-clip-text text-transparent">
                    المخزون المحجوز
                  </span>
                  <span className="text-lg font-normal text-muted-foreground">
                    الطلبات في حالة التجهيز والمعالجة
                  </span>
                </div>
              </DialogTitle>
            </DialogHeader>

            {/* كروت الإحصائيات - مربعات صغيرة مع تدرجات جميلة ودوائر خفيفة */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* طلب محجوز */}
              <Card className="group cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl relative overflow-hidden border-0">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-blue-600 to-cyan-600 opacity-90"></div>
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-transparent to-cyan-500/20"></div>
                <CardContent className="relative p-4 text-white text-center">
                  <div className="flex justify-center mb-3">
                    <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl border border-white/30">
                      <ShoppingCart className="w-6 h-6" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-bold">{filteredDisplayOrders.length}</h3>
                    <p className="text-white/90 font-medium text-sm">طلب محجوز</p>
                    <p className="text-white/70 text-xs">قيد التجهيز</p>
                  </div>
                  {/* دوائر خفيفة للزينة */}
                  <div className="absolute top-2 right-2 w-16 h-16 bg-white/10 rounded-full -z-10"></div>
                  <div className="absolute bottom-2 left-2 w-12 h-12 bg-white/5 rounded-full -z-10"></div>
                </CardContent>
              </Card>

              {/* منتج مختلف */}
              <Card className="group cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl relative overflow-hidden border-0">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 opacity-90"></div>
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 via-transparent to-pink-500/20"></div>
                <CardContent className="relative p-4 text-white text-center">
                  <div className="flex justify-center mb-3">
                    <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl border border-white/30">
                      <Package className="w-6 h-6" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-bold">{totalReservedItems}</h3>
                    <p className="text-white/90 font-medium text-sm">منتج مختلف</p>
                    <p className="text-white/70 text-xs">محجوز</p>
                  </div>
                  {/* دوائر خفيفة للزينة */}
                  <div className="absolute top-2 right-2 w-16 h-16 bg-white/10 rounded-full -z-10"></div>
                  <div className="absolute bottom-2 left-2 w-12 h-12 bg-white/5 rounded-full -z-10"></div>
                </CardContent>
              </Card>

              {/* إجمالي القطع */}
              <Card className="group cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl relative overflow-hidden border-0">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500 via-violet-600 to-indigo-600 opacity-90"></div>
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 via-transparent to-indigo-500/20"></div>
                <CardContent className="relative p-4 text-white text-center">
                  <div className="flex justify-center mb-3">
                    <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl border border-white/30">
                      <PackageOpen className="w-6 h-6" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-bold">{totalReservedQuantity}</h3>
                    <p className="text-white/90 font-medium text-sm">قطعة</p>
                    <p className="text-white/70 text-xs">إجمالي الكمية</p>
                  </div>
                  {/* دوائر خفيفة للزينة */}
                  <div className="absolute top-2 right-2 w-16 h-16 bg-white/10 rounded-full -z-10"></div>
                  <div className="absolute bottom-2 left-2 w-12 h-12 bg-white/5 rounded-full -z-10"></div>
                </CardContent>
              </Card>

              {/* القيمة الإجمالية - تظهر الرقم الكامل */}
              <Card className="group cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl relative overflow-hidden border-0">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 via-teal-600 to-green-600 opacity-90"></div>
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 via-transparent to-green-500/20"></div>
                <CardContent className="relative p-4 text-white text-center">
                  <div className="flex justify-center mb-3">
                    <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl border border-white/30">
                      <DollarSign className="w-6 h-6" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold">{totalReservedValue.toLocaleString()}</h3>
                    <p className="text-white/90 font-medium text-sm">د.ع</p>
                    <p className="text-white/70 text-xs">القيمة الإجمالية</p>
                  </div>
                  {/* دوائر خفيفة للزينة */}
                  <div className="absolute top-2 right-2 w-16 h-16 bg-white/10 rounded-full -z-10"></div>
                  <div className="absolute bottom-2 left-2 w-12 h-12 bg-white/5 rounded-full -z-10"></div>
                </CardContent>
              </Card>
            </div>

            {/* فلتر الموظفين - للمدير فقط - يظهر على كل الشاشات */}
            {(() => {
              console.log('🎯 FILTER DROPDOWN CHECK:', {
                isAdmin: isAdmin,
                employeesInvolvedLength: employeesInvolved.length,
                shouldShowFilter: isAdmin && employeesInvolved.length > 0,
                employeesInvolved: employeesInvolved.map(e => ({ id: e.id, name: e.full_name }))
              });
              return isAdmin && employeesInvolved.length > 0;
            })() && (
              <Card className="border-2 border-violet-200/60 bg-gradient-to-r from-violet-50/50 to-purple-50/50 dark:from-violet-950/20 dark:to-purple-950/20">
                <CardContent className="p-4 md:p-6">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                        <Users className="w-4 h-4 md:w-5 md:h-5 text-white" />
                      </div>
                      <span className="text-base md:text-lg font-bold text-foreground">فلترة حسب الموظف:</span>
                    </div>
                    <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                      <SelectTrigger className="w-full h-10 md:h-12 bg-background border-2 border-violet-200 hover:border-violet-400 transition-all duration-300 rounded-xl text-sm md:text-base font-medium">
                        <SelectValue placeholder="اختر الموظف لعرض طلباته المحجوزة" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-2 border-violet-200 shadow-2xl z-[9999] rounded-xl max-h-[300px] overflow-y-auto">
                        <SelectItem value="all" className="hover:bg-violet-50 dark:hover:bg-violet-950/30 p-3 md:p-4 rounded-lg m-1">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full"></div>
                            <span className="font-medium text-sm md:text-base">جميع الموظفين ({reservedOrders?.length || 0} طلب)</span>
                          </div>
                        </SelectItem>
                        {employeesInvolved.map(emp => {
                          const empOrdersCount = reservedOrders?.filter(o => o.created_by === emp.id).length || 0;
                          return (
                            <SelectItem key={emp.id} value={emp.id} className="hover:bg-violet-50 dark:hover:bg-violet-950/30 p-3 md:p-4 rounded-lg m-1">
                              <div className="flex items-center gap-2 md:gap-3">
                                <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex-shrink-0"></div>
                                <span className="font-medium text-sm md:text-base">
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
            <div className="space-y-6">
              {filteredDisplayOrders && filteredDisplayOrders.length > 0 ? (
                filteredDisplayOrders.map((order, index) => (
                  <Card key={order.id} className="group relative overflow-hidden border-2 border-violet-200/60 hover:border-violet-400/80 transition-all duration-500 hover:shadow-2xl hover:shadow-violet-500/20">
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-purple-500/5 to-indigo-500/5"></div>
                    <CardContent className="p-8 relative">
                      {/* رأس الطلب */}
                      <div className="flex flex-col xl:flex-row xl:items-center justify-between mb-6">
                        <div className="flex items-center gap-4 mb-4 xl:mb-0">
                          <div className="p-4 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl shadow-xl">
                            <FileText className="w-6 h-6 text-white" />
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <h3 className="font-black text-2xl bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                                {order.order_number}
                              </h3>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="w-4 h-4" />
                              <span className="font-medium">{formatDate(order.created_at)}</span>
                              {!isAdmin && (
                                <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-0 text-xs px-3 py-1 ml-2">
                                  {getEmployeeCode(user?.id)}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className="bg-gradient-to-r from-amber-400 to-orange-500 text-white border-0 shadow-lg px-4 py-2 text-sm">
                            <Clock className="w-4 h-4 mr-2" />
                            قيد التجهيز
                          </Badge>
                          <Badge variant="outline" className="text-sm px-3 py-1">
                            #{index + 1}
                          </Badge>
                        </div>
                      </div>

                      <Separator className="my-6 bg-gradient-to-r from-transparent via-violet-300 to-transparent" />

                       {/* معلومات الموظف المسؤول فقط */}
                      <Card className="border-2 border-green-200/60 hover:border-green-400/80 transition-all duration-300 bg-gradient-to-br from-green-50/50 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/20 mb-6">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-4">
                            <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                              <Building2 className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-green-700 dark:text-green-300">الموظف المسؤول:</span>
                              <span className="font-semibold text-lg">
                                {getEmployeeName(order.created_by)}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Separator className="my-6 bg-gradient-to-r from-transparent via-violet-300 to-transparent" />

                      {/* المنتجات المحجوزة */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl flex items-center justify-center">
                            <Package className="w-4 h-4 text-white" />
                          </div>
                          <h4 className="font-bold text-xl text-orange-700 dark:text-orange-300">
                            المنتجات المحجوزة ({order.items?.length || 0})
                          </h4>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                          {order.items?.map((item, itemIndex) => (
                            <Card key={itemIndex} className="border-2 border-orange-200/60 hover:border-orange-400/80 transition-all duration-300 bg-gradient-to-br from-orange-50/30 to-amber-50/30 dark:from-orange-950/20 dark:to-amber-950/20">
                              <CardContent className="p-4">
                                <div className="flex items-center gap-4">
                                  {item.image && (
                                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted flex-shrink-0 border-2 border-orange-200/60">
                                      <img src={item.image} alt={item.name || item.productName} className="w-full h-full object-cover" />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0 space-y-2">
                                    <h5 className="font-bold text-sm truncate">{item.name || item.productName || 'منتج غير محدد'}</h5>
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                      <span className="font-medium">الكمية: {item.quantity || 0}</span>
                                      <span className="font-bold text-orange-600">{((item.price || 0) * (item.quantity || 0)).toLocaleString()} د.ع</span>
                                    </div>
                                    {(item.color || item.size) && (
                                      <div className="flex gap-1 flex-wrap">
                                        {item.color && (
                                          <Badge variant="outline" className="text-xs px-2 py-0.5">{item.color}</Badge>
                                        )}
                                        {item.size && (
                                          <Badge variant="outline" className="text-xs px-2 py-0.5">{item.size}</Badge>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )) || (
                            <div className="col-span-full text-center py-8 text-muted-foreground">
                              <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                              <p className="font-medium">لا توجد منتجات محجوزة في هذا الطلب</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="border-2 border-dashed border-muted-foreground/30 bg-gradient-to-br from-gray-50/50 to-slate-50/50 dark:from-gray-950/50 dark:to-slate-950/50">
                  <CardContent className="p-16 text-center">
                    <div className="w-32 h-32 mx-auto mb-8 bg-gradient-to-br from-violet-500/20 to-purple-500/20 rounded-full flex items-center justify-center">
                      <Archive className="w-16 h-16 text-violet-500" />
                    </div>
                    <h3 className="text-2xl font-bold mb-4">لا توجد طلبات محجوزة</h3>
                    <p className="text-muted-foreground mb-6 text-lg max-w-md mx-auto">
                      {isAdmin 
                        ? selectedEmployee === 'all' 
                          ? 'لا توجد حاليًا أي طلبات في حالة التجهيز تطابق الفلتر المحدد.'
                          : 'الموظف المحدد ليس لديه طلبات محجوزة حاليًا.'
                        : 'ليس لديك طلبات محجوزة حاليًا.'
                      }
                    </p>
                    <div className="text-sm text-blue-600 bg-blue-50 dark:bg-blue-950/20 rounded-xl p-4 inline-block">
                      <Clock className="w-5 h-5 inline mr-2" />
                      <span className="font-medium">
                        {isAdmin ? 'يتم عرض طلبات جميع الموظفين' : 'يتم عرض الطلبات التي قمت بإنشاؤها فقط'}
                      </span>
                    </div>
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