import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Phone, 
  MapPin, 
  Star, 
  Award, 
  Medal, 
  Crown, 
  Gem, 
  Send, 
  MessageCircle, 
  Eye,
  Gift,
  Sparkles,
  Users,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const CustomerCard = ({ 
  customer, 
  onViewDetails, 
  onSendNotification, 
  onApplyDiscount,
  tierIcons = {},
  index = 0
}) => {
  const [customMessage, setCustomMessage] = useState('');

  const getTierIcon = (iconName) => {
    const iconMap = {
      'Award': Award,
      'Medal': Medal,
      'Crown': Crown,
      'Gem': Gem,
      'Star': Star,
      ...tierIcons
    };
    return iconMap[iconName] || Star;
  };

  // تدرجات لونية راقية جداً مع تنويع حسب الفهرس
  const getCardGradient = (index, hasPoints) => {
    const gradientSets = [
      // مجموعة 1: الغروب الساحر
      {
        gradient: 'from-rose-500 via-orange-400 to-amber-400',
        darkGradient: 'dark:from-rose-600 dark:via-orange-500 dark:to-amber-500',
        textColor: 'text-white',
        shadow: 'shadow-rose-500/25',
        hoverShadow: 'hover:shadow-rose-500/40',
        glow: 'hover:shadow-2xl hover:shadow-rose-500/30'
      },
      // مجموعة 2: المحيط العميق
      {
        gradient: 'from-blue-600 via-cyan-500 to-teal-400',
        darkGradient: 'dark:from-blue-700 dark:via-cyan-600 dark:to-teal-500',
        textColor: 'text-white',
        shadow: 'shadow-blue-500/25',
        hoverShadow: 'hover:shadow-blue-500/40',
        glow: 'hover:shadow-2xl hover:shadow-blue-500/30'
      },
      // مجموعة 3: الطبيعة الخضراء
      {
        gradient: 'from-emerald-600 via-green-500 to-lime-400',
        darkGradient: 'dark:from-emerald-700 dark:via-green-600 dark:to-lime-500',
        textColor: 'text-white',
        shadow: 'shadow-emerald-500/25',
        hoverShadow: 'hover:shadow-emerald-500/40',
        glow: 'hover:shadow-2xl hover:shadow-emerald-500/30'
      },
      // مجموعة 4: البنفسجي الملكي
      {
        gradient: 'from-purple-600 via-violet-500 to-indigo-500',
        darkGradient: 'dark:from-purple-700 dark:via-violet-600 dark:to-indigo-600',
        textColor: 'text-white',
        shadow: 'shadow-purple-500/25',
        hoverShadow: 'hover:shadow-purple-500/40',
        glow: 'hover:shadow-2xl hover:shadow-purple-500/30'
      },
      // مجموعة 5: الوردي الساحر
      {
        gradient: 'from-pink-600 via-rose-500 to-fuchsia-500',
        darkGradient: 'dark:from-pink-700 dark:via-rose-600 dark:to-fuchsia-600',
        textColor: 'text-white',
        shadow: 'shadow-pink-500/25',
        hoverShadow: 'hover:shadow-pink-500/40',
        glow: 'hover:shadow-2xl hover:shadow-pink-500/30'
      },
      // مجموعة 6: الذهبي الفاخر
      {
        gradient: 'from-amber-600 via-yellow-500 to-orange-500',
        darkGradient: 'dark:from-amber-700 dark:via-yellow-600 dark:to-orange-600',
        textColor: 'text-white',
        shadow: 'shadow-amber-500/25',
        hoverShadow: 'hover:shadow-amber-500/40',
        glow: 'hover:shadow-2xl hover:shadow-amber-500/30'
      }
    ];

    const selectedGradient = gradientSets[index % gradientSets.length];
    
    return {
      ...selectedGradient,
      // العملاء ذوو النقاط يكون لهم اتجاه مختلف
      direction: hasPoints ? 'flex-row-reverse' : 'flex-row',
      specialRing: hasPoints ? 'ring-2 ring-white/30 ring-offset-2 ring-offset-transparent' : ''
    };
  };

  const customerTier = customer.customer_loyalty?.loyalty_tiers;
  const TierIcon = getTierIcon(customerTier?.icon);
  const hasPoints = customer.customer_loyalty?.total_points > 0;
  const cardStyle = getCardGradient(index, hasPoints);

  // حساب تاريخ انتهاء صلاحية النقاط (3 أشهر من آخر تحديث)
  const pointsExpiryDate = customer.customer_loyalty?.points_expiry_date 
    ? new Date(customer.customer_loyalty.points_expiry_date)
    : null;
  
  const isPointsExpiringSoon = pointsExpiryDate && pointsExpiryDate <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // خلال 30 يوم

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={{ 
        y: -8,
        transition: { duration: 0.3, ease: "easeOut" }
      }}
    >
      <Card className={`
        relative overflow-hidden group cursor-pointer
        bg-gradient-to-br ${cardStyle.gradient} ${cardStyle.darkGradient}
        border-0 shadow-xl ${cardStyle.shadow} ${cardStyle.specialRing}
        ${cardStyle.glow}
        transition-all duration-500
        hover:scale-[1.03] hover:-translate-y-2
        backdrop-blur-sm
      `}>
        {/* تأثيرات الخلفية الجديدة */}
        <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
        <div className="absolute -top-6 -left-6 w-24 h-24 bg-white/5 rounded-full blur-xl"></div>
        <div className="absolute top-1/2 left-1/2 w-40 h-40 bg-white/3 rounded-full blur-3xl transform -translate-x-1/2 -translate-y-1/2"></div>
        
        {/* حدود متوهجة للعملاء ذوي النقاط */}
        {hasPoints && (
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-60 pointer-events-none"></div>
        )}
        
        <CardHeader className="pb-3">
          <div className={`flex items-start justify-between ${cardStyle.direction}`}>
            <div className="flex-1">
              <motion.h3 
                className={`font-bold text-lg ${cardStyle.textColor} drop-shadow-sm group-hover:opacity-90 transition-colors duration-300`}
                whileHover={{ scale: 1.02 }}
              >
                {customer.name}
              </motion.h3>
              
              {customer.phone && (
                <motion.div 
                  className={`flex items-center gap-1 text-sm ${cardStyle.textColor} opacity-90 mt-1 drop-shadow-sm`}
                  whileHover={{ x: hasPoints ? -2 : 2 }}
                  transition={{ duration: 0.2 }}
                >
                  <Phone className="h-3 w-3" />
                  {customer.phone}
                </motion.div>
              )}
              
              {(customer.city || customer.province) && (
                <motion.div 
                  className={`flex items-center gap-1 text-sm ${cardStyle.textColor} opacity-90 mt-1 drop-shadow-sm`}
                  whileHover={{ x: hasPoints ? -2 : 2 }}
                  transition={{ duration: 0.2 }}
                >
                  <MapPin className="h-3 w-3" />
                  {[customer.city, customer.province].filter(Boolean).join(', ')}
                </motion.div>
              )}
            </div>
            
            {/* أيقونة المستوى */}
            {customerTier && (
              <motion.div 
                className="p-3 rounded-xl bg-white/20 text-white shadow-xl border border-white/30 backdrop-blur-sm"
                whileHover={{ 
                  rotate: [0, -10, 10, 0],
                  scale: 1.15,
                  transition: { duration: 0.6, ease: "easeInOut" }
                }}
              >
                <TierIcon className="h-6 w-6 drop-shadow-lg" />
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/40 to-white/0 rounded-xl"
                  initial={{ x: '-100%' }}
                  whileHover={{ 
                    x: '100%',
                    transition: { duration: 1, ease: "easeInOut" }
                  }}
                />
              </motion.div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* معلومات النقاط والمستوى */}
          {customer.customer_loyalty && (
            <div className="space-y-3">
              {/* مستوى العضوية */}
              {customerTier && (
                <motion.div 
                  className="flex items-center justify-between"
                  whileHover={{ scale: 1.02 }}
                >
                  <span className="text-sm font-medium drop-shadow-sm">المستوى:</span>
                  <Badge 
                    className="bg-white/20 text-white px-3 py-1 font-medium shadow-lg border border-white/30 backdrop-blur-sm"
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    {customerTier.name}
                  </Badge>
                </motion.div>
              )}
              
              {/* النقاط الحالية */}
              <motion.div 
                className="flex items-center justify-between"
                whileHover={{ scale: 1.02 }}
              >
                <span className="text-sm font-medium drop-shadow-sm">النقاط:</span>
                <div className="flex items-center gap-1 font-bold text-yellow-300 drop-shadow-lg">
                  <Star className="h-4 w-4 fill-current" />
                  {customer.customer_loyalty.total_points?.toLocaleString('ar') || 0}
                </div>
              </motion.div>

              {/* عرض تاريخ انتهاء صلاحية النقاط */}
              {pointsExpiryDate && hasPoints && (
                <motion.div 
                  className="flex items-center justify-between"
                  whileHover={{ scale: 1.02 }}
                >
                  <span className="text-sm font-medium drop-shadow-sm">صلاحية النقاط:</span>
                  <Badge 
                    className={`
                      ${isPointsExpiringSoon 
                        ? 'bg-red-500/30 text-red-100 border-red-300/50' 
                        : 'bg-white/20 text-white border-white/30'
                      } shadow-lg backdrop-blur-sm px-2 py-1
                    `}
                  >
                    <Clock className="h-3 w-3 mr-1" />
                    {format(pointsExpiryDate, 'dd/MM/yyyy', { locale: ar })}
                  </Badge>
                </motion.div>
              )}
              
              {/* عدد الطلبات */}
              <motion.div 
                className="flex items-center justify-between"
                whileHover={{ scale: 1.02 }}
              >
                <span className="text-sm font-medium drop-shadow-sm">الطلبات:</span>
                <div className="flex items-center gap-1 font-medium text-blue-200 drop-shadow-sm">
                  <Users className="h-4 w-4" />
                  {customer.customer_loyalty.total_orders || 0}
                </div>
              </motion.div>
              
              {/* إجمالي المشتريات */}
              {customer.customer_loyalty.total_spent > 0 && (
                <motion.div 
                  className="flex items-center justify-between"
                  whileHover={{ scale: 1.02 }}
                >
                  <span className="text-sm font-medium drop-shadow-sm">المشتريات:</span>
                  <div className="font-medium text-emerald-200 drop-shadow-sm">
                    {customer.customer_loyalty.total_spent?.toLocaleString('ar')} د.ع
                  </div>
                </motion.div>
              )}
              
              {/* خصم المستوى */}
              {customerTier?.discount_percentage > 0 && (
                <motion.div 
                  className="flex items-center justify-between"
                  whileHover={{ scale: 1.02 }}
                >
                  <span className="text-sm font-medium drop-shadow-sm">خصم المستوى:</span>
                  <Badge className="bg-green-400/30 text-green-100 border-green-300/50 shadow-lg backdrop-blur-sm">
                    <Gift className="h-3 w-3 mr-1" />
                    {customerTier.discount_percentage}%
                  </Badge>
                </motion.div>
              )}
            </div>
          )}
          
          {/* أزرار الإجراءات */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewDetails(customer.id)}
              className="flex-1 group/btn bg-white/10 border-white/30 text-white hover:bg-white/20 hover:border-white/50 transition-all duration-300 backdrop-blur-sm"
            >
              <Eye className="h-4 w-4 mr-1 group-hover/btn:scale-110 transition-transform duration-200" />
              التفاصيل
            </Button>
            
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="group/btn bg-white/10 border-white/30 text-white hover:bg-blue-500/20 hover:border-blue-300/50 transition-all duration-300 backdrop-blur-sm"
                >
                  <MessageCircle className="h-4 w-4 group-hover/btn:scale-110 transition-transform duration-200" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>إرسال إشعار مخصص - {customer.name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    placeholder="اكتب رسالتك هنا..."
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    className="min-h-[100px]"
                    dir="rtl"
                  />
                  <Button
                    onClick={() => {
                      onSendNotification(customer.id, customMessage);
                      setCustomMessage('');
                    }}
                    className="w-full"
                    disabled={!customMessage.trim()}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    إرسال الإشعار
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => onApplyDiscount(customer.id)}
              className="group/btn bg-white/10 border-white/30 text-white hover:bg-green-500/20 hover:border-green-300/50 transition-all duration-300 backdrop-blur-sm"
            >
              <Gift className="h-4 w-4 group-hover/btn:scale-110 transition-transform duration-200" />
            </Button>
          </div>
        </CardContent>
        
        {/* تأثير الضوء المحسن */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-black/5 opacity-0 group-hover:opacity-100 transition-all duration-500 rounded-xl" />
        
        {/* شريط تدرج في الأسفل */}
        <motion.div 
          className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-white/60 to-white/80 w-0 group-hover:w-full transition-all duration-700"
          whileHover={{ width: "100%" }}
        />
      </Card>
    </motion.div>
  );
};

export default CustomerCard;