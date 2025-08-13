import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Loader from "@/components/ui/loader";
import { Gift, MapPin, Percent, Calendar, Award, Target, CheckCircle, Users, Truck, TrendingUp, Trophy, Sparkles, Crown, RefreshCw, BarChart3 } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { useSuper } from "@/contexts/SuperProvider";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/UnifiedAuthContext";
import { normalizePhone, extractOrderPhone } from "@/utils/phoneUtils";

const CityDiscountsContent = ({ cityDiscounts: initialCityDiscounts = [], monthlyBenefits: initialMonthlyBenefits = [], topCities: initialTopCities = [] }) => {
  // استخدام البيانات الموحدة
  const { orders: allOrders, loading: systemLoading } = useSuper();
  const { user } = usePermissions();
  const { user: authUser } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [timeFilter, setTimeFilter] = useState('current_month');
  const [cityDiscounts, setCityDiscounts] = useState(initialCityDiscounts);
  const [monthlyBenefits, setMonthlyBenefits] = useState(initialMonthlyBenefits);

  
  // المستخدم الحالي
  const currentUserId = authUser?.user_id || authUser?.id || user?.user_id || user?.id || null;

  // فترات زمنية للفلترة
  const timeRanges = [
    { value: 'current_month', label: 'الشهر الحالي', months: 0 },
    { value: '1month', label: 'الشهر الماضي', months: 1 },
    { value: '3months', label: '3 أشهر', months: 3 },
    { value: '6months', label: '6 أشهر', months: 6 },
    { value: '12months', label: 'السنة الحالية', months: 12 }
  ];

  // فلترة الطلبات للمستخدم الحالي
  const filterOrdersByCurrentUser = (orders) => {
    if (!orders || !currentUserId) return [];
    return orders.filter(order => 
      (order.created_by && order.created_by === currentUserId) || 
      (order.user_id && order.user_id === currentUserId)
    );
  };

  // حساب أفضل المدن من البيانات الموحدة
  const calculateTopCities = useMemo(() => {
    if (!allOrders) return [];

    // فلترة الطلبات للمستخدم الحالي
    const eligibleOrders = (allOrders || []).filter(order => 
      ['completed', 'delivered'].includes(order.status) && 
      order.receipt_received === true
    );
    
    const eligibleOrdersByUser = filterOrdersByCurrentUser(eligibleOrders);

    // تطبيق الفلترة الزمنية
    let filteredOrders = eligibleOrdersByUser;
    if (timeFilter !== 'current_month') {
      const range = timeRanges.find(r => r.value === timeFilter);
      if (range && range.months > 0) {
        const now = new Date();
        const startDate = new Date();
        startDate.setMonth(now.getMonth() - range.months);
        
        filteredOrders = eligibleOrdersByUser.filter(order => {
          const orderDate = new Date(order.created_at);
          return orderDate >= startDate;
        });
      }
    } else {
      // الشهر الحالي فقط
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      
      filteredOrders = eligibleOrdersByUser.filter(order => {
        const orderDate = new Date(order.created_at);
        return orderDate >= startDate;
      });
    }

    // تجميع البيانات حسب المدينة
    const cityGroups = {};
    filteredOrders.forEach(order => {
      const city = order.customer_city || 'غير محدد';
      const revenue = (order.total_amount || 0) - (order.delivery_fee || 0);
      
      if (!cityGroups[city]) {
        cityGroups[city] = {
          city_name: city,
          total_orders: 0,
          total_amount: 0,
          unique_customers: new Set()
        };
      }

      cityGroups[city].total_orders += 1;
      cityGroups[city].total_amount += revenue;
      
      const phone = extractOrderPhone(order);
      if (phone) {
        const normalizedPhone = normalizePhone(phone);
        if (normalizedPhone) {
          cityGroups[city].unique_customers.add(normalizedPhone);
        }
      }
    });

    // تحويل لمصفوفة وترتيب
    return Object.values(cityGroups)
      .map(group => ({
        ...group,
        unique_customers: group.unique_customers.size
      }))
      .sort((a, b) => b.total_amount - a.total_amount)
      .slice(0, 5);
  }, [allOrders, timeFilter, currentUserId]);

  const getCurrentMonthName = () => {
    const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
    return months[new Date().getMonth()];
  };

  if (loading && !(cityDiscounts.length || monthlyBenefits.length || topCities.length)) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader />
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 rounded-xl overflow-hidden">
      <div className="p-6 border-b bg-gradient-to-r from-orange-500 to-red-500 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-full">
              <Gift className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">نظام خصومات المدن - {getCurrentMonthName()} {new Date().getFullYear()}</h2>
              <p className="text-white/90 mt-1">برنامج مكافآت شهري تلقائي للمدن الأكثر نشاطاً</p>
            </div>
          </div>
          
          <div className="flex gap-3">
            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger className="w-[200px] bg-white/20 border-white/30 text-white">
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
          </div>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* System Explanation */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-0 bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-3">
                <Target className="h-6 w-6" />
                كيف يعمل النظام؟
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3"><CheckCircle className="h-5 w-5 mt-0.5 text-cyan-200" /><p className="text-sm">يختار النظام تلقائياً أفضل مدينة مبيعات كل شهر</p></div>
              <div className="flex items-start gap-3"><CheckCircle className="h-5 w-5 mt-0.5 text-cyan-200" /><p className="text-sm">عميل واحد يحصل على توصيل مجاني للطلبات الجديدة</p></div>
              <div className="flex items-start gap-3"><CheckCircle className="h-5 w-5 mt-0.5 text-cyan-200" /><p className="text-sm">عميل آخر يحصل على خصم 5% + توصيل مجاني</p></div>
              <div className="flex items-start gap-3"><CheckCircle className="h-5 w-5 mt-0.5 text-cyan-200" /><p className="text-sm">الاختيار عشوائي ويتجدد شهرياً</p></div>
            </CardContent>
          </Card>

          <Card className="border-0 bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-3">
                <Award className="h-6 w-6" />
                فوائد النظام
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3"><Sparkles className="h-5 w-5 mt-0.5 text-pink-200" /><p className="text-sm">تحفيز العملاء في المدن النشطة</p></div>
              <div className="flex items-start gap-3"><Sparkles className="h-5 w-5 mt-0.5 text-pink-200" /><p className="text-sm">زيادة ولاء العملاء ورضاهم</p></div>
              <div className="flex items-start gap-3"><Sparkles className="h-5 w-5 mt-0.5 text-pink-200" /><p className="text-sm">تعزيز المبيعات في المناطق المتميزة</p></div>
              <div className="flex items-start gap-3"><Sparkles className="h-5 w-5 mt-0.5 text-pink-200" /><p className="text-sm">نظام مكافآت عادل ومتجدد</p></div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Current Month's Discounts */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-0 shadow-xl bg-white dark:bg-slate-800">
            <CardHeader className="bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-t-lg">
              <CardTitle className="flex items-center gap-3">
                <Crown className="h-6 w-6" />
                المدن المختارة هذا الشهر
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {cityDiscounts.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {cityDiscounts.map((discount, index) => (
                    <motion.div key={discount.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 * index }} className="group">
                      <Card className="border-2 border-orange-200 hover:border-orange-400 transition-all duration-300 bg-gradient-to-br from-orange-50 to-red-50 dark:from-slate-700 dark:to-slate-800">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-gradient-to-r from-orange-500 to-red-500 rounded-full text-white">
                              <MapPin className="h-6 w-6" />
                            </div>
                            <div>
                              <h3 className="text-xl font-bold text-orange-800 dark:text-orange-200">{discount.city_name}</h3>
                              <p className="text-sm text-muted-foreground">مدينة متميزة لشهر {getCurrentMonthName()}</p>
                            </div>
                          </div>
                          <div className="space-y-3">
                            <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white border-0 w-full justify-center py-2">
                              <Percent className="h-4 w-4 mr-2" />
                              خصم {discount.discount_percentage}% {discount.include_free_delivery ? '+ توصيل مجاني' : ''}
                            </Badge>
                            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="h-4 w-4" />
                              ساري حتى نهاية الشهر
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Gift className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold text-muted-foreground mb-2">لم يتم اختيار مدن بعد</h3>
                  <p className="text-sm text-muted-foreground">سيتم اختيار المدن المتميزة تلقائياً في بداية الشهر</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Monthly Benefits */}
        {monthlyBenefits.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="border-0 shadow-xl bg-white dark:bg-slate-800">
              <CardHeader className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-t-lg">
                <CardTitle className="flex items-center gap-3">
                  <Truck className="h-6 w-6" />
                  المزايا الشهرية النشطة
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {monthlyBenefits.map((benefit, index) => (
                    <motion.div key={benefit.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * index }}>
                      <Card className="border-2 border-cyan-200 hover:border-cyan-400 transition-all duration-300">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg text-white"><Users className="h-4 w-4" /></div>
                            <div>
                              <h4 className="font-semibold">{benefit.city_name}</h4>
                              <p className="text-xs text-muted-foreground">{benefit.benefit_type === 'free_delivery' ? 'توصيل مجاني' : 'خصم + توصيل'}</p>
                            </div>
                          </div>
                          <Badge className={`w-full justify-center py-1 ${benefit.benefit_type === 'free_delivery' ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gradient-to-r from-orange-500 to-red-500'} text-white border-0`}>
                            {benefit.benefit_type === 'free_delivery' ? 'توصيل مجاني' : `خصم ${benefit.benefit_value || 5}% + توصيل`}
                          </Badge>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Top Performing Cities - من البيانات الموحدة */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="border-0 shadow-xl bg-white dark:bg-slate-800">
            <CardHeader className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-t-lg">
              <CardTitle className="flex items-center gap-3">
                <TrendingUp className="h-6 w-6" />
                أفضل المدن أداءً - {timeRanges.find(r => r.value === timeFilter)?.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {(systemLoading || loading) ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                  <span>جارٍ تحميل البيانات...</span>
                </div>
              ) : calculateTopCities.length > 0 ? (
                <div className="space-y-4">
                  {calculateTopCities.map((city, index) => (
                    <motion.div key={`${city.city_name}-${index}`} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 * index }} className="flex items-center gap-4 p-4 bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-700 dark:to-slate-800 rounded-xl">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
                        index === 0 ? 'bg-gradient-to-r from-yellow-400 to-orange-500' :
                        index === 1 ? 'bg-gradient-to-r from-gray-400 to-gray-600' :
                        index === 2 ? 'bg-gradient-to-r from-orange-400 to-red-500' :
                        'bg-gradient-to-r from-blue-400 to-purple-500'
                      }`}>{index + 1}</div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-lg">{city.city_name}</h4>
                        <div className="flex items-center gap-6 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Trophy className="h-4 w-4" />
                            {city.total_orders} طلب
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {city.unique_customers} عميل
                          </span>
                          <span className="flex items-center gap-1">
                            <BarChart3 className="h-4 w-4" />
                            {city.total_amount?.toLocaleString()} د.ع
                          </span>
                        </div>
                      </div>
                      {index < 3 && (
                        <Trophy className={`h-8 w-8 ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-500' : 'text-orange-500'}`} />
                      )}
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <TrendingUp className="h-16 w-16 mx-auto text-muted-foreground mb-4 opacity-50" />
                  <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                    لا توجد بيانات للفترة المحددة
                  </h3>
                  <p className="text-muted-foreground">
                    جرب تغيير الفترة الزمنية لعرض المزيد من البيانات
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default CityDiscountsContent;
