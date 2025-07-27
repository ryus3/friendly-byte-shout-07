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
import TopProvincesDialog from '@/components/customers/TopProvincesDialog';

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
      
      // 🔥 الحل النهائي الأكيد لمشكلة مبيعات المدن
      console.log('=== 🚀 إعادة حساب جذرية لمبيعات المدن ===');
      
      try {
        // تحديد الشهر والسنة الحاليين بدقة
        const now = new Date();
        const currentMonth = now.getMonth() + 1; // 1-12
        const currentYear = now.getFullYear();
        
        console.log(`📅 الشهر الحالي: ${currentMonth}/${currentYear}`);
        
        // استعلام مباشر وشامل مع فلترة دقيقة للشهر الحالي
        const { data: allOrdersData, error: ordersError } = await supabase
          .from('orders')
          .select('id, order_number, customer_city, final_amount, total_amount, created_at, status, receipt_received')
          .gte('created_at', `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`)
          .lt('created_at', `${currentYear}-${(currentMonth + 1).toString().padStart(2, '0')}-01`);

        if (ordersError) {
          console.error('❌ خطأ في جلب الطلبات:', ordersError);
          setCityStats([]);
          return;
        }

        console.log(`📊 إجمالي طلبات الشهر الحالي: ${allOrdersData?.length || 0}`);
        
        // فلترة دقيقة للطلبات المكتملة والمستلمة فقط
        const validOrders = allOrdersData?.filter(order => {
          const isCompleted = order.status === 'completed';
          const isReceived = order.receipt_received === true;
          const hasCity = order.customer_city && order.customer_city.trim();
          const hasAmount = (order.final_amount || order.total_amount) > 0;
          
          const isValid = isCompleted && isReceived && hasCity && hasAmount;
          
          if (isValid) {
            const amount = order.final_amount || order.total_amount || 0;
            console.log(`✅ طلب صالح: ${order.order_number} | ${order.customer_city} | ${amount} د.ع | مكتمل: ${isCompleted} | مستلم: ${isReceived}`);
          }
          
          return isValid;
        }) || [];

        console.log(`🎯 الطلبات الصالحة للحساب: ${validOrders.length}`);

        // حساب إحصائيات المدن بدقة عالية
        const cityStatsMap = new Map();
        let totalSystemRevenue = 0;

        validOrders.forEach(order => {
          const cityName = order.customer_city.trim();
          const orderAmount = parseFloat(order.final_amount || order.total_amount || 0);
          
          if (!cityStatsMap.has(cityName)) {
            cityStatsMap.set(cityName, {
              id: `city_${cityName}`,
              city_name: cityName,
              total_orders: 0,
              total_amount: 0
            });
          }
          
          const cityData = cityStatsMap.get(cityName);
          cityData.total_orders += 1;
          cityData.total_amount += orderAmount;
          totalSystemRevenue += orderAmount;
          
          console.log(`✅ ${order.order_number}: ${cityName} +${orderAmount} = ${cityData.total_amount} د.ع (${cityData.total_orders} طلب)`);
        });

        // تحويل النتائج وترتيبها
        const finalCityStats = Array.from(cityStatsMap.values())
          .filter(city => city.total_orders > 0) // فقط المدن التي لها طلبات
          .sort((a, b) => b.total_orders - a.total_orders); // ترتيب حسب عدد الطلبات
        
        console.log('🎯 === النتائج النهائية المضمونة ===');
        console.log(`💰 إجمالي إيرادات النظام للشهر: ${totalSystemRevenue.toLocaleString('ar')} د.ع`);
        console.log(`🏛️ عدد المدن النشطة: ${finalCityStats.length}`);
        
        finalCityStats.forEach((city, index) => {
          console.log(`${index + 1}. 🏙️ ${city.city_name}: ${city.total_orders} طلب = ${city.total_amount.toLocaleString('ar')} د.ع`);
        });

        setCityStats(finalCityStats);
        console.log('✅ تم تحديث إحصائيات المدن بضمان دقة البيانات');
        
      } catch (error) {
        console.error('❌ خطأ في حساب إحصائيات المدن:', error);
        setCityStats([]);
      }

      
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
                        text-center p-6 rounded-xl cursor-pointer relative overflow-hidden
                        bg-gradient-to-br from-white/90 to-slate-50/90 dark:from-slate-800/90 dark:to-slate-700/90
                        border-2 border-border/50 shadow-xl hover:shadow-2xl
                        backdrop-blur-sm transition-all duration-300
                        hover:scale-[1.02] hover:-translate-y-2
                        hover:border-primary/50
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
                      <h3 className="font-bold text-xl mb-2 bg-gradient-to-r from-slate-700 to-slate-900 dark:from-slate-200 dark:to-slate-400 bg-clip-text text-transparent">
                        {tier.name}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-3 px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-full">
                        {tier.points_required} نقطة
                      </p>
                      <div className="bg-gradient-to-r from-primary/10 to-primary/20 rounded-lg p-3 mb-4">
                        <p className="text-3xl font-bold text-primary">
                          {selectedTier === tier.id 
                            ? filteredCustomers.length 
                            : customersInTier
                          }
                        </p>
                        <p className="text-xs text-muted-foreground">عميل</p>
                      </div>
                      
                      {/* عرض المزايا بناءً على المستوى */}
                      <div className="space-y-2">
                        {/* برونزي: لا مزايا - فقط لمعرفة النقاط */}
                        {tier.name === 'برونزي' && (
                          <Badge 
                            className="bg-gradient-to-r from-slate-400 to-slate-500 text-white border-0 shadow-md block"
                          >
                            🏁 بداية رحلة الولاء
                          </Badge>
                        )}
                        
                        {/* فضي: خصم فقط بدون توصيل مجاني */}
                        {tier.name === 'فضي' && tier.discount_percentage > 0 && (
                          <Badge 
                            className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 shadow-md block"
                          >
                            خصم {tier.discount_percentage}% شهرياً
                          </Badge>
                        )}
                        
                        {/* ذهبي وماسي: خصم + توصيل مجاني */}
                        {(tier.name === 'ذهبي' || tier.name === 'ماسي') && (
                          <>
                            {tier.discount_percentage > 0 && (
                              <Badge 
                                className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 shadow-md block"
                              >
                                خصم {tier.discount_percentage}% شهرياً
                              </Badge>
                            )}
                            
                            {tier.free_delivery_threshold !== null && tier.free_delivery_threshold === 0 && (
                              <Badge 
                                className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-0 shadow-md block"
                              >
                                🚚 توصيل مجاني دائماً
                              </Badge>
                            )}
                          </>
                        )}
                        
                        {tier.special_benefits && tier.special_benefits.length > 0 && (
                          <Badge 
                            className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 shadow-md block"
                          >
                            مزايا خاصة متاحة
                          </Badge>
                        )}
                      </div>
                      
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" dir="rtl">
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

        {/* Cities Stats Tab - كارت عالمي احترافي مذهل */}
        <TabsContent value="cities" className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <Card className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 text-white shadow-2xl hover:shadow-3xl transition-all duration-700 hover:scale-[1.01] border-0">
              <CardHeader className="relative z-10 pb-8">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-3xl font-bold flex items-center gap-4 mb-3">
                      <motion.div 
                        className="p-3 bg-white/20 rounded-xl backdrop-blur-sm shadow-lg"
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        transition={{ duration: 0.3 }}
                      >
                        <BarChart3 className="h-8 w-8" />
                      </motion.div>
                      تحليل أداء المدن العراقية
                    </CardTitle>
                    <p className="text-blue-100 text-lg leading-relaxed mb-2">
                      إحصائيات شاملة ودقيقة لأداء المبيعات في جميع المدن
                    </p>
                    <div className="flex items-center gap-2 text-sm text-blue-200">
                      <Sparkles className="h-4 w-4" />
                      <span>البيانات محسوبة مباشرة من الطلبات المكتملة والمُسلّمة</span>
                    </div>
                  </div>
                  
                  <TopProvincesDialog
                    trigger={
                      <motion.button
                        className="flex items-center gap-3 px-6 py-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl border border-white/30 font-bold transition-all duration-300 shadow-lg hover:shadow-xl"
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Eye className="h-5 w-5" />
                        التقرير التفصيلي المتكامل
                      </motion.button>
                    }
                  />
                </div>
                
                {/* عناصر تزيينية محسنة */}
                <motion.div 
                  className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full"
                  animate={{ 
                    scale: [1, 1.1, 1],
                    opacity: [0.3, 0.6, 0.3]
                  }}
                  transition={{ duration: 4, repeat: Infinity }}
                />
                <motion.div 
                  className="absolute -bottom-6 -left-6 w-32 h-32 bg-purple-400/20 rounded-full"
                  animate={{ 
                    scale: [1, 1.2, 1],
                    opacity: [0.2, 0.5, 0.2]
                  }}
                  transition={{ duration: 6, repeat: Infinity, delay: 1 }}
                />
                <motion.div 
                  className="absolute top-1/2 right-1/4 w-16 h-16 bg-pink-300/20 rounded-full"
                  animate={{ 
                    y: [0, -10, 0],
                    opacity: [0.3, 0.7, 0.3]
                  }}
                  transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
                />
                
                {/* شعاع ضوئي متحرك */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-purple-500/10" />
                <motion.div 
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  initial={{ x: '-100%' }}
                  animate={{ x: '200%' }}
                  transition={{ duration: 3, repeat: Infinity, repeatDelay: 4 }}
                />
              </CardHeader>
              
              <CardContent className="p-8 bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-slate-100 backdrop-blur-sm">
                {/* معلومات تفسيرية مهمة */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="mb-6 p-4 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-900/20 dark:via-indigo-900/20 dark:to-purple-900/20 rounded-xl border border-blue-200/50 dark:border-blue-800/50"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <motion.div
                      className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-lg"
                      whileHover={{ scale: 1.1, rotate: 5 }}
                    >
                      <Sparkles className="h-5 w-5 text-white" />
                    </motion.div>
                    <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200">شرح البيانات والحسابات</h4>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4 text-sm text-slate-600 dark:text-slate-400">
                    <div className="space-y-2">
                      <p>• <strong className="text-blue-600 dark:text-blue-400">المصدر:</strong> حسابات مباشرة من قاعدة البيانات</p>
                      <p>• <strong className="text-blue-600 dark:text-blue-400">التصفية:</strong> الطلبات المكتملة والمُسلّمة فقط</p>
                      <p>• <strong className="text-blue-600 dark:text-blue-400">الفترة:</strong> الشهر الحالي ({new Date().toLocaleDateString('ar', {month: 'long', year: 'numeric'})})</p>
                    </div>
                    <div className="space-y-2">
                      <p>• <strong className="text-emerald-600 dark:text-emerald-400">المبيعات:</strong> مجموع قيم الطلبات النهائية</p>
                      <p>• <strong className="text-emerald-600 dark:text-emerald-400">الترتيب:</strong> حسب عدد الطلبات (الأعلى أولاً)</p>
                      <p>• <strong className="text-emerald-600 dark:text-emerald-400">التحديث:</strong> فوري ومطابق لسجلات النظام</p>
                    </div>
                  </div>
                </motion.div>

                {cityStats.length > 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                  >
                    {cityStats.slice(0, 6).map((city, index) => (
                      <motion.div 
                        key={city.id}
                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                        className="relative overflow-hidden group"
                      >
                        {/* شريط الترتيب العلوي مع تدرج محسن */}
                        <div className={`absolute top-0 left-0 w-full h-1 ${
                          index === 0 ? 'bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600' :
                          index === 1 ? 'bg-gradient-to-r from-gray-300 via-gray-400 to-gray-500' :
                          index === 2 ? 'bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700' :
                          'bg-gradient-to-r from-blue-400 via-blue-500 to-purple-600'
                        }`} />
                        
                        <div className="relative bg-white dark:bg-slate-800 rounded-xl p-6 shadow-xl hover:shadow-2xl transition-all duration-500 hover:scale-[1.03] hover:-translate-y-2 border border-slate-200/50 dark:border-slate-700/50">
                          <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-3">
                              <motion.div 
                                className={`p-3 rounded-xl shadow-lg ${
                                  index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' :
                                  index === 1 ? 'bg-gradient-to-br from-gray-400 to-gray-600' :
                                  index === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-800' :
                                  'bg-gradient-to-br from-blue-500 to-purple-600'
                                }`}
                                whileHover={{ scale: 1.15, rotate: 10 }}
                                transition={{ duration: 0.3 }}
                              >
                                <MapPin className="h-5 w-5 text-white" />
                              </motion.div>
                              <div>
                                <h3 className="font-bold text-xl text-slate-800 dark:text-slate-100 mb-1">
                                  {city.city_name}
                                </h3>
                                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                                  <TrendingUp className="h-4 w-4" />
                                  <span className="font-medium">المرتبة #{index + 1}</span>
                                </div>
                              </div>
                            </div>
                            
                            <Badge 
                              className={`${
                                index === 0 ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white shadow-yellow-500/25' :
                                index === 1 ? 'bg-gradient-to-r from-gray-500 to-gray-600 text-white shadow-gray-500/25' :
                                index === 2 ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-amber-500/25' :
                                'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-blue-500/25'
                              } border-0 px-3 py-1 text-sm font-bold shadow-lg`}
                            >
                              {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅'}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/30 rounded-lg border border-blue-200/30 dark:border-blue-800/30">
                              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                                {city.total_orders}
                              </div>
                              <div className="text-xs text-blue-700 dark:text-blue-300 font-medium">طلب مكتمل</div>
                            </div>
                            
                            <div className="text-center p-4 bg-gradient-to-br from-emerald-50 to-green-100 dark:from-emerald-900/20 dark:to-green-900/30 rounded-lg border border-emerald-200/30 dark:border-emerald-800/30">
                              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mb-1 truncate" title={formatCurrency(city.total_amount)}>
                                {formatCurrency(city.total_amount)}
                              </div>
                              <div className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">إجمالي المبيعات</div>
                            </div>
                          </div>
                          
                          {/* مؤشر الأداء المحسن */}
                          <div className="mt-4">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">مؤشر الأداء</span>
                              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                {Math.min((city.total_orders / (cityStats[0]?.total_orders || 1)) * 100, 100).toFixed(0)}%
                              </span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                              <motion.div 
                                className={`h-full ${
                                  index === 0 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' :
                                  index === 1 ? 'bg-gradient-to-r from-gray-400 to-gray-600' :
                                  index === 2 ? 'bg-gradient-to-r from-amber-600 to-amber-800' :
                                  'bg-gradient-to-r from-blue-400 to-purple-600'
                                }`}
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min((city.total_orders / (cityStats[0]?.total_orders || 1)) * 100, 100)}%` }}
                                transition={{ duration: 1.5, delay: index * 0.1, ease: "easeOut" }}
                              />
                            </div>
                          </div>
                          
                          {/* تأثيرات بصرية محسنة */}
                          <div className="absolute -top-2 -right-2 w-4 h-4 bg-blue-400/20 rounded-full animate-pulse" />
                          <div className="absolute -bottom-2 -left-2 w-3 h-3 bg-purple-400/20 rounded-full animate-ping" />
                          
                          {/* تأثير ضوئي عند التمرير */}
                          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-xl" />
                        </div>
                      </motion.div>
                    ))}
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
                        scale: [1, 1.05, 1],
                        rotate: [0, 5, -5, 0]
                      }}
                      transition={{ 
                        duration: 4,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    >
                      <BarChart3 className="h-16 w-16 text-slate-400 dark:text-slate-500" />
                    </motion.div>
                    <motion.h3 
                      className="text-2xl font-bold text-slate-700 dark:text-slate-300 mb-3"
                      animate={{ opacity: [0.7, 1, 0.7] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      لا توجد بيانات للمدن هذا الشهر
                    </motion.h3>
                    <p className="text-slate-500 dark:text-slate-400 text-lg max-w-md mx-auto">
                      ستظهر إحصائيات المدن تلقائياً عند اكتمال طلبات جديدة
                    </p>
                  </motion.div>
                )}

                {/* رابط التقرير التفصيلي */}
                {cityStats.length > 6 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.8 }}
                    className="mt-8 text-center"
                  >
                    <TopProvincesDialog
                      trigger={
                        <motion.button
                          className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <Eye className="h-5 w-5" />
                          عرض جميع المدن ({cityStats.length}) والتحليل المتقدم
                          <Sparkles className="h-4 w-4" />
                        </motion.button>
                      }
                    />
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* City Discounts Tab */}
        <TabsContent value="discounts" className="space-y-4">
          <Card className="overflow-hidden bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 dark:from-violet-900/30 dark:via-purple-900/30 dark:to-fuchsia-900/30 border-0 shadow-2xl">
            <CardHeader className="relative bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 text-white pb-8">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZGVmcz4KICAgIDxwYXR0ZXJuIGlkPSJncmlkIiB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiPgogICAgICA8cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMSkiIHN0cm9rZS13aWR0aD0iMSIvPgogICAgPC9wYXR0ZXJuPgogIDwvZGVmcz4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIiAvPgo8L3N2Zz4=')] opacity-20" />
              <div className="relative z-10">
                <CardTitle className="text-3xl font-bold flex items-center gap-4">
                  <motion.div 
                    className="p-3 bg-white/20 rounded-xl backdrop-blur-sm shadow-lg"
                    animate={{ 
                      rotate: [0, 5, -5, 0],
                      scale: [1, 1.05, 1]
                    }}
                    transition={{ 
                      duration: 4,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    <Gift className="h-8 w-8" />
                  </motion.div>
                  <span className="bg-gradient-to-r from-white via-purple-100 to-white bg-clip-text text-transparent">
                    🎁 نظام خصومات المدن الخرافي
                  </span>
                </CardTitle>
                <p className="text-purple-100 mt-3 text-lg font-medium">المكافآت الشهرية المدهشة للمدن الأكثر نشاطاً ✨</p>
              </div>
              
              {/* تأثيرات بصرية خرافية */}
              <div className="absolute top-4 right-4 w-16 h-16 bg-white/10 rounded-full animate-pulse" />
              <div className="absolute bottom-3 left-10 w-10 h-10 bg-fuchsia-400/20 rounded-full animate-pulse delay-1000" />
              <div className="absolute top-1/2 right-1/4 w-8 h-8 bg-purple-300/20 rounded-full animate-pulse delay-500" />
              <div className="absolute top-6 left-1/3 w-6 h-6 bg-violet-300/30 rounded-full animate-ping delay-700" />
            </CardHeader>
            
            <CardContent className="p-8">
              {/* شرح الميزة الخرافي */}
              <motion.div 
                className="mb-8 bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-amber-900/30 dark:via-orange-900/30 dark:to-yellow-900/30 rounded-2xl p-6 border-2 border-amber-200/50 dark:border-amber-800/30 shadow-xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <div className="flex items-start gap-4">
                  <motion.div 
                    className="p-3 bg-gradient-to-br from-amber-500 via-orange-500 to-yellow-500 rounded-xl shadow-lg flex-shrink-0"
                    animate={{ 
                      boxShadow: [
                        "0 4px 20px rgba(245, 158, 11, 0.3)",
                        "0 8px 30px rgba(245, 158, 11, 0.5)",
                        "0 4px 20px rgba(245, 158, 11, 0.3)"
                      ]
                    }}
                    transition={{ 
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    <Sparkles className="h-6 w-6 text-white" />
                  </motion.div>
                  <div className="flex-1">
                    <h4 className="font-bold text-2xl text-amber-800 dark:text-amber-200 mb-4 flex items-center gap-2">
                      🎯 نظام المكافآت الذكي للمدن الرائدة
                      <motion.span
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        ⚡
                      </motion.span>
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <motion.div 
                        className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl border border-emerald-200/50 dark:border-emerald-800/30"
                        whileHover={{ scale: 1.02 }}
                        transition={{ duration: 0.2 }}
                      >
                        <p className="text-emerald-800 dark:text-emerald-200 font-semibold mb-2">🤖 النظام التلقائي الذكي</p>
                        <p className="text-emerald-700 dark:text-emerald-300">يختار المدن الأكثر نشاطاً في المبيعات والطلبات بذكاء خالص</p>
                      </motion.div>
                      
                      <motion.div 
                        className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200/50 dark:border-blue-800/30"
                        whileHover={{ scale: 1.02 }}
                        transition={{ duration: 0.2 }}
                      >
                        <p className="text-blue-800 dark:text-blue-200 font-semibold mb-2">🎁 مزايا خرافية شهرية</p>
                        <p className="text-blue-700 dark:text-blue-300">كل شهر مدينة واحدة تفوز بخصم 10% + توصيل مجاني</p>
                      </motion.div>
                      
                      <motion.div 
                        className="p-4 bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20 rounded-xl border border-purple-200/50 dark:border-purple-800/30"
                        whileHover={{ scale: 1.02 }}
                        transition={{ duration: 0.2 }}
                      >
                        <p className="text-purple-800 dark:text-purple-200 font-semibold mb-2">🎲 عشوائية عادلة مدهشة</p>
                        <p className="text-purple-700 dark:text-purple-300">طلبين عشوائيين: واحد خصم 10% وآخر توصيل مجاني</p>
                      </motion.div>
                      
                      <motion.div 
                        className="p-4 bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/20 dark:to-rose-900/20 rounded-xl border border-pink-200/50 dark:border-pink-800/30"
                        whileHover={{ scale: 1.02 }}
                        transition={{ duration: 0.2 }}
                      >
                        <p className="text-pink-800 dark:text-pink-200 font-semibold mb-2">🔔 إشعارات فورية رائعة</p>
                        <p className="text-pink-700 dark:text-pink-300">العملاء يُشعرون فوراً عند تطبيق المزايا على طلباتهم</p>
                      </motion.div>
                    </div>
                    
                    <motion.div 
                      className="mt-6 p-4 bg-gradient-to-r from-yellow-100 via-amber-100 to-orange-100 dark:from-yellow-900/30 dark:via-amber-900/30 dark:to-orange-900/30 rounded-xl border-2 border-yellow-300/50 dark:border-yellow-700/50"
                      animate={{ 
                        borderColor: [
                          "rgba(252, 211, 77, 0.5)",
                          "rgba(245, 158, 11, 0.7)",
                          "rgba(252, 211, 77, 0.5)"
                        ]
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <p className="text-yellow-800 dark:text-yellow-200 font-bold text-center flex items-center justify-center gap-2">
                        ⚖️ <span>نظام عادل 100% - كل مدينة لها فرصة الفوز حسب أداء سكانها!</span> 🏆
                      </p>
                    </motion.div>
                  </div>
                </div>
              </motion.div>

              {cityDiscounts.length > 0 ? (
                <div className="space-y-6">
                  {cityDiscounts.map((discount, index) => (
                    <motion.div 
                      key={discount.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.5, delay: index * 0.15 }}
                      className="relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/30 via-blue-500/30 to-purple-500/30 rounded-2xl blur-sm" />
                      <div className="relative bg-white/90 dark:bg-slate-800/90 backdrop-blur-lg border-2 border-emerald-200/70 dark:border-emerald-800/50 rounded-2xl p-8 shadow-2xl hover:shadow-3xl transition-all duration-500 group hover:scale-[1.02]">
                        
                        {/* الشريط العلوي الخرافي */}
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-500 via-blue-500 via-purple-500 to-pink-500 rounded-t-2xl" />
                        
                        {/* أيقونات متحركة في الخلفية */}
                        <div className="absolute top-4 right-4 opacity-10">
                          <motion.div
                            animate={{ 
                              rotate: [0, 360],
                              scale: [1, 1.2, 1]
                            }}
                            transition={{ 
                              duration: 8,
                              repeat: Infinity,
                              ease: "linear"
                            }}
                          >
                            <Gift className="h-16 w-16 text-emerald-500" />
                          </motion.div>
                        </div>
                        
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-6">
                            <motion.div 
                              className="p-4 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 rounded-2xl shadow-xl"
                              whileHover={{ 
                                scale: 1.15, 
                                rotate: 10,
                                boxShadow: "0 20px 40px rgba(16, 185, 129, 0.4)"
                              }}
                              transition={{ duration: 0.3 }}
                            >
                              <MapPin className="h-8 w-8 text-white" />
                            </motion.div>
                            <div>
                              <h3 className="font-bold text-3xl bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                                🏙️ {discount.city_name}
                              </h3>
                              <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400 mt-1">
                                <Calendar className="h-4 w-4" />
                                <span className="font-medium">شهر {discount.discount_month} - {discount.discount_year}</span>
                                <motion.span 
                                  className="px-3 py-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-bold rounded-full"
                                  animate={{ 
                                    boxShadow: [
                                      "0 0 0 0 rgba(251, 191, 36, 0.7)",
                                      "0 0 0 10px rgba(251, 191, 36, 0)",
                                      "0 0 0 0 rgba(251, 191, 36, 0.7)"
                                    ]
                                  }}
                                  transition={{ duration: 2, repeat: Infinity }}
                                >
                                  🎉 مدينة الشهر
                                </motion.span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex flex-col items-end gap-3">
                            <motion.div
                              className="bg-gradient-to-r from-emerald-500 to-green-600 text-white border-0 px-6 py-3 text-lg font-bold rounded-2xl shadow-xl"
                              whileHover={{ 
                                scale: 1.05,
                                boxShadow: "0 10px 30px rgba(16, 185, 129, 0.4)"
                              }}
                            >
                              <Sparkles className="h-5 w-5 mr-2 inline" />
                              خصم {discount.discount_percentage}%
                            </motion.div>
                            <motion.div
                              className="bg-gradient-to-r from-blue-500 to-cyan-600 text-white border-0 px-6 py-3 text-lg font-bold rounded-2xl shadow-xl"
                              whileHover={{ 
                                scale: 1.05,
                                boxShadow: "0 10px 30px rgba(59, 130, 246, 0.4)"
                              }}
                            >
                              <Truck className="h-5 w-5 mr-2 inline" />
                              توصيل مجاني
                            </motion.div>
                          </div>
                        </div>
                        
                        {/* رسالة التهنئة الخرافية */}
                        <motion.div 
                          className="bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-900/30 dark:via-teal-900/30 dark:to-cyan-900/30 rounded-2xl p-6 border-2 border-emerald-200/70 dark:border-emerald-800/40 mb-6"
                          whileHover={{ scale: 1.02 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="flex items-start gap-4">
                            <motion.div 
                              className="p-3 bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500 rounded-2xl shadow-lg"
                              animate={{ 
                                rotate: [0, -5, 5, 0],
                                scale: [1, 1.1, 1]
                              }}
                              transition={{ 
                                duration: 3,
                                repeat: Infinity,
                                ease: "easeInOut"
                              }}
                            >
                              <PartyPopper className="h-6 w-6 text-white" />
                            </motion.div>
                            <div className="flex-1">
                              <motion.p 
                                className="text-emerald-800 dark:text-emerald-200 font-bold text-xl leading-relaxed mb-2"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.5 }}
                              >
                                🎊 <strong>ألف مبروك لأهالي {discount.city_name} الكرام!</strong> 🎊
                              </motion.p>
                              <p className="text-emerald-700 dark:text-emerald-300 text-lg">
                                تم اختياركم كمدينة البطولة لهذا الشهر! استمتعوا بخصم {discount.discount_percentage}% وتوصيل مجاني على طلباتكم المميزة! 🚀✨
                              </p>
                            </div>
                          </div>
                        </motion.div>
                        
                        {/* إحصائيات رائعة */}
                        <div className="grid grid-cols-2 gap-6">
                          <motion.div 
                            className="text-center p-4 bg-gradient-to-br from-emerald-100 to-green-100 dark:from-emerald-900/40 dark:to-green-900/40 rounded-2xl border-2 border-emerald-300/50 dark:border-emerald-700/50"
                            whileHover={{ 
                              scale: 1.05,
                              boxShadow: "0 10px 25px rgba(16, 185, 129, 0.2)"
                            }}
                          >
                            <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400 mb-2">1</div>
                            <div className="text-sm text-emerald-700 dark:text-emerald-300 font-semibold">خصم متاح</div>
                          </motion.div>
                          <motion.div 
                            className="text-center p-4 bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/40 dark:to-cyan-900/40 rounded-2xl border-2 border-blue-300/50 dark:border-blue-700/50"
                            whileHover={{ 
                              scale: 1.05,
                              boxShadow: "0 10px 25px rgba(59, 130, 246, 0.2)"
                            }}
                          >
                            <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">1</div>
                            <div className="text-sm text-blue-700 dark:text-blue-300 font-semibold">توصيل مجاني</div>
                          </motion.div>
                        </div>
                        
                        {/* تأثيرات بصرية خرافية */}
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-emerald-400/40 rounded-full animate-ping" />
                        <div className="absolute -bottom-2 -left-2 w-4 h-4 bg-blue-400/40 rounded-full animate-pulse" />
                        <div className="absolute top-1/2 -left-1 w-3 h-3 bg-purple-400/40 rounded-full animate-bounce" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8 }}
                  className="text-center py-16"
                >
                  <div className="relative">
                    <motion.div 
                      className="w-32 h-32 mx-auto mb-8 bg-gradient-to-br from-violet-100 via-purple-100 to-fuchsia-100 dark:from-violet-900/40 dark:via-purple-900/40 dark:to-fuchsia-900/40 rounded-full flex items-center justify-center shadow-2xl border-4 border-violet-200/50 dark:border-violet-700/50"
                      animate={{ 
                        y: [0, -15, 0],
                        scale: [1, 1.08, 1],
                        rotate: [0, 3, -3, 0]
                      }}
                      transition={{ 
                        duration: 4,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    >
                      <Gift className="h-16 w-16 text-violet-500 dark:text-violet-400" />
                    </motion.div>
                    
                    {/* تأثيرات خرافية حول الأيقونة */}
                    <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
                      {[...Array(6)].map((_, i) => (
                        <motion.div
                          key={i}
                          className="absolute w-2 h-2 bg-violet-400/60 rounded-full"
                          animate={{
                            x: [0, Math.cos(i * 60 * Math.PI / 180) * 40],
                            y: [0, Math.sin(i * 60 * Math.PI / 180) * 40],
                            opacity: [0, 1, 0],
                            scale: [0, 1, 0]
                          }}
                          transition={{
                            duration: 3,
                            repeat: Infinity,
                            delay: i * 0.5,
                            ease: "easeInOut"
                          }}
                        />
                      ))}
                    </div>
                    
                    <motion.h3 
                      className="text-3xl font-bold bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 bg-clip-text text-transparent mb-4"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                    >
                      🌟 لا توجد مدن محظوظة حالياً 🌟
                    </motion.h3>
                    
                    <motion.p 
                      className="text-slate-500 dark:text-slate-400 mb-8 max-w-md mx-auto text-lg leading-relaxed"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.7 }}
                    >
                      النظام الذكي يختار المدن الرائدة تلقائياً بناءً على الأداء المتميز في المبيعات والطلبات ✨
                    </motion.p>
                    
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 1, type: "spring", stiffness: 200 }}
                    >
                      <Button 
                        onClick={selectRandomCityDiscount}
                        className="bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700 text-white shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 px-10 py-4 text-lg font-bold rounded-2xl border-0"
                        size="lg"
                      >
                        <motion.div
                          animate={{ 
                            rotate: [0, 10, -10, 0],
                            scale: [1, 1.1, 1]
                          }}
                          transition={{ 
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut"
                          }}
                        >
                          <Zap className="h-6 w-6 mr-3" />
                        </motion.div>
                        🎯 اختيار مدينة البطولة الشهرية
                      </Button>
                    </motion.div>
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