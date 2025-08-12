import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import Loader from "@/components/ui/loader";
import { motion, AnimatePresence } from "framer-motion";
import useOrdersAnalytics from "@/hooks/useOrdersAnalytics";
import { Users, TrendingUp, Award, Star, Crown, Diamond, Medal } from "lucide-react";
import { startOfMonth, startOfYear, subMonths, startOfWeek } from 'date-fns';

const TopCustomersDialog = ({ open, onOpenChange, employeeId }) => {
  const [selectedPeriod, setSelectedPeriod] = useState(() =>
    (typeof localStorage !== 'undefined' && localStorage.getItem('topCustomersPeriod')) || 'all'
  );
  
  const periods = [
    { key: 'all', label: 'الكل' },
    { key: 'week', label: 'أسبوع' },
    { key: 'month', label: 'شهر' },
    { key: '3months', label: '3 أشهر' },
    { key: '6months', label: '6 أشهر' },
    { key: 'year', label: 'سنة' }
  ];

  const { analytics, loading, setDateRange } = useOrdersAnalytics();
  
  // تفعيل فلترة الفترة الزمنية فعلياً عبر hook التحليلات
  const getDateRangeFor = (key) => {
    const now = new Date();
    switch (key) {
      case 'week':
        return { from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), to: now };
      case 'month':
        return { from: startOfMonth(now), to: now };
      case '3months':
        // آخر 3 أشهر تشمل الشهر الحالي + شهرين سابقين
        return { from: startOfMonth(subMonths(now, 2)), to: now };
      case '6months':
        // آخر 6 أشهر تشمل الشهر الحالي + 5 سابقة
        return { from: startOfMonth(subMonths(now, 5)), to: now };
      case 'year':
        return { from: startOfYear(now), to: now };
      default:
        return { from: null, to: null };
    }
  };

  useEffect(() => {
    try { if (typeof localStorage !== 'undefined') localStorage.setItem('topCustomersPeriod', selectedPeriod); } catch {}
    setDateRange(getDateRangeFor(selectedPeriod));
  }, [selectedPeriod, setDateRange]);

  const topCustomers = analytics?.topCustomers || [];
  const totalOrders = topCustomers.reduce((sum, c) => sum + (c.total_orders ?? c.orderCount ?? 0), 0);
  const totalRevenue = topCustomers.reduce((sum, c) => sum + (c.total_spent ?? c.totalRevenue ?? 0), 0);
  const totalCustomers = topCustomers.length;
  const getLoyaltyIcon = (rank) => {
    if (rank === 1) return <Crown className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Diamond className="h-5 w-5 text-blue-400" />;
    if (rank === 3) return <Medal className="h-5 w-5 text-orange-500" />;
    return <Star className="h-5 w-5 text-gray-400" />;
  };

  const getLoyaltyLevel = (points) => {
    if (points >= 3000) return { level: 'ماسي', color: 'bg-gradient-to-r from-cyan-400 to-blue-500', icon: <Diamond className="h-4 w-4" /> };
    if (points >= 1500) return { level: 'ذهبي', color: 'bg-gradient-to-r from-yellow-400 to-orange-500', icon: <Crown className="h-4 w-4" /> };
    if (points >= 750) return { level: 'فضي', color: 'bg-gradient-to-r from-gray-400 to-gray-600', icon: <Medal className="h-4 w-4" /> };
    return { level: 'برونزي', color: 'bg-gradient-to-r from-orange-400 to-red-500', icon: <Award className="h-4 w-4" /> };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Users className="h-6 w-6 text-primary" />
            أفضل العملاء
          </DialogTitle>
          <DialogDescription>
            تحليل مفصل لأفضل العملاء وإحصائياتهم خلال الفترة المحددة
          </DialogDescription>
        </DialogHeader>

        {/* Period Selection */}
        <div className="flex flex-wrap gap-2 mb-6">
          {periods.map((period) => (
            <Button
              key={period.key}
              variant={selectedPeriod === period.key ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedPeriod(period.key)}
              className="text-sm"
            >
              {period.label}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-0 bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm opacity-90">إجمالي الطلبات</p>
                      <p className="text-2xl font-bold">{totalOrders.toLocaleString()}</p>
                    </div>
                    <TrendingUp className="h-8 w-8 opacity-80" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 bg-gradient-to-r from-green-500 to-emerald-600 text-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm opacity-90">إجمالي المبيعات</p>
                      <p className="text-2xl font-bold">{totalRevenue.toLocaleString()} د.ع</p>
                    </div>
                    <TrendingUp className="h-8 w-8 opacity-80" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 bg-gradient-to-r from-orange-500 to-red-500 text-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm opacity-90">عدد العملاء</p>
                      <p className="text-2xl font-bold">{totalCustomers}</p>
                    </div>
                    <Users className="h-8 w-8 opacity-80" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Top Customers List */}
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              <h3 className="text-lg font-semibold text-right mb-4">قائمة أفضل العملاء</h3>
              
              <AnimatePresence>
                {topCustomers.length > 0 ? (
                  topCustomers.map((customer, index) => {
                    const rank = index + 1;
                    const loyaltyInfo = getLoyaltyLevel(customer.loyaltyPoints || 0);
                    const contribution = totalOrders > 0 ? (((customer.total_orders ?? customer.orderCount ?? 0)) / totalOrders * 100) : 0;
                    
                    return (
                      <motion.div
                        key={customer.id || index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <Card className="overflow-hidden hover:shadow-lg transition-all duration-300">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                                  {getLoyaltyIcon(rank)}
                                </div>
                                <div className="text-right">
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-semibold text-lg">{customer.name || 'عميل غير محدد'}</h4>
                                    <Badge className={`${loyaltyInfo.color} text-white border-0`}>
                                      <span className="flex items-center gap-1">
                                        {loyaltyInfo.icon}
                                        {loyaltyInfo.level}
                                      </span>
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {customer.phone || 'لا يوجد رقم'}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {customer.city || 'لا توجد مدينة'}
                                  </p>
                                </div>
                              </div>
                              
                              <div className="text-left space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-muted-foreground">الطلبات:</span>
                                  <span className="font-semibold">{customer.total_orders ?? customer.orderCount ?? 0}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-muted-foreground">المبلغ:</span>
                                  <span className="font-semibold text-green-600">
                                    {((customer.total_spent ?? customer.totalRevenue ?? 0)).toLocaleString()} د.ع
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-muted-foreground">النقاط:</span>
                                  <span className="font-semibold text-yellow-600">
                                    {customer.loyaltyPoints || 0}
                                  </span>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  مساهمة: {contribution.toFixed(1)}%
                                </div>
                              </div>
                            </div>
                            
                            {/* Progress Bar */}
                            <div className="mt-3">
                              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                <span>مساهمة في الطلبات</span>
                                <span>{contribution.toFixed(1)}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-gradient-to-r from-primary to-primary/80 h-2 rounded-full transition-all duration-500"
                                  style={{ width: `${Math.min(contribution, 100)}%` }}
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })
                ) : (
                  <Card className="text-center py-8">
                    <CardContent>
                      <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">لا توجد بيانات عملاء للفترة المحددة</p>
                    </CardContent>
                  </Card>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TopCustomersDialog;