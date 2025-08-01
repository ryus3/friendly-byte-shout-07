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

const ReservedStockDialog = ({ open, onOpenChange }) => {
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
  const [realReservedOrders, setRealReservedOrders] = useState([]);
  const [employees, setEmployees] = useState([]);

  // جلب البيانات الحقيقية للمخزون المحجوز والموظفين
  useEffect(() => {
    const fetchReservedStockData = async () => {
      if (!open) return;

      try {
        const { supabase } = await import('@/lib/customSupabaseClient');

        // جلب الطلبات المعلقة مع المنتجات المحجوزة
        const { data: orders, error: ordersError } = await supabase
          .from('orders')
          .select(`
            id,
            order_number,
            created_by,
            customer_name,
            customer_phone,
            status,
            total_amount,
            created_at,
            order_items (
              id,
              product_id,
              variant_id,
              quantity,
              unit_price,
              total_price,
              products (
                id,
                name,
                images
              ),
              product_variants (
                id,
                colors (name),
                sizes (name)
              )
            ),
            profiles!orders_created_by_fkey (
              user_id,
              full_name,
              username,
              employee_code
            )
          `)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (ordersError) throw ordersError;

        // جلب جميع الموظفين النشطين
        const { data: allEmployees, error: employeesError } = await supabase
          .from('profiles')
          .select('user_id, full_name, username, employee_code')
          .eq('is_active', true)
          .order('full_name');

        if (employeesError) throw employeesError;

        // تحويل البيانات للشكل المطلوب
        const processedOrders = orders?.map(order => ({
          ...order,
          items: order.order_items?.map(item => ({
            id: item.id,
            name: item.products?.name || 'منتج غير محدد',
            quantity: item.quantity,
            price: item.unit_price,
            total: item.total_price,
            color: item.product_variants?.colors?.name || null,
            size: item.product_variants?.sizes?.name || null,
            image: item.products?.images?.[0] || null
          })) || []
        })) || [];

        setRealReservedOrders(processedOrders);
        setEmployees(allEmployees || []);

      } catch (error) {
        console.error('خطأ في جلب بيانات المخزون المحجوز:', error);
      }
    };

    fetchReservedStockData();
  }, [open]);

  // الموظفون المتورطون في الطلبات المحجوزة
  const employeesInvolved = useMemo(() => {
    if (!realReservedOrders || !employees) return [];
    
    const employeeIds = [...new Set(realReservedOrders.map(o => o.created_by))];
    return employees.filter(emp => employeeIds.includes(emp.user_id));
  }, [realReservedOrders, employees]);

  // فلترة الطلبات حسب الموظف المختار
  const filteredDisplayOrders = useMemo(() => {
    if (!realReservedOrders?.length) return [];
    
    if (isAdmin) {
      if (selectedEmployee === 'all') {
        return realReservedOrders;
      } else {
        return realReservedOrders.filter(o => o.created_by === selectedEmployee);
      }
    } else {
      // للموظف العادي - يرى طلباته فقط
      return realReservedOrders.filter(o => o.created_by === user?.id);
    }
  }, [realReservedOrders, selectedEmployee, isAdmin, user?.id]);

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

  const getEmployeeName = (employeeId) => {
    const employee = employees?.find(u => u.user_id === employeeId);
    return employee?.full_name || employee?.username || 'موظف غير معروف';
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

            {/* كروت الإحصائيات */}
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
                </CardContent>
              </Card>

              {/* القيمة الإجمالية */}
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
                </CardContent>
              </Card>
            </div>

            {/* فلتر الموظفين - للمدير فقط */}
            {isAdmin && employeesInvolved.length > 0 && (
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
                            <span className="font-medium text-sm md:text-base">جميع الموظفين ({realReservedOrders?.length || 0} طلب)</span>
                          </div>
                        </SelectItem>
                        {employeesInvolved.map(emp => {
                          const empOrdersCount = realReservedOrders?.filter(o => o.created_by === emp.user_id).length || 0;
                          return (
                            <SelectItem key={emp.user_id} value={emp.user_id} className="hover:bg-violet-50 dark:hover:bg-violet-950/30 p-3 md:p-4 rounded-lg m-1">
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
                                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0 space-y-2">
                                    <h5 className="font-bold text-sm truncate">{item.name || 'منتج غير محدد'}</h5>
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