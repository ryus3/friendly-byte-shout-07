
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Download } from 'lucide-react';
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
      const { data, error } = await supabase
        .from('customers')
        .select(`
          *,
          customer_loyalty (
            *,
            loyalty_tiers (
              name,
              color,
              icon,
              discount_percentage,
              points_required
            )
          ),
          customer_product_segments (
            *,
            departments (name),
            categories (name),
            product_types (name)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      console.log('بيانات العملاء:', data);
      setCustomers(data || []);
      setFilteredCustomers(data || []);
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
      
      // دمج الأقسام والتصنيفات في قائمة واحدة للفلترة
      const allFilters = [
        ...(departmentsRes.data || []).map(d => ({...d, type: 'department'})),
        ...(categoriesRes.data || []).map(c => ({...c, type: 'category'}))
      ];
      setDepartments(allFilters);
      
      // تطبيق خصم المدينة العشوائي إذا لم يكن مطبق هذا الشهر
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

      // فلتر النقاط - التأكد من أن النقاط محسوبة على أساس الطلبات (200 نقطة لكل طلب)
      if (filters.pointsFilter === 'with_points' && (!customer.customer_loyalty?.[0]?.total_points || customer.customer_loyalty[0].total_points === 0)) return false;
      if (filters.pointsFilter === 'no_points' && customer.customer_loyalty?.[0]?.total_points > 0) return false;
      if (filters.pointsFilter === 'high_points' && (!customer.customer_loyalty?.[0]?.total_points || customer.customer_loyalty[0].total_points < 1000)) return false;

      // فلتر مستوى الولاء
      if (filters.loyaltyTierFilter !== 'all') {
        const customerTier = customer.customer_loyalty?.[0]?.current_tier_id;
        if (customerTier !== filters.loyaltyTierFilter) return false;
      }

      // فلتر الجنس/التقسيم حسب القسم والتصنيف معاً
      if (filters.genderSegmentation !== 'all') {
        const hasGenderSegment = customer.customer_product_segments?.some(seg => 
          seg.gender_segment === filters.genderSegmentation
        );
        if (!hasGenderSegment) return false;
      }

      // فلتر حسب القسم (departments) والتصنيف (categories) معاً
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

      // فلتر نطاق التاريخ
      if (filters.dateRange?.from && filters.dateRange?.to) {
        const customerDate = new Date(customer.created_at);
        if (customerDate < filters.dateRange.from || customerDate > filters.dateRange.to) return false;
      }

      return true;
    });

    // تطبيق الفلتر النشط من الكروت
    if (activeFilter === 'with_points') {
      filtered = filtered.filter(c => c.customer_loyalty?.[0]?.total_points > 0);
    } else if (activeFilter === 'with_phones') {
      filtered = filtered.filter(c => c.phone);
    } else if (activeFilter === 'high_points') {
      filtered = filtered.filter(c => c.customer_loyalty?.[0]?.total_points >= 1000);
    }

    setFilteredCustomers(filtered);
  }, [customers, filters, activeFilter]);

  // إحصائيات العملاء
  const customersWithPoints = customers.filter(c => c.customer_loyalty?.[0]?.total_points > 0).length;
  const customersWithPhones = customers.filter(c => c.phone).length;
  const highPointsCustomers = customers.filter(c => c.customer_loyalty?.[0]?.total_points >= 1000).length;

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
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">جاري تحميل بيانات العملاء...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* الهيدر */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">إدارة العملاء</h1>
          <p className="text-muted-foreground">
            إدارة شاملة لبيانات العملاء ونظام الولاء - النقاط تُحسب على أساس الطلب (200 نقطة لكل طلب)
          </p>
          {monthlyDiscount && (
            <div className="mt-2 p-3 bg-green-100 border border-green-300 rounded-lg">
              <p className="text-green-800 font-medium">
                🎉 مدينة {monthlyDiscount.city_name} مختارة لخصم {monthlyDiscount.discount_percentage}% هذا الشهر!
              </p>
            </div>
          )}
        </div>
        <Button onClick={() => setShowExportDialog(true)} className="gap-2">
          <Download className="h-4 w-4" />
          تصدير العملاء
        </Button>
      </div>

      {/* الإحصائيات */}
      <CustomerStats
        totalCustomers={customers.length}
        customersWithPoints={customersWithPoints}
        customersWithPhones={customersWithPhones}
        highPointsCustomers={highPointsCustomers}
        cityStats={cityStats}
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

      {/* قائمة العملاء */}
      <Card>
        <CardHeader>
          <CardTitle>قائمة العملاء ({filteredCustomers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredCustomers.map((customer) => (
              <CustomerCard
                key={customer.id}
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
            ))}

            {filteredCustomers.length === 0 && (
              <div className="text-center py-8">
                <div className="h-12 w-12 mx-auto text-muted-foreground mb-4">👥</div>
                <h3 className="text-lg font-semibold mb-2">لا توجد عملاء</h3>
                <p className="text-muted-foreground">لا توجد عملاء يطابقون معايير البحث المحددة</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* نافذة تفاصيل العميل */}
      <Dialog open={showCustomerDetails} onOpenChange={setShowCustomerDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>تفاصيل العميل</DialogTitle>
          </DialogHeader>
          
          {selectedCustomer && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="font-semibold">المعلومات الأساسية</Label>
                  <div className="space-y-2 mt-2">
                    <p><span className="font-medium">الاسم:</span> {selectedCustomer.name}</p>
                    <p><span className="font-medium">الهاتف:</span> {selectedCustomer.phone || 'غير متوفر'}</p>
                    <p><span className="font-medium">البريد الإلكتروني:</span> {selectedCustomer.email || 'غير متوفر'}</p>
                    <p><span className="font-medium">العنوان:</span> {selectedCustomer.address || 'غير محدد'}</p>
                    <p><span className="font-medium">المدينة:</span> {selectedCustomer.city || 'غير محددة'}</p>
                    <p><span className="font-medium">المحافظة:</span> {selectedCustomer.province || 'غير محددة'}</p>
                  </div>
                </div>

                <div>
                  <Label className="font-semibold">معلومات الولاء</Label>
                  <div className="space-y-2 mt-2">
                    {selectedCustomer.customer_loyalty?.[0] ? (
                      <>
                        <p><span className="font-medium">إجمالي النقاط:</span> {selectedCustomer.customer_loyalty[0].total_points}</p>
                        <p><span className="font-medium">إجمالي الطلبات:</span> {selectedCustomer.customer_loyalty[0].total_orders}</p>
                        <p><span className="font-medium">إجمالي المشتريات:</span> {new Intl.NumberFormat('ar-IQ').format(selectedCustomer.customer_loyalty[0].total_spent)} د.ع</p>
                        <p className="text-sm text-muted-foreground">النقاط تُحسب: 200 نقطة لكل طلب مكتمل</p>
                        {selectedCustomer.customer_loyalty[0].loyalty_tiers && (
                          <div className="flex items-center gap-2">
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
                              <div className="p-3 bg-yellow-100 border border-yellow-300 rounded-lg">
                                <p className="text-sm font-medium text-yellow-800">⚠️ تحذير: عدم تطابق في النقاط</p>
                                <p className="text-xs text-yellow-700">
                                  النقاط الحالية: {currentPoints} | المتوقعة: {expectedPoints}
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
                          {tier.points_required} نقطة
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

      {/* نافذة إرسال الإشعارات */}
      <Dialog open={showNotificationDialog} onOpenChange={setShowNotificationDialog}>
        <DialogContent>
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
                  <div>
                    <p className="font-medium">{selectedCustomer.name}</p>
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
