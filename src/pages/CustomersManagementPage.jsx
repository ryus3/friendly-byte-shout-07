import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Users, Phone, MapPin, Star, Award, Medal, Crown, Gem, ShoppingBag, TrendingUp, Send, MessageCircle, Download, Eye, Gift, Calendar, BarChart3, Filter, Clock } from 'lucide-react';
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
  const [appliedDiscounts, setAppliedDiscounts] = useState([]);
  
  // فلاتر جديدة
  const [dateRange, setDateRange] = useState(null);
  const [pointsFilter, setPointsFilter] = useState('all'); // all, with_points, without_points
  const [tierFilter, setTierFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all'); // all, this_month, this_year, last_month

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
      
      // جلب الخصومات المطبقة
      const { data: appliedDiscountsData } = await supabase
        .from('applied_customer_discounts')
        .select(`
          *,
          customers (name, phone),
          orders (order_number, final_amount)
        `)
        .order('applied_at', { ascending: false });
        
      setAppliedDiscounts(appliedDiscountsData || []);
      
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

  // فلترة العملاء حسب المعايير المختلفة
  const filteredCustomers = customers.filter(customer => {
    // فلتر النص
    const searchMatch = customer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       customer.phone?.includes(searchTerm) ||
                       customer.city?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!searchMatch) return false;
    
    // فلتر النقاط
    const hasPoints = customer.customer_loyalty?.[0]?.total_points > 0;
    if (pointsFilter === 'with_points' && !hasPoints) return false;
    if (pointsFilter === 'without_points' && hasPoints) return false;
    
    // فلتر المستوى
    const customerTierId = customer.customer_loyalty?.[0]?.current_tier_id;
    if (tierFilter !== 'all' && customerTierId !== tierFilter) return false;
    
    // فلتر الوقت
    const customerDate = new Date(customer.created_at);
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    
    if (timeFilter === 'this_month') {
      if (customerDate.getMonth() !== thisMonth || customerDate.getFullYear() !== thisYear) return false;
    } else if (timeFilter === 'this_year') {
      if (customerDate.getFullYear() !== thisYear) return false;
    } else if (timeFilter === 'last_month') {
      const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
      const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;
      if (customerDate.getMonth() !== lastMonth || customerDate.getFullYear() !== lastMonthYear) return false;
    }
    
    // فلتر نطاق التاريخ
    if (dateRange?.from && dateRange?.to) {
      if (customerDate < dateRange.from || customerDate > dateRange.to) return false;
    }
    
    return true;
  });

  const customersWithPoints = filteredCustomers.filter(c => c.customer_loyalty?.[0]?.total_points > 0);
  const customersWithPhones = filteredCustomers.filter(c => c.phone);
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

  // تصدير بيانات العملاء مع فلترة متقدمة (CSV)
  const exportCustomersData = (filterType = 'all', dateRange = null) => {
    let filteredData = customers;
    
    // فلترة حسب النوع
    if (filterType === 'with_points') {
      filteredData = customers.filter(c => c.customer_loyalty?.total_points > 0);
    } else if (filterType === 'no_points') {
      filteredData = customers.filter(c => !c.customer_loyalty || c.customer_loyalty.total_points === 0);
    } else if (filterType === 'active') {
      filteredData = customers.filter(c => c.customer_loyalty?.total_orders > 0);
    } else if (filterType === 'with_phone') {
      filteredData = customers.filter(c => c.phone && c.phone.trim());
    }
    
    if (filteredData.length === 0) {
      toast({
        title: 'لا توجد بيانات',
        description: 'لا توجد عملاء مطابقون للفلتر المحدد',
        variant: 'destructive'
      });
      return;
    }

    // إنشاء CSV مع جميع التفاصيل
    const csvHeaders = [
      'الاسم',
      'الهاتف', 
      'المدينة',
      'المحافظة',
      'النقاط_الحالية',
      'الطلبات_المكتملة',
      'إجمالي_المشتريات',
      'المستوى',
      'خصم_المستوى_%',
      'تاريخ_الانضمام',
      'آخر_ترقية_مستوى',
      'حالة_الواتساب',
      'العنوان'
    ];

    const csvData = filteredData.map(customer => [
      customer.name || '',
      customer.phone || '',
      customer.city || '',
      customer.province || '',
      customer.customer_loyalty?.total_points || 0,
      customer.customer_loyalty?.total_orders || 0,
      customer.customer_loyalty?.total_spent || 0,
      customer.customer_loyalty?.loyalty_tiers?.name || 'لا يوجد',
      customer.customer_loyalty?.loyalty_tiers?.discount_percentage || 0,
      customer.created_at ? new Date(customer.created_at).toLocaleDateString('ar') : '',
      customer.customer_loyalty?.last_tier_upgrade 
        ? new Date(customer.customer_loyalty.last_tier_upgrade).toLocaleDateString('ar') 
        : 'لا يوجد',
      customer.phone ? 'متوفر' : 'غير متوفر',
      customer.address || ''
    ]);

    // إنشاء محتوى CSV
    const csvContent = [
      csvHeaders.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // إضافة BOM للدعم العربي
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    
    const filterSuffix = filterType === 'with_points' ? '_مع_نقاط' : 
                        filterType === 'no_points' ? '_بدون_نقاط' : 
                        filterType === 'active' ? '_نشط' :
                        filterType === 'with_phone' ? '_مع_هاتف' : '';
    
    const timestamp = new Date().toISOString().split('T')[0];
    link.download = `عملاء${filterSuffix}_${timestamp}.csv`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: 'تم التصدير بنجاح',
      description: `تم تصدير ${csvData.length} عميل إلى ملف CSV`
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
      console.error('Error fetching customer details:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ في تحميل تفاصيل العميل',
        variant: 'destructive'
      });
    }
  };

  // إرسال إشعار مخصص للعميل
  const sendCustomNotification = async (customerId, message) => {
    if (!message.trim()) {
      toast({
        title: 'خطأ',
        description: 'يرجى كتابة رسالة',
        variant: 'destructive'
      });
      return;
    }

    try {
      await sendCustomerNotification(customerId, 'custom', message);
    } catch (error) {
      console.error('Error sending notification:', error);
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
                تصدير العملاء (CSV)
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>تصدير بيانات العملاء</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  اختر نوع العملاء المراد تصديرهم إلى ملف CSV:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    onClick={() => exportCustomersData('all')}
                    variant="outline"
                    className="h-12"
                  >
                    جميع العملاء
                    <div className="text-xs text-muted-foreground">
                      ({customers.length} عميل)
                    </div>
                  </Button>
                  <Button 
                    onClick={() => exportCustomersData('with_points')}
                    variant="outline"
                    className="h-12"
                  >
                    العملاء مع نقاط
                    <div className="text-xs text-muted-foreground">
                      ({customers.filter(c => c.customer_loyalty?.total_points > 0).length} عميل)
                    </div>
                  </Button>
                  <Button 
                    onClick={() => exportCustomersData('no_points')}
                    variant="outline"
                    className="h-12"
                  >
                    العملاء بدون نقاط
                    <div className="text-xs text-muted-foreground">
                      ({customers.filter(c => !c.customer_loyalty || c.customer_loyalty.total_points === 0).length} عميل)
                    </div>
                  </Button>
                  <Button 
                    onClick={() => exportCustomersData('with_phone')}
                    variant="outline"
                    className="h-12"
                  >
                    العملاء مع أرقام هواتف
                    <div className="text-xs text-muted-foreground">
                      ({customers.filter(c => c.phone).length} عميل)
                    </div>
                  </Button>
                </div>
                
                <div className="p-3 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">ملاحظات:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• سيتم التصدير بصيغة CSV مع دعم العربية</li>
                    <li>• العملاء مع نقاط: الذين لديهم طلبات مكتملة/مُسلّمة</li>
                    <li>• يشمل الملف: الاسم، الهاتف، النقاط، المستوى، التواريخ</li>
                  </ul>
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
          {/* Enhanced Search and Filters */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <Input
                placeholder="البحث بالاسم أو الهاتف أو المدينة..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
              <Button variant="outline" className="shrink-0">
                <Filter className="h-4 w-4 mr-1" />
                فلاتر متقدمة
              </Button>
            </div>

            {/* Advanced Filters Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-lg">
              {/* Time Filter */}
              <div>
                <Label className="text-sm font-medium">فترة الانضمام</Label>
                <Select value={timeFilter} onValueChange={setTimeFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="اختر الفترة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الفترات</SelectItem>
                    <SelectItem value="this_month">هذا الشهر</SelectItem>
                    <SelectItem value="last_month">الشهر الماضي</SelectItem>
                    <SelectItem value="this_year">هذا العام</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Points Filter */}
              <div>
                <Label className="text-sm font-medium">النقاط</Label>
                <Select value={pointsFilter} onValueChange={setPointsFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="فلتر النقاط" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    <SelectItem value="with_points">مع نقاط</SelectItem>
                    <SelectItem value="without_points">بدون نقاط</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tier Filter */}
              <div>
                <Label className="text-sm font-medium">المستوى</Label>
                <Select value={tierFilter} onValueChange={setTierFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="فلتر المستوى" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع المستويات</SelectItem>
                    {loyaltyTiers.map((tier) => (
                      <SelectItem key={tier.id} value={tier.id}>
                        {tier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range Filter */}
              <div>
                <Label className="text-sm font-medium">نطاق التاريخ</Label>
                <DateRangePicker
                  date={dateRange}
                  onDateChange={setDateRange}
                />
              </div>
            </div>

            {/* Filter Results Summary */}
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>النتائج: {filteredCustomers.length} عميل</span>
              <span>•</span>
              <span>مع نقاط: {customersWithPoints.length}</span>
              <span>•</span>
              <span>مع هواتف: {customersWithPhones.length}</span>
              {(timeFilter !== 'all' || pointsFilter !== 'all' || tierFilter !== 'all' || dateRange) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setTimeFilter('all');
                    setPointsFilter('all');
                    setTierFilter('all');
                    setDateRange(null);
                  }}
                  className="ml-2"
                >
                  إزالة الفلاتر
                </Button>
              )}
            </div>
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
                      
                      {/* Enhanced Status Indicators */}
                      <div className="mt-2 space-y-1">
                        {loyalty && loyalty.total_points > 0 && (
                          <div className="text-center">
                            <Badge variant="secondary" className="text-xs">
                              ✅ مؤهل لخصم الولاء ({tier?.discount_percentage || 0}%)
                            </Badge>
                          </div>
                        )}
                        
                        {(!loyalty || loyalty.total_points === 0) && (
                          <div className="text-center">
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              بحاجة لطلب مكتمل بقيمة 20,000+ د.ع للحصول على 200 نقطة
                            </Badge>
                          </div>
                        )}

                        {/* Discount Applied Indicator */}
                        {appliedDiscounts.some(d => d.customer_id === customer.id) && (
                          <div className="text-center">
                            <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                              🏷️ تم تطبيق خصم مؤخراً
                            </Badge>
                          </div>
                        )}
                      </div>
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