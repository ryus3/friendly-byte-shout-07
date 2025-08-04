import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Users, Calendar, Eye, TrendingUp, DollarSign, Phone } from 'lucide-react';
import { motion } from 'framer-motion';
import useOrdersAnalytics from '@/hooks/useOrdersAnalytics';

const TopCustomersDialog = ({ open, onOpenChange, employeeId = null }) => {
  const [selectedPeriod, setSelectedPeriod] = useState('all');
  const { analytics, loading } = useOrdersAnalytics();
  
  console.log('🔥 TopCustomersDialog - البيانات من useOrdersAnalytics:', {
    analytics: analytics?.topCustomers,
    length: analytics?.topCustomers?.length || 0
  });

  const periods = [
    { key: 'week', label: 'الأسبوع الماضي' },
    { key: 'month', label: 'الشهر الماضي' },
    { key: '3months', label: '3 أشهر' },
    { key: 'year', label: 'السنة' },
    { key: 'all', label: 'كل الفترات' }
  ];

  // استخدام البيانات من analytics.topCustomers مباشرة
  const customerStats = analytics?.topCustomers || [];

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

  const totalOrders = customerStats.reduce((sum, customer) => sum + (customer.orders_count || customer.orderCount || 0), 0);
  const totalRevenue = customerStats.reduce((sum, customer) => sum + (customer.total_revenue || customer.totalRevenue || 0), 0);

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
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="mr-3">جاري تحميل البيانات...</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* إحصائيات سريعة */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-blue-500 to-sky-400 rounded-lg p-4 text-white relative overflow-hidden">
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
                      key={customer.customer_phone || customer.phone || index}
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
                              <p className="font-bold text-base text-foreground">
                                {customer.customer_name || customer.label || 'زبون غير محدد'}
                              </p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {normalizePhoneNumber(customer.customer_phone || customer.phone)}
                              </p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-6 text-left">
                            <div className="text-center">
                              <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-2 mx-auto">
                                <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                              </div>
                              <p className="text-xs text-muted-foreground mb-1">عدد الطلبات</p>
                              <p className="font-bold text-lg text-blue-600 dark:text-blue-400">
                                {customer.orders_count || customer.orderCount || 0}
                              </p>
                            </div>
                            <div className="text-center">
                              <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center mb-2 mx-auto">
                                <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
                              </div>
                              <p className="text-xs text-muted-foreground mb-1">إجمالي الإيرادات</p>
                              <p className="font-bold text-lg text-green-600 dark:text-green-400">
                                {(customer.total_revenue || customer.totalRevenue || 0).toLocaleString()}
                              </p>
                            </div>
                            <div className="text-center">
                              <div className="w-14 h-14 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center mb-2 mx-auto">
                                <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                              </div>
                              <p className="text-xs text-muted-foreground mb-1">متوسط الطلب</p>
                              <p className="font-bold text-lg text-purple-600 dark:text-purple-400">
                                {customer.orders_count || customer.orderCount > 0 
                                  ? Math.round((customer.total_revenue || customer.totalRevenue || 0) / (customer.orders_count || customer.orderCount)).toLocaleString()
                                  : 0
                                }
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        {/* شريط التقدم */}
                        <div className="mt-6">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-medium text-muted-foreground">نسبة المساهمة</span>
                            <span className="text-xs font-bold text-primary">
                              {totalOrders > 0 
                                ? (((customer.orders_count || customer.orderCount || 0) / totalOrders) * 100).toFixed(1) 
                                : 0
                              }%
                            </span>
                          </div>
                          <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-500"
                              style={{ 
                                width: totalOrders > 0 
                                  ? `${((customer.orders_count || customer.orderCount || 0) / totalOrders) * 100}%` 
                                  : '0%' 
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>لا توجد بيانات زبائن متاحة حالياً</p>
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