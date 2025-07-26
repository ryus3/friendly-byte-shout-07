
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Phone, MapPin, Star, Award, Medal, Crown, Gem, Eye, Send, Gift, Users, AlertTriangle } from 'lucide-react';

const CustomerCard = ({ customer, onViewDetails, onSendNotification }) => {
  const loyaltyData = customer.customer_loyalty?.[0];
  const getTierIcon = (iconName) => {
    const icons = { Star, Award, Medal, Crown, Gem };
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
    <Card className="w-full hover:shadow-lg transition-all duration-200 border-l-4" 
          style={{ borderLeftColor: loyaltyData?.loyalty_tiers?.color || '#3B82F6' }}>
      <CardContent className="p-4 md:p-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <Avatar className="h-12 w-12 md:h-16 md:w-16 shrink-0">
              <AvatarFallback className="bg-primary/10 text-sm md:text-lg font-bold">
                {customer.name.slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            
            <div className="space-y-2 md:space-y-3 flex-1 min-w-0">
              <div className="flex flex-col md:flex-row md:items-center gap-2 flex-wrap">
                <h3 className="font-bold text-lg md:text-xl leading-tight truncate">
                  {customer.name}
                </h3>
                
                <div className="flex flex-wrap items-center gap-2">
                  {loyaltyData?.loyalty_tiers && (
                    <Badge 
                      variant="secondary" 
                      className="flex items-center gap-1 px-2 py-1 text-xs"
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
                    <Badge variant="outline" className="text-xs">
                      <span className="md:hidden">{genderIcon}</span>
                      <span className="hidden md:inline">{genderIcon} {genderText}</span>
                    </Badge>
                  )}
                </div>
              </div>
              
              {/* Contact Info */}
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-medium truncate">{customer.phone || 'غير متوفر'}</span>
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
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
              className="flex-1 md:flex-none gap-2 text-xs px-3 py-2"
            >
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">تفاصيل</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSendNotification(customer)}
              className="flex-1 md:flex-none gap-2 text-xs px-3 py-2"
            >
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">إشعار</span>
            </Button>
          </div>
        </div>

        {/* Loyalty Stats - Enhanced Mobile View */}
        <div className="bg-muted/30 rounded-lg p-3 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500 shrink-0" />
              <div className="min-w-0">
                <div className="font-bold text-lg">{totalPoints.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">نقطة</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-green-500 shrink-0" />
              <div className="min-w-0">
                <div className="font-bold text-lg">{totalOrders}</div>
                <div className="text-xs text-muted-foreground">طلب مكتمل</div>
              </div>
            </div>
          </div>
          
          {/* Points Calculation Info */}
          <div className="text-xs text-muted-foreground">
            النقاط المحسوبة: {totalOrders} طلب × 200 نقطة = {expectedPoints} نقطة
          </div>
          
          {/* Mismatch Warning */}
          {hasPointsMismatch && (
            <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 p-2 rounded">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="text-xs">خطأ في النقاط - المتوقع: {expectedPoints.toLocaleString()} نقطة</span>
            </div>
          )}

          {/* Total Spending */}
          {loyaltyData?.total_spent > 0 && (
            <div className="text-sm text-muted-foreground pt-1 border-t border-border">
              إجمالي المشتريات: {new Intl.NumberFormat('ar-IQ').format(loyaltyData.total_spent)} د.ع
            </div>
          )}
        </div>

        {/* Product Segments */}
        {customer.customer_product_segments?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {customer.customer_product_segments.slice(0, 3).map((segment, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {segment.departments?.name || segment.categories?.name || 'غير محدد'}
              </Badge>
            ))}
            {customer.customer_product_segments.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{customer.customer_product_segments.length - 3}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CustomerCard;
