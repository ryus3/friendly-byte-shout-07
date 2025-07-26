
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Phone, MapPin, Star, Award, Medal, Crown, Gem, Eye, Send, Gift, Users } from 'lucide-react';

const CustomerCard = ({ customer, onViewDetails, onSendNotification }) => {
  const loyaltyData = customer.customer_loyalty?.[0];
  const tierIcon = loyaltyData?.loyalty_tiers?.icon ? getTierIcon(loyaltyData.loyalty_tiers.icon) : Star;
  const TierIcon = tierIcon;

  // تحديد الجمهور المستهدف
  const genderSegment = customer.customer_product_segments?.[0]?.gender_segment;
  const genderIcon = genderSegment === 'male' ? '🧑' : genderSegment === 'female' ? '👩' : '👥';
  const genderText = genderSegment === 'male' ? 'رجالي' : genderSegment === 'female' ? 'نسائي' : 'للجنسين';

  // حساب النقاط - التأكد من أنها محسوبة على أساس الطلبات المكتملة
  const totalPoints = loyaltyData?.total_points || 0;
  const totalOrders = loyaltyData?.total_orders || 0;
  const expectedPoints = totalOrders * 200; // 200 نقطة لكل طلب

  const getTierIcon = (iconName) => {
    const tierIcons = { Star, Award, Medal, Crown, Gem };
    return tierIcons[iconName] || Star;
  };

  return (
    <Card className="hover:shadow-lg transition-all duration-200 border-l-4" 
          style={{ borderLeftColor: loyaltyData?.loyalty_tiers?.color || '#3B82F6' }}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start space-x-4 space-x-reverse flex-1">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary/10 text-lg font-bold">
                {customer.name.slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-lg">{customer.name}</h3>
                {loyaltyData?.loyalty_tiers && (
                  <Badge 
                    variant="secondary" 
                    className="flex items-center gap-1 px-3 py-1"
                    style={{ 
                      backgroundColor: loyaltyData.loyalty_tiers.color + '20', 
                      color: loyaltyData.loyalty_tiers.color,
                      borderColor: loyaltyData.loyalty_tiers.color + '40'
                    }}
                  >
                    <TierIcon className="h-4 w-4" />
                    {loyaltyData.loyalty_tiers.name}
                  </Badge>
                )}
                {genderSegment && (
                  <Badge variant="outline" className="text-sm">
                    {genderIcon} {genderText}
                  </Badge>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{customer.phone || 'غير متوفر'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{customer.city ? `${customer.city}, ${customer.province}` : 'غير محدد'}</span>
                </div>
              </div>

              {/* إحصائيات العميل */}
              <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-500" />
                    <span className="font-semibold text-lg">{totalPoints}</span>
                    <span className="text-muted-foreground">نقطة</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Gift className="h-5 w-5 text-green-500" />
                    <span className="font-semibold">{totalOrders}</span>
                    <span className="text-muted-foreground">طلب مكتمل</span>
                  </div>
                </div>
                
                {/* تحذير إذا كان هناك عدم تطابق في النقاط */}
                {totalPoints !== expectedPoints && totalOrders > 0 && (
                  <div className="flex items-center gap-2 text-destructive text-sm">
                    <span>⚠️</span>
                    <span>خطأ في النقاط - المتوقع: {expectedPoints} نقطة</span>
                  </div>
                )}

                {/* إجمالي المصروف */}
                {loyaltyData?.total_spent > 0 && (
                  <div className="text-sm text-muted-foreground">
                    إجمالي المشتريات: {new Intl.NumberFormat('ar-IQ').format(loyaltyData.total_spent)} د.ع
                  </div>
                )}
              </div>

              {/* تقسيمات المنتجات */}
              <div className="flex flex-wrap gap-2">
                {customer.customer_product_segments?.map((segment, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {segment.departments?.name || segment.categories?.name || 'غير محدد'}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewDetails(customer)}
              className="gap-2"
            >
              <Eye className="h-4 w-4" />
              تفاصيل
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSendNotification(customer)}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              إشعار
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CustomerCard;
