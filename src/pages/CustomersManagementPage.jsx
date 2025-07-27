import React, { useState, useEffect } from 'react';
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
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="customers">العملاء ({filteredCustomers.length})</TabsTrigger>
          <TabsTrigger value="city-stats">إحصائيات المدن</TabsTrigger>
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

        {/* إحصائيات المدن */}
        <TabsContent value="city-stats" className="space-y-6">
          <div className="grid gap-6">
            {/* كارت إحصائيات المدن المحسن والاحترافي */}
            <Card className="relative bg-gradient-to-br from-violet-500/10 via-purple-500/10 to-fuchsia-500/10 border-violet-200/50 dark:border-violet-800/30 overflow-hidden shadow-xl">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-600/5 to-fuchsia-600/5 dark:from-violet-400/5 dark:to-fuchsia-400/5"></div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-violet-500/20 to-purple-500/20 rounded-full -translate-y-16 translate-x-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-fuchsia-500/20 to-pink-500/20 rounded-full translate-y-12 -translate-x-12"></div>
              
              <CardHeader className="relative pb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-2xl blur-lg opacity-30"></div>
                      <div className="relative p-4 bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-2xl shadow-lg">
                        <BarChart3 className="h-8 w-8 text-white" />
                      </div>
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-bold bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 bg-clip-text text-transparent">
                        إحصائيات المدن العالمية
                      </CardTitle>
                      <p className="text-muted-foreground mt-1 text-sm">
                        أداء المدن المتميز • تحليل شامل • نظرة عامة احترافية
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge 
                      variant="secondary" 
                      className="px-4 py-2 bg-gradient-to-r from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 border border-violet-200/50 dark:border-violet-700/50"
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      {new Date().toLocaleDateString('ar', { month: 'long', year: 'numeric' })}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="relative pb-8">
                {cityStats.length > 0 ? (
                  <>
                    {/* ملخص سريع */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                      <div className="p-4 bg-gradient-to-br from-white/60 to-gray-50/60 dark:from-gray-800/60 dark:to-gray-900/60 rounded-xl border border-gray-200/50 dark:border-gray-700/50 backdrop-blur-sm">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg">
                            <MapPin className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">إجمالي المدن</p>
                            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{cityStats.length}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-4 bg-gradient-to-br from-white/60 to-gray-50/60 dark:from-gray-800/60 dark:to-gray-900/60 rounded-xl border border-gray-200/50 dark:border-gray-700/50 backdrop-blur-sm">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg">
                            <ShoppingBag className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">إجمالي الطلبات</p>
                            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                              {cityStats.reduce((sum, city) => sum + city.total_orders, 0)}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-4 bg-gradient-to-br from-white/60 to-gray-50/60 dark:from-gray-800/60 dark:to-gray-900/60 rounded-xl border border-gray-200/50 dark:border-gray-700/50 backdrop-blur-sm">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg">
                            <TrendingUp className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">إجمالي المبيعات</p>
                            <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                              {formatCurrency(cityStats.reduce((sum, city) => sum + city.total_amount, 0))}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* قائمة المدن الاحترافية */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {cityStats.slice(0, 9).map((city, index) => (
                        <motion.div
                          key={city.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="relative group"
                        >
                          <div className="p-6 rounded-2xl bg-gradient-to-br from-white/80 to-gray-50/80 dark:from-gray-800/80 dark:to-gray-900/80 border border-gray-200/50 dark:border-gray-700/50 hover:shadow-2xl hover:shadow-violet-500/10 transition-all duration-500 group-hover:border-violet-300/60 dark:group-hover:border-violet-600/40 backdrop-blur-sm group-hover:-translate-y-1">
                            {/* رقم الترتيب */}
                            <div className="absolute -top-3 -right-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-lg ${
                                index === 0 ? "bg-gradient-to-br from-yellow-400 to-orange-500" :
                                index === 1 ? "bg-gradient-to-br from-gray-400 to-gray-600" :
                                index === 2 ? "bg-gradient-to-br from-orange-400 to-red-500" :
                                "bg-gradient-to-br from-violet-400 to-purple-500"
                              }`}>
                                {index + 1}
                              </div>
                            </div>

                            {/* اسم المدينة */}
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-lg font-bold text-gray-800 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                                {city.city_name}
                              </h4>
                              {index < 3 && (
                                <div className="flex items-center gap-1">
                                  {index === 0 && <Crown className="h-4 w-4 text-yellow-500" />}
                                  {index === 1 && <Medal className="h-4 w-4 text-gray-500" />}
                                  {index === 2 && <Award className="h-4 w-4 text-orange-500" />}
                                </div>
                              )}
                            </div>

                            {/* الإحصائيات */}
                            <div className="space-y-3">
                              <div className="flex justify-between items-center p-3 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg">
                                <div className="flex items-center gap-2">
                                  <ShoppingBag className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                  <span className="text-sm text-blue-700 dark:text-blue-300">الطلبات</span>
                                </div>
                                <span className="font-bold text-blue-600 dark:text-blue-400">
                                  {city.total_orders}
                                </span>
                              </div>
                              
                              <div className="flex justify-between items-center p-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg">
                                <div className="flex items-center gap-2">
                                  <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                                  <span className="text-sm text-green-700 dark:text-green-300">المبيعات</span>
                                </div>
                                <span className="font-bold text-green-600 dark:text-green-400 text-sm">
                                  {formatCurrency(city.total_amount)}
                                </span>
                              </div>

                              {/* متوسط قيمة الطلب */}
                              <div className="flex justify-between items-center p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg">
                                <div className="flex items-center gap-2">
                                  <BarChart3 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                  <span className="text-sm text-purple-700 dark:text-purple-300">متوسط الطلب</span>
                                </div>
                                <span className="font-bold text-purple-600 dark:text-purple-400 text-sm">
                                  {formatCurrency(Math.round(city.total_amount / city.total_orders))}
                                </span>
                              </div>
                            </div>
                            
                            {/* مؤشر المدينة المختارة */}
                            {cityDiscounts.some(discount => discount.city_name === city.city_name) && (
                              <div className="mt-4 p-3 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-lg border border-green-200/50 dark:border-green-700/50">
                                <div className="flex items-center gap-2">
                                  <div className="relative">
                                    <Gift className="h-5 w-5 text-green-600 dark:text-green-400" />
                                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                  </div>
                                  <span className="text-sm font-medium text-green-700 dark:text-green-300">
                                    مدينة مميزة • خصائص خاصة
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12">
                    <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4 opacity-50" />
                    <p className="text-gray-500 dark:text-gray-400 text-lg">لا توجد إحصائيات للمدن هذا الشهر</p>
                    <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">ستظهر البيانات عند وجود طلبات من المدن</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* نظام خصومات المدن المحسن */}
            <Card className="relative bg-gradient-to-br from-emerald-500/10 via-teal-500/10 to-cyan-500/10 border-emerald-200/50 dark:border-emerald-800/30 overflow-hidden shadow-xl">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/5 to-cyan-600/5 dark:from-emerald-400/5 dark:to-cyan-400/5"></div>
              <div className="absolute top-0 left-0 w-28 h-28 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-full -translate-y-14 -translate-x-14"></div>
              
              <CardHeader className="relative pb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl blur-lg opacity-30"></div>
                      <div className="relative p-4 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-lg">
                        <PartyPopper className="h-8 w-8 text-white" />
                      </div>
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent">
                        نظام المدن المميزة الذكي
                      </CardTitle>
                      <p className="text-muted-foreground mt-1 text-sm">
                        كل شهر • طلبين عشوائيين • خصم 10% أو توصيل مجاني • مفاجآت للعملاء
                      </p>
                    </div>
                  </div>
                  <Button 
                    onClick={selectRandomCityDiscount}
                    className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                    size="sm"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    اختيار مدينة جديدة
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="relative pb-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* شرح النظام */}
                  <div className="space-y-6">
                    <div className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-2xl border border-blue-200/50 dark:border-blue-700/50">
                      <div className="flex items-center gap-3 mb-4">
                        <Zap className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        <h4 className="text-lg font-bold text-blue-800 dark:text-blue-300">آلية عمل النظام</h4>
                      </div>
                      <div className="space-y-3">
                        {[
                          "نختار أفضل المدن من الشهر السابق تلقائياً",
                          "كل مدينة مختارة تحصل على مزايا خاصة",
                          "طلبين عشوائيين شهرياً لكل مدينة",
                          "خصم 10% أو توصيل مجاني عشوائي"
                        ].map((item, index) => (
                          <div key={index} className="flex items-center gap-3 text-blue-700 dark:text-blue-300">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <span className="text-sm">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl border border-green-200/50 dark:border-green-700/50">
                      <div className="flex items-center gap-3 mb-4">
                        <Gift className="h-6 w-6 text-green-600 dark:text-green-400" />
                        <h4 className="text-lg font-bold text-green-800 dark:text-green-300">المزايا والعروض</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { icon: "💰", text: "خصم 10%" },
                          { icon: "🚚", text: "توصيل مجاني" },
                          { icon: "🔔", text: "إشعارات خاصة" },
                          { icon: "⭐", text: "أولوية في الخدمة" }
                        ].map((item, index) => (
                          <div key={index} className="flex items-center gap-2 p-2 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                            <span className="text-lg">{item.icon}</span>
                            <span className="text-sm text-green-700 dark:text-green-300 font-medium">{item.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* المدن المختارة حالياً */}
                  <div className="space-y-6">
                    <h4 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-3">
                      <Truck className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                      المدن المميزة هذا الشهر
                    </h4>
                    
                    {cityDiscounts.length > 0 ? (
                      <div className="space-y-4">
                        {cityDiscounts.map((discount, index) => (
                          <motion.div
                            key={discount.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.2 }}
                            className="p-6 bg-gradient-to-r from-yellow-50 via-orange-50 to-red-50 dark:from-yellow-900/20 dark:via-orange-900/20 dark:to-red-900/20 rounded-2xl border border-yellow-200/50 dark:border-yellow-700/50 shadow-lg hover:shadow-xl transition-all duration-300"
                          >
                            <div className="flex items-center justify-between mb-4">
                              <h5 className="text-xl font-bold text-yellow-800 dark:text-yellow-300 flex items-center gap-3">
                                <Crown className="h-6 w-6" />
                                {discount.city_name}
                              </h5>
                              <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-0 px-3 py-1">
                                🎯 نشط
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="p-3 bg-white/60 dark:bg-gray-800/60 rounded-lg">
                                <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-1">نسبة الخصم</p>
                                <p className="text-lg font-bold text-yellow-800 dark:text-yellow-200">
                                  {discount.discount_percentage}%
                                </p>
                              </div>
                              <div className="p-3 bg-white/60 dark:bg-gray-800/60 rounded-lg">
                                <p className="text-xs text-yellow-700 dark:text-yellow-300 mb-1">العروض الشهرية</p>
                                <p className="text-lg font-bold text-yellow-800 dark:text-yellow-200">
                                  طلبين مميزين
                                </p>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        <PartyPopper className="h-16 w-16 mx-auto mb-4 opacity-30" />
                        <p className="text-lg mb-2">لا توجد مدن مختارة حالياً</p>
                        <p className="text-sm">اضغط على "اختيار مدينة جديدة" لبدء النظام</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* City Discounts Tab */}
        <TabsContent value="discounts" className="space-y-4">
          <Card className="overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900/50 dark:to-blue-900/30 border-0 shadow-xl">
            <CardHeader className="relative bg-gradient-to-r from-blue-600 to-purple-600 text-white pb-8">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZGVmcz4KICAgIDxwYXR0ZXJuIGlkPSJncmlkIiB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiPgogICAgICA8cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMSkiIHN0cm9rZS13aWR0aD0iMSIvPgogICAgPC9wYXR0ZXJuPgogIDwvZGVmcz4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIiAvPgo8L3N2Zz4=')] opacity-20" />
              <div className="relative z-10">
                <CardTitle className="text-2xl font-bold flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                    <Gift className="h-6 w-6" />
                  </div>
                  خصومات المدن الحالية
                </CardTitle>
                <p className="text-blue-100 mt-2">نظام المكافآت الشهرية للمدن النشطة</p>
              </div>
              
              {/* Decorative elements */}
              <div className="absolute top-4 right-4 w-12 h-12 bg-white/10 rounded-full animate-pulse" />
              <div className="absolute bottom-2 left-8 w-8 h-8 bg-purple-400/20 rounded-full animate-pulse delay-1000" />
              <div className="absolute top-1/2 right-1/3 w-6 h-6 bg-blue-300/20 rounded-full animate-pulse delay-500" />
            </CardHeader>
            
            <CardContent className="p-6">
              {cityDiscounts.length > 0 ? (
                <div className="space-y-6">
                  {cityDiscounts.map((discount, index) => (
                    <motion.div 
                      key={discount.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      className="relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-blue-500/20 rounded-xl" />
                      <div className="relative bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-emerald-200/50 dark:border-emerald-800/30 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 group">
                        {/* الشريط العلوي المتدرج */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500" />
                        
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-4">
                            <motion.div 
                              className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full shadow-lg"
                              whileHover={{ scale: 1.1, rotate: 5 }}
                              transition={{ duration: 0.2 }}
                            >
                              <MapPin className="h-6 w-6 text-white" />
                            </motion.div>
                            <div>
                              <h3 className="font-bold text-xl text-slate-800 dark:text-slate-100">
                                {discount.city_name}
                              </h3>
                              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                <Calendar className="h-4 w-4" />
                                <span>شهر {discount.discount_month} - {discount.discount_year}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex flex-col items-end gap-2">
                            <Badge className="bg-gradient-to-r from-emerald-500 to-green-600 text-white border-0 px-4 py-2 text-sm font-bold shadow-md">
                              <Sparkles className="h-4 w-4 mr-1" />
                              خصم {discount.discount_percentage}%
                            </Badge>
                            <Badge className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white border-0 px-4 py-2 text-sm font-bold shadow-md">
                              <Truck className="h-4 w-4 mr-1" />
                              توصيل مجاني
                            </Badge>
                          </div>
                        </div>
                        
                        {/* محتوى التهنئة */}
                        <div className="bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-900/20 dark:to-blue-900/20 rounded-lg p-4 border border-emerald-200/50 dark:border-emerald-800/30">
                          <div className="flex items-start gap-3">
                            <div className="p-2 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg shadow-md">
                              <PartyPopper className="h-5 w-5 text-white" />
                            </div>
                            <div className="flex-1">
                              <p className="text-emerald-800 dark:text-emerald-200 font-medium leading-relaxed">
                                🎉 <strong>تهانينا لسكان {discount.city_name}!</strong>
                              </p>
                              <p className="text-emerald-700 dark:text-emerald-300 text-sm mt-1">
                                تم اختياركم كمدينة الشهر للحصول على مزايا خاصة: خصم {discount.discount_percentage}% وتوصيل مجاني!
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        {/* معلومات إضافية */}
                        <div className="grid grid-cols-2 gap-4 mt-4">
                          <div className="text-center p-3 bg-white/60 dark:bg-slate-700/60 rounded-lg border border-slate-200/50 dark:border-slate-600/50">
                            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">1</div>
                            <div className="text-xs text-slate-600 dark:text-slate-400">خصم متاح</div>
                          </div>
                          <div className="text-center p-3 bg-white/60 dark:bg-slate-700/60 rounded-lg border border-slate-200/50 dark:border-slate-600/50">
                            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">1</div>
                            <div className="text-xs text-slate-600 dark:text-slate-400">توصيل مجاني</div>
                          </div>
                        </div>
                        
                        {/* تأثيرات بصرية */}
                        <div className="absolute -top-2 -right-2 w-4 h-4 bg-emerald-400/30 rounded-full animate-ping" />
                        <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-blue-400/30 rounded-full animate-pulse" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  className="text-center py-12"
                >
                  <div className="relative">
                    <motion.div 
                      className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-full flex items-center justify-center shadow-lg"
                      animate={{ 
                        y: [0, -10, 0],
                        scale: [1, 1.05, 1]
                      }}
                      transition={{ 
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    >
                      <Gift className="h-12 w-12 text-slate-400 dark:text-slate-500" />
                    </motion.div>
                    <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-2">
                      لا توجد خصومات مدن نشطة حالياً
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
                      سيتم اختيار المدن تلقائياً بناءً على أداء المبيعات والطلبات
                    </p>
                    <Button 
                      onClick={selectRandomCityDiscount}
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 px-8 py-3"
                      size="lg"
                    >
                      <Zap className="h-5 w-5 mr-2" />
                      اختيار مدينة للخصم الشهري
                    </Button>
                  </div>
                </motion.div>
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