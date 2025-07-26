
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Star, Phone, Gift, MapPin, Award, Crown, Medal, Gem } from 'lucide-react';

const CustomerStats = ({ 
  customers = [], 
  loyaltyTiers = [], 
  activeFilter, 
  setActiveFilter 
}) => {
  
  // حساب الإحصائيات
  const totalCustomers = customers.length;
  const customersWithPoints = customers.filter(c => (c.customer_loyalty?.[0]?.total_points || 0) > 0).length;
  const customersWithPhones = customers.filter(c => c.phone).length;
  const highPointsCustomers = customers.filter(c => (c.customer_loyalty?.[0]?.total_points || 0) >= 1000).length;

  // حساب عدد العملاء في كل مستوى ولاء
  const tierCounts = {};
  customers.forEach(customer => {
    const loyaltyData = customer.customer_loyalty?.[0];
    if (loyaltyData?.current_tier_id) {
      const tierId = loyaltyData.current_tier_id;
      tierCounts[tierId] = (tierCounts[tierId] || 0) + 1;
    }
  });
  
  const StatCard = ({ icon: Icon, title, value, description, isActive, onClick, color = "blue" }) => (
    <Card 
      className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
        isActive ? 'ring-2 ring-primary bg-primary/5' : ''
      }`}
      onClick={onClick}
    >
      <CardContent className="p-3 md:p-4 flex items-center space-x-3 space-x-reverse">
        <div className={`p-2 md:p-3 rounded-full bg-${color}-100`}>
          <Icon className={`h-5 w-5 md:h-6 md:w-6 text-${color}-600`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xl md:text-2xl font-bold">{value}</p>
          <p className="text-xs md:text-sm font-medium truncate">{title}</p>
          {description && (
            <p className="text-xs text-muted-foreground truncate">{description}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );

  const getTierIcon = (iconName) => {
    const icons = { Star, Award, Medal, Crown, Gem };
    return icons[iconName] || Star;
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* إحصائيات العملاء الرئيسية */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          icon={Users}
          title="جميع العملاء"
          value={totalCustomers}
          isActive={activeFilter === 'all'}
          onClick={() => setActiveFilter('all')}
          color="blue"
        />

        <StatCard
          icon={Star}
          title="لديهم نقاط"
          value={customersWithPoints}
          description={`${Math.round((customersWithPoints / totalCustomers) * 100)}%`}
          isActive={activeFilter === 'with_points'}
          onClick={() => setActiveFilter('with_points')}
          color="yellow"
        />

        <StatCard
          icon={Phone}
          title="مع أرقام"
          value={customersWithPhones}
          description={`${Math.round((customersWithPhones / totalCustomers) * 100)}%`}
          isActive={activeFilter === 'with_phones'}
          onClick={() => setActiveFilter('with_phones')}
          color="green"
        />

        <StatCard
          icon={Gift}
          title="نقاط عالية"
          value={highPointsCustomers}
          description="أكثر من 1000"
          isActive={activeFilter === 'high_points'}
          onClick={() => setActiveFilter('high_points')}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* مستويات الولاء */}
        {loyaltyTiers && loyaltyTiers.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <Award className="h-5 w-5" />
                مستويات الولاء
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {loyaltyTiers.map((tier) => {
                const TierIcon = getTierIcon(tier.icon);
                return (
                  <div 
                    key={tier.id} 
                    className="flex items-center justify-between p-2 md:p-3 rounded-lg border transition-colors hover:bg-muted/50"
                    style={{ borderLeftColor: tier.color, borderLeftWidth: '4px' }}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div 
                        className="p-1.5 rounded-full"
                        style={{ backgroundColor: tier.color + '20' }}
                      >
                        <TierIcon 
                          className="h-4 w-4" 
                          style={{ color: tier.color }} 
                        />
                      </div>
                       <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm truncate">{tier.name}</div>
                        <div className="text-xs text-muted-foreground space-x-2 space-x-reverse">
                          <span>{tier.points_required.toLocaleString()} نقطة</span>
                          <span>•</span>
                          <span className="font-medium text-primary">
                            {tierCounts[tier.id] || 0} عضو
                          </span>
                        </div>
                      </div>
                    </div>
                    {tier.discount_percentage > 0 && (
                      <div className="text-xs font-medium text-green-600 shrink-0">
                        خصم {tier.discount_percentage}%
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* إحصائيات الجمهور */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Users className="h-5 w-5" />
              الجمهور المستهدف
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-700">
                {customers.filter(c => c.customer_product_segments?.some(s => s.gender_segment === 'male')).length}
              </div>
              <div className="text-sm text-blue-600">🧑 جمهور رجالي</div>
            </div>
            <div className="text-center p-4 bg-pink-50 rounded-lg">
              <div className="text-2xl font-bold text-pink-700">
                {customers.filter(c => c.customer_product_segments?.some(s => s.gender_segment === 'female')).length}
              </div>
              <div className="text-sm text-pink-600">👩 جمهور نسائي</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CustomerStats;
