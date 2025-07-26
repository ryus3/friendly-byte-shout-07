
import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, Filter, MoreHorizontal, Users, Award, TrendingUp, UserCheck } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';

const CustomersManagementPage = () => {
  const { toast } = useToast();
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterTier, setFilterTier] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCustomers: 0,
    activeCustomers: 0,
    totalLoyaltyPoints: 0,
    averageOrderValue: 0
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

  // Load customers and stats
  useEffect(() => {
    loadCustomers();
    loadStats();
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

    setFilteredCustomers(filtered);
  }, [customers, searchTerm, filterStatus, filterTier]);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setCustomers(data || []);
    } catch (error) {
      console.error('Error loading customers:', error);
      toast({
        title: "خطأ",
        description: "فشل في تحميل بيانات العملاء",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      // Get total customers
      const { count: totalCustomers } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true });

      // Get active customers
      const { count: activeCustomers } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // Get total loyalty points
      const { data: loyaltyData } = await supabase
        .from('customers')
        .select('loyalty_points');

      const totalLoyaltyPoints = loyaltyData?.reduce((sum, customer) => sum + (customer.loyalty_points || 0), 0) || 0;

      // Calculate average order value from orders
      const { data: ordersData } = await supabase
        .from('orders')
        .select('total');

      const averageOrderValue = ordersData?.length > 0 
        ? ordersData.reduce((sum, order) => sum + (order.total || 0), 0) / ordersData.length 
        : 0;

      setStats({
        totalCustomers: totalCustomers || 0,
        activeCustomers: activeCustomers || 0,
        totalLoyaltyPoints,
        averageOrderValue
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const getCustomerTier = (points) => {
    if (points >= 10000) return 'gold';
    if (points >= 5000) return 'silver';
    if (points >= 1000) return 'bronze';
    return 'standard';
  };

  const getTierColor = (tier) => {
    switch (tier) {
      case 'gold': return 'bg-yellow-500';
      case 'silver': return 'bg-gray-400';
      case 'bronze': return 'bg-orange-600';
      default: return 'bg-blue-500';
    }
  };

  const getTierLabel = (tier) => {
    switch (tier) {
      case 'gold': return 'ذهبي';
      case 'silver': return 'فضي';
      case 'bronze': return 'برونزي';
      default: return 'عادي';
    }
  };

  const handleAddCustomer = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert([newCustomer])
        .select()
        .single();

      if (error) throw error;

      setCustomers(prev => [data, ...prev]);
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

      setCustomers(prev =>
        prev.map(customer =>
          customer.id === selectedCustomer.id ? data : customer
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
      // Award 200 points per order
      const { data, error } = await supabase
        .from('customers')
        .update({ 
          loyalty_points: supabase.raw('loyalty_points + 200')
        })
        .eq('id', customerId)
        .select()
        .single();

      if (error) throw error;

      setCustomers(prev =>
        prev.map(customer =>
          customer.id === customerId 
            ? { ...customer, loyalty_points: (customer.loyalty_points || 0) + 200 }
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
        break;
      case 'active':
        setFilterStatus('active');
        setFilterTier('all');
        break;
      case 'gold':
        setFilterStatus('all');
        setFilterTier('gold');
        break;
      case 'silver':
        setFilterStatus('all');
        setFilterTier('silver');
        break;
    }
    toast({
      title: "تم تطبيق الفلتر",
      description: "تم تصفية العملاء حسب الإحصائية المختارة"
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

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
              
              <div>
                <Label htmlFor="loyalty_points">نقاط الولاء الأولية</Label>
                <Input
                  id="loyalty_points"
                  type="number"
                  value={newCustomer.loyalty_points}
                  onChange={(e) => setNewCustomer({...newCustomer, loyalty_points: parseInt(e.target.value) || 0})}
                  placeholder="0"
                />
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

      {/* Stats Cards - Now Clickable */}
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

        <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer hover:scale-105" onClick={() => handleStatCardClick('gold')}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">إجمالي نقاط الولاء</p>
                <p className="text-3xl font-bold text-yellow-600">{stats.totalLoyaltyPoints.toLocaleString()}</p>
              </div>
              <Award className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer hover:scale-105">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">متوسط قيمة الطلب</p>
                <p className="text-3xl font-bold text-blue-600">{stats.averageOrderValue.toLocaleString()} د.ع</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

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
            
            {/* Advanced Filters Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  فلاتر متقدمة
                  {(filterStatus !== 'all' || filterTier !== 'all') && (
                    <Badge variant="secondary" className="ml-2">
                      {(filterStatus !== 'all' ? 1 : 0) + (filterTier !== 'all' ? 1 : 0)}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>فلترة حسب الحالة</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setFilterStatus('all')}>
                  جميع العملاء
                  {filterStatus === 'all' && <span className="mr-auto">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus('active')}>
                  العملاء النشطين
                  {filterStatus === 'active' && <span className="mr-auto">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus('inactive')}>
                  العملاء غير النشطين
                  {filterStatus === 'inactive' && <span className="mr-auto">✓</span>}
                </DropdownMenuItem>
                
                <DropdownMenuSeparator />
                <DropdownMenuLabel>فلترة حسب مستوى الولاء</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setFilterTier('all')}>
                  جميع المستويات
                  {filterTier === 'all' && <span className="mr-auto">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterTier('gold')}>
                  ذهبي (10,000+ نقطة)
                  {filterTier === 'gold' && <span className="mr-auto">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterTier('silver')}>
                  فضي (5,000+ نقطة)
                  {filterTier === 'silver' && <span className="mr-auto">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterTier('bronze')}>
                  برونزي (1,000+ نقطة)
                  {filterTier === 'bronze' && <span className="mr-auto">✓</span>}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterTier('standard')}>
                  عادي (أقل من 1,000)
                  {filterTier === 'standard' && <span className="mr-auto">✓</span>}
                </DropdownMenuItem>
                
                {(filterStatus !== 'all' || filterTier !== 'all') && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => {
                        setFilterStatus('all');
                        setFilterTier('all');
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
                return (
                  <div key={customer.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center space-x-4 space-x-reverse">
                      <Avatar>
                        <AvatarFallback>
                          {customer.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'ع'}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{customer.full_name}</h3>
                          <Badge variant={customer.status === 'active' ? 'default' : 'secondary'}>
                            {customer.status === 'active' ? 'نشط' : 'غير نشط'}
                          </Badge>
                          <Badge className={`text-white ${getTierColor(tier)}`}>
                            {getTierLabel(tier)}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          {customer.phone && <span>{customer.phone}</span>}
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
              
              <div>
                <Label htmlFor="edit-loyalty_points">نقاط الولاء</Label>
                <Input
                  id="edit-loyalty_points"
                  type="number"
                  value={selectedCustomer.loyalty_points || 0}
                  onChange={(e) => setSelectedCustomer({...selectedCustomer, loyalty_points: parseInt(e.target.value) || 0})}
                  placeholder="0"
                />
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
