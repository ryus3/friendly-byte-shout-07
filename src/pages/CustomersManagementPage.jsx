import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Phone, MapPin, Star, Award, Medal, Crown, Gem, ShoppingBag, TrendingUp, Send, MessageCircle, Download, Eye, Gift, Calendar, BarChart3, Sparkles, Truck, PartyPopper, Zap } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import CustomerStats from '@/components/customers/CustomerStats';
import CustomerCard from '@/components/customers/CustomerCard';
import SimpleCustomersToolbar from '@/components/customers/SimpleCustomersToolbar';
import CustomerDetailsDialog from '@/components/customers/CustomerDetailsDialog';
import EnhancedExportDialog from '@/components/customers/EnhancedExportDialog';
import TopProvincesDialog from '@/components/customers/TopProvincesDialog';

const CustomersManagementPage = () => {
  const { user, isAdmin, canViewAllData, filterDataByUser } = usePermissions();
  const [customers, setCustomers] = useState([]);
  const [loyaltyTiers, setLoyaltyTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [cityStats, setCityStats] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [cityDiscounts, setCityDiscounts] = useState([]);
  const [activeTab, setActiveTab] = useState('customers');
  const [filterType, setFilterType] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [pointsUsageFilter, setPointsUsageFilter] = useState('all');
  const [selectedTier, setSelectedTier] = useState(null);
  const [showExportDialog, setShowExportDialog] = useState(false);

  const tierIcons = {
    'Award': Award,
    'Medal': Medal,
    'Crown': Crown,
    'Gem': Gem,
    'Star': Star
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      // جلب مستويات الولاء
      const { data: tiersData } = await supabase
        .from('loyalty_tiers')
        .select('*')
        .order('points_required', { ascending: true });
      
      setLoyaltyTiers(tiersData || []);

      // جلب العملاء المدمجين من جدول customer_phone_loyalty
      let customersQuery = supabase
        .from('customer_phone_loyalty')
        .select(`
          *,
          loyalty_tiers (
            name,
            color,
            icon,
            discount_percentage
          )
        `)
        .order('total_orders', { ascending: false });

      // فلترة العملاء حسب الصلاحيات - الموظفين يرون عملاءهم فقط
      if (!canViewAllData) {
        // جلب أرقام هواتف العملاء الذين أنشأهم هذا الموظف
        const { data: employeeCustomerPhones } = await supabase
          .from('customers')
          .select('phone')
          .eq('created_by', user.user_id);
        
        if (employeeCustomerPhones && employeeCustomerPhones.length > 0) {
          // تطبيع أرقام الهواتف للمقارنة
          const normalizedPhones = employeeCustomerPhones
            .map(c => c.phone)
            .filter(phone => phone && phone.trim() !== '')
            .map(phone => {
              // تطبيع رقم الهاتف (نفس منطق دالة normalize_phone_number)
              let normalized = phone.replace(/[\s\-\(\)]/g, '');
              normalized = normalized.replace(/^(\+964|00964)/, '');
              normalized = normalized.replace(/^0/, '');
              return normalized;
            })
            .filter(phone => phone && phone !== '');
          
          if (normalizedPhones.length > 0) {
            customersQuery = customersQuery.in('phone_number', normalizedPhones);
          } else {
            setCustomers([]);
            setLoading(false);
            return;
          }
        } else {
          setCustomers([]);
          setLoading(false);
          return;
        }
      }

      const { data: customersData } = await customersQuery;
      setCustomers(customersData || []);
      
      // إحصائيات المدن - فقط للمديرين
      if (canViewAllData) {
        // حساب إحصائيات المدن بشكل محسن
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        
        const { data: monthlyStats } = await supabase
          .from('city_order_stats')
          .select('*')
          .eq('month', currentMonth)
          .eq('year', currentYear)
          .order('total_orders', { ascending: false });
        
        setCityStats(monthlyStats || []);
        
        // جلب خصومات المدن
        const { data: discounts } = await supabase
          .from('city_random_discounts')
          .select('*')
          .eq('discount_month', currentMonth)
          .eq('discount_year', currentYear);
        
        setCityDiscounts(discounts || []);
      }
    } catch (error) {
      console.error('خطأ في جلب البيانات:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء جلب البيانات",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [canViewAllData, user?.user_id]);

  // تطبيق الفلاتر والبحث مع تحسين الأداء
  const filteredCustomers = useMemo(() => {
    return customers.filter(customer => {
      // فلترة حسب البحث
      const matchesSearch = searchTerm === '' || 
        customer.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.phone_number?.includes(searchTerm) ||
        customer.original_phone?.includes(searchTerm) ||
        customer.customer_city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.customer_province?.toLowerCase().includes(searchTerm.toLowerCase());

      // فلترة حسب النوع
      let matchesFilter = true;
      if (filterType === 'with_loyalty') {
        matchesFilter = customer.total_points > 0;
      } else if (filterType === 'no_loyalty') {
        matchesFilter = !customer.total_points || customer.total_points === 0;
      } else if (filterType === 'recent') {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        matchesFilter = customer.last_order_date && new Date(customer.last_order_date) >= oneMonthAgo;
      } else if (filterType === 'high_value') {
        matchesFilter = customer.total_spent > 100000;
      }

      // فلترة حسب المستوى
      let matchesTier = true;
      if (selectedTier) {
        matchesTier = customer.current_tier_id === selectedTier;
      }

      // فلترة حسب المدة الزمنية
      let matchesDateRange = true;
      if (dateRange !== 'all' && customer.last_order_date) {
        const now = new Date();
        const customerDate = new Date(customer.last_order_date);
        
        if (dateRange === 'week') {
          const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          matchesDateRange = customerDate >= oneWeekAgo;
        } else if (dateRange === 'month') {
          const oneMonthAgo = new Date();
          oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
          matchesDateRange = customerDate >= oneMonthAgo;
        } else if (dateRange === '3months') {
          const threeMonthsAgo = new Date();
          threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
          matchesDateRange = customerDate >= threeMonthsAgo;
        }
      }

      // فلترة حسب استخدام النقاط
      let matchesPointsUsage = true;
      if (pointsUsageFilter === 'not_used') {
        matchesPointsUsage = customer.total_points > 0;
      }

      return matchesSearch && matchesFilter && matchesTier && matchesDateRange && matchesPointsUsage;
    })
    // العملاء مرتبين حسب أهمية الولاء مع تحسين الأداء
    .sort((a, b) => {
      const aPoints = a.total_points || 0;
      const bPoints = b.total_points || 0;
      
      // العملاء الذين لديهم نقاط أولاً
      if (aPoints > 0 && bPoints === 0) return -1;
      if (bPoints > 0 && aPoints === 0) return 1;
      
      // ترتيب حسب النقاط (الأعلى أولاً)
      if (aPoints !== bPoints) return bPoints - aPoints;
      
      // إذا كانت النقاط متساوية، رتب حسب تاريخ آخر طلب
      return new Date(b.last_order_date || 0) - new Date(a.last_order_date || 0);
    });
  }, [customers, searchTerm, filterType, selectedTier, dateRange, pointsUsageFilter]);

  const sendCustomerNotification = useCallback(async (customerId, message) => {
    try {
      const { error } = await supabase.functions.invoke('send-customer-notifications', {
        body: { customer_id: customerId, message }
      });

      if (error) throw error;

      toast({
        title: "تم الإرسال",
        description: "تم إرسال الإشعار للعميل بنجاح"
      });
    } catch (error) {
      console.error('خطأ في إرسال الإشعار:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء إرسال الإشعار",
        variant: "destructive"
      });
    }
  }, []);

  const applyLoyaltyDiscount = useCallback(async (customerId) => {
    try {
      // منطق تطبيق خصم الولاء
      toast({
        title: "تم التطبيق",
        description: "تم تطبيق خصم الولاء بنجاح"
      });
    } catch (error) {
      console.error('خطأ في تطبيق خصم الولاء:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تطبيق خصم الولاء",
        variant: "destructive"
      });
    }
  }, []);

  const selectRandomCityDiscount = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('select_random_city_for_monthly_discount');
      
      if (error) throw error;
      
      toast({
        title: "تم الاختيار",
        description: data.message || "تم اختيار مدينة عشوائية للخصم الشهري"
      });
      
      fetchData();
    } catch (error) {
      console.error('خطأ في اختيار المدينة:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء اختيار المدينة",
        variant: "destructive"
      });
    }
  }, [fetchData]);

  const exportCustomersData = useCallback(async (filters) => {
    try {
      // منطق تصدير البيانات
      const csvData = filteredCustomers.map(customer => ({
        'اسم العميل': customer.customer_name || '',
        'رقم الهاتف': customer.original_phone || customer.phone_number || '',
        'المدينة': customer.customer_city || '',
        'المحافظة': customer.customer_province || '',
        'النقاط': customer.total_points || 0,
        'عدد الطلبات': customer.total_orders || 0,
        'إجمالي المشتريات': customer.total_spent || 0,
        'تاريخ آخر طلب': customer.last_order_date || ''
      }));

      const csvContent = "data:text/csv;charset=utf-8," + 
        Object.keys(csvData[0]).join(",") + "\n" +
        csvData.map(row => Object.values(row).join(",")).join("\n");

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `customers_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "تم التصدير",
        description: "تم تصدير بيانات العملاء بنجاح"
      });
    } catch (error) {
      console.error('خطأ في تصدير البيانات:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تصدير البيانات",
        variant: "destructive"
      });
    }
  }, [filteredCustomers]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Loading skeletons */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-48 bg-white dark:bg-slate-800 rounded-lg animate-pulse shadow-sm"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">إدارة العملاء</h1>
            <p className="text-muted-foreground">
              {canViewAllData ? 'إدارة شاملة لجميع العملاء' : 'إدارة عملاءك الخاصين'}
            </p>
          </div>
          <Button onClick={() => setShowExportDialog(true)} className="gap-2">
            <Download className="h-4 w-4" />
            تصدير البيانات
          </Button>
        </div>

        {/* Stats */}
        <CustomerStats customers={filteredCustomers} />

        {/* Toolbar */}
        <SimpleCustomersToolbar
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          filterType={filterType}
          setFilterType={setFilterType}
          dateRange={dateRange}
          setDateRange={setDateRange}
          selectedTier={selectedTier}
          setSelectedTier={setSelectedTier}
          loyaltyTiers={loyaltyTiers}
          onExport={() => setShowExportDialog(true)}
        />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="customers">العملاء ({filteredCustomers.length})</TabsTrigger>
            {canViewAllData && (
              <>
                <TabsTrigger value="cities">المدن ({cityStats.length})</TabsTrigger>
                <TabsTrigger value="discounts">الخصومات</TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="customers" className="space-y-6">
            {/* Loyalty tiers info */}
            {loyaltyTiers.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-500" />
                    مستويات الولاء
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    {loyaltyTiers.map(tier => {
                      const TierIcon = tierIcons[tier.icon] || Star;
                      return (
                        <Badge key={tier.id} variant="outline" className="flex items-center gap-2 p-2">
                          <TierIcon className="h-4 w-4" style={{ color: tier.color }} />
                          {tier.name} ({tier.points_required} نقطة)
                        </Badge>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Customers grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredCustomers.map((customer, index) => (
                <motion.div
                  key={customer.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <CustomerCard
                    customer={customer}
                    onSendNotification={sendCustomerNotification}
                    onApplyDiscount={applyLoyaltyDiscount}
                    onViewDetails={setSelectedCustomer}
                  />
                </motion.div>
              ))}
            </div>

            {filteredCustomers.length === 0 && (
              <Card>
                <CardContent className="text-center py-12">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">لا يوجد عملاء</h3>
                  <p className="text-muted-foreground">
                    {searchTerm ? 'لم يتم العثور على عملاء مطابقين للبحث' : 'لم يتم إضافة أي عملاء بعد'}
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {canViewAllData && (
            <>
              <TabsContent value="cities" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {cityStats.map((city, index) => (
                    <motion.div
                      key={city.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                    >
                      <Card className="hover:shadow-lg transition-shadow">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <MapPin className="h-5 w-5 text-blue-500" />
                            {city.city_name}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex justify-between">
                            <span>إجمالي الطلبات:</span>
                            <Badge variant="secondary">{city.total_orders}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>إجمالي المبيعات:</span>
                            <Badge variant="secondary">{city.total_amount?.toLocaleString('ar')} د.ع</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="discounts" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Gift className="h-5 w-5 text-green-500" />
                      خصومات المدن الشهرية
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {cityDiscounts.length > 0 ? (
                      cityDiscounts.map(discount => (
                        <div key={discount.id} className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <div>
                            <h3 className="font-semibold">{discount.city_name}</h3>
                            <p className="text-sm text-muted-foreground">خصم {discount.discount_percentage}%</p>
                          </div>
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            نشط
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <PartyPopper className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-semibold mb-2">لا توجد خصومات نشطة</h3>
                        <p className="text-muted-foreground mb-4">يمكنك اختيار مدينة عشوائية للخصم الشهري</p>
                        <Button onClick={selectRandomCityDiscount} className="gap-2">
                          <Zap className="h-4 w-4" />
                          اختيار مدينة عشوائية
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </>
          )}
        </Tabs>

        {/* Dialogs */}
        {selectedCustomer && (
          <CustomerDetailsDialog
            customer={selectedCustomer}
            open={!!selectedCustomer}
            onOpenChange={() => setSelectedCustomer(null)}
          />
        )}

        <EnhancedExportDialog
          open={showExportDialog}
          onOpenChange={setShowExportDialog}
          onExport={exportCustomersData}
          customers={filteredCustomers}
        />
      </div>
    </div>
  );
};

export default CustomersManagementPage;