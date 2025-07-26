import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Download, Star, Gift, Users, Eye, Send, Phone, MapPin, AlertTriangle, Sparkles, Trophy, Medal, Crown, Gem, Award } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import CustomerFilters from '@/components/customers/CustomerFilters';
import CustomerStats from '@/components/customers/CustomerStats';
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
    fetchSupportingData();
    fetchCityStatsAndDiscounts();
  }, []);

  useEffect(() => {
    if (loyaltyTiers.length > 0) {
      fetchCustomers();
    }
  }, [loyaltyTiers]);

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

  // مكون كارت العميل المحسن
  const CustomerCard = ({ customer, onViewDetails, onSendNotification }) => {
    const loyaltyData = customer.customer_loyalty?.[0];
    const getTierIcon = (iconName) => {
      const icons = { Star, Award, Medal, Crown, Gem, Trophy };
      return icons[iconName] || Star;
    };
    
    const TierIcon = loyaltyData?.loyalty_tiers?.icon ? getTierIcon(loyaltyData.loyalty_tiers.icon) : Star;

    // تحديد الجمهور المستهدف
    const genderSegment = customer.customer_product_segments?.[0]?.gender_segment;
    const genderIcon = genderSegment === 'male' ? '🧑' : genderSegment === 'female' ? '👩' : '👥';
    const genderText = genderSegment === 'male' ? 'رجالي' : genderSegment === 'female' ? 'نسائي' : 'للجنسين';

    // حساب النقاط - 200 نقطة لكل طلب مكتمل
    const totalPoints = loyaltyData?.total_points || 0;
    const totalOrders = loyaltyData?.total_orders || 0;
    const expectedPoints = totalOrders * 200;
    const hasPointsMismatch = totalPoints !== expectedPoints && totalOrders > 0;

    return (
      <Card className="group w-full hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 border-0 bg-gradient-to-br from-card to-card/80 shadow-lg overflow-hidden relative" 
            style={{ 
              boxShadow: `0 8px 32px ${loyaltyData?.loyalty_tiers?.color || '#3B82F6'}15`,
              borderLeft: `6px solid ${loyaltyData?.loyalty_tiers?.color || '#3B82F6'}`
            }}>
        {/* خلفية متحركة */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
        
        <CardContent className="p-5 md:p-7 relative z-10">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <Avatar className="h-12 w-12 md:h-16 md:w-16 shrink-0 ring-4 ring-primary/10">
                <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 text-sm md:text-lg font-bold text-primary">
                  {customer.name.slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              
              <div className="space-y-2 md:space-y-3 flex-1 min-w-0">
                <div className="flex flex-col md:flex-row md:items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-lg md:text-xl leading-tight truncate bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    {customer.name}
                  </h3>
                  
                  <div className="flex flex-wrap items-center gap-2">
                    {loyaltyData?.loyalty_tiers && (
                      <Badge 
                        variant="secondary" 
                        className="flex items-center gap-1 px-3 py-1 text-xs font-semibold border-2"
                        style={{ 
                          backgroundColor: loyaltyData.loyalty_tiers.color + '20', 
                          color: loyaltyData.loyalty_tiers.color,
                          borderColor: loyaltyData.loyalty_tiers.color + '40'
                        }}
                      >
                        <TierIcon className="h-3 w-3" />
                        <span className="hidden sm:inline">{loyaltyData.loyalty_tiers.name}</span>
                        <span className="sm:hidden">{loyaltyData.loyalty_tiers.name.slice(0, 3)}</span>
                      </Badge>
                    )}
                    {genderSegment && (
                      <Badge variant="outline" className="text-xs border-2 font-medium">
                        <span className="md:hidden">{genderIcon}</span>
                        <span className="hidden md:inline">{genderIcon} {genderText}</span>
                      </Badge>
                    )}
                  </div>
                </div>
                
                {/* Contact Info */}
                <div className="grid grid-cols-1 gap-2 text-sm">
                  <div className="flex items-center gap-2 min-w-0 p-2 bg-muted/30 rounded-lg">
                    <Phone className="h-4 w-4 text-green-600 shrink-0" />
                    <span className="font-medium truncate">{customer.phone || 'غير متوفر'}</span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0 p-2 bg-muted/30 rounded-lg">
                    <MapPin className="h-4 w-4 text-blue-600 shrink-0" />
                    <span className="truncate">
                      {customer.city ? `${customer.city}, ${customer.province}` : 'غير محدد'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons - Mobile Optimized */}
            <div className="flex md:flex-col gap-2 justify-end shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewDetails(customer)}
                className="flex-1 md:flex-none gap-2 text-xs px-3 py-2 border-2 hover:bg-primary hover:text-primary-foreground transition-all"
              >
                <Eye className="h-4 w-4" />
                <span className="hidden sm:inline">تفاصيل</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSendNotification(customer)}
                className="flex-1 md:flex-none gap-2 text-xs px-3 py-2 border-2 hover:bg-accent hover:text-accent-foreground transition-all"
              >
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">إشعار</span>
              </Button>
            </div>
          </div>

          {/* إحصائيات الولاء المحسنة */}
          <div className="bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 rounded-xl p-4 space-y-4 border border-primary/10">
            <div className="grid grid-cols-2 gap-6">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-lg opacity-10 group-hover:opacity-20 transition-opacity"></div>
                <div className="relative flex items-center gap-3 p-3">
                  <div className="p-2 bg-yellow-100 rounded-full">
                    <Star className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-xl text-yellow-700">{totalPoints.toLocaleString()}</div>
                    <div className="text-sm text-yellow-600 font-medium">نقطة ولاء</div>
                  </div>
                </div>
              </div>
              
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-green-600 rounded-lg opacity-10 group-hover:opacity-20 transition-opacity"></div>
                <div className="relative flex items-center gap-3 p-3">
                  <div className="p-2 bg-green-100 rounded-full">
                    <Gift className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-xl text-green-700">{totalOrders}</div>
                    <div className="text-sm text-green-600 font-medium">طلب مكتمل</div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* معلومات حساب النقاط */}
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-3 border border-blue-100">
              <div className="text-sm text-blue-700 font-medium mb-1">معادلة النقاط:</div>
              <div className="text-sm text-blue-600">
                {totalOrders} طلب × 200 نقطة = <span className="font-bold">{expectedPoints.toLocaleString()}</span> نقطة
              </div>
            </div>
            
            {/* تحذير عدم التطابق */}
            {hasPointsMismatch && (
              <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-red-50 to-orange-50 rounded-lg"></div>
                <div className="relative flex items-center gap-3 p-3 border border-red-200 rounded-lg">
                  <div className="p-1 bg-red-100 rounded-full">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-red-800 text-sm">خطأ في حساب النقاط</div>
                    <div className="text-red-600 text-xs">
                      المتوقع: <span className="font-bold">{expectedPoints.toLocaleString()}</span> نقطة
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Total Spending */}
            {loyaltyData?.total_spent > 0 && (
              <div className="text-sm text-muted-foreground pt-2 border-t border-border/50">
                💰 إجمالي المشتريات: <span className="font-bold text-primary">{new Intl.NumberFormat('ar-IQ').format(loyaltyData.total_spent)} د.ع</span>
              </div>
            )}
          </div>

          {/* Product Segments */}
          {customer.customer_product_segments?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {customer.customer_product_segments.slice(0, 3).map((segment, index) => (
                <Badge key={index} variant="outline" className="text-xs border-2">
                  {segment.departments?.name || segment.categories?.name || 'غير محدد'}
                </Badge>
              ))}
              {customer.customer_product_segments.length > 3 && (
                <Badge variant="outline" className="text-xs border-2">
                  +{customer.customer_product_segments.length - 3}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const handleSendNotification = async () => {
    if (!selectedCustomer || !notificationMessage.trim()) {
      toast({
        title: 'خطأ',
        description: 'يرجى إدخال نص الإشعار',
        variant: 'destructive'
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('customer_notifications_sent')
        .insert({
          customer_id: selectedCustomer.id,
          notification_type: 'manual',
          message: notificationMessage,
          sent_via: 'pending',
          success: false
        });

      if (error) throw error;

      toast({
        title: 'تم إرسال الإشعار',
        description: `تم إضافة الإشعار لـ ${selectedCustomer.name} في قائمة الانتظار`
      });

      setShowNotificationDialog(false);
      setNotificationMessage('');
      setSelectedCustomer(null);
    } catch (error) {
      console.error('خطأ في إرسال الإشعار:', error);
      toast({
        title: 'خطأ في الإرسال',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary/30 border-t-primary mx-auto"></div>
            <Sparkles className="h-8 w-8 text-primary absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-primary">جاري التحميل...</h3>
            <p className="text-muted-foreground">تحضير بيانات العملاء المتطورة</p>
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

        {/* Dialog تفاصيل العميل */}
        <Dialog open={showCustomerDetails} onOpenChange={setShowCustomerDetails}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Eye className="h-5 w-5" />
                تفاصيل العميل
              </DialogTitle>
            </DialogHeader>
            {selectedCustomer && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">الاسم</Label>
                    <p className="text-lg font-semibold">{selectedCustomer.name}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">الهاتف</Label>
                    <p className="text-lg">{selectedCustomer.phone || 'غير متوفر'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">البريد الإلكتروني</Label>
                    <p className="text-lg">{selectedCustomer.email || 'غير متوفر'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">المحافظة</Label>
                    <p className="text-lg">{selectedCustomer.province || 'غير محدد'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">المدينة</Label>
                    <p className="text-lg">{selectedCustomer.city || 'غير محدد'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">تاريخ التسجيل</Label>
                    <p className="text-lg">
                      {selectedCustomer.created_at ? new Date(selectedCustomer.created_at).toLocaleDateString('ar') : 'غير محدد'}
                    </p>
                  </div>
                </div>
                
                {selectedCustomer.address && (
                  <div>
                    <Label className="text-sm font-medium">العنوان</Label>
                    <p className="text-lg">{selectedCustomer.address}</p>
                  </div>
                )}

                {/* معلومات الولاء */}
                {selectedCustomer.customer_loyalty?.[0] && (
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <h4 className="font-semibold mb-3">معلومات الولاء</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">النقاط:</span>
                        <span className="ml-2">{selectedCustomer.customer_loyalty[0].total_points || 0}</span>
                      </div>
                      <div>
                        <span className="font-medium">الطلبات:</span>
                        <span className="ml-2">{selectedCustomer.customer_loyalty[0].total_orders || 0}</span>
                      </div>
                      <div>
                        <span className="font-medium">إجمالي المشتريات:</span>
                        <span className="ml-2">{new Intl.NumberFormat('ar-IQ').format(selectedCustomer.customer_loyalty[0].total_spent || 0)} د.ع</span>
                      </div>
                      {selectedCustomer.customer_loyalty[0].loyalty_tiers && (
                        <div>
                          <span className="font-medium">مستوى الولاء:</span>
                          <span className="ml-2">{selectedCustomer.customer_loyalty[0].loyalty_tiers.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* تقسيمات المنتجات */}
                {selectedCustomer.customer_product_segments?.length > 0 && (
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <h4 className="font-semibold mb-3">تقسيمات المنتجات</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedCustomer.customer_product_segments.map((segment, index) => (
                        <Badge key={index} variant="outline">
                          {segment.departments?.name || segment.categories?.name || 'غير محدد'}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog إرسال إشعار */}
        <Dialog open={showNotificationDialog} onOpenChange={setShowNotificationDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <Send className="h-5 w-5" />
                إرسال إشعار
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="message">نص الإشعار</Label>
                <Textarea
                  id="message"
                  placeholder="اكتب نص الإشعار هنا..."
                  value={notificationMessage}
                  onChange={(e) => setNotificationMessage(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowNotificationDialog(false)}>
                  إلغاء
                </Button>
                <Button onClick={handleSendNotification}>
                  إرسال الإشعار
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog التصدير */}
        <ExportDialog
          open={showExportDialog}
          onOpenChange={setShowExportDialog}
          onExport={handleExport}
          customers={customers}
        />
      </div>
    </div>
  );
};

export default CustomersManagementPage;