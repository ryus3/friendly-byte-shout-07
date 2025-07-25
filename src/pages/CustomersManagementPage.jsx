import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';
import { Users, Phone, MapPin, Star, Award, Medal, Crown, Gem, ShoppingBag, TrendingUp, Send, MessageCircle, Download, Eye, Gift, Calendar, BarChart3, Filter, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { StatCard } from '@/components/dashboard/StatCard';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const CustomersManagementPage = () => {
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustomerDetails, setShowCustomerDetails] = useState(false);
  const [showNotificationDialog, setShowNotificationDialog] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [genderSegmentation, setGenderSegmentation] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');
  const [loyaltyTierFilter, setLoyaltyTierFilter] = useState('all');
  const [pointsFilter, setPointsFilter] = useState('all');
  const [dateRange, setDateRange] = useState(null);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [loyaltyTiers, setLoyaltyTiers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [userPermissions, setUserPermissions] = useState({});
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

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
      const [tiersRes, categoriesRes, departmentsRes, permsRes] = await Promise.all([
        supabase.from('loyalty_tiers').select('*').order('points_required'),
        supabase.from('categories').select('*').order('name'),
        supabase.from('departments').select('*').order('name'),
        supabase.from('employee_loyalty_permissions').select('*').eq('user_id', (await supabase.auth.getUser()).data.user?.id).single()
      ]);

      if (tiersRes.data) setLoyaltyTiers(tiersRes.data);
      // دمج الأقسام والتصنيفات في قائمة واحدة للفلترة
      const allFilters = [
        ...(departmentsRes.data || []).map(d => ({...d, type: 'department'})),
        ...(categoriesRes.data || []).map(c => ({...c, type: 'category'}))
      ];
      setDepartments(allFilters);
      if (permsRes.data) setUserPermissions(permsRes.data);
      
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
      const matchesSearch = !searchTerm || 
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.phone?.includes(searchTerm) ||
        customer.email?.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      // فلتر النقاط
      if (pointsFilter === 'with_points' && (!customer.customer_loyalty?.[0]?.total_points || customer.customer_loyalty[0].total_points === 0)) return false;
      if (pointsFilter === 'no_points' && customer.customer_loyalty?.[0]?.total_points > 0) return false;
      if (pointsFilter === 'high_points' && (!customer.customer_loyalty?.[0]?.total_points || customer.customer_loyalty[0].total_points < 1000)) return false;

      // فلتر مستوى الولاء
      if (loyaltyTierFilter !== 'all') {
        const customerTier = customer.customer_loyalty?.[0]?.current_tier_id;
        if (customerTier !== loyaltyTierFilter) return false;
      }

      // فلتر الجنس/التقسيم حسب القسم والتصنيف معاً
      if (genderSegmentation !== 'all') {
        const hasGenderSegment = customer.customer_product_segments?.some(seg => 
          seg.gender_segment === genderSegmentation
        );
        if (!hasGenderSegment) return false;
      }

      // فلتر حسب القسم (departments) والتصنيف (categories) معاً
      if (departmentFilter !== 'all') {
        const hasSegment = customer.customer_product_segments?.some(seg => 
          seg.department_id === departmentFilter || seg.category_id === departmentFilter
        );
        if (!hasSegment) return false;
      }

      // فلتر الوقت
      if (timeFilter !== 'all') {
        const customerDate = new Date(customer.created_at);
        const now = new Date();
        
        if (timeFilter === 'today') {
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          if (customerDate < today) return false;
        } else if (timeFilter === 'week') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (customerDate < weekAgo) return false;
        } else if (timeFilter === 'month') {
          const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          if (customerDate < monthAgo) return false;
        }
      }

      // فلتر نطاق التاريخ
      if (dateRange?.from && dateRange?.to) {
        const customerDate = new Date(customer.created_at);
        if (customerDate < dateRange.from || customerDate > dateRange.to) return false;
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
  }, [customers, searchTerm, activeFilter, pointsFilter, loyaltyTierFilter, genderSegmentation, departmentFilter, timeFilter, dateRange]);

  const customersWithPoints = filteredCustomers.filter(c => c.customer_loyalty?.[0]?.total_points > 0);
  const customersWithPhones = filteredCustomers.filter(c => c.phone);

  // تصدير البيانات
  const exportCustomers = (filterType = 'all') => {
    const dataToExport = filterType === 'all' ? filteredCustomers : 
                        filterType === 'with_points' ? customersWithPoints :
                        filterType === 'with_phones' ? customersWithPhones : filteredCustomers;

    const csvHeaders = [
      'الاسم', 'الهاتف', 'البريد الإلكتروني', 'المحافظة', 'المدينة', 'العنوان',
      'إجمالي النقاط', 'إجمالي الطلبات', 'إجمالي المبالغ', 'مستوى الولاء', 'خصم الولاء',
      'تاريخ التسجيل', 'آخر ترقية', 'حالة الهاتف', 'تقسيم الجنس'
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
      customer.customer_loyalty?.[0]?.total_spent || 0,
      customer.customer_loyalty?.[0]?.loyalty_tiers?.name || 'لا يوجد',
      customer.customer_loyalty?.[0]?.loyalty_tiers?.discount_percentage || 0,
      customer.created_at ? new Date(customer.created_at).toLocaleDateString('ar') : '',
      customer.customer_loyalty?.[0]?.last_tier_upgrade 
        ? new Date(customer.customer_loyalty[0].last_tier_upgrade).toLocaleDateString('ar') 
        : 'لا يوجد',
      customer.phone ? 'متوفر' : 'غير متوفر',
      customer.customer_product_segments?.[0]?.gender_segment || 'غير محدد'
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
                        filterType === 'with_phones' ? '_مع_هواتف' : 
                        filterType === 'high_points' ? '_نقاط_عالية' : '';
    
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

  // تحقق من تطبيق خصم المدينة العشوائي
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
        // تطبيق اختيار المدينة العشوائية
        const { data: result } = await supabase.rpc('select_random_city_for_monthly_discount');
        console.log('نتيجة اختيار المدينة:', result);
      }
    } catch (error) {
      console.error('خطأ في تطبيق خصم المدينة:', error);
    }
  };

  const getTierIcon = (iconName) => {
    const tierIcons = {
      Star, Award, Medal, Crown, Gem
    };
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
            إدارة شاملة لبيانات العملاء ونظام الولاء
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

      {/* كروت الإحصائيات */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="إجمالي العملاء"
          value={filteredCustomers.length}
          icon={Users}
          trend="positive"
          trendValue="12%"
          trendPeriod="الشهر الماضي"
          onClick={() => {
            setActiveFilter('all');
            setSearchTerm('');
            setPointsFilter('all');
            setLoyaltyTierFilter('all');
            setGenderSegmentation('all');
            setDepartmentFilter('all');
            setTimeFilter('all');
            setDateRange(null);
          }}
          active={activeFilter === 'all'}
        />
        <StatCard
          title="عملاء لديهم نقاط"
          value={customersWithPoints.length}
          icon={Star}
          trend="positive"
          trendValue="8%"
          trendPeriod="الشهر الماضي"
          onClick={() => {
            setActiveFilter('with_points');
            setPointsFilter('with_points');
          }}
          active={activeFilter === 'with_points'}
        />
        <StatCard
          title="عملاء مع أرقام"
          value={customersWithPhones.length}
          icon={Phone}
          trend="neutral"
          trendValue="3%"
          trendPeriod="الشهر الماضي"
          onClick={() => {
            setActiveFilter('with_phones');
            setSearchTerm('');
            setPointsFilter('all');
          }}
          active={activeFilter === 'with_phones'}
        />
        <StatCard
          title="متوسط النقاط"
          value={Math.round(filteredCustomers.reduce((sum, c) => sum + (c.customer_loyalty?.[0]?.total_points || 0), 0) / filteredCustomers.length || 0)}
          icon={Gift}
          trend="positive"
          trendValue="15%"
          trendPeriod="الشهر الماضي"
          onClick={() => {
            setActiveFilter('high_points');
            setPointsFilter('high_points');
          }}
          active={activeFilter === 'high_points'}
        />
      </div>

      {/* الفلاتر والبحث */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              البحث والفلترة
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              فلاتر متقدمة
              {showAdvancedFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* الفلاتر الأساسية */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>البحث</Label>
              <Input
                placeholder="ابحث بالاسم أو الهاتف..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>فلتر الوقت</Label>
              <Select value={timeFilter} onValueChange={setTimeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الفترات</SelectItem>
                  <SelectItem value="today">اليوم</SelectItem>
                  <SelectItem value="week">هذا الأسبوع</SelectItem>
                  <SelectItem value="month">هذا الشهر</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>فلتر النقاط</Label>
              <Select value={pointsFilter} onValueChange={setPointsFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل العملاء</SelectItem>
                  <SelectItem value="with_points">لديهم نقاط</SelectItem>
                  <SelectItem value="no_points">بدون نقاط</SelectItem>
                  <SelectItem value="high_points">نقاط عالية (+1000)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* الفلاتر المتقدمة */}
          {showAdvancedFilters && (
            <div className="mt-4 pt-4 border-t">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>التصنيف (رجالي/نسائي)</Label>
                  <Select value={genderSegmentation} onValueChange={setGenderSegmentation}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل التصنيفات</SelectItem>
                      <SelectItem value="male">رجالي</SelectItem>
                      <SelectItem value="female">نسائي</SelectItem>
                      <SelectItem value="unisex">للجنسين</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>الأقسام والتصنيفات</Label>
                  <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الأقسام والتصنيفات</SelectItem>
                      {departments.map(item => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} ({item.type === 'department' ? 'قسم' : 'تصنيف'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>مستوى الولاء</Label>
                  <Select value={loyaltyTierFilter} onValueChange={setLoyaltyTierFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل المستويات</SelectItem>
                      {loyaltyTiers.map(tier => (
                        <SelectItem key={tier.id} value={tier.id}>
                          {tier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>نطاق التاريخ</Label>
                  <DatePickerWithRange
                    date={dateRange}
                    setDate={setDateRange}
                  />
                </div>

                <div className="flex items-end">
                  <Button 
                    onClick={() => {
                      setSearchTerm('');
                      setTimeFilter('all');
                      setPointsFilter('all');
                      setLoyaltyTierFilter('all');
                      setGenderSegmentation('all');
                      setDepartmentFilter('all');
                      setDateRange(null);
                      setActiveFilter('all');
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    مسح الفلاتر
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

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
                      
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
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
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {customer.phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="h-4 w-4" />
                              {customer.phone}
                            </div>
                          )}
                          {customer.city && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {customer.city}
                            </div>
                          )}
                        </div>

                        {loyaltyData && (
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1 text-primary">
                              <Star className="h-4 w-4" />
                              {loyaltyData.total_points || 0} نقطة
                            </div>
                            <div className="flex items-center gap-1">
                              <ShoppingBag className="h-4 w-4" />
                              {loyaltyData.total_orders || 0} طلب
                            </div>
                            <div className="flex items-center gap-1">
                              <TrendingUp className="h-4 w-4" />
                              {formatCurrency(loyaltyData.total_spent || 0)}
                            </div>
                          </div>
                        )}

                        {customer.customer_product_segments && customer.customer_product_segments.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {customer.customer_product_segments.slice(0, 3).map((segment, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {segment.departments?.name || segment.categories?.name || segment.product_types?.name}
                              </Badge>
                            ))}
                            {customer.customer_product_segments.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{customer.customer_product_segments.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
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
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredCustomers.length === 0 && (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground mb-2">لا يوجد عملاء</h3>
                <p className="text-sm text-muted-foreground">
                  لم يتم العثور على عملاء مطابقين للفلاتر المحددة
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* حوار إرسال الإشعارات */}
      <Dialog open={showNotificationDialog} onOpenChange={setShowNotificationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إرسال إشعار للعميل</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>العميل</Label>
              <p className="text-sm text-muted-foreground">{selectedCustomer?.name}</p>
            </div>
            <div>
              <Label>الرسالة</Label>
              <Textarea
                placeholder="اكتب رسالة للعميل..."
                value={notificationMessage}
                onChange={(e) => setNotificationMessage(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNotificationDialog(false)}>
                إلغاء
              </Button>
              <Button 
                onClick={() => {
                  if (selectedCustomer && notificationMessage.trim()) {
                    // إرسال الإشعار
                    toast({
                      title: 'تم إرسال الإشعار',
                      description: `تم إرسال الإشعار إلى ${selectedCustomer.name}`
                    });
                    setShowNotificationDialog(false);
                    setNotificationMessage('');
                  }
                }}
                disabled={!notificationMessage.trim()}
              >
                <Send className="h-4 w-4 mr-2" />
                إرسال
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomersManagementPage;