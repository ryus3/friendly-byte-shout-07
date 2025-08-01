import React, { useState, useMemo } from 'react';
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

  // تسجيل مفصل للتشخيص
  console.log('🔍 ReservedStockDialog - Debug Info:', {
    reservedOrdersCount: reservedOrders?.length || 0,
    allUsersCount: allUsers?.length || 0,
    currentUserId: user?.id,
    isAdmin,
    reservedOrdersDetails: reservedOrders?.map(o => ({
      id: o.id,
      created_by: o.created_by,
      customer_name: o.customer_name,
      status: o.status,
      items_count: o.items?.length || 0,
      employee_name: allUsers?.find(u => u.id === o.created_by)?.full_name || 'غير معروف'
    })) || []
  });

  const employeesInvolved = useMemo(() => {
    if (!reservedOrders || !allUsers) return [];
    const employeeIds = [...new Set(reservedOrders.map(o => o.created_by))];
    const employees = allUsers.filter(u => employeeIds.includes(u.id));
    console.log('📋 Employees involved:', employees.map(e => ({ 
      id: e.id, 
      name: e.full_name || e.username,
      orders: reservedOrders.filter(o => o.created_by === e.id).length
    })));
    return employees;
  }, [reservedOrders, allUsers]);

  const filteredDisplayOrders = useMemo(() => {
    if (!reservedOrders || reservedOrders.length === 0) {
      console.log('❌ No reserved orders available');
      return [];
    }
    
    console.log('🔧 Filtering logic:', {
      isAdmin,
      selectedEmployee,
      currentUserId: user?.id,
      totalOrders: reservedOrders.length
    });
    
    let filtered = [];
    
    if (isAdmin) {
      if (selectedEmployee === 'all') {
        filtered = reservedOrders;
        console.log('👑 Admin viewing all orders:', filtered.length);
      } else {
        filtered = reservedOrders.filter(o => o.created_by === selectedEmployee);
        console.log('👑 Admin viewing orders for employee:', selectedEmployee, 'Count:', filtered.length);
      }
    } else {
      // للموظف العادي - يرى طلباته فقط
      filtered = reservedOrders.filter(o => o.created_by === user?.id);
      console.log('👤 Employee viewing own orders:', {
        userId: user?.id,
        foundOrders: filtered.length,
        orderIds: filtered.map(o => o.id)
      });
    }
    
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

  // استخدام معرف الموظف الحقيقي من قاعدة البيانات
  const getEmployeeCode = (employeeId) => {
    const employee = allUsers?.find(u => u.id === employeeId);
    // استخدام المعرف الحقيقي من قاعدة البيانات أولاً
    return employee?.employee_code || 'غير محدد';
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

            {/* كروت الإحصائيات - تصميم احترافي عالمي */}
            <div className="grid grid-cols-2 gap-6">
              {/* الصف الأول */}
              <Card className="group cursor-pointer transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl relative overflow-hidden border-0">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-blue-600 to-cyan-600 opacity-90"></div>
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-transparent to-cyan-500/20"></div>
                <CardContent className="relative p-8 text-white">
                  <div className="flex items-center justify-center mb-6">
                    <div className="p-4 bg-white/15 backdrop-blur-sm rounded-2xl border border-white/20">
                      <ShoppingCart className="w-10 h-10" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-4xl font-black">{filteredDisplayOrders.length}</h3>
                    <p className="text-white/90 font-semibold text-lg">طلب محجوز</p>
                    <p className="text-white/70 text-sm">إجمالي الطلبات في حالة التجهيز</p>
                  </div>
                  <div className="absolute top-4 right-4 w-32 h-32 bg-white/5 rounded-full -z-10"></div>
                  <div className="absolute bottom-4 left-4 w-24 h-24 bg-white/5 rounded-full -z-10"></div>
                </CardContent>
              </Card>

              <Card className="group cursor-pointer transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl relative overflow-hidden border-0">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 opacity-90"></div>
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 via-transparent to-pink-500/20"></div>
                <CardContent className="relative p-8 text-white">
                  <div className="flex items-center justify-center mb-6">
                    <div className="p-4 bg-white/15 backdrop-blur-sm rounded-2xl border border-white/20">
                      <Package className="w-10 h-10" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-4xl font-black">{totalReservedItems}</h3>
                    <p className="text-white/90 font-semibold text-lg">منتج مختلف</p>
                    <p className="text-white/70 text-sm">عدد المنتجات المحجوزة</p>
                  </div>
                  <div className="absolute top-4 right-4 w-32 h-32 bg-white/5 rounded-full -z-10"></div>
                  <div className="absolute bottom-4 left-4 w-24 h-24 bg-white/5 rounded-full -z-10"></div>
                </CardContent>
              </Card>

              {/* الصف الثاني */}
              <Card className="group cursor-pointer transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl relative overflow-hidden border-0">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500 via-violet-600 to-indigo-600 opacity-90"></div>
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 via-transparent to-indigo-500/20"></div>
                <CardContent className="relative p-8 text-white">
                  <div className="flex items-center justify-center mb-6">
                    <div className="p-4 bg-white/15 backdrop-blur-sm rounded-2xl border border-white/20">
                      <PackageOpen className="w-10 h-10" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-4xl font-black">{totalReservedQuantity}</h3>
                    <p className="text-white/90 font-semibold text-lg">قطعة</p>
                    <p className="text-white/70 text-sm">إجمالي الكمية المحجوزة</p>
                  </div>
                  <div className="absolute top-4 right-4 w-32 h-32 bg-white/5 rounded-full -z-10"></div>
                  <div className="absolute bottom-4 left-4 w-24 h-24 bg-white/5 rounded-full -z-10"></div>
                </CardContent>
              </Card>

              <Card className="group cursor-pointer transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl relative overflow-hidden border-0">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 via-teal-600 to-green-600 opacity-90"></div>
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 via-transparent to-green-500/20"></div>
                <CardContent className="relative p-8 text-white">
                  <div className="flex items-center justify-center mb-6">
                    <div className="p-4 bg-white/15 backdrop-blur-sm rounded-2xl border border-white/20">
                      <DollarSign className="w-10 h-10" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-4xl font-black">{totalReservedValue.toLocaleString()}</h3>
                    <p className="text-white/90 font-semibold text-lg">د.ع</p>
                    <p className="text-white/70 text-sm">القيمة الإجمالية للطلبات</p>
                  </div>
                  <div className="absolute top-4 right-4 w-32 h-32 bg-white/5 rounded-full -z-10"></div>
                  <div className="absolute bottom-4 left-4 w-24 h-24 bg-white/5 rounded-full -z-10"></div>
                </CardContent>
              </Card>
            </div>

            {/* فلتر الموظفين - للمدير فقط */}
            {isAdmin && employeesInvolved.length > 0 && (
              <Card className="border-2 border-violet-200/60 bg-gradient-to-r from-violet-50/50 to-purple-50/50 dark:from-violet-950/20 dark:to-purple-950/20">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                        <Users className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-lg font-bold text-foreground">فلترة حسب الموظف:</span>
                    </div>
                    <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                      <SelectTrigger className="w-full lg:w-[350px] h-12 bg-background border-2 border-violet-200 hover:border-violet-400 transition-all duration-300 rounded-xl text-base font-medium">
                        <SelectValue placeholder="اختر الموظف لعرض طلباته المحجوزة" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-2 border-violet-200 shadow-2xl z-50 rounded-xl">
                        <SelectItem value="all" className="hover:bg-violet-50 dark:hover:bg-violet-950/30 p-4 rounded-lg m-1">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 bg-gradient-to-r from-violet-500 to-purple-500 rounded-full"></div>
                            <span className="font-medium">جميع الموظفين ({reservedOrders?.length || 0} طلب)</span>
                          </div>
                        </SelectItem>
                        {employeesInvolved.map(emp => {
                          const empOrdersCount = reservedOrders?.filter(o => o.created_by === emp.id).length || 0;
                          return (
                            <SelectItem key={emp.id} value={emp.id} className="hover:bg-violet-50 dark:hover:bg-violet-950/30 p-4 rounded-lg m-1">
                              <div className="flex items-center gap-3">
                                <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full"></div>
                                <span className="font-medium">{emp.full_name || emp.username} ({empOrdersCount} طلب)</span>
                                <Badge variant="outline" className="text-xs">
                                  {getEmployeeCode(emp.id)}
                                </Badge>
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
                                {order.trackingnumber || order.order_number || `RYUS-${(index + 1).toString().padStart(6, '0')}`}
                              </h3>
                              {!isAdmin && (
                                <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-0 text-xs px-3 py-1">
                                  {getEmployeeCode(user?.id)}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="w-4 h-4" />
                              <span className="font-medium">{formatDate(order.created_at)}</span>
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

                      {/* معلومات العميل والموظف */}
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
                        {/* معلومات العميل */}
                        <Card className="border-2 border-blue-200/60 hover:border-blue-400/80 transition-all duration-300 bg-gradient-to-br from-blue-50/50 to-cyan-50/50 dark:from-blue-950/20 dark:to-cyan-950/20">
                          <CardHeader className="pb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl flex items-center justify-center">
                                <User className="w-4 h-4 text-white" />
                              </div>
                              <h4 className="font-bold text-lg text-blue-700 dark:text-blue-300">معلومات العميل</h4>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0 space-y-3">
                            <div className="flex items-center gap-3 text-sm">
                              <User className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium text-muted-foreground min-w-[60px]">الاسم:</span>
                              <span className="font-semibold">{order.customerinfo?.name || order.customer_name || 'غير معروف'}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                              <Phone className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium text-muted-foreground min-w-[60px]">الهاتف:</span>
                              <span className="font-semibold">{order.customerinfo?.phone || order.customer_phone || 'غير معروف'}</span>
                            </div>
                            <div className="flex items-start gap-3 text-sm">
                              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                              <span className="font-medium text-muted-foreground min-w-[60px]">العنوان:</span>
                              <span className="flex-1 font-semibold text-xs leading-relaxed">
                                {[
                                  order.customerinfo?.address || order.customer_address,
                                  order.customerinfo?.city || order.customer_city,
                                  order.customerinfo?.province || order.customer_province
                                ].filter(Boolean).join(', ') || 'غير محدد'}
                              </span>
                            </div>
                          </CardContent>
                        </Card>

                        {/* معلومات الموظف */}
                        <Card className="border-2 border-green-200/60 hover:border-green-400/80 transition-all duration-300 bg-gradient-to-br from-green-50/50 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/20">
                          <CardHeader className="pb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                                <Building2 className="w-4 h-4 text-white" />
                              </div>
                              <h4 className="font-bold text-lg text-green-700 dark:text-green-300">الموظف المسؤول</h4>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0 space-y-3">
                            <div className="flex items-center gap-3 text-sm">
                              <User className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium text-muted-foreground min-w-[60px]">الاسم:</span>
                              <span className="font-semibold">
                                {(() => {
                                  // البحث عن الموظف من قائمة المستخدمين
                                  const employee = allUsers?.find(u => u.id === order.created_by);
                                  if (employee) {
                                    console.log('✅ Employee found:', {
                                      id: employee.id,
                                      full_name: employee.full_name,
                                      username: employee.username,
                                      email: employee.email,
                                      employee_code: employee.employee_code
                                    });
                                    return employee.full_name || employee.username || employee.email || 'غير محدد';
                                  }
                                  // إذا لم نجد الموظف في القائمة، نبحث في بيانات الطلب
                                  console.log('⚠️ Employee not found in allUsers:', {
                                    orderId: order.id,
                                    createdBy: order.created_by,
                                    allUsersCount: allUsers?.length || 0,
                                    employeeNameInOrder: order.employeeName || order.employee_name,
                                    allUsersIds: allUsers?.map(u => u.id) || []
                                  });
                                  return order.employeeName || order.employee_name || 'غير معروف';
                                })()}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                              <Hash className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium text-muted-foreground min-w-[60px]">المعرف:</span>
                              <Badge variant="outline" className="text-xs font-mono">
                                {getEmployeeCode(order.created_by)}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

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