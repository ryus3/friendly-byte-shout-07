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

  // جلب إحصائيات المدن من قاعدة البيانات
  const fetchCityStats = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('orders')
        .select(`
          customer_city,
          total_amount,
          delivery_fee,
          customer_phone,
          customer_name,
          created_at,
          status,
          receipt_received
        `)
        .in('status', ['completed', 'delivered'])
        .eq('receipt_received', true);

      // تطبيق الفلترة الزمنية
      if (timeFilter !== 'all') {
        const range = timeRanges.find(r => r.value === timeFilter);
        if (range && range.months) {
          const startDate = new Date();
          startDate.setMonth(startDate.getMonth() - range.months);
          query = query.gte('created_at', startDate.toISOString());
        }
      }

      const { data: ordersData, error } = await query;
      
      if (error) throw error;

      // تجميع البيانات حسب المدينة
      const cityGroups = {};
      const phoneCustomers = new Set();

      ordersData.forEach(order => {
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
        
        if (order.customer_phone) {
          cityGroups[city].uniqueCustomers.add(order.customer_phone);
        }
      });

      // تحويل لمصفوفة وحساب المتوسطات
      const statsArray = Object.values(cityGroups).map(group => ({
        city: group.city,
        totalOrders: group.totalOrders,
        totalRevenue: group.totalRevenue,
        uniqueCustomers: group.uniqueCustomers.size,
        averageOrderValue: group.totalOrders > 0 ? group.totalRevenue / group.totalOrders : 0
      }));

      setCityStats(statsArray);
    } catch (error) {
      console.error('خطأ في جلب إحصائيات المدن:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCityStats();
  }, [timeFilter]);

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

  // إحصائيات إجمالية
  const totalStats = useMemo(() => {
    return cityStats.reduce((acc, city) => ({
      totalOrders: acc.totalOrders + city.totalOrders,
      totalRevenue: acc.totalRevenue + city.totalRevenue,
      totalCustomers: acc.totalCustomers + city.uniqueCustomers,
      totalCities: cityStats.length
    }), { totalOrders: 0, totalRevenue: 0, totalCustomers: 0, totalCities: 0 });
  }, [cityStats]);

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
            📊 إحصائيات المدن
          </h2>
          <p className="text-muted-foreground">
            تحليل شامل للمبيعات حسب المدن مع فلترة زمنية متقدمة
          </p>
        </div>
        
        <div className="flex gap-3 w-full sm:w-auto">
          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="اختر الفترة" />
            </SelectTrigger>
            <SelectContent>
              {timeRanges.map(range => (
                <SelectItem key={range.value} value={range.value}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <BarChart3 className="h-4 w-4 mr-2" />
              <SelectValue placeholder="ترتيب حسب" />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button 
            onClick={fetchCityStats} 
            disabled={loading}
            variant="outline"
            size="icon"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* إحصائيات إجمالية */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-0 bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">إجمالي المدن</p>
                  <p className="text-2xl font-bold">{totalStats.totalCities}</p>
                </div>
                <MapPin className="h-8 w-8 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-0 bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">إجمالي الطلبات</p>
                  <p className="text-2xl font-bold">{totalStats.totalOrders.toLocaleString()}</p>
                </div>
                <Trophy className="h-8 w-8 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-0 bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">إجمالي العملاء</p>
                  <p className="text-2xl font-bold">{totalStats.totalCustomers.toLocaleString()}</p>
                </div>
                <Users className="h-8 w-8 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="border-0 bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90">إجمالي المبيعات</p>
                  <p className="text-2xl font-bold">{totalStats.totalRevenue.toLocaleString()} د.ع</p>
                </div>
                <DollarSign className="h-8 w-8 opacity-80" />
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
            تفاصيل المدن ({timeRanges.find(r => r.value === timeFilter)?.label})
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