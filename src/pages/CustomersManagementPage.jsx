
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { 
  Users, 
  Star, 
  TrendingUp, 
  Eye,
  Search,
  Filter,
  Calendar,
  Package,
  Award,
  Crown,
  Heart,
  Sparkles,
  ChevronDown
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const CustomersManagementPage = () => {
  const { toast } = useToast();
  const [customers, setCustomers] = useState([]);
  const [loyaltyData, setLoyaltyData] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTier, setSelectedTier] = useState('all');
  const [selectedSegment, setSelectedSegment] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  // الإحصائيات
  const [stats, setStats] = useState({
    total: 0,
    new: 0,
    loyal: 0,
    vip: 0
  });

  // بيانات مستويات الولاء
  const [loyaltyTiers, setLoyaltyTiers] = useState([]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);

      // جلب العملاء مع بياناتهم
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select(`
          *,
          orders(
            id,
            total_amount,
            created_at,
            status
          )
        `)
        .order('created_at', { ascending: false });

      if (customersError) throw customersError;

      // جلب بيانات الولاء
      const { data: loyaltyDataResult, error: loyaltyError } = await supabase
        .from('customer_loyalty')
        .select(`
          *,
          loyalty_tiers(*)
        `);

      if (loyaltyError) throw loyaltyError;

      // جلب مستويات الولاء
      const { data: tiersData, error: tiersError } = await supabase
        .from('loyalty_tiers')
        .select('*')
        .order('points_required', { ascending: true });

      if (tiersError) throw tiersError;

      setLoyaltyTiers(tiersData || []);

      // تنظيم بيانات الولاء
      const loyaltyMap = {};
      loyaltyDataResult?.forEach(loyalty => {
        loyaltyMap[loyalty.customer_id] = loyalty;
      });

      setLoyaltyData(loyaltyMap);

      // معالجة العملاء وحساب الإحصائيات
      const processedCustomers = customersData?.map(customer => {
        const loyalty = loyaltyMap[customer.id];
        const orders = customer.orders || [];
        const completedOrders = orders.filter(order => order.status === 'completed');
        
        return {
          ...customer,
          loyalty,
          totalOrders: orders.length,
          totalSpent: completedOrders.reduce((sum, order) => sum + parseFloat(order.total_amount || 0), 0),
          lastOrderDate: orders.length > 0 ? orders[0].created_at : null
        };
      }) || [];

      setCustomers(processedCustomers);

      // حساب الإحصائيات
      const now = new Date();
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const newCustomers = processedCustomers.filter(c => 
        new Date(c.created_at) >= oneMonthAgo
      ).length;

      const loyalCustomers = processedCustomers.filter(c => 
        c.totalOrders >= 3
      ).length;

      const vipCustomers = processedCustomers.filter(c => 
        c.loyalty?.loyalty_tiers?.name === 'VIP' || c.totalSpent >= 500000
      ).length;

      setStats({
        total: processedCustomers.length,
        new: newCustomers,
        loyal: loyalCustomers,
        vip: vipCustomers
      });

    } catch (error) {
      console.error('خطأ في جلب بيانات العملاء:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ في جلب بيانات العملاء",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  // فلترة العملاء
  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = customer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customer.phone?.includes(searchTerm) ||
                         customer.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTier = selectedTier === 'all' || 
                       customer.loyalty?.loyalty_tiers?.name === selectedTier;
    
    const matchesSegment = selectedSegment === 'all' ||
                          (selectedSegment === 'new' && new Date(customer.created_at) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) ||
                          (selectedSegment === 'loyal' && customer.totalOrders >= 3) ||
                          (selectedSegment === 'vip' && customer.totalSpent >= 500000);

    return matchesSearch && matchesTier && matchesSegment;
  });

  // ترتيب العملاء
  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return new Date(b.created_at) - new Date(a.created_at);
      case 'oldest':
        return new Date(a.created_at) - new Date(b.created_at);
      case 'spending':
        return b.totalSpent - a.totalSpent;
      case 'orders':
        return b.totalOrders - a.totalOrders;
      case 'points':
        return (b.loyalty?.total_points || 0) - (a.loyalty?.total_points || 0);
      default:
        return 0;
    }
  });

  const handleStatCardClick = (type) => {
    switch (type) {
      case 'new':
        setSelectedSegment('new');
        break;
      case 'loyal':
        setSelectedSegment('loyal');
        break;
      case 'vip':
        setSelectedSegment('vip');
        break;
      default:
        setSelectedSegment('all');
    }
  };

  const getTierIcon = (tierName) => {
    switch (tierName?.toLowerCase()) {
      case 'bronze':
      case 'برونزي':
        return Award;
      case 'silver':
      case 'فضي':
        return Star;
      case 'gold':
      case 'ذهبي':
        return Crown;
      case 'vip':
        return Sparkles;
      default:
        return Heart;
    }
  };

  const getTierColor = (tierName) => {
    switch (tierName?.toLowerCase()) {
      case 'bronze':
      case 'برونزي':
        return 'text-orange-600';
      case 'silver':
      case 'فضي':
        return 'text-gray-600';
      case 'gold':
      case 'ذهبي':
        return 'text-yellow-600';
      case 'vip':
        return 'text-purple-600';
      default:
        return 'text-blue-600';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <span className="ml-3 text-lg">جاري تحميل بيانات العملاء...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" dir="rtl">
      {/* العنوان */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">إدارة العملاء</h1>
          <p className="text-muted-foreground mt-1">
            إدارة وتتبع عملائك ومستويات الولاء
          </p>
        </div>
      </div>

      {/* بطاقات الإحصائيات - قابلة للنقر */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card 
          className="cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-105"
          onClick={() => handleStatCardClick('total')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي العملاء</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">جميع العملاء المسجلين</p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-105"
          onClick={() => handleStatCardClick('new')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">عملاء جدد</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.new}</div>
            <p className="text-xs text-muted-foreground">خلال الشهر الماضي</p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-105"
          onClick={() => handleStatCardClick('loyal')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">عملاء مخلصين</CardTitle>
            <Heart className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.loyal}</div>
            <p className="text-xs text-muted-foreground">3 طلبات أو أكثر</p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-105"
          onClick={() => handleStatCardClick('vip')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">عملاء VIP</CardTitle>
            <Crown className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.vip}</div>
            <p className="text-xs text-muted-foreground">عملاء مميزين</p>
          </CardContent>
        </Card>
      </div>

      {/* الفلاتر والبحث */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* البحث */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="ابحث بالاسم، الهاتف، أو الإيميل..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>

            {/* الفلاتر المتقدمة - قائمة منسدلة واحدة */}
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Filter className="h-4 w-4" />
                    الفلاتر
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="p-2">
                    <p className="text-sm font-medium mb-2">مستوى الولاء</p>
                    <div className="space-y-1">
                      <DropdownMenuItem 
                        onClick={() => setSelectedTier('all')}
                        className={selectedTier === 'all' ? 'bg-accent' : ''}
                      >
                        جميع المستويات
                      </DropdownMenuItem>
                      {loyaltyTiers.map(tier => (
                        <DropdownMenuItem 
                          key={tier.id}
                          onClick={() => setSelectedTier(tier.name)}
                          className={selectedTier === tier.name ? 'bg-accent' : ''}
                        >
                          {tier.name}
                        </DropdownMenuItem>
                      ))}
                    </div>
                  </div>
                  
                  <DropdownMenuSeparator />
                  
                  <div className="p-2">
                    <p className="text-sm font-medium mb-2">التصنيف</p>
                    <div className="space-y-1">
                      <DropdownMenuItem 
                        onClick={() => setSelectedSegment('all')}
                        className={selectedSegment === 'all' ? 'bg-accent' : ''}
                      >
                        جميع العملاء
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => setSelectedSegment('new')}
                        className={selectedSegment === 'new' ? 'bg-accent' : ''}
                      >
                        عملاء جدد
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => setSelectedSegment('loyal')}
                        className={selectedSegment === 'loyal' ? 'bg-accent' : ''}
                      >
                        عملاء مخلصين
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => setSelectedSegment('vip')}
                        className={selectedSegment === 'vip' ? 'bg-accent' : ''}
                      >
                        عملاء VIP
                      </DropdownMenuItem>
                    </div>
                  </div>
                  
                  <DropdownMenuSeparator />
                  
                  <div className="p-2">
                    <p className="text-sm font-medium mb-2">الترتيب</p>
                    <div className="space-y-1">
                      <DropdownMenuItem 
                        onClick={() => setSortBy('newest')}
                        className={sortBy === 'newest' ? 'bg-accent' : ''}
                      >
                        الأحدث أولاً
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => setSortBy('oldest')}
                        className={sortBy === 'oldest' ? 'bg-accent' : ''}
                      >
                        الأقدم أولاً
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => setSortBy('spending')}
                        className={sortBy === 'spending' ? 'bg-accent' : ''}
                      >
                        الأعلى إنفاقاً
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => setSortBy('orders')}
                        className={sortBy === 'orders' ? 'bg-accent' : ''}
                      >
                        الأكثر طلباً
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => setSortBy('points')}
                        className={sortBy === 'points' ? 'bg-accent' : ''}
                      >
                        الأعلى نقاطاً
                      </DropdownMenuItem>
                    </div>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* عداد النتائج */}
          <div className="mt-4 text-sm text-muted-foreground">
            عرض {sortedCustomers.length} من أصل {customers.length} عميل
          </div>
        </CardContent>
      </Card>

      {/* قائمة العملاء */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedCustomers.map((customer) => {
          const TierIcon = getTierIcon(customer.loyalty?.loyalty_tiers?.name);
          
          return (
            <Card key={customer.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center text-white font-bold">
                      {customer.name?.charAt(0)?.toUpperCase() || 'ع'}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{customer.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        انضم {format(new Date(customer.created_at), 'dd MMM yyyy', { locale: ar })}
                      </p>
                    </div>
                  </div>
                  
                  {customer.loyalty?.loyalty_tiers && (
                    <Badge variant="outline" className="gap-1">
                      <TierIcon className={`h-3 w-3 ${getTierColor(customer.loyalty.loyalty_tiers.name)}`} />
                      {customer.loyalty.loyalty_tiers.name}
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* معلومات الاتصال */}
                <div className="space-y-2">
                  {customer.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">الهاتف:</span>
                      <span>{customer.phone}</span>
                    </div>
                  )}
                  {customer.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">الإيميل:</span>
                      <span className="truncate">{customer.email}</span>
                    </div>
                  )}
                  {customer.city && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">المدينة:</span>
                      <span>{customer.city}</span>
                    </div>
                  )}
                </div>

                {/* إحصائيات العميل */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-muted/50 rounded-lg p-2">
                    <div className="text-lg font-bold">{customer.totalOrders}</div>
                    <div className="text-xs text-muted-foreground">طلب</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2">
                    <div className="text-lg font-bold">{customer.totalSpent.toLocaleString()}</div>
                    <div className="text-xs text-muted-foreground">د.ع</div>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2">
                    <div className="text-lg font-bold">{customer.loyalty?.total_points || 0}</div>
                    <div className="text-xs text-muted-foreground">نقطة</div>
                  </div>
                </div>

                {/* آخر طلب */}
                {customer.lastOrderDate && (
                  <div className="text-xs text-muted-foreground text-center border-t pt-2">
                    آخر طلب: {format(new Date(customer.lastOrderDate), 'dd/MM/yyyy', { locale: ar })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* رسالة عدم وجود نتائج */}
      {sortedCustomers.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">لا توجد عملاء</h3>
            <p className="text-muted-foreground">
              {searchTerm || selectedTier !== 'all' || selectedSegment !== 'all'
                ? 'لا توجد نتائج تطابق الفلاتر المحددة'
                : 'لم يتم تسجيل أي عملاء بعد'
              }
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CustomersManagementPage;
