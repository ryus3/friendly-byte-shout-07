import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Calendar, Eye, TrendingUp } from 'lucide-react';
import { useOrders } from '@/hooks/useOrders';
import { filterOrdersByPeriod } from '@/lib/dashboard-helpers';
import { motion } from 'framer-motion';

const TopProvincesDialog = ({ open, onOpenChange }) => {
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

  const provinceStats = useMemo(() => {
    if (!orders || orders.length === 0) return [];

    // فلترة الطلبات حسب الفترة المحددة والطلبات المُوصَّلة فقط
    const filteredOrders = filterOrdersByPeriod(orders, selectedPeriod)
      .filter(order => order.status === 'delivered');

    // تجميع البيانات حسب المحافظة
    const provinceMap = new Map();

    filteredOrders.forEach(order => {
      const province = order.delivery_address?.province || order.customer_address?.province || 'غير محدد';
      
      if (!provinceMap.has(province)) {
        provinceMap.set(province, {
          name: province,
          orderCount: 0,
          totalRevenue: 0,
          customerCount: new Set(),
          avgOrderValue: 0
        });
      }

      const provinceData = provinceMap.get(province);
      provinceData.orderCount += 1;
      provinceData.totalRevenue += order.total_amount || 0;
      provinceData.customerCount.add(order.customer_phone || order.phone_number);
    });

    // تحويل البيانات إلى مصفوفة وحساب المتوسط
    return Array.from(provinceMap.values())
      .map(province => ({
        ...province,
        customerCount: province.customerCount.size,
        avgOrderValue: province.orderCount > 0 ? province.totalRevenue / province.orderCount : 0
      }))
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, 10);
  }, [orders, selectedPeriod]);

  const totalOrders = provinceStats.reduce((sum, province) => sum + province.orderCount, 0);
  const totalRevenue = provinceStats.reduce((sum, province) => sum + province.totalRevenue, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-blue-500" />
            </div>
            إحصائيات المحافظات الأكثر طلباً
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
            <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-600 dark:text-blue-400">إجمالي الطلبات</p>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{totalOrders}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-800/30 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-blue-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-600 dark:text-green-400">إجمالي الإيرادات</p>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                      {totalRevenue.toLocaleString()} د.ع
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-800/30 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-green-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-purple-600 dark:text-purple-400">عدد المحافظات</p>
                    <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{provinceStats.length}</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-800/30 rounded-lg flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-purple-500" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* قائمة المحافظات */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Eye className="w-5 h-5" />
              تفاصيل المحافظات
            </h3>
            
            {provinceStats.length > 0 ? (
              <div className="grid gap-3">
                {provinceStats.map((province, index) => (
                  <motion.div
                    key={province.name}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="hover:shadow-md transition-shadow border-border/60">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                              {index + 1}
                            </div>
                            <div>
                              <h4 className="font-semibold text-foreground">{province.name}</h4>
                              <p className="text-sm text-muted-foreground">
                                {province.customerCount} زبون فريد
                              </p>
                            </div>
                          </div>
                          
                          <div className="text-left space-y-1">
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="text-sm text-muted-foreground">عدد الطلبات</p>
                                <p className="font-bold text-lg">{province.orderCount}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-muted-foreground">إجمالي الإيرادات</p>
                                <p className="font-bold text-lg text-green-600 dark:text-green-400">
                                  {province.totalRevenue.toLocaleString()} د.ع
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm text-muted-foreground">متوسط الطلب</p>
                                <p className="font-bold text-lg text-blue-600 dark:text-blue-400">
                                  {Math.round(province.avgOrderValue).toLocaleString()} د.ع
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* شريط التقدم */}
                        <div className="mt-3">
                          <div className="w-full bg-muted rounded-full h-2">
                            <div 
                              className="bg-primary h-2 rounded-full transition-all duration-300"
                              style={{ 
                                width: `${totalOrders > 0 ? (province.orderCount / totalOrders) * 100 : 0}%`
                              }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {totalOrders > 0 ? ((province.orderCount / totalOrders) * 100).toFixed(1) : 0}% من إجمالي الطلبات
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            ) : (
              <Card className="p-8">
                <div className="text-center">
                  <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">لا توجد بيانات متاحة للفترة المحددة</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TopProvincesDialog;