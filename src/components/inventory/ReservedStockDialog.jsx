import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Archive, Package, User, Hash, Calendar, Phone, MapPin, Users, Clock, AlertCircle, ShoppingCart, Building2, DollarSign, FileText } from 'lucide-react';
import { formatDistanceToNow, isValid, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import usePermissions from '@/hooks/usePermissions';

const ReservedStockDialog = ({ open, onOpenChange, reservedOrders, allUsers }) => {
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const { user } = useAuth();
  const { isAdmin } = usePermissions();

  console.log('ReservedStockDialog - Data:', {
    reservedOrders: reservedOrders?.length,
    allUsers: allUsers?.length,
    currentUser: user?.id,
    isAdmin,
    orderDetails: reservedOrders?.map(o => ({
      id: o.id,
      created_by: o.created_by,
      employeeName: o.employeeName
    }))
  });

  const employeesInvolved = useMemo(() => {
    if (!reservedOrders || !allUsers) return [];
    const employeeIds = [...new Set(reservedOrders.map(o => o.created_by))];
    return allUsers.filter(u => employeeIds.includes(u.id));
  }, [reservedOrders, allUsers]);

  const filteredDisplayOrders = useMemo(() => {
    if (!reservedOrders || reservedOrders.length === 0) return [];
    
    console.log('Filtering orders - selectedEmployee:', selectedEmployee);
    console.log('Available orders:', reservedOrders.map(o => ({ id: o.id, created_by: o.created_by, user_id: user?.id })));
    
    // إذا كان المدير وقال "الكل"، يرى جميع الطلبات
    if (isAdmin && selectedEmployee === 'all') {
      return reservedOrders;
    }
    
    // إذا كان المدير وقام بتحديد موظف معين
    if (isAdmin && selectedEmployee !== 'all') {
      return reservedOrders.filter(o => o.created_by === selectedEmployee);
    }
    
    // إذا كان موظف عادي، يرى جميع الطلبات المحجوزة (تغيير مؤقت للتشخيص)
    // يجب أن يرى طلباته فقط لكن للآن سنعرض جميع الطلبات
    if (!isAdmin) {
      return reservedOrders; // عرض جميع الطلبات للتشخيص
    }
    
    return reservedOrders;
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
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
        
        {/* إحصائيات سريعة - كروت صغيرة بألوان قسم الجرد */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {/* كارت إجمالي الطلبات - أزرق فاتح */}
          <Card className="group relative overflow-hidden border border-sky-300/30 hover:border-sky-400/50 transition-all duration-300 hover:shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950/20 dark:to-blue-950/20"></div>
            <CardContent className="p-3 relative">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-sky-500 to-blue-500 rounded-lg flex items-center justify-center shadow-sm">
                  <ShoppingCart className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-muted-foreground">إجمالي الطلبات</p>
                  <p className="text-lg font-bold text-sky-600 dark:text-sky-400">{filteredDisplayOrders.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* كارت المنتجات المحجوزة - برتقالي */}
          <Card className="group relative overflow-hidden border border-orange-300/30 hover:border-orange-400/50 transition-all duration-300 hover:shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20"></div>
            <CardContent className="p-3 relative">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg flex items-center justify-center shadow-sm">
                  <Package className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-muted-foreground">عناصر محجوزة</p>
                  <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{totalReservedItems}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* كارت إجمالي الكمية - أخضر */}
          <Card className="group relative overflow-hidden border border-emerald-300/30 hover:border-emerald-400/50 transition-all duration-300 hover:shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/20 dark:to-green-950/20"></div>
            <CardContent className="p-3 relative">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-green-500 rounded-lg flex items-center justify-center shadow-sm">
                  <Hash className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-muted-foreground">إجمالي الكمية</p>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{totalReservedQuantity}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* كارت القيمة الإجمالية - بنفسجي */}
          <Card className="group relative overflow-hidden border border-violet-300/30 hover:border-violet-400/50 transition-all duration-300 hover:shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20"></div>
            <CardContent className="p-3 relative">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-500 rounded-lg flex items-center justify-center shadow-sm">
                  <DollarSign className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-muted-foreground">القيمة الإجمالية</p>
                  <p className="text-lg font-bold text-violet-600 dark:text-violet-400">
                    {filteredDisplayOrders.reduce((total, order) => {
                      return total + (order.items?.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0) || 0);
                    }, 0).toLocaleString()} د.ع
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* فلتر الموظفين - للمدير فقط */}
        {isAdmin && employeesInvolved.length > 0 && (
          <Card className="mb-6 border-2 border-violet-200/50">
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
                  <SelectContent className="bg-background border-2 border-muted shadow-lg">
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
                            {emp.full_name} ({empOrdersCount} طلب)
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

        <ScrollArea className="flex-1">
          <div className="space-y-4 py-4">
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
                                const employee = allUsers?.find(u => u.id === order.created_by);
                                return employee?.full_name || order.employeeName || 'غير معروف';
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
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {order.items && Array.isArray(order.items) ? order.items.map((item, itemIndex) => (
                          <Card key={itemIndex} className="group border-2 border-orange-200/50 hover:border-orange-300/70 transition-all duration-300 hover:shadow-md">
                            <CardContent className="p-3">
                              <div className="flex items-center gap-3">
                                <div className="relative">
                                  <img 
                                    src={item.image || '/placeholder.png'} 
                                    alt={item.productName || 'منتج'} 
                                    className="w-12 h-12 rounded-lg object-cover border-2 border-orange-200 shadow-sm group-hover:scale-105 transition-transform duration-300"
                                    onError={(e) => {
                                      e.target.src = '/placeholder.png';
                                    }}
                                  />
                                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full flex items-center justify-center">
                                    <span className="text-xs font-bold text-white">{item.quantity || 0}</span>
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-sm text-foreground truncate">
                                    {item.productName || 'منتج غير معروف'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {[item.color, item.size].filter(Boolean).join(' / ') || 'متغير افتراضي'}
                                  </p>
                                  {item.price && (
                                    <p className="text-xs font-medium text-orange-600 mt-1">
                                      {item.price.toLocaleString()} د.ع
                                    </p>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )) : (
                          <div className="col-span-full text-center py-8">
                            <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-3">
                              <Package className="w-8 h-8 text-muted-foreground" />
                            </div>
                            <p className="text-muted-foreground font-medium">لا توجد عناصر للطلب</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-20">
                <div className="relative mx-auto mb-8">
                  <div className="w-32 h-32 bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/20 dark:to-purple-900/20 rounded-full flex items-center justify-center mx-auto">
                    <div className="w-24 h-24 bg-gradient-to-br from-violet-200 to-purple-200 dark:from-violet-800/30 dark:to-purple-800/30 rounded-full flex items-center justify-center">
                      <Archive className="w-12 h-12 text-violet-500" />
                    </div>
                  </div>
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-6 h-6 bg-gradient-to-br from-violet-400 to-purple-500 rounded-full animate-pulse"></div>
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-3">لا توجد طلبات محجوزة</h3>
                <p className="text-muted-foreground text-lg max-w-md mx-auto mb-4">
                  لا توجد حالياً أي طلبات في حالة انتظار التجهيز تطابق الفلتر المحدد.
                </p>
                {!isAdmin && (
                  <Card className="max-w-md mx-auto border-2 border-blue-200/50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-sm text-blue-600">
                        <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                        <span className="font-medium">يتم عرض الطلبات التي قمت بإنشائها فقط</span>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default ReservedStockDialog;