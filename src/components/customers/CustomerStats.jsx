
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Star, Phone, Gift, MapPin, Award } from 'lucide-react';

const CustomerStats = ({ 
  totalCustomers, 
  customersWithPoints, 
  customersWithPhones, 
  highPointsCustomers,
  cityStats,
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
      <CardContent className="p-4 flex items-center space-x-4 space-x-reverse">
        <div className={`p-3 rounded-full bg-${color}-100`}>
          <Icon className={`h-6 w-6 text-${color}-600`} />
        </div>
        <div className="flex-1">
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm font-medium">{title}</p>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* إحصائيات العملاء الرئيسية */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
          description={`${Math.round((customersWithPoints / totalCustomers) * 100)}% من العملاء`}
          isActive={activeFilter === 'with_points'}
          onClick={() => onFilterChange('with_points')}
          color="yellow"
        />

        <StatCard
          icon={Phone}
          title="مع أرقام"
          value={customersWithPhones}
          description={`${Math.round((customersWithPhones / totalCustomers) * 100)}% من العملاء`}
          isActive={activeFilter === 'with_phones'}
          onClick={() => onFilterChange('with_phones')}
          color="green"
        />

        <StatCard
          icon={Gift}
          title="نقاط عالية"
          value={highPointsCustomers}
          description="أكثر من 1000 نقطة"
          isActive={activeFilter === 'high_points'}
          onClick={() => onFilterChange('high_points')}
          color="purple"
        />
      </div>

      {/* إحصائيات المدن */}
      {cityStats && cityStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              أكثر المدن طلباً
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {cityStats.slice(0, 6).map((city, index) => (
                <div key={city.city_name} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <p className="font-medium">{city.city_name}</p>
                    <p className="text-sm text-muted-foreground">{city.customer_count} عميل</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{city.total_orders} طلب</p>
                    <p className="text-xs text-muted-foreground">
                      {new Intl.NumberFormat('ar-IQ').format(city.total_amount)} د.ع
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CustomerStats;
