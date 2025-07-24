import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MapPin, Calendar, Eye, TrendingUp, DollarSign, User as UserIcon } from 'lucide-react';
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

    console.log('Filtered delivered orders:', filteredOrders.length);

    // تجميع البيانات حسب المحافظة
    const provinceMap = new Map();

    filteredOrders.forEach(order => {
      // محاولة الحصول على المحافظة من عدة مصادر
      let province = null;
      
      if (order.delivery_address && typeof order.delivery_address === 'string') {
        try {
          const parsed = JSON.parse(order.delivery_address);
          province = parsed.province || parsed.city || parsed.governorate;
        } catch (e) {
          province = order.delivery_address;
        }
      } else if (order.delivery_address && typeof order.delivery_address === 'object') {
        province = order.delivery_address.province || order.delivery_address.city || order.delivery_address.governorate;
      }
      
      if (!province && order.customer_address) {
        if (typeof order.customer_address === 'string') {
          try {
            const parsed = JSON.parse(order.customer_address);
            province = parsed.province || parsed.city || parsed.governorate;
          } catch (e) {
            province = order.customer_address;
          }
        } else if (typeof order.customer_address === 'object') {
          province = order.customer_address.province || order.customer_address.city || order.customer_address.governorate;
        }
      }
      
      // محاولة الحصول على المحافظة من بيانات أخرى
      if (!province) {
        province = order.governorate || order.city || order.province || order.address || 'غير محدد';
      }
      
      console.log('Order province:', province, 'Order:', order);

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
      provinceData.customerCount.add(order.customer_phone || order.phone_number || order.customer_name);
    });

    console.log('Province map:', Array.from(provinceMap.entries()));

    // تحويل البيانات إلى مصفوفة وحساب المتوسط
    return Array.from(provinceMap.values())
      .map(province => ({
        ...province,
        customerCount: province.customerCount.size,
        avgOrderValue: province.orderCount > 0 ? province.totalRevenue / province.orderCount : 0
      }))
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, 15);
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
                  <p className="text-sm font-medium text-white/90 mb-1">عدد المحافظات</p>
                  <p className="text-3xl font-bold text-white">{provinceStats.length}</p>
                  <p className="text-xs text-white/70 mt-1">محافظة نشطة</p>
                </div>
                <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <MapPin className="w-7 h-7 text-white" />
                </div>
              </div>
            </div>
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
                    <div className="bg-gradient-to-br from-card to-card/60 hover:from-card/80 hover:to-card/40 rounded-xl p-6 border border-border/60 hover:border-primary/30 shadow-lg hover:shadow-xl transition-all duration-300 backdrop-blur-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-lg font-bold shadow-lg">
                            {index + 1}
                          </div>
                          <div>
                            <h4 className="font-bold text-lg text-foreground mb-1">{province.name}</h4>
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <UserIcon className="w-4 h-4" />
                              {province.customerCount} زبون فريد
                            </p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-6 text-left">
                          <div className="text-center">
                            <div className="w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-2 mx-auto">
                              <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <p className="text-xs text-muted-foreground mb-1">عدد الطلبات</p>
                            <p className="font-bold text-lg text-blue-600 dark:text-blue-400">{province.orderCount}</p>
                          </div>
                          <div className="text-center">
                            <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center mb-2 mx-auto">
                              <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
                            </div>
                            <p className="text-xs text-muted-foreground mb-1">إجمالي الإيرادات</p>
                            <p className="font-bold text-lg text-green-600 dark:text-green-400">
                              {province.totalRevenue.toLocaleString()}
                            </p>
                          </div>
                          <div className="text-center">
                            <div className="w-14 h-14 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center mb-2 mx-auto">
                              <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                            </div>
                            <p className="text-xs text-muted-foreground mb-1">متوسط الطلب</p>
                            <p className="font-bold text-lg text-purple-600 dark:text-purple-400">
                              {Math.round(province.avgOrderValue).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {/* شريط التقدم */}
                      <div className="mt-6">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-medium text-muted-foreground">نسبة المساهمة</span>
                          <span className="text-xs font-bold text-primary">
                            {totalOrders > 0 ? ((province.orderCount / totalOrders) * 100).toFixed(1) : 0}%
                          </span>
                        </div>
                        <div className="w-full bg-muted/50 rounded-full h-3 overflow-hidden">
                          <div 
                            className="bg-gradient-to-r from-primary to-primary/80 h-3 rounded-full transition-all duration-500 shadow-sm"
                            style={{ 
                              width: `${totalOrders > 0 ? (province.orderCount / totalOrders) * 100 : 0}%`
                            }}
                          />
                        </div>
                      </div>
                    </div>
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