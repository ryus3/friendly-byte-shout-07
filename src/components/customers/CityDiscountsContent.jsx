import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Loader from "@/components/ui/loader";
import { Gift, MapPin, Percent, Calendar, Award, Target, CheckCircle, Users, Truck, TrendingUp, Trophy, Sparkles, Crown } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';

const CityDiscountsContent = ({ cityDiscounts: initialCityDiscounts = [], monthlyBenefits: initialMonthlyBenefits = [], topCities: initialTopCities = [] }) => {
  const [loading, setLoading] = useState(!(initialCityDiscounts.length || initialMonthlyBenefits.length || initialTopCities.length));
  const [cityDiscounts, setCityDiscounts] = useState(initialCityDiscounts);
  const [monthlyBenefits, setMonthlyBenefits] = useState(initialMonthlyBenefits);
  const [topCities, setTopCities] = useState(initialTopCities);

  useEffect(() => {
    const fetchCityDiscountsData = async () => {
      try {
        setLoading(!(cityDiscounts.length || monthlyBenefits.length || topCities.length));
        const month = new Date().getMonth() + 1;
        const year = new Date().getFullYear();

        const { data: discounts } = await supabase
          .from('city_random_discounts')
          .select('*')
          .eq('discount_month', month)
          .eq('discount_year', year);

        const { data: benefits } = await supabase
          .from('city_monthly_benefits')
          .select('*')
          .eq('month', month)
          .eq('year', year);

        const { data: cities } = await supabase
          .from('city_order_stats')
          .select('*')
          .eq('month', month)
          .eq('year', year)
          .order('total_amount', { ascending: false })
          .limit(5);

        setCityDiscounts(discounts || []);
        setMonthlyBenefits(benefits || []);
        setTopCities(cities || []);
      } catch (e) {
        console.error('Error fetching city discounts data:', e);
      } finally {
        setLoading(false);
      }
    };

    if (!(initialCityDiscounts.length && initialMonthlyBenefits.length && initialTopCities.length)) {
      fetchCityDiscountsData();
    } else {
      setLoading(false);
    }
  }, [initialCityDiscounts, initialMonthlyBenefits, initialTopCities]);

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
        <div className="flex items-center gap-4">
          <div className="p-3 bg-white/20 rounded-full">
            <Gift className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">نظام خصومات المدن - {getCurrentMonthName()} {new Date().getFullYear()}</h2>
            <p className="text-white/90 mt-1">برنامج مكافآت شهري تلقائي للمدن الأكثر نشاطاً</p>
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

        {/* Top Performing Cities */}
        {topCities.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="border-0 shadow-xl bg-white dark:bg-slate-800">
              <CardHeader className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-t-lg">
                <CardTitle className="flex items-center gap-3">
                  <TrendingUp className="h-6 w-6" />
                  أفضل المدن أداءً هذا الشهر
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {topCities.map((city, index) => (
                    <motion.div key={city.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 * index }} className="flex items-center gap-4 p-4 bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-700 dark:to-slate-800 rounded-xl">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                        index === 0 ? 'bg-gradient-to-r from-yellow-400 to-orange-500' :
                        index === 1 ? 'bg-gradient-to-r from-gray-400 to-gray-600' :
                        index === 2 ? 'bg-gradient-to-r from-orange-400 to-red-500' :
                        'bg-gradient-to-r from-blue-400 to-purple-500'
                      }`}>{index + 1}</div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-lg">{city.city_name}</h4>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{city.total_orders} طلب</span>
                          <span>{city.total_amount?.toLocaleString()} د.ع</span>
                        </div>
                      </div>
                      {index < 3 && (
                        <Trophy className={`h-6 w-6 ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-500' : 'text-orange-500'}`} />
                      )}
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default CityDiscountsContent;
