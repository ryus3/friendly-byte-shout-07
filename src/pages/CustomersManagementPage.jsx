import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Download, Star, Gift, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/customSupabaseClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import CustomerFilters from '@/components/customers/CustomerFilters';
import CustomerStats from '@/components/customers/CustomerStats';
import CustomerCard from '@/components/customers/CustomerCard';
import ExportDialog from '@/components/customers/ExportDialog';

const CustomersManagementPage = () => {
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustomerDetails, setShowCustomerDetails] = useState(false);
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [loyaltyTiers, setLoyaltyTiers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [cityStats, setCityStats] = useState([]);
  const [monthlyDiscount, setMonthlyDiscount] = useState(null);
  
  // Filter states
  const [activeFilter, setActiveFilter] = useState('all');
  const [filters, setFilters] = useState({
    searchTerm: '',
    timeFilter: 'all',
    pointsFilter: 'all',
    loyaltyTierFilter: 'all',
    genderSegmentation: 'all',
    departmentFilter: 'all',
    dateRange: null
  });

  // جلب بيانات العملاء مع تفاصيل الولاء
  const fetchCustomers = async () => {
    try {
      setLoading(true);
      
      // جلب العملاء مع إحصائيات مدمجة من الطلبات المكتملة
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select(`
          *,
          customer_loyalty (
            total_points,
            total_orders,
            total_spent,
            current_tier_id,
            loyalty_tiers (
              name,
              color,
              icon,
              discount_percentage,
              points_required
            )
          ),
          customer_product_segments (
            gender_segment,
            departments (name),
            categories (name),
            product_types (name)
          )
        `)
        .order('created_at', { ascending: false });

      if (customersError) throw customersError;

      // حساب عدد أعضاء كل مستوى ولاء
      const tierCounts = {};
      const processedCustomers = (customersData || []).map(customer => {
        const loyaltyData = customer.customer_loyalty?.[0];
        
        // عد الأعضاء لكل مستوى
        if (loyaltyData?.current_tier_id) {
          const tierId = loyaltyData.current_tier_id;
          tierCounts[tierId] = (tierCounts[tierId] || 0) + 1;
        }
        
        return customer;
      });

      // إضافة عدد الأعضاء لمستويات الولاء
      const updatedTiers = loyaltyTiers.map(tier => ({
        ...tier,
        memberCount: tierCounts[tier.id] || 0
      }));
      
      setLoyaltyTiers(updatedTiers);
      setCustomers(processedCustomers);
      setFilteredCustomers(processedCustomers);
      
      console.log('بيانات العملاء المحملة:', processedCustomers);
      
    } catch (error) {
      console.error('خطأ في جلب العملاء:', error);
      toast({
        title: 'خطأ في جلب البيانات',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // جلب إحصائيات المدن وخصم المدينة المختارة
  const fetchCityStatsAndDiscounts = async () => {
    try {
      // إحصائيات المدن
      const { data: cityData, error: cityError } = await supabase
        .from('customers')
        .select(`
          city,
          customer_loyalty!inner(total_orders, total_spent)
        `)
        .not('city', 'is', null);

      if (cityError) throw cityError;

      // تجميع البيانات حسب المدينة
      const cityMap = {};
      cityData?.forEach(customer => {
        const city = customer.city;
        if (!cityMap[city]) {
          cityMap[city] = {
            city_name: city,
            customer_count: 0,
            total_orders: 0,
            total_amount: 0
          };
        }
        cityMap[city].customer_count++;
        cityMap[city].total_orders += customer.customer_loyalty?.total_orders || 0;
        cityMap[city].total_amount += customer.customer_loyalty?.total_spent || 0;
      });

      const cityStatsArray = Object.values(cityMap)
        .sort((a, b) => b.total_orders - a.total_orders)
        .slice(0, 10);

      setCityStats(cityStatsArray);

      // خصم المدينة الشهري
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      
      const { data: discountData } = await supabase
        .from('city_random_discounts')
        .select('*')
        .eq('discount_month', currentMonth)
        .eq('discount_year', currentYear)
        .single();

      if (discountData) {
        setMonthlyDiscount(discountData);
      }

    } catch (error) {
      console.error('خطأ في جلب إحصائيات المدن:', error);
    }
  };

  // جلب مستويات الولاء والأقسام والتصنيفات للفلترة  
  const fetchSupportingData = async () => {
    try {
      const [tiersRes, categoriesRes, departmentsRes] = await Promise.all([
        supabase.from('loyalty_tiers').select('*').order('points_required'),
        supabase.from('categories').select('*').order('name'),
        supabase.from('departments').select('*').order('name')
      ]);

      if (tiersRes.data) setLoyaltyTiers(tiersRes.data);
      
      const allFilters = [
        ...(departmentsRes.data || []).map(d => ({...d, type: 'department'})),
        ...(categoriesRes.data || []).map(c => ({...c, type: 'category'}))
      ];
      setDepartments(allFilters);
      
      await checkAndApplyCityDiscount();
    } catch (error) {
      console.error('خطأ في جلب البيانات المساعدة:', error);
    }
  };

  useEffect(() => {
    fetchCustomers();
    fetchSupportingData();
    fetchCityStatsAndDiscounts();
  }, []);

  // تطبيق الفلاتر
  useEffect(() => {
    let filtered = customers.filter(customer => {
      // فلتر البحث
      const matchesSearch = !filters.searchTerm || 
        customer.name.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        customer.phone?.includes(filters.searchTerm) ||
        customer.email?.toLowerCase().includes(filters.searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      // فلتر النقاط
      const customerPoints = customer.customer_loyalty?.[0]?.total_points || 0;
      if (filters.pointsFilter === 'with_points' && customerPoints === 0) return false;
      if (filters.pointsFilter === 'no_points' && customerPoints > 0) return false;
      if (filters.pointsFilter === 'high_points' && customerPoints < 1000) return false;

      // فلتر مستوى الولاء
      if (filters.loyaltyTierFilter !== 'all') {
        const customerTier = customer.customer_loyalty?.[0]?.current_tier_id;
        if (customerTier !== filters.loyaltyTierFilter) return false;
      }

      // فلتر الجنس
      if (filters.genderSegmentation !== 'all') {
        const hasGenderSegment = customer.customer_product_segments?.some(seg => 
          seg.gender_segment === filters.genderSegmentation
        );
        if (!hasGenderSegment) return false;
      }

      // فلتر حسب القسم/التصنيف
      if (filters.departmentFilter !== 'all') {
        const hasSegment = customer.customer_product_segments?.some(seg => 
          seg.department_id === filters.departmentFilter || seg.category_id === filters.departmentFilter
        );
        if (!hasSegment) return false;
      }

      // فلتر الوقت
      if (filters.timeFilter !== 'all') {
        const customerDate = new Date(customer.created_at);
        const now = new Date();
        
        if (filters.timeFilter === 'today') {
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          if (customerDate < today) return false;
        } else if (filters.timeFilter === 'week') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (customerDate < weekAgo) return false;
        } else if (filters.timeFilter === 'month') {
          const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          if (customerDate < monthAgo) return false;
        }
      }

      return true;
    });

    // تطبيق الفلتر النشط من الكروت
    if (activeFilter === 'with_points') {
      filtered = filtered.filter(c => (c.customer_loyalty?.[0]?.total_points || 0) > 0);
    } else if (activeFilter === 'with_phones') {
      filtered = filtered.filter(c => c.phone);
    } else if (activeFilter === 'high_points') {
      filtered = filtered.filter(c => (c.customer_loyalty?.[0]?.total_points || 0) >= 1000);
    }

    setFilteredCustomers(filtered);
  }, [customers, filters, activeFilter]);

  // إحصائيات العملاء
  const customersWithPoints = customers.filter(c => (c.customer_loyalty?.[0]?.total_points || 0) > 0).length;
  const customersWithPhones = customers.filter(c => c.phone).length;
  const highPointsCustomers = customers.filter(c => (c.customer_loyalty?.[0]?.total_points || 0) >= 1000).length;

  const handleExport = (exportType, includeFields) => {
    let dataToExport = [];
    
    switch (exportType) {
      case 'with_points':
        dataToExport = customers.filter(c => c.customer_loyalty?.[0]?.total_points > 0);
        break;
      case 'with_phones':
        dataToExport = customers.filter(c => c.phone);
        break;
      case 'high_points':
        dataToExport = customers.filter(c => c.customer_loyalty?.[0]?.total_points >= 1000);
        break;
      case 'male_segment':
        dataToExport = customers.filter(c => c.customer_product_segments?.some(s => s.gender_segment === 'male'));
        break;
      case 'female_segment':
        dataToExport = customers.filter(c => c.customer_product_segments?.some(s => s.gender_segment === 'female'));
        break;
      default:
        dataToExport = customers;
    }

    const csvHeaders = [];
    
    if (includeFields.basic) {
      csvHeaders.push('الاسم', 'الهاتف', 'البريد الإلكتروني');
    }
    if (includeFields.location) {
      csvHeaders.push('المحافظة', 'المدينة', 'العنوان');
    }
    if (includeFields.loyalty) {
      csvHeaders.push('إجمالي النقاط', 'إجمالي الطلبات', 'مستوى الولاء', 'إجمالي المشتريات');
    }
    if (includeFields.segments) {
      csvHeaders.push('الجمهور المستهدف', 'التقسيمات');
    }
    csvHeaders.push('تاريخ التسجيل');

    const csvData = dataToExport.map(customer => {
      const row = [];
      
      if (includeFields.basic) {
        row.push(
          customer.name,
          customer.phone || '',
          customer.email || ''
        );
      }
      if (includeFields.location) {
        row.push(
          customer.province || '',
          customer.city || '',
          customer.address || ''
        );
      }
      if (includeFields.loyalty) {
        row.push(
          customer.customer_loyalty?.[0]?.total_points || 0,
          customer.customer_loyalty?.[0]?.total_orders || 0,
          customer.customer_loyalty?.[0]?.loyalty_tiers?.name || 'لا يوجد',
          customer.customer_loyalty?.[0]?.total_spent || 0
        );
      }
      if (includeFields.segments) {
        const genderSegment = customer.customer_product_segments?.[0]?.gender_segment;
        const genderText = genderSegment === 'male' ? 'رجالي' : genderSegment === 'female' ? 'نسائي' : 'للجنسين';
        const segments = customer.customer_product_segments?.map(s => 
          s.departments?.name || s.categories?.name || 'غير محدد'
        ).join(', ') || 'غير محدد';
        
        row.push(genderText, segments);
      }
      row.push(customer.created_at ? new Date(customer.created_at).toLocaleDateString('ar') : '');
      
      return row;
    });

    const csvContent = [
      csvHeaders.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    
    const filterSuffix = exportType === 'all' ? '' : 
                        exportType === 'with_points' ? '_مع_نقاط' :
                        exportType === 'with_phones' ? '_مع_هواتف' :
                        exportType === 'high_points' ? '_نقاط_عالية' :
                        exportType === 'male_segment' ? '_جمهور_رجالي' :
                        exportType === 'female_segment' ? '_جمهور_نسائي' : '';
    
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

  const checkAndApplyCityDiscount = async () => {
    try {
      const currentMonth = new Date().getMonth() + 1;
      const currentYear = new Date().getFullYear();
      
      const { data: existingDiscount } = await supabase
        .from('city_random_discounts')
        .select('*')
        .eq('discount_month', currentMonth)
        .eq('discount_year', currentYear)
        .single();
        
      if (!existingDiscount) {
        const { data: result } = await supabase.rpc('select_random_city_for_monthly_discount');
        console.log('نتيجة اختيار المدينة:', result);
      }
    } catch (error) {
      console.error('خطأ في تطبيق خصم المدينة:', error);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-3 md:p-6">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">جاري تحميل بيانات العملاء...</p>
          </div>
      </div>
    </div>
  );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <div className="container mx-auto p-3 md:p-6 space-y-6 max-w-7xl">
        {/* هيدر حديث وجذاب */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 p-6 md:p-8 border border-primary/20">
          <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
          <div className="relative z-10">
            <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
              <div className="space-y-2">
                <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  🏪 إدارة العملاء
                </h1>
                <p className="text-lg text-muted-foreground max-w-2xl">
                  منصة متطورة لإدارة قاعدة عملائك ونظام الولاء الذكي
                </p>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full">
                    <Star className="h-4 w-4 text-primary" />
                    <span>200 نقطة لكل طلب مكتمل</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 bg-green-100 rounded-full">
                    <Gift className="h-4 w-4 text-green-600" />
                    <span>خصومات تلقائية للولاء</span>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                <Button 
                  onClick={() => setShowExportDialog(true)} 
                  className="gap-2 bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-700 shadow-lg"
                  size="lg"
                >
                  <Download className="h-5 w-5" />
                  تصدير البيانات
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* إعلان خصم المدينة الشهري */}
        {monthlyDiscount && (
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 p-4 shadow-sm">
            <div className="absolute inset-0 bg-pattern opacity-5"></div>
            <div className="relative flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-full">
                <Gift className="h-6 w-6 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-green-800">🎉 خصم المدينة المختارة</h3>
                <p className="text-green-700">
                  مدينة <span className="font-bold">{monthlyDiscount.city_name}</span> مختارة للحصول على خصم خاص 
                  <span className="font-bold text-lg"> {monthlyDiscount.discount_percentage}%</span> هذا الشهر!
                </p>
              </div>
            </div>
          </div>
        )}

      {/* الإحصائيات */}
      <CustomerStats
        totalCustomers={customers.length}
        customersWithPoints={customersWithPoints}
        customersWithPhones={customersWithPhones}
        highPointsCustomers={highPointsCustomers}
        cityStats={cityStats}
        loyaltyTiers={loyaltyTiers}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />

      {/* الفلاتر */}
      <CustomerFilters
        filters={filters}
        onFiltersChange={setFilters}
        loyaltyTiers={loyaltyTiers}
        departments={departments}
        activeFilter={activeFilter}
        onActiveFilterChange={setActiveFilter}
        customersWithPoints={customersWithPoints}
        customersWithPhones={customersWithPhones}
        totalCustomers={filteredCustomers.length}
      />

        {/* قائمة العملاء المحسنة */}
        <Card className="border-0 shadow-xl bg-gradient-to-br from-card to-card/50">
          <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5 rounded-t-lg pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl md:text-2xl font-bold flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                قائمة العملاء
                <Badge variant="secondary" className="text-lg px-3 py-1">
                  {filteredCustomers.length}
                </Badge>
              </CardTitle>
            </div>
            {filteredCustomers.length === 0 && (
              <p className="text-muted-foreground">لا توجد نتائج تطابق معايير البحث</p>
            )}
          </CardHeader>
          <CardContent className="p-4 md:p-6">
            <div className="grid gap-4 md:gap-6">
              {filteredCustomers.map((customer, index) => (
                <div 
                  key={customer.id}
                  className="animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <CustomerCard
                    customer={customer}
                    onViewDetails={(customer) => {
                      setSelectedCustomer(customer);
                      setShowCustomerDetails(true);
                    }}
                    onSendNotification={(customer) => {
                      setSelectedCustomer(customer);
                      setShowNotificationDialog(true);
                    }}
                  />
                </div>
              ))}
              
              {filteredCustomers.length === 0 && customers.length > 0 && (
                <div className="text-center py-12">
                  <div className="p-4 bg-muted/30 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <Users className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">لا توجد نتائج</h3>
                  <p className="text-muted-foreground">جرب تعديل معايير البحث للعثور على العملاء</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

      {/* نافذة تفاصيل العميل - محسنة للهاتف */}
      <Dialog open={showCustomerDetails} onOpenChange={setShowCustomerDetails}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تفاصيل العميل</DialogTitle>
          </DialogHeader>
          
          {selectedCustomer && (
            <div className="space-y-4 md:space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="font-semibold">المعلومات الأساسية</Label>
                  <div className="space-y-2 mt-2 text-sm">
                    <p><span className="font-medium">الاسم:</span> {selectedCustomer.name}</p>
                    <p><span className="font-medium">الهاتف:</span> {selectedCustomer.phone || 'غير متوفر'}</p>
                    <p><span className="font-medium">البريد:</span> {selectedCustomer.email || 'غير متوفر'}</p>
                    <p><span className="font-medium">العنوان:</span> {selectedCustomer.address || 'غير محدد'}</p>
                    <p><span className="font-medium">المدينة:</span> {selectedCustomer.city || 'غير محددة'}</p>
                    <p><span className="font-medium">المحافظة:</span> {selectedCustomer.province || 'غير محددة'}</p>
                  </div>
                </div>

                <div>
                  <Label className="font-semibold">معلومات الولاء</Label>
                  <div className="space-y-2 mt-2 text-sm">
                    {selectedCustomer.customer_loyalty?.[0] ? (
                      <>
                        <p><span className="font-medium">إجمالي النقاط:</span> {selectedCustomer.customer_loyalty[0].total_points.toLocaleString()}</p>
                        <p><span className="font-medium">إجمالي الطلبات:</span> {selectedCustomer.customer_loyalty[0].total_orders}</p>
                        <p><span className="font-medium">إجمالي المشتريات:</span> {new Intl.NumberFormat('ar-IQ').format(selectedCustomer.customer_loyalty[0].total_spent)} د.ع</p>
                        
                        {selectedCustomer.customer_loyalty[0].loyalty_tiers && (
                          <div className="flex items-center gap-2 mt-2">
                            <span className="font-medium">مستوى الولاء:</span>
                            <div className="flex items-center gap-2 px-2 py-1 rounded-lg" 
                                 style={{ backgroundColor: selectedCustomer.customer_loyalty[0].loyalty_tiers.color + '20' }}>
                              <span style={{ color: selectedCustomer.customer_loyalty[0].loyalty_tiers.color }}>
                                {selectedCustomer.customer_loyalty[0].loyalty_tiers.name}
                              </span>
                            </div>
                          </div>
                        )}
                        
                        {/* تحذير من عدم تطابق النقاط */}
                        {(() => {
                          const currentPoints = selectedCustomer.customer_loyalty[0].total_points;
                          const currentOrders = selectedCustomer.customer_loyalty[0].total_orders;
                          const expectedPoints = currentOrders * 200;
                          
                          if (currentPoints !== expectedPoints && currentOrders > 0) {
                            return (
                              <div className="p-3 bg-yellow-100 border border-yellow-300 rounded-lg mt-2">
                                <p className="text-sm font-medium text-yellow-800">⚠️ تحذير: عدم تطابق في النقاط</p>
                                <p className="text-xs text-yellow-700">
                                  النقاط الحالية: {currentPoints.toLocaleString()} | المتوقعة: {expectedPoints.toLocaleString()}
                                </p>
                              </div>
                            );
                          }
                        })()}
                      </>
                    ) : (
                      <p className="text-muted-foreground">لا توجد بيانات ولاء</p>
                    )}
                  </div>
                </div>
              </div>

              {/* مستويات الولاء المتاحة */}
              {loyaltyTiers.length > 0 && (
                <div>
                  <Label className="font-semibold">مستويات الولاء المتاحة</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                    {loyaltyTiers.map((tier) => (
                      <div key={tier.id} className="flex items-center justify-between p-2 rounded-lg border">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tier.color }}></div>
                          <span className="text-sm font-medium">{tier.name}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {tier.points_required.toLocaleString()} نقطة
                          {tier.discount_percentage > 0 && (
                            <span className="text-green-600 mr-1">
                              (خصم {tier.discount_percentage}%)
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* نافذة إرسال الإشعارات - محسنة للهاتف */}
      <Dialog open={showNotificationDialog} onOpenChange={setShowNotificationDialog}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>إرسال إشعار للعميل</DialogTitle>
          </DialogHeader>
          
          {selectedCustomer && (
            <div className="space-y-4">
              <div>
                <Label>العميل المحدد</Label>
                <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{selectedCustomer.name.slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{selectedCustomer.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedCustomer.phone}</p>
                  </div>
                </div>
              </div>

              <div>
                <Label>نص الرسالة</Label>
                <Textarea
                  placeholder="اكتب رسالتك هنا..."
                  value={notificationMessage}
                  onChange={(e) => setNotificationMessage(e.target.value)}
                  className="mt-2"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowNotificationDialog(false);
                    setNotificationMessage('');
                  }}
                >
                  إلغاء
                </Button>
                <Button
                  onClick={() => {
                    toast({
                      title: 'تم إرسال الإشعار',
                      description: `تم إرسال الرسالة إلى ${selectedCustomer.name}`
                    });
                    setShowNotificationDialog(false);
                    setNotificationMessage('');
                  }}
                  disabled={!notificationMessage.trim()}
                >
                  إرسال
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* نافذة التصدير */}
      <ExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        customers={filteredCustomers}
        customersWithPoints={customersWithPoints}
        customersWithPhones={customersWithPhones}
        highPointsCustomers={highPointsCustomers}
        onExport={handleExport}
      />
    </div>
  );
};

export default CustomersManagementPage;
