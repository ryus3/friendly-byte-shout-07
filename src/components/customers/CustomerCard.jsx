
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Phone, MapPin, Star, Award, Medal, Crown, Gem, Eye, Send, Gift, Users, AlertTriangle } from 'lucide-react';

const CustomerCard = ({ customer, onViewDetails, onSendNotification }) => {
  const loyaltyData = customer.customer_loyalty; // تغيير من [0] إلى object مباشرة
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
