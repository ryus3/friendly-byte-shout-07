import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Users, Calendar, Eye, TrendingUp, DollarSign, Phone } from 'lucide-react';
import { useOrders } from '@/hooks/useOrders';
import { motion } from 'framer-motion';

const TopCustomersDialog = ({ open, onOpenChange }) => {
  const { orders: allOrders, loading } = useOrders();
  const [selectedPeriod, setSelectedPeriod] = useState('month');

  const periods = [
    { key: 'week', label: 'الأسبوع الماضي' },
    { key: 'month', label: 'الشهر الماضي' },
    { key: '3months', label: '3 أشهر' },
    { key: '6months', label: '6 أشهر' },
    { key: 'year', label: 'السنة الماضية' },
    { key: 'all', label: 'كل الفترات' }
  ];

  // دالة تطبيع رقم الهاتف
  const normalizePhoneNumber = (phone) => {
    if (!phone || typeof phone !== 'string') return null;
    
    // إزالة المسافات والرموز غير المرغوب فيها
    let normalized = phone.replace(/[\s\-\(\)]/g, '');
    
    // إزالة رمز الدولة +964 أو 00964
    normalized = normalized.replace(/^(\+964|00964)/, '');
    
    // إزالة الصفر في البداية إذا كان رقم العراق
    normalized = normalized.replace(/^0/, '');
    
    // التأكد من أن الرقم بين 10-11 رقم
    if (normalized.length >= 10 && normalized.length <= 11) {
      return normalized;
    }
    
    return null;
  };

  // حساب إحصائيات الزبائن
  const customerStats = useMemo(() => {
    console.log('🔍 بدء تحليل بيانات الزبائن...');
    console.log('📊 إجمالي الطلبات المتاحة:', allOrders?.length || 0);

    if (!allOrders || allOrders.length === 0) {
      console.log('❌ لا توجد طلبات متاحة');
      return [];
    }

    // فلترة الطلبات المكتملة فقط (منطق مبسط)
    const completedOrders = allOrders.filter(order => {
      const isCompleted = order.status === 'completed' || order.status === 'delivered';
      const isNotCancelled = order.status !== 'cancelled' && order.status !== 'return_received';
      return isCompleted && isNotCancelled;
    });

    console.log('✅ الطلبات المكتملة:', completedOrders.length);

    if (completedOrders.length === 0) {
      console.log('❌ لا توجد طلبات مكتملة');
      return [];
    }

    // فلترة حسب الفترة الزمنية
    const now = new Date();
    const filteredOrders = completedOrders.filter(order => {
      const orderDate = new Date(order.created_at);
      
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

    console.log('📅 الطلبات بعد فلترة الفترة:', filteredOrders.length);

    // تجميع البيانات حسب رقم الهاتف
    const customerMap = new Map();

    filteredOrders.forEach(order => {
      const rawPhone = order.customer_phone;
      const normalizedPhone = normalizePhoneNumber(rawPhone);
      const customerName = order.customer_name || 'زبون غير محدد';
      
      console.log(`📞 معالجة الطلب ${order.id}: الهاتف="${rawPhone}" -> المطبع="${normalizedPhone}" الاسم="${customerName}"`);

      // استخدام رقم الهاتف الخام إذا فشل التطبيع
      const phoneKey = normalizedPhone || rawPhone || 'غير محدد';

      if (!customerMap.has(phoneKey)) {
        customerMap.set(phoneKey, {
          phone: rawPhone || 'غير محدد',
          normalizedPhone: normalizedPhone,
          name: customerName,
          orderCount: 0,
          totalRevenue: 0,
          avgOrderValue: 0,
          firstOrderDate: order.created_at,
          lastOrderDate: order.created_at
        });
      }

      const customerData = customerMap.get(phoneKey);
      customerData.orderCount += 1;
      customerData.totalRevenue += parseFloat(order.final_amount || order.total_amount || 0);
      
      // تحديث اسم العميل إذا كان أفضل
      if (customerName && customerName !== 'زبون غير محدد' && customerData.name === 'زبون غير محدد') {
        customerData.name = customerName;
      }
      
      // تحديث التواريخ
      const orderDate = new Date(order.created_at);
      const firstDate = new Date(customerData.firstOrderDate);
      const lastDate = new Date(customerData.lastOrderDate);
      
      if (orderDate < firstDate) customerData.firstOrderDate = order.created_at;
      if (orderDate > lastDate) customerData.lastOrderDate = order.created_at;
    });

    console.log('👥 عدد الزبائن الفريدين:', customerMap.size);

    // تحويل إلى مصفوفة وترتيب
    const result = Array.from(customerMap.values())
      .map(customer => ({
        ...customer,
        avgOrderValue: customer.orderCount > 0 ? customer.totalRevenue / customer.orderCount : 0
      }))
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, 15);
      
    console.log('🏆 أفضل الزبائن:', result);
    return result;
  }, [allOrders, selectedPeriod]);

  const totalOrders = customerStats.reduce((sum, customer) => sum + customer.orderCount, 0);
  const totalRevenue = customerStats.reduce((sum, customer) => sum + customer.totalRevenue, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-background">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            إحصائيات الزبائن الأكثر طلباً
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-muted-foreground">جاري تحميل البيانات...</p>
            </div>
          </div>
        ) : (
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
                    <p className="text-xs text-white/70 mt-1">طلب مكتمل</p>
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
                تفاصيل الزبائن ({customerStats.length} زبون)
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
                    <p className="text-lg font-semibold text-muted-foreground mb-2">لا توجد بيانات زبائن</p>
                    <p className="text-sm text-muted-foreground">لا توجد طلبات مكتملة للفترة المحددة</p>
                    <div className="mt-4 text-xs text-muted-foreground">
                      <p>الطلبات المتاحة: {allOrders?.length || 0}</p>
                      <p>الفترة المحددة: {periods.find(p => p.key === selectedPeriod)?.label}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TopCustomersDialog;