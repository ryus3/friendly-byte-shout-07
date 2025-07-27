import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  MapPin, 
  TrendingUp, 
  BarChart3, 
  Users, 
  Calendar,
  Star,
  Trophy,
  DollarSign,
  ShoppingBag,
  Sparkles,
  Crown,
  Activity,
  Target
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';

const TopProvincesDialog = ({ trigger, isOpen, onOpenChange }) => {
  const [loading, setLoading] = useState(false);
  const [provinceStats, setProvinceStats] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [totalStats, setTotalStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    totalProvinces: 0,
    avgOrderValue: 0,
    topPerformer: null
  });

  const periods = [
    { value: 'week', label: 'هذا الأسبوع', icon: Calendar },
    { value: 'month', label: 'هذا الشهر', icon: BarChart3 },
    { value: 'quarter', label: 'هذا الربع', icon: TrendingUp },
    { value: 'year', label: 'هذا العام', icon: Star }
  ];

  const fetchProvinceData = async () => {
    if (!isOpen) return;
    
    setLoading(true);
    try {
      let dateFilter = '';
      const now = new Date();
      
      switch (selectedPeriod) {
        case 'week':
          const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
          dateFilter = `created_at >= '${weekStart.toISOString()}'`;
          break;
        case 'month':
          dateFilter = `EXTRACT(MONTH FROM created_at) = ${new Date().getMonth() + 1} AND EXTRACT(YEAR FROM created_at) = ${new Date().getFullYear()}`;
          break;
        case 'quarter':
          const quarter = Math.ceil((new Date().getMonth() + 1) / 3);
          const quarterStart = (quarter - 1) * 3 + 1;
          dateFilter = `EXTRACT(MONTH FROM created_at) >= ${quarterStart} AND EXTRACT(MONTH FROM created_at) <= ${quarterStart + 2} AND EXTRACT(YEAR FROM created_at) = ${new Date().getFullYear()}`;
          break;
        case 'year':
          dateFilter = `EXTRACT(YEAR FROM created_at) = ${new Date().getFullYear()}`;
          break;
      }

      // جلب البيانات الخام من جدول الطلبات مباشرة لضمان الدقة
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select(`
          customer_province,
          customer_city,
          final_amount,
          status,
          created_at
        `)
        .in('status', ['completed', 'delivered'])
        .not('customer_province', 'is', null)
        .neq('customer_province', '')
        .gte('created_at', getDateRange(selectedPeriod).start)
        .lte('created_at', getDateRange(selectedPeriod).end);

      if (error) throw error;

      // معالجة البيانات وتجميعها حسب المحافظة
      const provinceMap = {};
      let totalOrders = 0;
      let totalRevenue = 0;

      ordersData?.forEach(order => {
        const province = order.customer_province;
        if (!provinceMap[province]) {
          provinceMap[province] = {
            province_name: province,
            total_orders: 0,
            total_amount: 0,
            cities: new Set(),
            avg_order_value: 0
          };
        }
        
        provinceMap[province].total_orders += 1;
        provinceMap[province].total_amount += parseFloat(order.final_amount || 0);
        if (order.customer_city) {
          provinceMap[province].cities.add(order.customer_city);
        }
        
        totalOrders += 1;
        totalRevenue += parseFloat(order.final_amount || 0);
      });

      // تحويل إلى مصفوفة وحساب متوسط قيمة الطلب
      const statsArray = Object.values(provinceMap).map(province => ({
        ...province,
        cities_count: province.cities.size,
        avg_order_value: province.total_orders > 0 ? province.total_amount / province.total_orders : 0,
        market_share: totalOrders > 0 ? (province.total_orders / totalOrders) * 100 : 0
      }));

      // ترتيب حسب عدد الطلبات
      statsArray.sort((a, b) => b.total_orders - a.total_orders);

      setProvinceStats(statsArray.slice(0, 10)); // أفضل 10 محافظات
      
      // إحصائيات إجمالية
      setTotalStats({
        totalOrders,
        totalRevenue,
        totalProvinces: statsArray.length,
        avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        topPerformer: statsArray[0] || null
      });

    } catch (error) {
      console.error('خطأ في جلب بيانات المحافظات:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDateRange = (period) => {
    const now = new Date();
    let start, end = now;

    switch (period) {
      case 'week':
        start = new Date(now.setDate(now.getDate() - now.getDay()));
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        const quarter = Math.ceil((now.getMonth() + 1) / 3);
        start = new Date(now.getFullYear(), (quarter - 1) * 3, 1);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return { start: start.toISOString(), end: end.toISOString() };
  };

  useEffect(() => {
    fetchProvinceData();
  }, [isOpen, selectedPeriod]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ar-IQ').format(amount) + ' د.ع';
  };

  const getRankIcon = (index) => {
    switch (index) {
      case 0: return <Crown className="h-5 w-5 text-yellow-500" />;
      case 1: return <Trophy className="h-5 w-5 text-gray-400" />;
      case 2: return <Star className="h-5 w-5 text-amber-600" />;
      default: return <Target className="h-4 w-4 text-blue-500" />;
    }
  };

  const getRankGradient = (index) => {
    switch (index) {
      case 0: return 'from-yellow-400 via-yellow-500 to-yellow-600';
      case 1: return 'from-gray-300 via-gray-400 to-gray-500';
      case 2: return 'from-amber-500 via-amber-600 to-amber-700';
      default: return 'from-blue-400 via-blue-500 to-blue-600';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden">
        <DialogHeader className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white p-8 -m-6 mb-6 rounded-t-lg">
          <div className="relative z-10">
            <DialogTitle className="text-3xl font-bold mb-2 flex items-center gap-3">
              <motion.div
                className="p-3 bg-white/20 rounded-xl backdrop-blur-sm"
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ duration: 0.3 }}
              >
                <MapPin className="h-8 w-8" />
              </motion.div>
              تحليل أداء المحافظات العراقية
            </DialogTitle>
            <p className="text-blue-100 text-lg">
              تقرير شامل ومفصل لأداء المبيعات والطلبات في جميع المحافظات
            </p>
          </div>
          
          {/* عناصر تزيينية */}
          <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full animate-pulse" />
          <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-purple-400/20 rounded-full animate-pulse delay-1000" />
          <div className="absolute top-1/2 right-1/4 w-16 h-16 bg-pink-300/20 rounded-full animate-pulse delay-500" />
          
          {/* شعاع ضوئي */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
        </DialogHeader>

        <div className="space-y-8">
          {/* فلاتر الفترة الزمنية */}
          <div className="flex flex-wrap gap-3 justify-center">
            {periods.map((period) => (
              <motion.button
                key={period.value}
                onClick={() => setSelectedPeriod(period.value)}
                className={`
                  relative overflow-hidden px-6 py-3 rounded-xl font-medium transition-all duration-300
                  flex items-center gap-2 shadow-lg hover:shadow-xl
                  ${selectedPeriod === period.value
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-indigo-500/25'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }
                `}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
              >
                <period.icon className="h-4 w-4" />
                {period.label}
                {selectedPeriod === period.value && (
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent"
                    initial={{ x: '-100%' }}
                    animate={{ x: '100%' }}
                    transition={{ duration: 1, repeat: Infinity, repeatDelay: 2 }}
                  />
                )}
              </motion.button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <motion.div
                className="flex flex-col items-center gap-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <motion.div
                  className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
                <motion.p 
                  className="text-slate-600 dark:text-slate-400 text-lg font-medium"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  جاري تحليل البيانات وحساب الإحصائيات...
                </motion.p>
              </motion.div>
            </div>
          ) : (
            <>
              {/* الإحصائيات الإجمالية */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="grid grid-cols-2 md:grid-cols-4 gap-6"
              >
                <Card className="relative overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/30 border-blue-200/50 dark:border-blue-800/50">
                  <CardContent className="p-6 text-center">
                    <motion.div
                      className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg"
                      whileHover={{ scale: 1.1, rotate: 5 }}
                    >
                      <ShoppingBag className="h-6 w-6 text-white" />
                    </motion.div>
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                      {totalStats.totalOrders.toLocaleString('ar')}
                    </div>
                    <div className="text-sm text-blue-700 dark:text-blue-300 font-medium">إجمالي الطلبات</div>
                  </CardContent>
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-400/30 rounded-full animate-pulse" />
                </Card>

                <Card className="relative overflow-hidden bg-gradient-to-br from-emerald-50 to-green-100 dark:from-emerald-900/20 dark:to-green-900/30 border-emerald-200/50 dark:border-emerald-800/50">
                  <CardContent className="p-6 text-center">
                    <motion.div
                      className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg"
                      whileHover={{ scale: 1.1, rotate: 5 }}
                    >
                      <DollarSign className="h-6 w-6 text-white" />
                    </motion.div>
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mb-1">
                      {formatCurrency(totalStats.totalRevenue)}
                    </div>
                    <div className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">إجمالي المبيعات</div>
                  </CardContent>
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-emerald-400/30 rounded-full animate-pulse" />
                </Card>

                <Card className="relative overflow-hidden bg-gradient-to-br from-purple-50 to-violet-100 dark:from-purple-900/20 dark:to-violet-900/30 border-purple-200/50 dark:border-purple-800/50">
                  <CardContent className="p-6 text-center">
                    <motion.div
                      className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg"
                      whileHover={{ scale: 1.1, rotate: 5 }}
                    >
                      <MapPin className="h-6 w-6 text-white" />
                    </motion.div>
                    <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-1">
                      {totalStats.totalProvinces}
                    </div>
                    <div className="text-sm text-purple-700 dark:text-purple-300 font-medium">محافظة نشطة</div>
                  </CardContent>
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-purple-400/30 rounded-full animate-pulse" />
                </Card>

                <Card className="relative overflow-hidden bg-gradient-to-br from-orange-50 to-red-100 dark:from-orange-900/20 dark:to-red-900/30 border-orange-200/50 dark:border-orange-800/50">
                  <CardContent className="p-6 text-center">
                    <motion.div
                      className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg"
                      whileHover={{ scale: 1.1, rotate: 5 }}
                    >
                      <Activity className="h-6 w-6 text-white" />
                    </motion.div>
                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-400 mb-1">
                      {formatCurrency(totalStats.avgOrderValue)}
                    </div>
                    <div className="text-sm text-orange-700 dark:text-orange-300 font-medium">متوسط قيمة الطلب</div>
                  </CardContent>
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-orange-400/30 rounded-full animate-pulse" />
                </Card>
              </motion.div>

              {/* قائمة المحافظات */}
              {provinceStats.length > 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                  <AnimatePresence>
                    {provinceStats.map((province, index) => (
                      <motion.div
                        key={province.province_name}
                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.9 }}
                        transition={{ 
                          duration: 0.5, 
                          delay: index * 0.1,
                          type: "spring",
                          stiffness: 100 
                        }}
                        className="group"
                      >
                        {/* شريط الترتيب العلوي */}
                        <div className={`w-full h-1 bg-gradient-to-r ${getRankGradient(index)} rounded-t-xl`} />
                        
                        <Card className="relative overflow-hidden bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-500 hover:scale-[1.02] hover:-translate-y-2 rounded-t-none">
                          <CardContent className="p-6">
                            {/* ترويسة المحافظة */}
                            <div className="flex items-center justify-between mb-6">
                              <div className="flex items-center gap-3">
                                <motion.div
                                  className={`p-3 rounded-xl shadow-lg bg-gradient-to-br ${getRankGradient(index)}`}
                                  whileHover={{ scale: 1.1, rotate: 10 }}
                                  transition={{ duration: 0.3 }}
                                >
                                  {getRankIcon(index)}
                                </motion.div>
                                <div>
                                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-1">
                                    {province.province_name}
                                  </h3>
                                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                    <TrendingUp className="h-4 w-4" />
                                    <span>المرتبة #{index + 1}</span>
                                    <span className="w-1 h-1 bg-slate-400 rounded-full" />
                                    <span>{province.cities_count} مدينة</span>
                                  </div>
                                </div>
                              </div>
                              
                              <Badge className={`bg-gradient-to-r ${getRankGradient(index)} text-white border-0 px-3 py-1 text-sm font-bold shadow-lg`}>
                                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅'}
                              </Badge>
                            </div>

                            {/* الإحصائيات */}
                            <div className="grid grid-cols-2 gap-4 mb-4">
                              <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/30 rounded-lg border border-blue-200/30 dark:border-blue-800/30">
                                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                                  {province.total_orders}
                                </div>
                                <div className="text-xs text-blue-700 dark:text-blue-300 font-medium">طلب مكتمل</div>
                              </div>
                              
                              <div className="text-center p-4 bg-gradient-to-br from-emerald-50 to-green-100 dark:from-emerald-900/20 dark:to-green-900/30 rounded-lg border border-emerald-200/30 dark:border-emerald-800/30">
                                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mb-1 truncate" title={formatCurrency(province.total_amount)}>
                                  {formatCurrency(province.total_amount)}
                                </div>
                                <div className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">إجمالي المبيعات</div>
                              </div>
                            </div>

                            {/* معلومات إضافية */}
                            <div className="space-y-3">
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-600 dark:text-slate-400">متوسط قيمة الطلب:</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                  {formatCurrency(province.avg_order_value)}
                                </span>
                              </div>
                              
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-600 dark:text-slate-400">نصيب السوق:</span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                  {province.market_share.toFixed(1)}%
                                </span>
                              </div>
                            </div>

                            {/* مؤشر الأداء */}
                            <div className="mt-4">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-xs text-slate-600 dark:text-slate-400">مؤشر الأداء</span>
                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                  {Math.min((province.total_orders / (provinceStats[0]?.total_orders || 1)) * 100, 100).toFixed(0)}%
                                </span>
                              </div>
                              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                                <motion.div
                                  className={`h-full bg-gradient-to-r ${getRankGradient(index)}`}
                                  initial={{ width: 0 }}
                                  animate={{ 
                                    width: `${Math.min((province.total_orders / (provinceStats[0]?.total_orders || 1)) * 100, 100)}%` 
                                  }}
                                  transition={{ duration: 1.5, delay: index * 0.1, ease: "easeOut" }}
                                />
                              </div>
                            </div>

                            {/* تأثيرات بصرية */}
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-400/20 rounded-full animate-pulse" />
                            <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-purple-400/20 rounded-full animate-ping" />
                            
                            {/* تأثير ضوئي عند التمرير */}
                            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  className="text-center py-16"
                >
                  <motion.div
                    className="w-32 h-32 mx-auto mb-6 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-full flex items-center justify-center shadow-xl"
                    animate={{ 
                      y: [0, -10, 0],
                      rotate: [0, 5, -5, 0]
                    }}
                    transition={{ 
                      duration: 4, 
                      repeat: Infinity, 
                      ease: "easeInOut" 
                    }}
                  >
                    <MapPin className="h-16 w-16 text-slate-400 dark:text-slate-500" />
                  </motion.div>
                  <motion.h3 
                    className="text-2xl font-bold text-slate-700 dark:text-slate-300 mb-3"
                    animate={{ opacity: [0.7, 1, 0.7] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    لا توجد بيانات متاحة
                  </motion.h3>
                  <p className="text-slate-500 dark:text-slate-400 text-lg">
                    لم يتم العثور على طلبات مكتملة في الفترة المحددة
                  </p>
                </motion.div>
              )}

              {/* شرح تفصيلي */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="mt-8 p-6 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900/50 dark:to-blue-900/20 rounded-xl border border-slate-200/50 dark:border-slate-700/50"
              >
                <div className="flex items-center gap-3 mb-4">
                  <motion.div
                    className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-lg"
                    whileHover={{ scale: 1.1, rotate: 5 }}
                  >
                    <Sparkles className="h-5 w-5 text-white" />
                  </motion.div>
                  <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200">معلومات مهمة حول التقرير</h4>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4 text-sm text-slate-600 dark:text-slate-400">
                  <div className="space-y-2">
                    <p>• <strong>البيانات المعروضة:</strong> تشمل الطلبات المكتملة والمُسلّمة فقط</p>
                    <p>• <strong>الحسابات:</strong> يتم حساب الأرقام مباشرة من قاعدة البيانات لضمان الدقة</p>
                    <p>• <strong>المحافظات:</strong> مرتبة حسب عدد الطلبات من الأعلى للأقل</p>
                  </div>
                  <div className="space-y-2">
                    <p>• <strong>متوسط قيمة الطلب:</strong> إجمالي المبيعات ÷ عدد الطلبات</p>
                    <p>• <strong>نصيب السوق:</strong> نسبة طلبات المحافظة من إجمالي الطلبات</p>
                    <p>• <strong>التحديث:</strong> البيانات محدثة لحظياً ومطابقة لسجلات النظام</p>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TopProvincesDialog;