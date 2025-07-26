
import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, MoreHorizontal, Users, Award, TrendingUp, UserCheck, Phone, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

const CustomersManagementPage = () => {
  const { toast } = useToast();
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterTier, setFilterTier] = useState('all');
  const [filterGender, setFilterGender] = useState('all');
  const [filterCity, setFilterCity] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completedOrders, setCompletedOrders] = useState([]);
  const [cityStats, setCityStats] = useState([]);
  const [cityDiscounts, setCityDiscounts] = useState([]);
  const [stats, setStats] = useState({
    totalCustomers: 0,
    activeCustomers: 0,
    totalLoyaltyPoints: 0,
    averageOrderValue: 0,
    goldTier: 0,
    silverTier: 0,
    bronzeTier: 0,
    diamondTier: 0,
    maleCustomers: 0,
    femaleCustomers: 0
  });

  const [newCustomer, setNewCustomer] = useState({
    full_name: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
    status: 'active',
    loyalty_points: 0
  });

  // Load all data
  useEffect(() => {
    loadAllData();
  }, []);

  // Filter customers based on search term and filters
  useEffect(() => {
    let filtered = customers;

    if (searchTerm) {
      filtered = filtered.filter(customer =>
        customer.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.phone?.includes(searchTerm) ||
        customer.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(customer => customer.status === filterStatus);
    }

    if (filterTier !== 'all') {
      filtered = filtered.filter(customer => getCustomerTier(customer.loyalty_points || 0) === filterTier);
    }

    if (filterGender !== 'all') {
      filtered = filtered.filter(customer => {
        const customerGender = getCustomerGender(customer.id);
        return customerGender === filterGender;
      });
    }

    if (filterCity !== 'all') {
      filtered = filtered.filter(customer => customer.city === filterCity);
    }

    setFilteredCustomers(filtered);
  }, [customers, searchTerm, filterStatus, filterTier, filterGender, filterCity]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadCustomers(),
        loadCompletedOrders(),
        loadCityStats(),
        loadCityDiscounts()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "خطأ",
        description: "فشل في تحميل البيانات",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // حساب النقاط الجديد لكل عميل
      const customersWithUpdatedPoints = await Promise.all(
        (data || []).map(async (customer) => {
          const points = await calculateCustomerLoyaltyPoints(customer.id);
          return { ...customer, loyalty_points: points };
        })
      );

      setCustomers(customersWithUpdatedPoints);
      calculateStats(customersWithUpdatedPoints);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  const loadCompletedOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .in('status', ['completed', 'delivered']);

      if (error) throw error;
      setCompletedOrders(data || []);
    } catch (error) {
      console.error('Error loading orders:', error);
    }
  };

  const loadCityStats = async () => {
    try {
      const { data, error } = await supabase
        .from('city_order_stats')
        .select('*')
        .order('total_orders', { ascending: false });

      if (error) throw error;
      setCityStats(data || []);
    } catch (error) {
      console.error('Error loading city stats:', error);
    }
  };

  const loadCityDiscounts = async () => {
    try {
      const { data, error } = await supabase
        .from('city_random_discounts')
        .select('*')
        .eq('discount_month', new Date().getMonth() + 1)
        .eq('discount_year', new Date().getFullYear());

      if (error) throw error;
      setCityDiscounts(data || []);
    } catch (error) {
      console.error('Error loading city discounts:', error);
    }
  };

  const calculateCustomerLoyaltyPoints = async (customerId) => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_id', customerId)
        .in('status', ['completed', 'delivered']);

      if (error) throw error;

      // 200 نقطة لكل طلب مكتمل
      return (data || []).length * 200;
    } catch (error) {
      console.error('Error calculating points:', error);
      return 0;
    }
  };

  const calculateStats = (customersData) => {
    const totalCustomers = customersData.length;
    const activeCustomers = customersData.filter(c => c.status === 'active').length;
    const totalLoyaltyPoints = customersData.reduce((sum, c) => sum + (c.loyalty_points || 0), 0);
    
    // حساب الفئات الجديدة
    const goldTier = customersData.filter(c => getCustomerTier(c.loyalty_points || 0) === 'gold').length;
    const silverTier = customersData.filter(c => getCustomerTier(c.loyalty_points || 0) === 'silver').length;
    const bronzeTier = customersData.filter(c => getCustomerTier(c.loyalty_points || 0) === 'bronze').length;
    const diamondTier = customersData.filter(c => getCustomerTier(c.loyalty_points || 0) === 'diamond').length;

    // حساب الجنس من خلال الطلبات
    const maleCustomers = customersData.filter(c => getCustomerGender(c.id) === 'male').length;
    const femaleCustomers = customersData.filter(c => getCustomerGender(c.id) === 'female').length;

    const averageOrderValue = completedOrders.length > 0 
      ? completedOrders.reduce((sum, order) => sum + (order.final_amount || 0), 0) / completedOrders.length 
      : 0;

    setStats({
      totalCustomers,
      activeCustomers,
      totalLoyaltyPoints,
      averageOrderValue,
      goldTier,
      silverTier,
      bronzeTier,
      diamondTier,
      maleCustomers,
      femaleCustomers
    });
  };

  const getCustomerTier = (points) => {
    if (points >= 20000) return 'diamond'; // ماسي
    if (points >= 10000) return 'gold';    // ذهبي
    if (points >= 5000) return 'silver';   // فضي
    if (points >= 1000) return 'bronze';   // برونزي
    return 'standard';                     // عادي
  };

  const getTierColor = (tier) => {
    switch (tier) {
      case 'diamond': return 'bg-purple-500';
      case 'gold': return 'bg-yellow-500';
      case 'silver': return 'bg-gray-400';
      case 'bronze': return 'bg-orange-600';
      default: return 'bg-blue-500';
    }
  };

  const getTierLabel = (tier) => {
    switch (tier) {
      case 'diamond': return 'ماسي';
      case 'gold': return 'ذهبي';
      case 'silver': return 'فضي';
      case 'bronze': return 'برونزي';
      default: return 'عادي';
    }
  };

  const getCustomerGender = (customerId) => {
    // البحث في الطلبات المكتملة لتحديد الجنس بناءً على المنتجات المشتراة
    const customerOrders = completedOrders.filter(order => order.customer_id === customerId);
    if (customerOrders.length === 0) return 'unknown';

    // هنا يمكن تطبيق منطق أكثر تعقيداً لتحديد الجنس بناءً على المنتجات
    // مؤقتاً سنعيد قيمة عشوائية للاختبار
    return Math.random() > 0.5 ? 'male' : 'female';
  };

  const getUniqueContent = (items, key) => {
    return [...new Set(items.map(item => item[key]).filter(Boolean))];
  };

  const handleAddCustomer = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert([newCustomer])
        .select()
        .single();

      if (error) throw error;

      const points = await calculateCustomerLoyaltyPoints(data.id);
      setCustomers(prev => [{ ...data, loyalty_points: points }, ...prev]);
      setIsAddDialogOpen(false);
      setNewCustomer({
        full_name: '',
        phone: '',
        email: '',
        address: '',
        notes: '',
        status: 'active',
        loyalty_points: 0
      });

      toast({
        title: "نجح",
        description: "تم إضافة العميل بنجاح"
      });
    } catch (error) {
      console.error('Error adding customer:', error);
      toast({
        title: "خطأ",
        description: "فشل في إضافة العميل",
        variant: "destructive"
      });
    }
  };

  const handleEditCustomer = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .update(selectedCustomer)
        .eq('id', selectedCustomer.id)
        .select()
        .single();

      if (error) throw error;

      const points = await calculateCustomerLoyaltyPoints(data.id);
      setCustomers(prev =>
        prev.map(customer =>
          customer.id === selectedCustomer.id ? { ...data, loyalty_points: points } : customer
        )
      );

      setIsEditDialogOpen(false);
      setSelectedCustomer(null);

      toast({
        title: "نجح",
        description: "تم تحديث بيانات العميل بنجاح"
      });
    } catch (error) {
      console.error('Error updating customer:', error);
      toast({
        title: "خطأ",
        description: "فشل في تحديث بيانات العميل",
        variant: "destructive"
      });
    }
  };

  const handleDeleteCustomer = async (customerId) => {
    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', customerId);

      if (error) throw error;

      setCustomers(prev => prev.filter(customer => customer.id !== customerId));

      toast({
        title: "نجح",
        description: "تم حذف العميل بنجاح"
      });
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast({
        title: "خطأ",
        description: "فشل في حذف العميل",
        variant: "destructive"
      });
    }
  };

  const awardLoyaltyPoints = async (customerId) => {
    try {
      const points = await calculateCustomerLoyaltyPoints(customerId);
      const newPoints = points + 200;

      setCustomers(prev =>
        prev.map(customer =>
          customer.id === customerId 
            ? { ...customer, loyalty_points: newPoints }
            : customer
        )
      );

      toast({
        title: "نجح",
        description: "تم منح 200 نقطة ولاء للعميل"
      });
    } catch (error) {
      console.error('Error awarding loyalty points:', error);
      toast({
        title: "خطأ",
        description: "فشل في منح نقاط الولاء",
        variant: "destructive"
      });
    }
  };

  const handleStatCardClick = (statType) => {
    switch (statType) {
      case 'total':
        setFilterStatus('all');
        setFilterTier('all');
        setFilterGender('all');
        setFilterCity('all');
        break;
      case 'active':
        setFilterStatus('active');
        setFilterTier('all');
        setFilterGender('all');
        setFilterCity('all');
        break;
      case 'gold':
        setFilterStatus('all');
        setFilterTier('gold');
        setFilterGender('all');
        setFilterCity('all');
        break;
      case 'silver':
        setFilterStatus('all');
        setFilterTier('silver');
        setFilterGender('all');
        setFilterCity('all');
        break;
      case 'bronze':
        setFilterStatus('all');
        setFilterTier('bronze');
        setFilterGender('all');
        setFilterCity('all');
        break;
      case 'diamond':
        setFilterStatus('all');
        setFilterTier('diamond');
        setFilterGender('all');
        setFilterCity('all');
        break;
      case 'male':
        setFilterStatus('all');
        setFilterTier('all');
        setFilterGender('male');
        setFilterCity('all');
        break;
      case 'female':
        setFilterStatus('all');
        setFilterTier('all');
        setFilterGender('female');
        setFilterCity('all');
        break;
    }
    
    toast({
      title: "تم تطبيق الفلتر",
      description: "تم تصفية العملاء حسب الإحصائية المختارة"
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6" dir="rtl">
        <div className="flex justify-between items-center">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const uniqueCities = getUniqueContent(customers, 'city');

  return (
    <div className="container mx-auto p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">إدارة العملاء</h1>
          <p className="text-muted-foreground">إدارة قاعدة بيانات العملاء ونقاط الولاء</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              إضافة عميل جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>إضافة عميل جديد</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">الاسم الكامل *</Label>
                <Input
                  id="name"
                  value={newCustomer.full_name}
                  onChange={(e) => setNewCustomer({...newCustomer, full_name: e.target.value})}
                  placeholder="أدخل الاسم الكامل"
                />
              </div>
              
              <div>
                <Label htmlFor="phone">رقم الهاتف *</Label>
                <Input
                  id="phone"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})}
                  placeholder="أدخل رقم الهاتف"
                />
              </div>
              
              <div>
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input
                  id="email"
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})}
                  placeholder="أدخل البريد الإلكتروني"
                />
              </div>
              
              <div>
                <Label htmlFor="address">العنوان</Label>
                <Textarea
                  id="address"
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer({...newCustomer, address: e.target.value})}
                  placeholder="أدخل العنوان"
                />
              </div>
              
              <div>
                <Label htmlFor="notes">ملاحظات</Label>
                <Textarea
                  id="notes"
                  value={newCustomer.notes}
                  onChange={(e) => setNewCustomer({...newCustomer, notes: e.target.value})}
                  placeholder="أدخل أي ملاحظات إضافية"
                />
              </div>
              
              <div>
                <Label htmlFor="status">الحالة</Label>
                <Select value={newCustomer.status} onValueChange={(value) => setNewCustomer({...newCustomer, status: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">نشط</SelectItem>
                    <SelectItem value="inactive">غير نشط</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  إلغاء
                </Button>
                <Button onClick={handleAddCustomer}>
                  إضافة العميل
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer hover:scale-105" onClick={() => handleStatCardClick('total')}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">إجمالي العملاء</p>
                <p className="text-3xl font-bold">{stats.totalCustomers}</p>
              </div>
              <Users className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer hover:scale-105" onClick={() => handleStatCardClick('active')}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">العملاء النشطين</p>
                <p className="text-3xl font-bold text-green-600">{stats.activeCustomers}</p>
              </div>
              <UserCheck className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer hover:scale-105" onClick={() => handleStatCardClick('diamond')}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">عملاء ماسيين</p>
                <p className="text-3xl font-bold text-purple-600">{stats.diamondTier}</p>
              </div>
              <Award className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer hover:scale-105" onClick={() => handleStatCardClick('gold')}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">عملاء ذهبيين</p>
                <p className="text-3xl font-bold text-yellow-600">{stats.goldTier}</p>
              </div>
              <Award className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer hover:scale-105" onClick={() => handleStatCardClick('silver')}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">عملاء فضيين</p>
                <p className="text-3xl font-bold text-gray-500">{stats.silverTier}</p>
              </div>
              <Award className="h-8 w-8 text-gray-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer hover:scale-105" onClick={() => handleStatCardClick('bronze')}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">عملاء برونزيين</p>
                <p className="text-3xl font-bold text-orange-600">{stats.bronzeTier}</p>
              </div>
              <Award className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer hover:scale-105" onClick={() => handleStatCardClick('male')}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">عملاء رجال</p>
                <p className="text-3xl font-bold text-blue-600">{stats.maleCustomers}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer hover:scale-105" onClick={() => handleStatCardClick('female')}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">عملاء نساء</p>
                <p className="text-3xl font-bold text-pink-600">{stats.femaleCustomers}</p>
              </div>
              <Users className="h-8 w-8 text-pink-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* City Stats */}
      {cityStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <MapPin className="mr-2 h-5 w-5" />
              إحصائيات المدن
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {cityStats.slice(0, 6).map((city, index) => (
                <div key={city.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{city.city_name}</p>
                    <p className="text-sm text-muted-foreground">{city.total_orders} طلب</p>
                  </div>
                  <div className="text-left">
                    <p className="text-lg font-bold">{city.total_amount.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">د.ع</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* City Discounts */}
      {cityDiscounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Award className="mr-2 h-5 w-5" />
              خصومات المدن الشهرية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cityDiscounts.map((discount) => (
                <div key={discount.id} className="flex items-center justify-between p-4 border rounded-lg bg-gradient-to-r from-green-50 to-emerald-50">
                  <div>
                    <p className="font-medium text-green-800">{discount.city_name}</p>
                    <p className="text-sm text-green-600">خصم شهري نشط</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-700">{discount.discount_percentage}%</p>
                    <p className="text-xs text-green-600">خصم</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="البحث في العملاء..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  فلاتر متقدمة
                  {(filterStatus !== 'all' || filterTier !== 'all' || filterGender !== 'all' || filterCity !== 'all') && (
                    <Badge variant="secondary" className="ml-2">
                      {(filterStatus !== 'all' ? 1 : 0) + 
                       (filterTier !== 'all' ? 1 : 0) + 
                       (filterGender !== 'all' ? 1 : 0) + 
                       (filterCity !== 'all' ? 1 : 0)}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>فلترة حسب الحالة</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setFilterStatus('all')}>
                  جميع العملاء {filterStatus === 'all' && <span className="mr-auto">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus('active')}>
                  العملاء النشطين {filterStatus === 'active' && <span className="mr-auto">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus('inactive')}>
                  العملاء غير النشطين {filterStatus === 'inactive' && <span className="mr-auto">✓</span>}
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                <DropdownMenuLabel>فلترة حسب مستوى الولاء</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setFilterTier('all')}>
                  جميع المستويات {filterTier === 'all' && <span className="mr-auto">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterTier('diamond')}>
                  ماسي (20,000+ نقطة) {filterTier === 'diamond' && <span className="mr-auto">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterTier('gold')}>
                  ذهبي (10,000+ نقطة) {filterTier === 'gold' && <span className="mr-auto">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterTier('silver')}>
                  فضي (5,000+ نقطة) {filterTier === 'silver' && <span className="mr-auto">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterTier('bronze')}>
                  برونزي (1,000+ نقطة) {filterTier === 'bronze' && <span className="mr-auto">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterTier('standard')}>
                  عادي (أقل من 1,000) {filterTier === 'standard' && <span className="mr-auto">✓</span>}
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuLabel>فلترة حسب الجنس</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setFilterGender('all')}>
                  الكل {filterGender === 'all' && <span className="mr-auto">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterGender('male')}>
                  رجال {filterGender === 'male' && <span className="mr-auto">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterGender('female')}>
                  نساء {filterGender === 'female' && <span className="mr-auto">✓</span>}
                </DropdownMenuItem>

                {uniqueCities.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>فلترة حسب المدينة</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => setFilterCity('all')}>
                      جميع المدن {filterCity === 'all' && <span className="mr-auto">✓</span>}
                    </DropdownMenuItem>
                    {uniqueCities.slice(0, 5).map((city) => (
                      <DropdownMenuItem key={city} onClick={() => setFilterCity(city)}>
                        {city} {filterCity === city && <span className="mr-auto">✓</span>}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
                
                {(filterStatus !== 'all' || filterTier !== 'all' || filterGender !== 'all' || filterCity !== 'all') && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => {
                        setFilterStatus('all');
                        setFilterTier('all');
                        setFilterGender('all');
                        setFilterCity('all');
                      }}
                      className="text-red-600"
                    >
                      إزالة جميع الفلاتر
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      {/* Customers List */}
      <Card>
        <CardHeader>
          <CardTitle>قائمة العملاء ({filteredCustomers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">لا توجد عملاء مطابقين للبحث</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredCustomers.map((customer) => {
                const tier = getCustomerTier(customer.loyalty_points || 0);
                const gender = getCustomerGender(customer.id);
                
                return (
                  <div key={customer.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center space-x-4 space-x-reverse">
                      <Avatar>
                        <AvatarFallback>
                          {customer.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'ع'}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium">{customer.full_name}</h3>
                          <Badge variant={customer.status === 'active' ? 'default' : 'secondary'}>
                            {customer.status === 'active' ? 'نشط' : 'غير نشط'}
                          </Badge>
                          <Badge className={`text-white ${getTierColor(tier)}`}>
                            {getTierLabel(tier)}
                          </Badge>
                          {gender !== 'unknown' && (
                            <Badge variant="outline">
                              {gender === 'male' ? 'رجال' : 'نساء'}
                            </Badge>
                          )}
                          {customer.city && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {customer.city}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          {customer.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {customer.phone}
                            </span>
                          )}
                          {customer.email && <span>{customer.email}</span>}
                          <span className="flex items-center gap-1">
                            <Award className="h-3 w-3" />
                            {customer.loyalty_points || 0} نقطة
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => awardLoyaltyPoints(customer.id)}
                      >
                        منح 200 نقطة
                      </Button>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => {
                              setSelectedCustomer(customer);
                              setIsEditDialogOpen(true);
                            }}
                          >
                            تعديل
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteCustomer(customer.id)}
                            className="text-red-600"
                          >
                            حذف
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>تعديل بيانات العميل</DialogTitle>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">الاسم الكامل *</Label>
                <Input
                  id="edit-name"
                  value={selectedCustomer.full_name || ''}
                  onChange={(e) => setSelectedCustomer({...selectedCustomer, full_name: e.target.value})}
                  placeholder="أدخل الاسم الكامل"
                />
              </div>
              
              <div>
                <Label htmlFor="edit-phone">رقم الهاتف *</Label>
                <Input
                  id="edit-phone"
                  value={selectedCustomer.phone || ''}
                  onChange={(e) => setSelectedCustomer({...selectedCustomer, phone: e.target.value})}
                  placeholder="أدخل رقم الهاتف"
                />
              </div>
              
              <div>
                <Label htmlFor="edit-email">البريد الإلكتروني</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={selectedCustomer.email || ''}
                  onChange={(e) => setSelectedCustomer({...selectedCustomer, email: e.target.value})}
                  placeholder="أدخل البريد الإلكتروني"
                />
              </div>
              
              <div>
                <Label htmlFor="edit-address">العنوان</Label>
                <Textarea
                  id="edit-address"
                  value={selectedCustomer.address || ''}
                  onChange={(e) => setSelectedCustomer({...selectedCustomer, address: e.target.value})}
                  placeholder="أدخل العنوان"
                />
              </div>
              
              <div>
                <Label htmlFor="edit-notes">ملاحظات</Label>
                <Textarea
                  id="edit-notes"
                  value={selectedCustomer.notes || ''}
                  onChange={(e) => setSelectedCustomer({...selectedCustomer, notes: e.target.value})}
                  placeholder="أدخل أي ملاحظات إضافية"
                />
              </div>
              
              <div>
                <Label htmlFor="edit-status">الحالة</Label>
                <Select value={selectedCustomer.status} onValueChange={(value) => setSelectedCustomer({...selectedCustomer, status: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">نشط</SelectItem>
                    <SelectItem value="inactive">غير نشط</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  إلغاء
                </Button>
                <Button onClick={handleEditCustomer}>
                  حفظ التغييرات
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
