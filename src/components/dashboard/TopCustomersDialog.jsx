import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Users, Calendar, Eye, TrendingUp, DollarSign, Phone } from 'lucide-react';
import { useOrders } from '@/hooks/useOrders';
import { motion } from 'framer-motion';

const TopCustomersDialog = ({ open, onOpenChange }) => {
  const { orders } = useOrders();
  const [selectedPeriod, setSelectedPeriod] = useState('month');

  const periods = [
    { key: 'week', label: 'الأسبوع الماضي' },
    { key: 'month', label: 'الشهر الماضي' },
    { key: '3months', label: '3 أشهر' },
    { key: '6months', label: '6 أشهر' },
    { key: 'year', label: 'السنة الماضية' },
    { key: 'all', label: 'كل الفترات' }
  ];

  // حساب إحصائيات الزبائن بناءً على رقم الهاتف للطلبات الموصلة
  const customerStats = useMemo(() => {
    if (!orders || orders.length === 0) {
      console.log('❌ لا توجد طلبات متاحة للزبائن');
      return [];
    }

    // فلترة الطلبات حسب الفترة المحددة والحالة المكتملة
    const filteredOrders = orders.filter(order => {
      // التأكد من أن الطلب مكتمل (تم التوصيل فقط) - يخصم من المخزون عندما يكون delivered
      const isDelivered = order.delivery_status === 'delivered' || 
                         order.status === 'delivered' || 
                         order.order_status === 'delivered';
      
      // استبعاد الطلبات المرجعة أو الملغية
      const isReturnedOrCancelled = order.status === 'returned' || 
                                   order.status === 'cancelled' ||
                                   order.delivery_status === 'returned' ||
                                   order.delivery_status === 'cancelled' ||
                                   order.order_status === 'returned' ||
                                   order.order_status === 'cancelled';
      
      if (!isDelivered || isReturnedOrCancelled) return false;

      const orderDate = new Date(order.created_at || order.order_date);
      const now = new Date();
      
      switch (selectedPeriod) {
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return orderDate >= weekAgo;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          return orderDate >= monthAgo;
        case '3months':
          const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          return orderDate >= threeMonthsAgo;
        case '6months':
          const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
          return orderDate >= sixMonthsAgo;
        case 'year':
          const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          return orderDate >= yearAgo;
        case 'all':
        default:
          return true;
      }
    });

    console.log('✅ طلبات مكتملة للزبائن:', filteredOrders.length);

    // تجميع البيانات حسب رقم الهاتف
    const customerMap = new Map();

    filteredOrders.forEach(order => {
      // تطبيع رقم الهاتف - إزالة الأصفار الزائدة والمسافات
      const normalizePhone = (phone) => {
        if (!phone) return 'غير محدد';
        
        // إزالة المسافات والرموز الخاصة
        let cleaned = phone.toString().replace(/[\s\-\(\)\+]/g, '');
        
        // إزالة 964 إذا كان موجوداً
        if (cleaned.startsWith('964')) {
          cleaned = cleaned.substring(3);
        }
        
        // إزالة 0 من البداية إذا كان موجوداً
        if (cleaned.startsWith('0')) {
          cleaned = cleaned.substring(1);
        }
        
        // التأكد من أن الرقم 10 أو 11 خانة
        if (cleaned.length >= 10 && cleaned.length <= 11) {
          return cleaned;
        }
        
        return phone; // إرجاع الرقم الأصلي إذا لم يكن صالحاً
      };

      const customerPhone = normalizePhone(order.customer_phone);
      const customerName = order.customer_name || 
                          order.client_name || 
                          order.name || 
                          'زبون غير محدد';
      
      console.log(`📞 الطلب ${order.id}: الهاتف = "${customerPhone}", الاسم = "${customerName}"`);

      if (!customerMap.has(customerPhone)) {
        customerMap.set(customerPhone, {
          phone: customerPhone,
          name: customerName,
          orderCount: 0,
          totalRevenue: 0,
          avgOrderValue: 0,
          firstOrderDate: order.created_at || order.order_date,
          lastOrderDate: order.created_at || order.order_date
        });
      }

      const customerData = customerMap.get(customerPhone);
      customerData.orderCount += 1;
      customerData.totalRevenue += parseFloat(order.total_amount || order.final_amount || 0);
      
      // تحديث تواريخ أول وآخر طلب
      const orderDate = new Date(order.created_at || order.order_date);
      const firstDate = new Date(customerData.firstOrderDate);
      const lastDate = new Date(customerData.lastOrderDate);
      
      if (orderDate < firstDate) customerData.firstOrderDate = order.created_at || order.order_date;
      if (orderDate > lastDate) customerData.lastOrderDate = order.created_at || order.order_date;
    });

    console.log('✅ خريطة الزبائن النهائية:', Array.from(customerMap.entries()).length, 'زبون');

    // تحويل البيانات إلى مصفوفة وحساب المتوسط
    return Array.from(customerMap.values())
      .map(customer => ({
        ...customer,
        avgOrderValue: customer.orderCount > 0 ? customer.totalRevenue / customer.orderCount : 0
      }))
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, 15);
  }, [orders, selectedPeriod]);

  const totalOrders = customerStats.reduce((sum, customer) => sum + customer.orderCount, 0);
  const totalRevenue = customerStats.reduce((sum, customer) => sum + customer.totalRevenue, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            إحصائيات الزبائن الأكثر طلباً
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* فلترة الفترة الزمنية */}
          <div className="flex flex-wrap gap-2">
            {periods.map((period) => (
              <Button
                key={period.key}
                variant={selectedPeriod === period.key ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedPeriod(period.key)}
                className="text-sm"
              >
                <Calendar className="w-4 h-4 mr-2" />
                {period.label}
              </Button>
            ))}
          </div>

          {/* الإحصائيات العامة */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-500 to-cyan-400 rounded-xl p-6 border border-blue-200/50 dark:border-blue-700/50 shadow-lg backdrop-blur-sm text-white relative overflow-hidden">
              <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-white/10 rounded-full"></div>
              <div className="absolute -top-2 -left-2 w-12 h-12 bg-white/10 rounded-full"></div>
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <p className="text-sm font-medium text-white/90 mb-1">إجمالي الطلبات</p>
                  <p className="text-3xl font-bold text-white">{totalOrders}</p>
                  <p className="text-xs text-white/70 mt-1">طلب موصل</p>
                </div>
                <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-7 h-7 text-white" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-emerald-400 rounded-xl p-6 border border-green-200/50 dark:border-green-700/50 shadow-lg backdrop-blur-sm text-white relative overflow-hidden">
              <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-white/10 rounded-full"></div>
              <div className="absolute -top-2 -left-2 w-12 h-12 bg-white/10 rounded-full"></div>
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <p className="text-sm font-medium text-white/90 mb-1">إجمالي الإيرادات</p>
                  <p className="text-3xl font-bold text-white">
                    {totalRevenue.toLocaleString()}
                  </p>
                  <p className="text-xs text-white/70 mt-1">دينار عراقي</p>
                </div>
                <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <DollarSign className="w-7 h-7 text-white" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-violet-400 rounded-xl p-6 border border-purple-200/50 dark:border-purple-700/50 shadow-lg backdrop-blur-sm text-white relative overflow-hidden">
              <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-white/10 rounded-full"></div>
              <div className="absolute -top-2 -left-2 w-12 h-12 bg-white/10 rounded-full"></div>
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <p className="text-sm font-medium text-white/90 mb-1">عدد الزبائن</p>
                  <p className="text-3xl font-bold text-white">{customerStats.length}</p>
                  <p className="text-xs text-white/70 mt-1">زبون نشط</p>
                </div>
                <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <Users className="w-7 h-7 text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* قائمة الزبائن */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Eye className="w-5 h-5" />
              تفاصيل الزبائن
            </h3>
            
            {customerStats.length > 0 ? (
              <div className="grid gap-3">
                {customerStats.map((customer, index) => (
                  <motion.div
                    key={customer.phone}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <div className="bg-gradient-to-br from-card to-card/60 hover:from-card/80 hover:to-card/40 rounded-xl p-6 border border-border/60 hover:border-primary/30 shadow-lg hover:shadow-xl transition-all duration-300 backdrop-blur-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-lg font-bold shadow-lg">
                            {index + 1}
                          </div>
                          <div>
                            <h4 className="font-bold text-lg text-foreground mb-1">{customer.name}</h4>
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Phone className="w-4 h-4" />
                              {customer.phone}
                            </p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-6 text-left">
                          <div className="text-center">
                            <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-2 mx-auto">
                              <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <p className="text-xs text-muted-foreground mb-1">عدد الطلبات</p>
                            <p className="font-bold text-lg text-blue-600 dark:text-blue-400">{customer.orderCount}</p>
                          </div>
                          <div className="text-center">
                            <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center mb-2 mx-auto">
                              <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
                            </div>
                            <p className="text-xs text-muted-foreground mb-1">إجمالي الإيرادات</p>
                            <p className="font-bold text-lg text-green-600 dark:text-green-400">
                              {customer.totalRevenue.toLocaleString()}
                            </p>
                          </div>
                          <div className="text-center">
                            <div className="w-14 h-14 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center mb-2 mx-auto">
                              <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                            </div>
                            <p className="text-xs text-muted-foreground mb-1">متوسط الطلب</p>
                            <p className="font-bold text-lg text-purple-600 dark:text-purple-400">
                              {Math.round(customer.avgOrderValue).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {/* شريط التقدم */}
                      <div className="mt-6">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-medium text-muted-foreground">نسبة المساهمة</span>
                          <span className="text-xs font-bold text-primary">
                            {totalOrders > 0 ? ((customer.orderCount / totalOrders) * 100).toFixed(1) : 0}%
                          </span>
                        </div>
                        <div className="w-full bg-muted/50 rounded-full h-3 overflow-hidden">
                          <div 
                            className="bg-gradient-to-r from-primary to-primary/80 h-3 rounded-full transition-all duration-500 shadow-sm"
                            style={{ 
                              width: `${totalOrders > 0 ? (customer.orderCount / totalOrders) * 100 : 0}%`
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="bg-gradient-to-br from-card to-card/60 rounded-xl p-12 border border-border/60 shadow-lg">
                <div className="text-center">
                  <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-semibold text-muted-foreground mb-2">لا توجد بيانات متاحة</p>
                  <p className="text-sm text-muted-foreground">لا توجد طلبات مكتملة للفترة المحددة</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TopCustomersDialog;