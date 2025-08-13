import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  MapPin, 
  TrendingUp, 
  Users, 
  Trophy, 
  Star,
  DollarSign,
  Calendar,
  BarChart3,
  Filter,
  RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const CityStatisticsContent = ({ customers = [], orders = [] }) => {
  const [cityStats, setCityStats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [timeFilter, setTimeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('orders');

  // فترات زمنية للفلترة
  const timeRanges = [
    { value: 'all', label: 'كل الفترات', months: null },
    { value: '1month', label: 'الشهر الحالي', months: 1 },
    { value: '3months', label: '3 أشهر', months: 3 },
    { value: '6months', label: '6 أشهر', months: 6 },
    { value: '12months', label: 'السنة الحالية', months: 12 }
  ];

  const sortOptions = [
    { value: 'orders', label: 'عدد الطلبات' },
    { value: 'revenue', label: 'إجمالي المبيعات' },
    { value: 'customers', label: 'عدد العملاء' },
    { value: 'average', label: 'متوسط قيمة الطلب' }
  ];

  // جلب إحصائيات المدن من قاعدة البيانات مع فلترة المستخدم
  const fetchCityStats = async () => {
    setLoading(true);
    try {
      // استخدام البيانات الممررة من العمليات المحددة للمستخدم
      const validOrders = (orders || []).filter(order => 
        ['completed', 'delivered'].includes(order.status) && 
        order.receipt_received === true
      );

      // تطبيق الفلترة الزمنية بشكل صحيح
      let filteredOrders = validOrders;
      if (timeFilter !== 'all') {
        const range = timeRanges.find(r => r.value === timeFilter);
        if (range && range.months) {
          const now = new Date();
          const startDate = new Date();
          
          if (timeFilter === '1month') {
            // الشهر الحالي فقط
            startDate.setDate(1); // أول يوم في الشهر
            startDate.setHours(0, 0, 0, 0);
          } else {
            // باقي الفترات
            startDate.setMonth(now.getMonth() - range.months);
          }
          
          filteredOrders = validOrders.filter(order => {
            const orderDate = new Date(order.created_at);
            return orderDate >= startDate;
          });
        }
      }

      // تجميع البيانات حسب المدينة
      const cityGroups = {};
      const allUniqueCustomers = new Set(); // مجموعة شاملة للعملاء الفريدين

      filteredOrders.forEach(order => {
        const city = order.customer_city || 'غير محدد';
        const revenue = (order.total_amount || 0) - (order.delivery_fee || 0);
        
        if (!cityGroups[city]) {
          cityGroups[city] = {
            city,
            totalOrders: 0,
            totalRevenue: 0,
            uniqueCustomers: new Set(),
            averageOrderValue: 0
          };
        }

        cityGroups[city].totalOrders += 1;
        cityGroups[city].totalRevenue += revenue;
        
        // إضافة العميل للمدينة وللمجموعة الشاملة
        if (order.customer_phone) {
          cityGroups[city].uniqueCustomers.add(order.customer_phone);
          allUniqueCustomers.add(order.customer_phone); // العملاء الفريدين عالمياً
        }
      });

      // تحويل لمصفوفة وحساب المتوسطات
      const statsArray = Object.values(cityGroups).map(group => ({
        city: group.city,
        totalOrders: group.totalOrders,
        totalRevenue: group.totalRevenue,
        uniqueCustomers: group.uniqueCustomers.size, // عملاء المدينة
        averageOrderValue: group.totalOrders > 0 ? group.totalRevenue / group.totalOrders : 0
      }));

      // حفظ البيانات مع العملاء الفريدين الصحيحين
      setCityStats(statsArray.map(stat => ({
        ...stat,
        globalUniqueCustomers: allUniqueCustomers.size // العدد الصحيح للعملاء الفريدين
      })));

    } catch (error) {
      console.error('خطأ في جلب إحصائيات المدن:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCityStats();
  }, [timeFilter, orders]);  // إضافة orders كـ dependency

  // ترتيب البيانات
  const sortedStats = useMemo(() => {
    const sorted = [...cityStats].sort((a, b) => {
      switch (sortBy) {
        case 'orders':
          return b.totalOrders - a.totalOrders;
        case 'revenue':
          return b.totalRevenue - a.totalRevenue;
        case 'customers':
          return b.uniqueCustomers - a.uniqueCustomers;
        case 'average':
          return b.averageOrderValue - a.averageOrderValue;
        default:
          return b.totalOrders - a.totalOrders;
      }
    });
    return sorted;
  }, [cityStats, sortBy]);

  // إحصائيات إجمالية - حساب صحيح للعملاء الفريدين
  const totalStats = useMemo(() => {
    // حساب الإحصائيات من بيانات المدن المحسوبة مسبقاً
    const totalOrders = cityStats.reduce((acc, city) => acc + city.totalOrders, 0);
    const totalRevenue = cityStats.reduce((acc, city) => acc + city.totalRevenue, 0);
    
    // حساب العملاء الفريدين مباشرة من كل الطلبات المفلترة (بدون تجميع حسب المدن)
    const allUniqueCustomers = new Set();
    
    // جلب كل الطلبات الصالحة
    const validOrders = (orders || []).filter(order => 
      ['completed', 'delivered'].includes(order.status) && 
      order.receipt_received === true
    );

    // تطبيق الفلترة الزمنية
    let filteredOrders = validOrders;
    if (timeFilter !== 'all') {
      const range = timeRanges.find(r => r.value === timeFilter);
      if (range && range.months) {
        const now = new Date();
        const startDate = new Date();
        
        if (timeFilter === '1month') {
          startDate.setDate(1);
          startDate.setHours(0, 0, 0, 0);
        } else {
          startDate.setMonth(now.getMonth() - range.months);
        }
        
        filteredOrders = validOrders.filter(order => {
          const orderDate = new Date(order.created_at);
          return orderDate >= startDate;
        });
      }
    }

    // حساب العملاء الفريدين من كل الطلبات المفلترة مباشرة
    filteredOrders.forEach(order => {
      if (order.customer_phone) {
        // تنظيف رقم الهاتف لضمان عدم التكرار بسبب المساحات أو التنسيق
        const cleanPhone = order.customer_phone.toString().trim().replace(/\s+/g, '');
        if (cleanPhone) {
          allUniqueCustomers.add(cleanPhone);
        }
      }
    });

    return {
      totalOrders,
      totalRevenue,
      totalCustomers: allUniqueCustomers.size, // العدد الصحيح للعملاء الفريدين
      totalCities: cityStats.length
    };
  }, [cityStats, timeFilter, orders]);

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
            📊 إحصائيات المدن
          </h2>
          <p className="text-muted-foreground">
            تحليل شامل للمبيعات حسب المدن ({timeRanges.find(r => r.value === timeFilter)?.label})
          </p>
        </div>
        
        <div className="flex gap-3 w-full sm:w-auto">
          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="w-full sm:w-[180px] bg-white dark:bg-slate-800">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue>
                {timeRanges.find(r => r.value === timeFilter)?.label || "اختر الفترة"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-slate-800 border-2 rounded-xl shadow-xl z-50">
              {timeRanges.map(range => (
                <SelectItem key={range.value} value={range.value}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-[180px] bg-white dark:bg-slate-800">
              <BarChart3 className="h-4 w-4 mr-2" />
              <SelectValue>
                {sortOptions.find(o => o.value === sortBy)?.label || "ترتيب حسب"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-slate-800 border-2 rounded-xl shadow-xl z-50">
              {sortOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* إحصائيات إجمالية */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-0 bg-gradient-to-br from-blue-500 to-blue-600 text-white h-32">
            <CardContent className="p-4 h-full flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm opacity-90 mb-1">إجمالي المدن</p>
                  <p className="text-2xl font-bold">{totalStats.totalCities}</p>
                </div>
                <MapPin className="h-8 w-8 opacity-80 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-0 bg-gradient-to-br from-green-500 to-green-600 text-white h-32">
            <CardContent className="p-4 h-full flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm opacity-90 mb-1">إجمالي الطلبات</p>
                  <p className="text-2xl font-bold">{totalStats.totalOrders.toLocaleString()}</p>
                </div>
                <Trophy className="h-8 w-8 opacity-80 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-0 bg-gradient-to-br from-purple-500 to-purple-600 text-white h-32">
            <CardContent className="p-4 h-full flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm opacity-90 mb-1">إجمالي العملاء</p>
                  <p className="text-2xl font-bold">{totalStats.totalCustomers.toLocaleString()}</p>
                </div>
                <Users className="h-8 w-8 opacity-80 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="border-0 bg-gradient-to-br from-orange-500 to-orange-600 text-white h-32">
            <CardContent className="p-4 h-full flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm opacity-90 mb-1">إجمالي المبيعات</p>
                  <p className="text-2xl font-bold">{totalStats.totalRevenue.toLocaleString()} د.ع</p>
                </div>
                <DollarSign className="h-8 w-8 opacity-80 flex-shrink-0" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* قائمة المدن */}
      <Card className="border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            تفاصيل المدن - {timeRanges.find(r => r.value === timeFilter)?.label} (ترتيب حسب: {sortOptions.find(o => o.value === sortBy)?.label})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              <span>جارٍ تحميل البيانات...</span>
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence>
                {sortedStats.map((city, index) => (
                  <motion.div
                    key={city.city}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="border border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all duration-300">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                              {index + 1}
                            </div>
                            <div>
                              <h3 className="font-bold text-lg">{city.city}</h3>
                              <Badge variant="outline" className="text-xs">
                                <MapPin className="h-3 w-3 mr-1" />
                                المرتبة #{index + 1}
                              </Badge>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <p className="text-2xl font-bold text-green-600">
                              {city.totalRevenue.toLocaleString()} د.ع
                            </p>
                            <p className="text-sm text-muted-foreground">إجمالي المبيعات</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                          <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <Trophy className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                            <p className="font-bold text-blue-600">{city.totalOrders}</p>
                            <p className="text-xs text-muted-foreground">طلب</p>
                          </div>
                          
                          <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                            <Users className="h-5 w-5 text-purple-600 mx-auto mb-1" />
                            <p className="font-bold text-purple-600">{city.uniqueCustomers}</p>
                            <p className="text-xs text-muted-foreground">عميل</p>
                          </div>
                          
                          <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg col-span-2 lg:col-span-1">
                            <Star className="h-5 w-5 text-orange-600 mx-auto mb-1" />
                            <p className="font-bold text-orange-600">{Math.round(city.averageOrderValue).toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">متوسط قيمة الطلب</p>
                          </div>
                        </div>

                        {/* شريط تقدم نسبي */}
                        <div className="mt-4">
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>نسبة المبيعات</span>
                            <span>{totalStats.totalRevenue > 0 ? ((city.totalRevenue / totalStats.totalRevenue) * 100).toFixed(1) : 0}%</span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                            <div 
                              className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-1000"
                              style={{ 
                                width: totalStats.totalRevenue > 0 ? `${(city.totalRevenue / totalStats.totalRevenue) * 100}%` : '0%' 
                              }}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>

              {sortedStats.length === 0 && !loading && (
                <div className="text-center py-12">
                  <MapPin className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                    لا توجد بيانات للفترة المحددة
                  </h3>
                  <p className="text-muted-foreground">
                    جرب تغيير الفترة الزمنية لعرض المزيد من البيانات
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CityStatisticsContent;