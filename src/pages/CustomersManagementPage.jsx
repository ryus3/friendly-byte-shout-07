import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Phone, MapPin, Star, Award, Medal, Crown, Gem, ShoppingBag, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';

const CustomersManagementPage = () => {
  const [customers, setCustomers] = useState([]);
  const [loyaltyTiers, setLoyaltyTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

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

      // جلب العملاء مع بيانات الولاء
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
            loyalty_tiers (
              name,
              color,
              icon,
              discount_percentage
            )
          )
        `)
        .order('created_at', { ascending: false });

      setCustomers(customersData || []);
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

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone?.includes(searchTerm) ||
    customer.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTierIcon = (iconName) => {
    const IconComponent = tierIcons[iconName] || Star;
    return IconComponent;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ar-IQ').format(amount) + ' د.ع';
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
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            إدارة العملاء ونظام الولاء
          </h1>
          <p className="text-muted-foreground">
            إدارة قاعدة بيانات العملاء ومستويات الولاء والنقاط
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">إجمالي العملاء</p>
                <p className="text-2xl font-bold">{customers.length}</p>
              </div>
              <Users className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">عملاء مع نقاط</p>
                <p className="text-2xl font-bold">
                  {customers.filter(c => c.customer_loyalty?.total_points > 0).length}
                </p>
              </div>
              <Star className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">إجمالي النقاط</p>
                <p className="text-2xl font-bold">
                  {customers.reduce((sum, c) => sum + (c.customer_loyalty?.total_points || 0), 0).toLocaleString()}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">إجمالي المبيعات</p>
                <p className="text-xl font-bold">
                  {formatCurrency(customers.reduce((sum, c) => sum + (c.customer_loyalty?.total_spent || 0), 0))}
                </p>
              </div>
              <ShoppingBag className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Input
          placeholder="البحث بالاسم أو الهاتف أو البريد الإلكتروني..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1"
        />
      </div>

      {/* Loyalty Tiers Overview */}
      <Card>
        <CardHeader>
          <CardTitle>مستويات الولاء</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {loyaltyTiers.map((tier) => {
              const TierIcon = getTierIcon(tier.icon);
              const customersInTier = customers.filter(c => 
                c.customer_loyalty?.current_tier_id === tier.id
              ).length;
              
              return (
                <div key={tier.id} className="text-center p-4 rounded-lg border">
                  <TierIcon 
                    className="h-8 w-8 mx-auto mb-2" 
                    style={{ color: tier.color }}
                  />
                  <h3 className="font-semibold">{tier.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {tier.points_required} نقطة
                  </p>
                  <p className="text-lg font-bold">{customersInTier} عميل</p>
                  {tier.discount_percentage > 0 && (
                    <Badge variant="secondary">
                      خصم {tier.discount_percentage}%
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Customers List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers.map((customer) => {
          const loyalty = customer.customer_loyalty;
          const tier = loyalty?.loyalty_tiers;
          const TierIcon = tier ? getTierIcon(tier.icon) : Star;

          return (
            <Card key={customer.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-4">
                <div className="space-y-3">
                  {/* Customer Basic Info */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{customer.name}</h3>
                      {customer.phone && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {customer.phone}
                        </div>
                      )}
                      {customer.address && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {customer.city}, {customer.province}
                        </div>
                      )}
                    </div>
                    
                    {/* Tier Badge */}
                    {tier && (
                      <Badge 
                        variant="outline" 
                        className="flex items-center gap-1"
                        style={{ borderColor: tier.color, color: tier.color }}
                      >
                        <TierIcon className="h-3 w-3" />
                        {tier.name}
                      </Badge>
                    )}
                  </div>

                  {/* Loyalty Stats */}
                  {loyalty && (
                    <div className="grid grid-cols-2 gap-4 pt-3 border-t">
                      <div className="text-center">
                        <p className="text-lg font-bold text-primary">
                          {loyalty.total_points.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">نقطة</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-green-600">
                          {loyalty.total_orders}
                        </p>
                        <p className="text-xs text-muted-foreground">طلب</p>
                      </div>
                      <div className="text-center col-span-2">
                        <p className="text-sm font-medium">
                          {formatCurrency(loyalty.total_spent)}
                        </p>
                        <p className="text-xs text-muted-foreground">إجمالي المشتريات</p>
                      </div>
                    </div>
                  )}

                  {/* No Loyalty Data */}
                  {!loyalty && (
                    <div className="text-center py-4 text-muted-foreground">
                      <Star className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">لا توجد بيانات ولاء بعد</p>
                      <p className="text-xs">سيتم إضافة النقاط عند أول طلب</p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" className="flex-1">
                      عرض التفاصيل
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1">
                      سجل الطلبات
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
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
    </div>
  );
};

export default CustomersManagementPage;