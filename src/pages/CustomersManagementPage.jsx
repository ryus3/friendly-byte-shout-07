import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Phone, MapPin, Star, Award, Medal, Crown, Gem, ShoppingBag, TrendingUp, Send, MessageCircle, Download, Eye, Gift, Calendar, BarChart3 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';

const CustomersManagementPage = () => {
  const [customers, setCustomers] = useState([]);
  const [loyaltyTiers, setLoyaltyTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [cityStats, setCityStats] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [cityDiscounts, setCityDiscounts] = useState([]);
  const [activeTab, setActiveTab] = useState('customers');

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

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // جلب مستويات الولاء
      const { data: tiersData } = await supabase
        .from('loyalty_tiers')
        .select('*')
        .order('points_required', { ascending: true });
      
      setLoyaltyTiers(tiersData || []);

      // جلب العملاء مع بيانات الولاء
      const { data: customersData } = await supabase
        .from('customers')
        .select(`
          *,
          customer_loyalty (
            total_points,
            total_spent,
            total_orders,
            current_tier_id,
            last_tier_upgrade,
            loyalty_tiers (
              name,
              color,
              icon,
              discount_percentage
            )
          )
        `)
        .order('created_at', { ascending: false });

      setCustomers(customersData || []);
      
      // جلب إحصائيات المدن
      const { data: cityStatsData } = await supabase
        .from('city_order_stats')
        .select('*')
        .eq('month', new Date().getMonth() + 1)
        .eq('year', new Date().getFullYear())
        .order('total_orders', { ascending: false });
        
      setCityStats(cityStatsData || []);
      
      // جلب خصومات المدن الحالية
      const { data: cityDiscountsData } = await supabase
        .from('city_random_discounts')
        .select('*')
        .eq('discount_month', new Date().getMonth() + 1)
        .eq('discount_year', new Date().getFullYear());
        
      setCityDiscounts(cityDiscountsData || []);
      
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ في تحميل البيانات',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone?.includes(searchTerm) ||
    customer.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTierIcon = (iconName) => {
    const IconComponent = tierIcons[iconName] || Star;
    return IconComponent;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ar-IQ').format(amount) + ' د.ع';
  };

  // إرسال إشعار للعميل
  const sendCustomerNotification = async (customerId, type, message) => {
    try {
      const response = await supabase.functions.invoke('send-customer-notifications', {
        body: {
          customer_id: customerId,
          notification_type: type,
          message: message
        }
      });

      if (response.error) throw response.error;

      toast({
        title: 'تم الإرسال',
        description: response.data.message || 'تم إرسال الإشعار بنجاح'
      });
    } catch (error) {
      toast({
        title: 'خطأ في الإرسال',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  // تطبيق خصم الولاء للعميل
  const applyLoyaltyDiscount = async (customerId) => {
    try {
      const { data, error } = await supabase.rpc('check_monthly_loyalty_discount_eligibility', {
        p_customer_id: customerId
      });

      if (error) throw error;

      if (data.eligible) {
        toast({
          title: 'الخصم متاح',
          description: `العميل يستحق خصم ${data.discount_percentage}% - مستوى ${data.tier_name}`
        });
        
        // يمكن إضافة منطق تطبيق الخصم هنا
        await sendCustomerNotification(
          customerId, 
          'discount_available',
          `🎉 تهانينا! يحق لك الحصول على خصم ${data.discount_percentage}% كونك من مستوى ${data.tier_name}`
        );
      } else {
        toast({
          title: 'الخصم غير متاح',
          description: data.already_used_this_month ? 'تم استخدام الخصم هذا الشهر' : 'لا يستحق خصم حالياً',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'خطأ',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  // اختيار مدينة عشوائية للخصم
  const selectRandomCityDiscount = async () => {
    try {
      const { data, error } = await supabase.rpc('select_random_city_for_monthly_discount');
      
      if (error) throw error;
      
      if (data.success) {
        toast({
          title: 'تم اختيار مدينة الخصم',
          description: `تم اختيار مدينة ${data.city_name} للحصول على خصم ${data.discount_percentage}%`
        });
        fetchData(); // تحديث البيانات
      } else {
        toast({
          title: 'تنبيه',
          description: data.message,
          variant: 'default'
        });
      }
    } catch (error) {
      toast({
        title: 'خطأ',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  // تصدير بيانات العملاء مع فلترة متقدمة
  const exportCustomersData = (filterType = 'all', dateRange = null) => {
    let filteredData = customers;
    
    // فلترة حسب النوع
    if (filterType === 'with_points') {
      filteredData = customers.filter(c => c.customer_loyalty?.total_points > 0);
    } else if (filterType === 'no_points') {
      filteredData = customers.filter(c => !c.customer_loyalty || c.customer_loyalty.total_points === 0);
    } else if (filterType === 'active') {
      filteredData = customers.filter(c => c.customer_loyalty?.total_orders > 0);
    }
    
    // فلترة حسب الفترة الزمنية
    if (dateRange) {
      const { start, end } = dateRange;
      filteredData = filteredData.filter(customer => {
        const customerDate = new Date(customer.created_at);
        return customerDate >= start && customerDate <= end;
      });
    }

    const csvData = filteredData.map(customer => ({
      'الاسم': customer.name,
      'الهاتف': customer.phone || '',
      'المدينة': customer.city || '',
      'المحافظة': customer.province || '',
      'النقاط': customer.customer_loyalty?.total_points || 0,
      'الطلبات_المكتملة': customer.customer_loyalty?.total_orders || 0,
      'المشتريات': customer.customer_loyalty?.total_spent || 0,
      'المستوى': customer.customer_loyalty?.loyalty_tiers?.name || 'لا يوجد',
      'خصم_المستوى': customer.customer_loyalty?.loyalty_tiers?.discount_percentage || 0,
      'تاريخ_الانضمام': new Date(customer.created_at).toLocaleDateString('ar'),
      'آخر_ترقية': customer.customer_loyalty?.last_tier_upgrade 
        ? new Date(customer.customer_loyalty.last_tier_upgrade).toLocaleDateString('ar') 
        : 'لا يوجد',
      'حالة_الواتساب': customer.phone ? 'متوفر' : 'غير متوفر'
    }));

    if (csvData.length === 0) {
      toast({
        title: 'لا توجد بيانات',
        description: 'لا توجد عملاء مطابقون للفلتر المحدد',
        variant: 'destructive'
      });
      return;
    }

    const csvContent = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    
    const filterSuffix = filterType === 'with_points' ? '_with_points' : 
                        filterType === 'no_points' ? '_no_points' : 
                        filterType === 'active' ? '_active_customers' : '';
    
    link.download = `customers_data${filterSuffix}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    toast({
      title: 'تم التصدير',
      description: `تم تصدير ${csvData.length} عميل بنجاح`
    });
  };

  // عرض تفاصيل العميل
  const viewCustomerDetails = async (customerId) => {
    try {
      // جلب تفاصيل العميل مع الطلبات والنقاط
      const { data: customerData } = await supabase
        .from('customers')
        .select(`
          *,
          customer_loyalty (*,
            loyalty_tiers (*)
          )
        `)
        .eq('id', customerId)
        .single();

      // جلب تاريخ النقاط
      const { data: pointsHistory } = await supabase
        .from('loyalty_points_history')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      // جلب الطلبات المكتملة
      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_id', customerId)
        .in('status', ['completed', 'delivered'])
        .order('created_at', { ascending: false });

      setSelectedCustomer({
        ...customerData,
        pointsHistory: pointsHistory || [],
        completedOrders: orders || []
      });

    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'حدث خطأ في تحميل تفاصيل العميل',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            إدارة العملاء ونظام الولاء المتقدم
          </h1>
          <p className="text-muted-foreground">
            إدارة شاملة للعملاء والولاء والإشعارات والخصومات
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* قائمة منسدلة للتصدير */}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-1" />
                تصدير البيانات
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>تصدير بيانات العملاء</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    onClick={() => exportCustomersData('all')}
                    variant="outline"
                  >
                    جميع العملاء
                  </Button>
                  <Button 
                    onClick={() => exportCustomersData('with_points')}
                    variant="outline"
                  >
                    العملاء مع نقاط
                  </Button>
                  <Button 
                    onClick={() => exportCustomersData('no_points')}
                    variant="outline"
                  >
                    العملاء بدون نقاط
                  </Button>
                  <Button 
                    onClick={() => exportCustomersData('active')}
                    variant="outline"
                  >
                    العملاء النشطين
                  </Button>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  <p>• العملاء مع نقاط: الذين لديهم طلبات مكتملة/مُسلّمة</p>
                  <p>• العملاء النشطين: الذين لديهم طلبات مُسجّلة</p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          <Button onClick={selectRandomCityDiscount} variant="outline" size="sm">
            <Gift className="h-4 w-4 mr-1" />
            اختيار مدينة للخصم
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">إجمالي العملاء</p>
                <p className="text-2xl font-bold">{customers.length}</p>
              </div>
              <Users className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">عملاء مع أرقام هواتف</p>
                <p className="text-2xl font-bold">
                  {customers.filter(c => c.phone).length}
                </p>
              </div>
              <Phone className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">عملاء مع نقاط</p>
                <p className="text-2xl font-bold">
                  {customers.filter(c => c.customer_loyalty?.total_points > 0).length}
                </p>
              </div>
              <Star className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">إجمالي النقاط</p>
                <p className="text-xl font-bold">
                  {customers.reduce((sum, c) => sum + (c.customer_loyalty?.total_points || 0), 0).toLocaleString()}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">إجمالي المبيعات</p>
                <p className="text-lg font-bold">
                  {formatCurrency(customers.reduce((sum, c) => sum + (c.customer_loyalty?.total_spent || 0), 0))}
                </p>
              </div>
              <ShoppingBag className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="customers">العملاء</TabsTrigger>
          <TabsTrigger value="cities">إحصائيات المدن</TabsTrigger>
          <TabsTrigger value="discounts">خصومات المدن</TabsTrigger>
        </TabsList>

        {/* Customers Tab */}
        <TabsContent value="customers" className="space-y-4">
          {/* Search */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Input
              placeholder="البحث بالاسم أو الهاتف أو البريد الإلكتروني..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>

          {/* Loyalty Tiers Overview */}
          <Card>
            <CardHeader>
              <CardTitle>مستويات الولاء (محدث)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {loyaltyTiers.map((tier) => {
                  const TierIcon = getTierIcon(tier.icon);
                  const customersInTier = customers.filter(c => 
                    c.customer_loyalty?.current_tier_id === tier.id
                  ).length;
                  
                  return (
                    <div key={tier.id} className="text-center p-4 rounded-lg border">
                      <TierIcon 
                        className="h-8 w-8 mx-auto mb-2" 
                        style={{ color: tier.color }}
                      />
                      <h3 className="font-semibold">{tier.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {tier.points_required} نقطة
                      </p>
                      <p className="text-lg font-bold">{customersInTier} عميل</p>
                      {tier.discount_percentage > 0 && (
                        <Badge variant="secondary">
                          خصم {tier.discount_percentage}% شهرياً
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Customers List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCustomers.map((customer) => {
              const loyalty = customer.customer_loyalty;
              const tier = loyalty?.loyalty_tiers;
              const TierIcon = tier ? getTierIcon(tier.icon) : Star;

              return (
                <Card key={customer.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      {/* Customer Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg">{customer.name}</h3>
                            {customer.phone && (
                              <Badge variant="outline" className="text-xs">
                                <Phone className="h-3 w-3 mr-1" />
                                واتساب
                              </Badge>
                            )}
                          </div>
                          {customer.phone && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {customer.phone}
                            </div>
                          )}
                          {customer.city && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {customer.city}, {customer.province}
                            </div>
                          )}
                        </div>
                        
                        {/* Tier Badge */}
                        {tier && (
                          <Badge 
                            variant="outline" 
                            className="flex items-center gap-1"
                            style={{ borderColor: tier.color, color: tier.color }}
                          >
                            <TierIcon className="h-3 w-3" />
                            {tier.name}
                          </Badge>
                        )}
                      </div>

                      {/* Enhanced Loyalty Stats */}
                      {loyalty && (
                        <div className="grid grid-cols-2 gap-4 pt-3 border-t">
                          <div className="text-center">
                            <p className="text-lg font-bold text-primary">
                              {loyalty.total_points.toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground">نقطة</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-bold text-green-600">
                              {loyalty.total_orders}
                            </p>
                            <p className="text-xs text-muted-foreground">طلب</p>
                          </div>
                          <div className="text-center col-span-2">
                            <p className="text-sm font-medium">
                              {formatCurrency(loyalty.total_spent)}
                            </p>
                            <p className="text-xs text-muted-foreground">إجمالي المشتريات</p>
                          </div>
                        </div>
                      )}

                      {/* Enhanced Action Buttons */}
                      <div className="grid grid-cols-3 gap-1 pt-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => applyLoyaltyDiscount(customer.id)}
                          disabled={!loyalty || (loyalty.total_points === 0)}
                          title={!loyalty || loyalty.total_points === 0 ? 'العميل لا يملك نقاط كافية' : 'تطبيق خصم الولاء'}
                        >
                          <Gift className="h-3 w-3 mr-1" />
                          خصم
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => sendCustomerNotification(
                            customer.id, 
                            'manual',
                            `مرحباً ${customer.name}، شكراً لك على ثقتك بنا! 🙏${loyalty ? ` لديك ${loyalty.total_points} نقطة ولاء` : ''}`
                          )}
                          disabled={!customer.phone}
                          title={!customer.phone ? 'لا يوجد رقم هاتف' : 'إرسال رسالة واتساب'}
                        >
                          <Send className="h-3 w-3 mr-1" />
                          رسالة
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => viewCustomerDetails(customer.id)}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          تفاصيل
                        </Button>
                      </div>
                      
                      {/* Points Status Indicator */}
                      {loyalty && loyalty.total_points > 0 && (
                        <div className="mt-2 text-center">
                          <Badge variant="secondary" className="text-xs">
                            ✅ مؤهل لخصم الولاء ({tier?.discount_percentage || 0}%)
                          </Badge>
                        </div>
                      )}
                      
                      {(!loyalty || loyalty.total_points === 0) && (
                        <div className="mt-2 text-center">
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            بحاجة لطلبات مكتملة للحصول على نقاط
                          </Badge>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Empty State */}
          {filteredCustomers.length === 0 && !loading && (
            <Card>
              <CardContent className="p-12 text-center">
                <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-semibold mb-2">لا توجد عملاء</h3>
                <p className="text-muted-foreground">
                  {searchTerm ? 'لا توجد نتائج للبحث' : 'لم يتم إضافة أي عملاء بعد'}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Cities Stats Tab */}
        <TabsContent value="cities" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>إحصائيات المدن هذا الشهر</CardTitle>
            </CardHeader>
            <CardContent>
              {cityStats.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {cityStats.map((city, index) => (
                    <div key={city.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold">{city.city_name}</h3>
                        <Badge variant={index < 3 ? "default" : "secondary"}>
                          #{index + 1}
                        </Badge>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">الطلبات:</span>
                          <span className="font-medium">{city.total_orders}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">المبيعات:</span>
                          <span className="font-medium">{formatCurrency(city.total_amount)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>لا توجد إحصائيات للمدن هذا الشهر</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* City Discounts Tab */}
        <TabsContent value="discounts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>خصومات المدن الحالية</CardTitle>
            </CardHeader>
            <CardContent>
              {cityDiscounts.length > 0 ? (
                <div className="space-y-4">
                  {cityDiscounts.map((discount) => (
                    <div key={discount.id} className="p-4 border rounded-lg bg-green-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-lg">{discount.city_name}</h3>
                          <p className="text-sm text-muted-foreground">
                            شهر {discount.discount_month} - {discount.discount_year}
                          </p>
                        </div>
                        <Badge className="bg-green-600">
                          خصم {discount.discount_percentage}%
                        </Badge>
                      </div>
                      <p className="text-sm mt-2 text-green-700">
                        🎉 تهانينا لسكان {discount.city_name}! اختاركم شهر للحصول على خصم خاص {discount.discount_percentage}%
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Gift className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>لا توجد خصومات مدن نشطة حالياً</p>
                  <Button 
                    onClick={selectRandomCityDiscount} 
                    className="mt-4"
                    variant="outline"
                  >
                    اختيار مدينة للخصم الشهري
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Customer Details Dialog */}
      {selectedCustomer && (
        <Dialog open={!!selectedCustomer} onOpenChange={() => setSelectedCustomer(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                تفاصيل العميل: {selectedCustomer.name}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Customer Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">معلومات العميل</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">الاسم:</span>
                      <span className="font-medium">{selectedCustomer.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">الهاتف:</span>
                      <span className="font-medium">{selectedCustomer.phone || 'غير متوفر'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">المدينة:</span>
                      <span className="font-medium">{selectedCustomer.city || 'غير محدد'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">المحافظة:</span>
                      <span className="font-medium">{selectedCustomer.province || 'غير محدد'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">تاريخ الانضمام:</span>
                      <span className="font-medium">
                        {new Date(selectedCustomer.created_at).toLocaleDateString('ar')}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">إحصائيات الولاء</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">النقاط الحالية:</span>
                      <span className="font-bold text-primary">
                        {selectedCustomer.customer_loyalty?.total_points || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">الطلبات المكتملة:</span>
                      <span className="font-medium text-green-600">
                        {selectedCustomer.customer_loyalty?.total_orders || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">إجمالي المشتريات:</span>
                      <span className="font-medium">
                        {formatCurrency(selectedCustomer.customer_loyalty?.total_spent || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">المستوى الحالي:</span>
                      <span className="font-medium">
                        {selectedCustomer.customer_loyalty?.loyalty_tiers?.name || 'لا يوجد'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">خصم المستوى:</span>
                      <span className="font-medium">
                        {selectedCustomer.customer_loyalty?.loyalty_tiers?.discount_percentage || 0}%
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Points History */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Star className="h-4 w-4" />
                    تاريخ النقاط
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedCustomer.pointsHistory && selectedCustomer.pointsHistory.length > 0 ? (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {selectedCustomer.pointsHistory.map((point, index) => (
                        <div key={index} className="flex justify-between items-center p-2 border rounded">
                          <div>
                            <p className="text-sm font-medium">{point.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(point.created_at).toLocaleDateString('ar')}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-green-600">
                              +{point.points_earned} نقطة
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-4">
                      لا يوجد تاريخ نقاط لهذا العميل
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Completed Orders */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4" />
                    الطلبات المكتملة ({selectedCustomer.completedOrders?.length || 0})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedCustomer.completedOrders && selectedCustomer.completedOrders.length > 0 ? (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {selectedCustomer.completedOrders.map((order, index) => (
                        <div key={index} className="flex justify-between items-center p-2 border rounded">
                          <div>
                            <p className="text-sm font-medium">طلب #{order.order_number}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(order.created_at).toLocaleDateString('ar')}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold">
                              {formatCurrency(order.final_amount)}
                            </p>
                            <Badge variant="secondary" className="text-xs">
                              {order.status === 'completed' ? 'مكتمل' : 'مُسلّم'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-4">
                      لا توجد طلبات مكتملة لهذا العميل
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => applyLoyaltyDiscount(selectedCustomer.id)}
                  disabled={!selectedCustomer.customer_loyalty || selectedCustomer.customer_loyalty.total_points === 0}
                >
                  <Gift className="h-4 w-4 mr-1" />
                  تطبيق خصم الولاء
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => sendCustomerNotification(
                    selectedCustomer.id, 
                    'loyalty_summary',
                    `مرحباً ${selectedCustomer.name}! 🌟\n\nملخص حسابك:\n• النقاط: ${selectedCustomer.customer_loyalty?.total_points || 0}\n• الطلبات: ${selectedCustomer.customer_loyalty?.total_orders || 0}\n• المستوى: ${selectedCustomer.customer_loyalty?.loyalty_tiers?.name || 'غير محدد'}\n\nشكراً لثقتك بنا! 🙏`
                  )}
                  disabled={!selectedCustomer.phone}
                >
                  <Send className="h-4 w-4 mr-1" />
                  إرسال ملخص الحساب
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default CustomersManagementPage;