
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Star, Phone, Gift, MapPin, Award, Crown, Medal, Gem } from 'lucide-react';

const CustomerStats = ({ 
  totalCustomers, 
  customersWithPoints, 
  customersWithPhones, 
  highPointsCustomers,
  cityStats,
  loyaltyTiers,
  activeFilter,
  onFilterChange 
}) => {
  
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
          onClick={() => onFilterChange('all')}
          color="blue"
        />

        <StatCard
          icon={Star}
          title="لديهم نقاط"
          value={customersWithPoints}
          description={`${Math.round((customersWithPoints / totalCustomers) * 100)}%`}
          isActive={activeFilter === 'with_points'}
          onClick={() => onFilterChange('with_points')}
          color="yellow"
        />

        <StatCard
          icon={Phone}
          title="مع أرقام"
          value={customersWithPhones}
          description={`${Math.round((customersWithPhones / totalCustomers) * 100)}%`}
          isActive={activeFilter === 'with_phones'}
          onClick={() => onFilterChange('with_phones')}
          color="green"
        />

        <StatCard
          icon={Gift}
          title="نقاط عالية"
          value={highPointsCustomers}
          description="أكثر من 1000"
          isActive={activeFilter === 'high_points'}
          onClick={() => onFilterChange('high_points')}
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
                        <div className="text-xs text-muted-foreground">
                          {tier.points_required.toLocaleString()} نقطة
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

        {/* إحصائيات المدن */}
        {cityStats && cityStats.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <MapPin className="h-5 w-5" />
                أكثر المدن طلباً
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {cityStats.slice(0, 6).map((city, index) => (
                <div key={city.city_name} className="flex items-center justify-between p-2 md:p-3 bg-muted/30 rounded-lg">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{city.city_name}</div>
                    <div className="text-xs text-muted-foreground">{city.customer_count} عميل</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-medium">{city.total_orders} طلب</div>
                    <div className="text-xs text-muted-foreground">
                      {new Intl.NumberFormat('ar-IQ').format(city.total_amount)} د.ع
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default CustomerStats;
