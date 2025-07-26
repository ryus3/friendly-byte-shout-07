import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';
import { Users, Phone, MapPin, Star, Award, Medal, Crown, Gem, Eye, Send, Download } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import CustomerFilters from '@/components/customers/CustomerFilters';

const CustomersManagementPage = () => {
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustomerDetails, setShowCustomerDetails] = useState(false);
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [loyaltyTiers, setLoyaltyTiers] = useState([]);
  const [departments, setDepartments] = useState([]);
  
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
              discount_percentage
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
  const customersWithPoints = filteredCustomers.filter(c => c.customer_loyalty?.[0]?.total_points > 0).length;
  const customersWithPhones = filteredCustomers.filter(c => c.phone).length;

  const exportCustomers = (filterType = 'all') => {
    const dataToExport = filterType === 'all' ? filteredCustomers : 
                        filterType === 'with_points' ? filteredCustomers.filter(c => c.customer_loyalty?.[0]?.total_points > 0) :
                        filterType === 'with_phones' ? filteredCustomers.filter(c => c.phone) : filteredCustomers;

    const csvHeaders = [
      'الاسم', 'الهاتف', 'البريد الإلكتروني', 'المحافظة', 'المدينة', 'العنوان',
      'إجمالي النقاط', 'إجمالي الطلبات', 'مستوى الولاء', 'الجمهور المستهدف',
      'تاريخ التسجيل'
    ];

    const csvData = dataToExport.map(customer => [
      customer.name,
      customer.phone || '',
      customer.email || '',
      customer.province || '',
      customer.city || '',
      customer.address || '',
      customer.customer_loyalty?.[0]?.total_points || 0,
      customer.customer_loyalty?.[0]?.total_orders || 0,
      customer.customer_loyalty?.[0]?.loyalty_tiers?.name || 'لا يوجد',
      customer.customer_product_segments?.[0]?.gender_segment === 'male' ? 'رجالي' :
      customer.customer_product_segments?.[0]?.gender_segment === 'female' ? 'نسائي' :
      customer.customer_product_segments?.[0]?.gender_segment === 'unisex' ? 'للجنسين' : 'غير محدد',
      customer.created_at ? new Date(customer.created_at).toLocaleDateString('ar') : ''
    ]);

    const csvContent = [
      csvHeaders.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    
    const filterSuffix = filterType === 'with_points' ? '_مع_نقاط' : 
                        filterType === 'with_phones' ? '_مع_هواتف' : '';
    
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

  const getTierIcon = (iconName) => {
    const tierIcons = { Star, Award, Medal, Crown, Gem };
    const IconComponent = tierIcons[iconName] || Star;
    return IconComponent;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ar-IQ').format(amount) + ' د.ع';
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
        </div>
        <div className="flex gap-2">
          <Button onClick={() => exportCustomers('all')} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            تصدير الكل
          </Button>
          <Button onClick={() => exportCustomers('with_points')} variant="outline">
            <Star className="h-4 w-4 mr-2" />
            تصدير العملاء مع النقاط
          </Button>
        </div>
      </div>

      {/* الفلاتر الجديدة */}
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
            {filteredCustomers.map((customer) => {
              const loyaltyData = customer.customer_loyalty?.[0];
              const tierIcon = loyaltyData?.loyalty_tiers?.icon ? getTierIcon(loyaltyData.loyalty_tiers.icon) : Users;
              const TierIcon = tierIcon;

              // تحديد الجمهور المستهدف
              const genderSegment = customer.customer_product_segments?.[0]?.gender_segment;
              const genderIcon = genderSegment === 'male' ? '🧑' : genderSegment === 'female' ? '👩' : '👥';
              const genderText = genderSegment === 'male' ? 'رجالي' : genderSegment === 'female' ? 'نسائي' : 'للجنسين';

              // حساب النقاط - التأكد من أنها محسوبة على أساس الطلبات
              const totalPoints = loyaltyData?.total_points || 0;
              const totalOrders = loyaltyData?.total_orders || 0;
              const expectedPoints = totalOrders * 200; // 200 نقطة لكل طلب

              return (
                <div
                  key={customer.id}
                  className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 space-x-reverse">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-primary/10">
                          {customer.name.slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{customer.name}</h3>
                          {loyaltyData?.loyalty_tiers && (
                            <Badge 
                              variant="secondary" 
                              className="flex items-center gap-1"
                              style={{ backgroundColor: loyaltyData.loyalty_tiers.color + '20', color: loyaltyData.loyalty_tiers.color }}
                            >
                              <TierIcon className="h-3 w-3" />
                              {loyaltyData.loyalty_tiers.name}
                            </Badge>
                          )}
                          {genderSegment && (
                            <Badge variant="outline" className="text-xs">
                              {genderIcon} {genderText}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {customer.phone || 'غير متوفر'}
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {customer.city ? `${customer.city}, ${customer.province}` : 'غير محدد'}
                          </div>
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3" />
                            {totalPoints} نقطة ({totalOrders} طلب)
                            {/* تحذير إذا كان هناك عدم تطابق في النقاط */}
                            {totalPoints !== expectedPoints && totalOrders > 0 && (
                              <Badge variant="destructive" className="text-xs mr-2">
                                خطأ في النقاط
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mt-2">
                          {customer.customer_product_segments?.map((segment, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {segment.departments?.name || segment.categories?.name || 'غير محدد'}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setShowCustomerDetails(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setShowNotificationDialog(true);
                        }}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredCustomers.length === 0 && (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
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
                        <p className="text-sm text-muted-foreground">النقاط تُحسب: 200 نقطة لكل طلب مكتمل</p>
                        {selectedCustomer.customer_loyalty[0].loyalty_tiers && (
                          <p><span className="font-medium">مستوى الولاء:</span> {selectedCustomer.customer_loyalty[0].loyalty_tiers.name}</p>
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
                  <Send className="h-4 w-4 mr-2" />
                  إرسال
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomersManagementPage;
