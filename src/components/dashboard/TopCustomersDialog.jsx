import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Users, Calendar, Eye, TrendingUp, DollarSign, Phone } from 'lucide-react';
import { motion } from 'framer-motion';
import useOrdersAnalytics from '@/hooks/useOrdersAnalytics';

const TopCustomersDialog = ({ open, onOpenChange, employeeId = null }) => {
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const [customerStats, setCustomerStats] = useState([]);
  
  // استخدام النظام الموحد للحصول على البيانات
  const { analytics, loading } = useOrdersAnalytics();

  const periods = [
    { key: 'week', label: 'الأسبوع الماضي' },
    { key: 'month', label: 'الشهر الماضي' },
    { key: '3months', label: '3 أشهر' },
    { key: '6months', label: '6 أشهر' },
    { key: 'year', label: 'السنة الماضية' },
    { key: 'all', label: 'كل الفترات' }
  ];

  // استخدام البيانات الموحدة مع الحفاظ على نفس الوظائف
  useEffect(() => {
    if (analytics.topCustomers && analytics.topCustomers.length > 0) {
      // تحويل البيانات الموحدة إلى نفس الهيكل المتوقع
      const unifiedCustomers = analytics.topCustomers.map(customer => ({
        phone: customer.phone || 'غير محدد',
        normalizedPhone: normalizePhoneNumber(customer.phone),
        name: customer.name || 'زبون غير محدد',
        orderCount: customer.total_orders || 0,
        totalRevenue: parseFloat(customer.total_spent) || 0,
        avgOrderValue: customer.total_orders > 0 ? (parseFloat(customer.total_spent) / customer.total_orders) : 0,
        orders: [{
          id: 'unified',
          amount: parseFloat(customer.total_spent) || 0,
          date: new Date()
        }],
        city: customer.city,
        province: customer.province
      }));
      
      setCustomerStats(unifiedCustomers);
    }
  }, [analytics.topCustomers]);

  // دالة تطبيع رقم الهاتف
  const normalizePhoneNumber = (phone) => {
    if (!phone) return 'غير محدد';
    let normalized = String(phone).replace(/[\s\-\(\)]/g, '');
    normalized = normalized.replace(/^(\+964|00964)/, '');
    normalized = normalized.replace(/^0/, '');
    return normalized;
  };

  // دالة فلترة البيانات حسب الفترة الزمنية (يمكن تطويرها لاحقاً)
  const getFilteredCustomers = () => {
    // الآن نستخدم البيانات الموحدة، يمكن إضافة فلترة زمنية لاحقاً إذا لزم الأمر
    return customerStats;
  };

  const totalOrders = customerStats.reduce((sum, customer) => sum + customer.orderCount, 0);
  const totalRevenue = customerStats.reduce((sum, customer) => sum + customer.totalRevenue, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-background">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-lg">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-blue-500" />
            </div>
            الزبائن الأكثر طلباً
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-sm text-muted-foreground">جاري التحليل...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* فلترة الفترة الزمنية */}
            <div className="flex flex-wrap gap-1">
              {periods.map((period) => (
                <Button
                  key={period.key}
                  variant={selectedPeriod === period.key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedPeriod(period.key)}
                  className="text-xs px-2 py-1 h-8"
                >
                  {period.label}
                </Button>
              ))}
            </div>

            {/* الإحصائيات العامة */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-gradient-to-br from-blue-500 to-cyan-400 rounded-lg p-4 text-white relative overflow-hidden">
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-white/10 rounded-full"></div>
                <div className="flex items-center justify-between relative z-10">
                  <div>
                    <p className="text-xs font-medium text-white/90 mb-1">إجمالي الطلبات</p>
                    <p className="text-xl font-bold text-white">{totalOrders}</p>
                  </div>
                  <TrendingUp className="w-5 h-5 text-white/80" />
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-500 to-emerald-400 rounded-lg p-4 text-white relative overflow-hidden">
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-white/10 rounded-full"></div>
                <div className="flex items-center justify-between relative z-10">
                  <div>
                    <p className="text-xs font-medium text-white/90 mb-1">إجمالي الإيرادات</p>
                    <p className="text-xl font-bold text-white">{totalRevenue.toLocaleString()}</p>
                  </div>
                  <DollarSign className="w-5 h-5 text-white/80" />
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-500 to-violet-400 rounded-lg p-4 text-white relative overflow-hidden">
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-white/10 rounded-full"></div>
                <div className="flex items-center justify-between relative z-10">
                  <div>
                    <p className="text-xs font-medium text-white/90 mb-1">عدد الزبائن</p>
                    <p className="text-xl font-bold text-white">{customerStats.length}</p>
                  </div>
                  <Users className="w-5 h-5 text-white/80" />
                </div>
              </div>
            </div>

            {/* قائمة الزبائن */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Eye className="w-4 h-4" />
                تفاصيل الزبائن ({customerStats.length})
              </h3>
              
              {customerStats.length > 0 ? (
                <div className="grid gap-2 max-h-60 overflow-y-auto">
                  {customerStats.map((customer, index) => (
                    <motion.div
                      key={customer.normalizedPhone}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                    >
                      <div className="bg-gradient-to-br from-card to-card/60 rounded-lg p-3 border border-border/60 hover:border-primary/30 transition-all duration-200">
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
                              <p className="text-xs text-muted-foreground">
                                الهاتف المطبع: {customer.normalizedPhone}
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

                        {/* تفاصيل الطلبات */}
                        <div className="mt-4 text-xs text-muted-foreground">
                          <p>طلبات هذا الزبون:</p>
                          {customer.orders.map((order, i) => (
                            <span key={order.id} className="inline-block mr-2">
                              {order.amount.toLocaleString()} د.ع
                              {i < customer.orders.length - 1 && ', '}
                            </span>
                          ))}
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
                      <p>الطلبات المكتملة: {analytics.completedOrders || 0}</p>
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