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
import { Archive, Package, User, Hash, Calendar, Phone, MapPin, Users, Clock, ShoppingCart, Building2, DollarSign, FileText, Shirt, PackageOpen } from 'lucide-react';
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
      items_count: o.items?.length || 0
    })) || []
  });

  const employeesInvolved = useMemo(() => {
    if (!reservedOrders || !allUsers) return [];
    const employeeIds = [...new Set(reservedOrders.map(o => o.created_by))];
    const employees = allUsers.filter(u => employeeIds.includes(u.id));
    console.log('📋 Employees involved:', employees.map(e => ({ id: e.id, name: e.full_name })));
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
        <ScrollArea className="h-full">
          <div className="p-6 space-y-6">
            <DialogHeader className="pb-4 border-b border-border/50">
              <DialogTitle className="flex items-center gap-3 text-2xl font-bold">
                <div className="p-3 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl shadow-lg">
                  <Archive className="w-7 h-7 text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="bg-gradient-to-r from-purple-600 to-violet-600 bg-clip-text text-transparent">
                    المخزون المحجوز
                  </span>
                  <span className="text-sm font-normal text-muted-foreground">
                    الطلبات في حالة التجهيز
                  </span>
                </div>
              </DialogTitle>
            </DialogHeader>

            {/* كروت الإحصائيات - مثل تصميم أقسام الجرد */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* كارت إجمالي الطلبات - أزرق مثل الملابس */}
              <Card className="cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl relative overflow-hidden">
                <CardContent className="p-4">
                  <div className="text-center space-y-3 bg-gradient-to-br from-blue-500 to-blue-700 text-white rounded-lg p-4 relative overflow-hidden">
                    <div className="absolute top-2 right-2">
                      <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs">
                        1
                      </Badge>
                    </div>
                    <div className="flex justify-center">
                      <div className="p-2 bg-white/10 rounded-full backdrop-blur-sm">
                        <ShoppingCart className="w-6 h-6" />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-2xl">{filteredDisplayOrders.length}</h4>
                      <p className="text-white/80 text-xs">طلب محجوز</p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-white/20">
                      <div className="text-right">
                        <p className="text-xs text-white/70">إجمالي الطلبات</p>
                      </div>
                      <div className="flex items-center gap-1 text-white/70">
                        <Package className="w-3 h-3" />
                        <span className="text-xs">نشط</span>
                      </div>
                    </div>
                    <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-white/5 rounded-full"></div>
                    <div className="absolute -top-2 -left-2 w-12 h-12 bg-white/5 rounded-full"></div>
                  </div>
                </CardContent>
              </Card>

              {/* كارت المنتجات المحجوزة - برتقالي مثل الأحذية */}
              <Card className="cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl relative overflow-hidden">
                <CardContent className="p-4">
                  <div className="text-center space-y-3 bg-gradient-to-br from-orange-500 to-red-600 text-white rounded-lg p-4 relative overflow-hidden">
                    <div className="absolute top-2 right-2">
                      <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs">
                        2
                      </Badge>
                    </div>
                    <div className="flex justify-center">
                      <div className="p-2 bg-white/10 rounded-full backdrop-blur-sm">
                        <Shirt className="w-6 h-6" />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-2xl">{totalReservedItems}</h4>
                      <p className="text-white/80 text-xs">منتج مختلف</p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-white/20">
                      <div className="text-right">
                        <p className="text-xs text-white/70">منتجات محجوزة</p>
                      </div>
                      <div className="flex items-center gap-1 text-white/70">
                        <Package className="w-3 h-3" />
                        <span className="text-xs">متاح</span>
                      </div>
                    </div>
                    <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-white/5 rounded-full"></div>
                    <div className="absolute -top-2 -left-2 w-12 h-12 bg-white/5 rounded-full"></div>
                  </div>
                </CardContent>
              </Card>

              {/* كارت إجمالي الكمية - بنفسجي مثل المواد العامة */}
              <Card className="cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl relative overflow-hidden">
                <CardContent className="p-4">
                  <div className="text-center space-y-3 bg-gradient-to-br from-purple-500 to-pink-600 text-white rounded-lg p-4 relative overflow-hidden">
                    <div className="absolute top-2 right-2">
                      <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs">
                        3
                      </Badge>
                    </div>
                    <div className="flex justify-center">
                      <div className="p-2 bg-white/10 rounded-full backdrop-blur-sm">
                        <PackageOpen className="w-6 h-6" />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-2xl">{totalReservedQuantity}</h4>
                      <p className="text-white/80 text-xs">قطعة</p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-white/20">
                      <div className="text-right">
                        <p className="text-xs text-white/70">إجمالي الكمية</p>
                      </div>
                      <div className="flex items-center gap-1 text-white/70">
                        <Package className="w-3 h-3" />
                        <span className="text-xs">محجوز</span>
                      </div>
                    </div>
                    <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-white/5 rounded-full"></div>
                    <div className="absolute -top-2 -left-2 w-12 h-12 bg-white/5 rounded-full"></div>
                  </div>
                </CardContent>
              </Card>

              {/* كارت القيمة الإجمالية - أخضر زمردي */}
              <Card className="cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl relative overflow-hidden">
                <CardContent className="p-4">
                  <div className="text-center space-y-3 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-lg p-4 relative overflow-hidden">
                    <div className="absolute top-2 right-2">
                      <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs">
                        4
                      </Badge>
                    </div>
                    <div className="flex justify-center">
                      <div className="p-2 bg-white/10 rounded-full backdrop-blur-sm">
                        <DollarSign className="w-6 h-6" />
                      </div>
                    </div>
                    <div>
                      <h4 className="font-bold text-2xl">{totalReservedValue.toLocaleString()}</h4>
                      <p className="text-white/80 text-xs">د.ع</p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-white/20">
                      <div className="text-right">
                        <p className="text-xs text-white/70">القيمة الإجمالية</p>
                      </div>
                      <div className="flex items-center gap-1 text-white/70">
                        <DollarSign className="w-3 h-3" />
                        <span className="text-xs">قيمة</span>
                      </div>
                    </div>
                    <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-white/5 rounded-full"></div>
                    <div className="absolute -top-2 -left-2 w-12 h-12 bg-white/5 rounded-full"></div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* فلتر الموظفين - للمدير فقط */}
            {isAdmin && employeesInvolved.length > 0 && (
              <Card className="border-2 border-violet-200/50">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-500 rounded-lg flex items-center justify-center">
                        <Users className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-sm font-semibold text-foreground">فلترة حسب الموظف:</span>
                    </div>
                    <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                      <SelectTrigger className="w-full sm:w-[280px] bg-background border-2 border-muted hover:border-violet-300 transition-colors">
                        <SelectValue placeholder="اختر الموظف لعرض طلباته" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-2 border-muted shadow-lg z-50">
                        <SelectItem value="all" className="hover:bg-violet-50 dark:hover:bg-violet-950/20">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-violet-500 rounded-full"></div>
                            جميع الموظفين ({reservedOrders?.length || 0} طلب)
                          </div>
                        </SelectItem>
                        {employeesInvolved.map(emp => {
                          const empOrdersCount = reservedOrders?.filter(o => o.created_by === emp.id).length || 0;
                          return (
                            <SelectItem key={emp.id} value={emp.id} className="hover:bg-violet-50 dark:hover:bg-violet-950/20">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                {emp.full_name || emp.username} ({empOrdersCount} طلب)
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
            <div className="space-y-4">
              {filteredDisplayOrders && filteredDisplayOrders.length > 0 ? (
                filteredDisplayOrders.map((order, index) => (
                  <Card key={order.id} className="group relative overflow-hidden border-2 border-violet-200/50 hover:border-violet-300/70 transition-all duration-300 hover:shadow-xl hover:shadow-violet-500/10">
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-purple-500/5"></div>
                    <CardContent className="p-6 relative">
                      {/* رأس الطلب */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
                        <div className="flex items-center gap-3 mb-3 md:mb-0">
                          <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-md">
                            <FileText className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <h3 className="font-bold text-xl bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                              {order.trackingnumber || order.order_number || `طلب #${index + 1}`}
                            </h3>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                              <Calendar className="w-4 h-4" />
                              {formatDate(order.created_at)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white border-0 shadow-md">
                            <Clock className="w-3 h-3 mr-1" />
                            قيد التجهيز
                          </Badge>
                        </div>
                      </div>

                      <Separator className="my-4 bg-gradient-to-r from-transparent via-border to-transparent" />

                      {/* معلومات العميل والموظف */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                        {/* معلومات العميل */}
                        <Card className="border-2 border-blue-200/50 hover:border-blue-300/70 transition-colors">
                          <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                                <User className="w-3 h-3 text-white" />
                              </div>
                              <h4 className="font-semibold text-sm text-blue-600">معلومات العميل</h4>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0 space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                              <User className="w-3 h-3 text-muted-foreground" />
                              <span className="font-medium text-muted-foreground">الاسم:</span>
                              <span className="font-medium">{order.customerinfo?.name || order.customer_name || 'غير معروف'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="w-3 h-3 text-muted-foreground" />
                              <span className="font-medium text-muted-foreground">الهاتف:</span>
                              <span className="font-medium">{order.customerinfo?.phone || order.customer_phone || 'غير معروف'}</span>
                            </div>
                            <div className="flex items-start gap-2 text-sm">
                              <MapPin className="w-3 h-3 text-muted-foreground mt-0.5" />
                              <span className="font-medium text-muted-foreground">العنوان:</span>
                              <span className="flex-1 font-medium text-xs">
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
                        <Card className="border-2 border-green-200/50 hover:border-green-300/70 transition-colors">
                          <CardHeader className="pb-3">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                                <Building2 className="w-3 h-3 text-white" />
                              </div>
                              <h4 className="font-semibold text-sm text-green-600">الموظف المسؤول</h4>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <div className="flex items-center gap-2 text-sm">
                              <User className="w-3 h-3 text-muted-foreground" />
                              <span className="font-semibold">
                                {(() => {
                                  // البحث عن الموظف من قائمة المستخدمين
                                  const employee = allUsers?.find(u => u.id === order.created_by);
                                  if (employee) {
                                    console.log('✅ Employee found:', employee);
                                    return employee.full_name || employee.username || employee.email || 'غير محدد';
                                  }
                                  // إذا لم نجد الموظف في القائمة، نبحث في بيانات الطلب
                                  console.log('⚠️ Employee not found in allUsers, using order data');
                                  return order.employeeName || order.employee_name || 'غير معروف';
                                })()}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      <Separator className="my-4 bg-gradient-to-r from-transparent via-border to-transparent" />

                      {/* المنتجات المحجوزة */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg flex items-center justify-center">
                            <Package className="w-3 h-3 text-white" />
                          </div>
                          <h4 className="font-semibold text-base text-orange-600">
                            المنتجات المحجوزة ({order.items?.length || 0})
                          </h4>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {order.items?.map((item, itemIndex) => (
                            <Card key={itemIndex} className="border border-orange-200/50 hover:border-orange-300/70 transition-colors">
                              <CardContent className="p-3">
                                <div className="flex items-center gap-3">
                                  {item.image && (
                                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                                      <img src={item.image} alt={item.name || item.productName} className="w-full h-full object-cover" />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <h5 className="font-medium text-sm truncate">{item.name || item.productName || 'منتج غير محدد'}</h5>
                                    <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                                      <span>الكمية: {item.quantity || 0}</span>
                                      <span>{((item.price || 0) * (item.quantity || 0)).toLocaleString()} د.ع</span>
                                    </div>
                                    {(item.color || item.size) && (
                                      <div className="flex gap-1 mt-1">
                                        {item.color && (
                                          <Badge variant="outline" className="text-xs">{item.color}</Badge>
                                        )}
                                        {item.size && (
                                          <Badge variant="outline" className="text-xs">{item.size}</Badge>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )) || (
                            <div className="col-span-full text-center py-4 text-muted-foreground">
                              لا توجد منتجات محجوزة في هذا الطلب
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="border-2 border-dashed border-muted-foreground/20">
                  <CardContent className="p-12 text-center">
                    <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-violet-500/20 to-purple-500/20 rounded-full flex items-center justify-center">
                      <Archive className="w-12 h-12 text-violet-500" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">لا توجد طلبات محجوزة</h3>
                    <p className="text-muted-foreground mb-4">
                      {isAdmin 
                        ? selectedEmployee === 'all' 
                          ? 'لا توجد حاليًا أي طلبات في حالة التجهيز تطابق الفلتر المحدد.'
                          : 'الموظف المحدد ليس لديه طلبات محجوزة حاليًا.'
                        : 'ليس لديك طلبات محجوزة حاليًا.'
                      }
                    </p>
                    <div className="text-sm text-blue-600 bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3 inline-block">
                      <Clock className="w-4 h-4 inline mr-1" />
                      يتم عرض الطلبات التي قمت بإنشاؤها فقط
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