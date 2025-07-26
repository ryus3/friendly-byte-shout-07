import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Phone, MapPin, Star, Award, Medal, Crown, Gem, ShoppingBag, TrendingUp, Send, MessageCircle, Download, Eye, Gift, Calendar, BarChart3 } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/hooks/use-toast';
import CustomerStats from '@/components/customers/CustomerStats';
import CustomerCard from '@/components/customers/CustomerCard';
import SimpleCustomersToolbar from '@/components/customers/SimpleCustomersToolbar';
import CustomerDetailsDialog from '@/components/customers/CustomerDetailsDialog';
import EnhancedExportDialog from '@/components/customers/EnhancedExportDialog';

const CustomersManagementPage = () => {
  const [customers, setCustomers] = useState([]);
  const [loyaltyTiers, setLoyaltyTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [cityStats, setCityStats] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [cityDiscounts, setCityDiscounts] = useState([]);
  const [activeTab, setActiveTab] = useState('customers');
  const [filterType, setFilterType] = useState('all'); // حالة الفلترة
  const [dateRange, setDateRange] = useState('all'); // فلترة المدة الزمنية
  const [pointsUsageFilter, setPointsUsageFilter] = useState('all'); // فلترة استخدام النقاط
  const [selectedTier, setSelectedTier] = useState(null); // فلترة حسب المستوى
  const [showExportDialog, setShowExportDialog] = useState(false); // حالة نافذة التصدير

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

      // جلب العملاء مع بيانات الولاء والجنس
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
            points_expiry_date,
            loyalty_tiers (
              name,
              color,
              icon,
              discount_percentage
            )
          ),
          customer_gender_segments (
            gender_type,
            confidence_score
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

  // فلترة وترتيب العملاء حسب البحث ونوع الفلتر
  const filteredCustomers = customers
    .filter(customer => {
      // فلترة البحث النصي
      const matchesSearch = customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.phone?.includes(searchTerm) ||
        customer.email?.toLowerCase().includes(searchTerm.toLowerCase());
      
      // فلترة حسب النوع
      let matchesFilter = true;
      if (filterType === 'with_phone') {
        matchesFilter = customer.phone && customer.phone.trim();
      } else if (filterType === 'with_points') {
        matchesFilter = customer.customer_loyalty?.total_points > 0;
      } else if (filterType === 'no_points') {
        matchesFilter = !customer.customer_loyalty || customer.customer_loyalty.total_points === 0;
      } else if (filterType === 'male_customers') {
        // فلترة العملاء الرجال بناءً على تحليل جنس حقيقي وفولاذي
        matchesFilter = customer.customer_gender_segments?.gender_type === 'male' || false;
      } else if (filterType === 'female_customers') {
        // فلترة العميلات النساء بناءً على تحليل جنس حقيقي وفولاذي
        matchesFilter = customer.customer_gender_segments?.gender_type === 'female' || false;
      }
      
      // فلترة حسب المستوى
      let matchesTier = true;
      if (selectedTier) {
        matchesTier = customer.customer_loyalty?.current_tier_id === selectedTier;
      }
      
      return matchesSearch && matchesFilter && matchesTier;
    })
    .sort((a, b) => {
      // ترتيب حسب النقاط أولاً (من الأعلى للأقل)
      const aPoints = a.customer_loyalty?.total_points || 0;
      const bPoints = b.customer_loyalty?.total_points || 0;
      
      if (aPoints !== bPoints) {
        return bPoints - aPoints; // ترتيب تنازلي حسب النقاط
      }
      
      // إذا كانت النقاط متساوية، ترتيب حسب تاريخ الإنشاء (الأحدث أولاً)
      return new Date(b.created_at) - new Date(a.created_at);
    });

  const getTierIcon = (iconName) => {
    const IconComponent = tierIcons[iconName] || Star;
    return IconComponent;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ar-IQ').format(amount) + ' د.ع';
  };

  // وصف نوع الفلتر
  const getFilterDescription = (type) => {
    switch(type) {
      case 'total': return 'جميع العملاء';
      case 'with_phone': return 'العملاء مع أرقام هواتف';
      case 'with_points': return 'العملاء مع نقاط';
      case 'no_points': return 'العملاء بدون نقاط';
      case 'total_points': return 'إجمالي النقاط';
      case 'total_sales': return 'إجمالي المبيعات';
      default: return 'جميع العملاء';
    }
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
    } else if (filterType === 'male') {
      // فلترة قوية للرجال - نظام فولاذي
      filteredData = customers.filter(c => 
        c.customer_gender_segments?.gender_type === 'male'
      );
    } else if (filterType === 'female') {
      // فلترة قوية للنساء - نظام فولاذي
      filteredData = customers.filter(c => 
        c.customer_gender_segments?.gender_type === 'female'
      );
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
      'الجنس_المتوقع',
      'النقاط_الحالية',
      'الطلبات_المكتملة',
      'إجمالي_المشتريات',
      'المستوى',
      'خصم_المستوى_%',
      'صلاحية_النقاط',
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
      // تحليل الجنس الدقيق والقوي
      customer.customer_gender_segments?.gender_type === 'male' ? 'ذكر' : 
      customer.customer_gender_segments?.gender_type === 'female' ? 'أنثى' : 'غير محدد',
      customer.customer_loyalty?.total_points || 0,
      customer.customer_loyalty?.total_orders || 0,
      customer.customer_loyalty?.total_spent || 0,
      customer.customer_loyalty?.loyalty_tiers?.name || 'لا يوجد',
      customer.customer_loyalty?.loyalty_tiers?.discount_percentage || 0,
      customer.customer_loyalty?.points_expiry_date ? 
        new Date(customer.customer_loyalty.points_expiry_date).toLocaleDateString('ar') : 'لا توجد',
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
                        filterType === 'with_phone' ? '_مع_هاتف' : 
                        filterType === 'male' ? '_رجال' :
                        filterType === 'female' ? '_نساء' : '';
    
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

  // عرض تفاصيل العميل مع المبيعات الصحيحة
  const viewCustomerDetails = async (customerId) => {
    try {
      // جلب تفاصيل العميل مع بيانات الولاء
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

      // جلب الطلبات المكتملة/المُسلّمة فقط (التي حصل العميل منها على نقاط)
      const { data: orders } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          total_amount,
          final_amount,
          delivery_fee,
          discount,
          status,
          created_at,
          customer_name,
          order_items (
            quantity,
            unit_price,
            total_price,
            product_id,
            products (name)
          )
        `)
        .eq('customer_id', customerId)
        .in('status', ['completed', 'delivered'])
        .order('created_at', { ascending: false });

      // حساب إجمالي المبيعات بدون رسوم التوصيل
      const totalSalesWithoutDelivery = orders?.reduce((sum, order) => {
        return sum + (order.final_amount - (order.delivery_fee || 0));
      }, 0) || 0;

      setSelectedCustomer({
        ...customerData,
        pointsHistory: pointsHistory || [],
        completedOrders: orders || [],
        totalSalesWithoutDelivery
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
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Users className="h-8 w-8 text-blue-600" />
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                إدارة العملاء ونظام الولاء
              </span>
            </h1>
            <p className="text-muted-foreground mt-1">
              إدارة شاملة للعملاء والولاء والإشعارات والخصومات
            </p>
          </div>
        <div className="flex flex-wrap gap-2">
          {/* زر تصدير العملاء بتصميم مطابق لزر إضافة المنتج */}
          <Button 
            size="sm"
            onClick={() => setShowExportDialog(true)}
            className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 border-0"
          >
            <Download className="h-4 w-4 mr-1" />
            تصدير العملاء (CSV)
          </Button>
          
          <Button onClick={selectRandomCityDiscount} variant="outline" size="sm">
            <Gift className="h-4 w-4 mr-1" />
            اختيار مدينة للخصم
          </Button>

          {/* أدوات تطوير سريعة لاختبار فلترة الجنس */}
          <div className="flex gap-1">
            <Button 
              variant={filterType === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType('all')}
              className="text-xs"
            >
              الكل
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <CustomerStats 
        customers={customers}
        onStatClick={(statType) => {
          // إزالة فلتر المستوى عند النقر على كروت الإحصائيات
          setSelectedTier(null);
          // تطبيق الفلترة الجديدة
          setFilterType(statType);
          console.log('Stats filter applied:', statType);
          toast({
            title: 'تم تطبيق الفلتر',
            description: getFilterDescription(statType)
          });
        }}
      />


      {/* Enhanced Search and Filter Toolbar */}
      <SimpleCustomersToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        filterType={filterType}
        loyaltyTiers={loyaltyTiers} // إضافة مستويات الولاء
        onFilterChange={(type) => {
          setFilterType(type);
          // تعامل مع فلتر المستويات
          if (type.startsWith('tier_')) {
            const tierId = type.replace('tier_', '');
            setSelectedTier(tierId);
          } else {
            setSelectedTier(null);
          }
          if (type !== 'all') {
            toast({
              title: 'تم تطبيق الفلتر',
              description: getFilterDescription(type)
            });
          }
        }}
        totalCount={customers.length}
        filteredCount={filteredCustomers.length}
      />

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="customers">العملاء ({filteredCustomers.length})</TabsTrigger>
          <TabsTrigger value="cities">إحصائيات المدن</TabsTrigger>
          <TabsTrigger value="discounts">خصومات المدن</TabsTrigger>
        </TabsList>

        {/* Customers Tab */}
        <TabsContent value="customers" className="space-y-4">

          {/* Loyalty Tiers Overview */}
          <Card className="
            bg-gradient-to-br from-white/90 to-slate-50/90 dark:from-slate-900/90 dark:to-slate-800/90
            backdrop-blur-sm border border-border/60 shadow-xl
          ">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                مستويات الولاء
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {loyaltyTiers.map((tier, index) => {
                  const TierIcon = getTierIcon(tier.icon);
                  const customersInTier = customers.filter(c => 
                    c.customer_loyalty?.current_tier_id === tier.id
                  ).length;
                  
                  return (
                    <motion.div 
                      key={tier.id} 
                      className="
                        text-center p-6 rounded-xl cursor-pointer
                        bg-gradient-to-br from-white/80 to-slate-50/80 dark:from-slate-800/80 dark:to-slate-700/80
                        border border-border/50 shadow-lg hover:shadow-xl
                        backdrop-blur-sm transition-all duration-300
                        hover:scale-[1.02] hover:-translate-y-1
                      "
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ y: -2 }}
                      onClick={() => {
                        if (selectedTier === tier.id) {
                          setSelectedTier(null);
                          toast({
                            title: 'تم إزالة فلتر المستوى',
                            description: 'عرض جميع العملاء'
                          });
                        } else {
                          setSelectedTier(tier.id);
                          toast({
                            title: 'تم فلترة المستوى',
                            description: `عرض عملاء مستوى ${tier.name} فقط`
                          });
                        }
                      }}
                    >
                      <motion.div
                        whileHover={{ rotate: [0, -10, 10, 0] }}
                        transition={{ duration: 0.6 }}
                      >
                        <TierIcon 
                          className="h-10 w-10 mx-auto mb-3" 
                          style={{ color: tier.color }}
                        />
                      </motion.div>
                      <h3 className="font-bold text-lg mb-1">{tier.name}</h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        {tier.points_required} نقطة
                      </p>
                      <p className="text-2xl font-bold text-primary mb-3">
                        {selectedTier === tier.id 
                          ? filteredCustomers.length 
                          : customersInTier
                        }
                      </p>
                      <p className="text-xs text-muted-foreground mb-3">عميل</p>
                      {tier.discount_percentage > 0 && (
                        <Badge 
                          className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 shadow-md"
                        >
                          خصم {tier.discount_percentage}% شهرياً
                        </Badge>
                      )}
                      {selectedTier === tier.id && (
                        <div className="absolute top-2 right-2 w-3 h-3 bg-primary rounded-full animate-pulse"></div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Customers List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCustomers.map((customer, index) => (
              <CustomerCard
                key={customer.id}
                customer={customer}
                index={index}
                onViewDetails={viewCustomerDetails}
                onSendNotification={sendCustomNotification}
                onApplyDiscount={applyLoyaltyDiscount}
                tierIcons={tierIcons}
              />
            ))}
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

      {/* Enhanced Customer Details Dialog */}
      <CustomerDetailsDialog
        customer={selectedCustomer}
        open={!!selectedCustomer}
        onOpenChange={(open) => !open && setSelectedCustomer(null)}
      />

      {/* Enhanced Export Dialog */}
      <EnhancedExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        customers={customers}
        onExport={exportCustomersData}
        loyaltyTiers={loyaltyTiers}
      />
    </div>
  );
};

export default CustomersManagementPage;