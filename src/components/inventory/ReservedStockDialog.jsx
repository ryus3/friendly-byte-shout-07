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
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Archive, Package, User, Hash, Calendar, Phone, MapPin, Users, Clock, AlertCircle, ShoppingCart, Building2 } from 'lucide-react';
import { formatDistanceToNow, isValid, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/UnifiedAuthContext';

const ReservedStockDialog = ({ open, onOpenChange, reservedOrders, allUsers }) => {
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const { user, isAdmin } = useAuth();

  console.log('ReservedStockDialog - Data:', {
    reservedOrders: reservedOrders?.length,
    allUsers: allUsers?.length,
    currentUser: user?.id,
    isAdmin
  });

  const employeesInvolved = useMemo(() => {
    if (!reservedOrders || !allUsers) return [];
    const employeeIds = [...new Set(reservedOrders.map(o => o.created_by))];
    return allUsers.filter(u => employeeIds.includes(u.id));
  }, [reservedOrders, allUsers]);

  const filteredDisplayOrders = useMemo(() => {
    if (!reservedOrders) return [];
    
    console.log('Filtering orders - selectedEmployee:', selectedEmployee);
    
    if (selectedEmployee === 'all') {
      return reservedOrders;
    }
    return reservedOrders.filter(o => o.created_by === selectedEmployee);
  }, [reservedOrders, selectedEmployee]);

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
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Archive className="w-6 h-6 text-primary" />
            </div>
            الطلبات قيد التجهيز - المخزون المحجوز
          </DialogTitle>
          <DialogDescription className="text-base">
            عرض شامل للطلبات التي حجزت كميات من المخزون وتحتاج للمعالجة
          </DialogDescription>
        </DialogHeader>
        
        {/* إحصائيات سريعة */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500 rounded-lg">
                  <ShoppingCart className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي الطلبات</p>
                  <p className="text-2xl font-bold text-blue-600">{filteredDisplayOrders.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-r from-orange-50 to-orange-100 border-orange-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500 rounded-lg">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">المنتجات المحجوزة</p>
                  <p className="text-2xl font-bold text-orange-600">{totalReservedItems}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي الكمية</p>
                  <p className="text-2xl font-bold text-green-600">{totalReservedQuantity}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* فلتر الموظفين */}
        {isAdmin && employeesInvolved.length > 0 && (
          <div className="flex items-center gap-3 mb-4 p-4 bg-muted/50 rounded-lg border">
            <Users className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm font-medium">فلترة حسب الموظف:</span>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="اختر الموظف" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الموظفين ({reservedOrders?.length || 0})</SelectItem>
                {employeesInvolved.map(emp => {
                  const empOrdersCount = reservedOrders?.filter(o => o.created_by === emp.id).length || 0;
                  return (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name} ({empOrdersCount})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        )}

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 py-4">
            {filteredDisplayOrders && filteredDisplayOrders.length > 0 ? (
              filteredDisplayOrders.map((order, index) => (
                <Card key={order.id} className="shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-primary">
                  <CardContent className="p-6">
                    {/* رأس الطلب */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
                      <div className="flex items-center gap-3 mb-3 md:mb-0">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Hash className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-bold text-xl text-primary">
                            {order.trackingnumber || order.order_number || `طلب #${index + 1}`}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <Calendar className="w-4 h-4" />
                            {formatDate(order.created_at)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                          <Clock className="w-3 h-3 mr-1" />
                          قيد التجهيز
                        </Badge>
                      </div>
                    </div>

                    <Separator className="my-4" />

                    {/* معلومات العميل والموظف */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                      {/* معلومات العميل */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-base flex items-center gap-2">
                          <User className="w-4 h-4 text-primary" />
                          معلومات العميل
                        </h4>
                        <div className="bg-muted/30 p-4 rounded-lg space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">الاسم:</span>
                            <span>{order.customerinfo?.name || order.customer_name || 'غير معروف'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">الهاتف:</span>
                            <span>{order.customerinfo?.phone || order.customer_phone || 'غير معروف'}</span>
                          </div>
                          <div className="flex items-start gap-2 text-sm">
                            <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                            <span className="font-medium">العنوان:</span>
                            <span className="flex-1">
                              {[
                                order.customerinfo?.address || order.customer_address,
                                order.customerinfo?.city || order.customer_city,
                                order.customerinfo?.province || order.customer_province
                              ].filter(Boolean).join(', ') || 'غير محدد'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* معلومات الموظف */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-base flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-primary" />
                          الموظف المسؤول
                        </h4>
                        <div className="bg-muted/30 p-4 rounded-lg">
                          <div className="flex items-center gap-2 text-sm">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{order.employeeName || 'غير معروف'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Separator className="my-4" />

                    {/* المنتجات المحجوزة */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-base flex items-center gap-2">
                        <Package className="w-4 h-4 text-primary" />
                        المنتجات المحجوزة ({order.items?.length || 0})
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {order.items && Array.isArray(order.items) ? order.items.map((item, itemIndex) => (
                          <div key={itemIndex} className="flex items-center gap-4 p-4 bg-gradient-to-r from-muted/20 to-muted/40 rounded-lg border">
                            <img 
                              src={item.image || '/placeholder.png'} 
                              alt={item.productName || 'منتج'} 
                              className="w-16 h-16 rounded-lg object-cover border-2 border-background shadow-sm"
                              onError={(e) => {
                                e.target.src = '/placeholder.png';
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-base text-foreground truncate">
                                {item.productName || 'منتج غير معروف'}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {[item.color, item.size].filter(Boolean).join(' / ') || 'متغير افتراضي'}
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="secondary" className="text-xs">
                                  الكمية: {item.quantity || 0}
                                </Badge>
                                {item.price && (
                                  <Badge variant="outline" className="text-xs">
                                    {item.price} د.ع
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        )) : (
                          <div className="col-span-full text-center py-8">
                            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                            <p className="text-muted-foreground">لا توجد عناصر للطلب</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-16">
                <div className="p-4 bg-muted/20 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
                  <Package className="w-12 h-12 text-muted-foreground" />
                </div>
                <h3 className="text-2xl font-semibold text-muted-foreground mb-3">لا توجد طلبات محجوزة</h3>
                <p className="text-muted-foreground text-lg max-w-md mx-auto">
                  لا توجد حالياً أي طلبات في حالة انتظار التجهيز تطابق الفلتر المحدد.
                </p>
                {!isAdmin && (
                  <p className="text-sm text-muted-foreground mt-4 italic">
                    يتم عرض الطلبات التي قمت بإنشائها فقط
                  </p>
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