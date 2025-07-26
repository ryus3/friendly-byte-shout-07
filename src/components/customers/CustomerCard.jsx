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

  // ألوان المستويات الحقيقية
  const getTierColors = (tierName) => {
    const tierColors = {
      'برونزي': {
        color: 'from-amber-600 to-orange-600',
        textColor: 'text-amber-600 dark:text-amber-400',
        bgColor: 'bg-amber-50 dark:bg-amber-900/20',
        borderColor: 'border-amber-200 dark:border-amber-800/50'
      },
      'فضي': {
        color: 'from-slate-500 to-gray-600',
        textColor: 'text-slate-600 dark:text-slate-400',
        bgColor: 'bg-slate-50 dark:bg-slate-900/20',
        borderColor: 'border-slate-200 dark:border-slate-800/50'
      },
      'ذهبي': {
        color: 'from-yellow-500 to-amber-600',
        textColor: 'text-yellow-600 dark:text-yellow-400',
        bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
        borderColor: 'border-yellow-200 dark:border-yellow-800/50'
      },
      'بلاتيني': {
        color: 'from-blue-600 to-indigo-600',
        textColor: 'text-blue-600 dark:text-blue-400',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        borderColor: 'border-blue-200 dark:border-blue-800/50'
      },
      'ماسي': {
        color: 'from-purple-600 to-pink-600',
        textColor: 'text-purple-600 dark:text-purple-400',
        bgColor: 'bg-purple-50 dark:bg-purple-900/20',
        borderColor: 'border-purple-200 dark:border-purple-800/50'
      }
    };
    
    return tierColors[tierName] || {
      color: 'from-gray-500 to-gray-600',
      textColor: 'text-gray-600 dark:text-gray-400',
      bgColor: 'bg-gray-50 dark:bg-gray-900/20',
      borderColor: 'border-gray-200 dark:border-gray-800/50'
    };
  };

  const customerTier = customer.customer_loyalty?.loyalty_tiers;
  const TierIcon = getTierIcon(customerTier?.icon);
  const hasPoints = customer.customer_loyalty?.total_points > 0;
  const tierColors = getTierColors(customerTier?.name);

  // حساب تاريخ انتهاء صلاحية النقاط
  const pointsExpiryDate = customer.customer_loyalty?.points_expiry_date 
    ? new Date(customer.customer_loyalty.points_expiry_date)
    : null;
  
  const isPointsExpiringSoon = pointsExpiryDate && pointsExpiryDate <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      whileHover={{ 
        y: -4,
        transition: { duration: 0.2, ease: "easeOut" }
      }}
      className={hasPoints ? 'order-first' : ''}
    >
      <Card className="
        relative overflow-hidden group cursor-pointer
        bg-card/80 dark:bg-card/60 backdrop-blur-sm
        border border-border/50 dark:border-border/30
        shadow-lg hover:shadow-xl
        transition-all duration-300
        hover:scale-[1.02] hover:-translate-y-1
      ">
        {/* تأثير الضوء الخفيف */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* حد ملون للمستوى */}
        {customerTier && (
          <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${tierColors.color}`} />
        )}
        
        <CardHeader className="pb-3">
          <div className={`flex items-start justify-between ${hasPoints ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className="flex-1">
              <motion.h3 
                className="font-bold text-lg text-foreground group-hover:text-primary transition-colors duration-300"
                whileHover={{ scale: 1.02 }}
              >
                {customer.name}
              </motion.h3>
              
              {customer.phone && (
                <motion.div 
                  className="flex items-center gap-1 text-sm text-muted-foreground mt-1"
                  whileHover={{ x: hasPoints ? -2 : 2 }}
                  transition={{ duration: 0.2 }}
                >
                  <Phone className="h-3 w-3 text-blue-500" />
                  {customer.phone}
                </motion.div>
              )}
              
              {(customer.city || customer.province) && (
                <motion.div 
                  className="flex items-center gap-1 text-sm text-muted-foreground mt-1"
                  whileHover={{ x: hasPoints ? -2 : 2 }}
                  transition={{ duration: 0.2 }}
                >
                  <MapPin className="h-3 w-3 text-green-500" />
                  {[customer.city, customer.province].filter(Boolean).join(', ')}
                </motion.div>
              )}
            </div>
            
            {/* أيقونة المستوى الملونة */}
            {customerTier && (
              <motion.div 
                className={`
                  p-3 rounded-xl ${tierColors.bgColor} ${tierColors.borderColor} border-2
                  shadow-lg group-hover:shadow-xl
                  relative overflow-hidden
                `}
                whileHover={{ 
                  rotate: [0, -10, 10, 0],
                  scale: 1.1,
                  transition: { duration: 0.6, ease: "easeInOut" }
                }}
              >
                <div className={`bg-gradient-to-br ${tierColors.color} bg-clip-text text-transparent`}>
                  <TierIcon className="h-6 w-6" style={{ color: 'inherit' }} />
                </div>
                <motion.div
                  className={`absolute inset-0 bg-gradient-to-r ${tierColors.color} opacity-10 rounded-xl`}
                  initial={{ scale: 0 }}
                  whileHover={{ 
                    scale: 1,
                    transition: { duration: 0.4, ease: "easeOut" }
                  }}
                />
              </motion.div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {customer.customer_loyalty && (
            <div className="space-y-3">
              {/* مستوى العضوية */}
              {customerTier && (
                <motion.div 
                  className="flex items-center justify-between"
                  whileHover={{ scale: 1.02 }}
                >
                  <span className="text-sm font-medium text-muted-foreground">المستوى:</span>
                  <Badge 
                    className={`${tierColors.bgColor} ${tierColors.textColor} ${tierColors.borderColor} border font-medium shadow-sm`}
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
                <span className="text-sm font-medium text-muted-foreground">النقاط:</span>
                <div className="flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
                  <Star className="h-4 w-4 fill-current" />
                  {customer.customer_loyalty.total_points?.toLocaleString('ar') || 0}
                </div>
              </motion.div>

              {/* صلاحية النقاط */}
              {pointsExpiryDate && hasPoints && (
                <motion.div 
                  className="flex items-center justify-between"
                  whileHover={{ scale: 1.02 }}
                >
                  <span className="text-sm font-medium text-muted-foreground">صلاحية النقاط:</span>
                  <Badge 
                    className={`
                      ${isPointsExpiringSoon 
                        ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50' 
                        : 'bg-green-50 text-green-600 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/50'
                      } border font-medium shadow-sm
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
                <span className="text-sm font-medium text-muted-foreground">الطلبات:</span>
                <div className="flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400">
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
                  <span className="text-sm font-medium text-muted-foreground">المشتريات:</span>
                  <div className="font-medium text-emerald-600 dark:text-emerald-400">
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
                  <span className="text-sm font-medium text-muted-foreground">خصم المستوى:</span>
                  <Badge className="bg-green-50 text-green-600 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/50 border font-medium shadow-sm">
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
              className="flex-1 group/btn hover:bg-primary hover:text-primary-foreground transition-all duration-300"
            >
              <Eye className="h-4 w-4 mr-1 group-hover/btn:scale-110 transition-transform duration-200" />
              التفاصيل
            </Button>
            
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="group/btn hover:bg-blue-500 hover:text-white transition-all duration-300"
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
              className="group/btn hover:bg-green-500 hover:text-white transition-all duration-300"
            >
              <Gift className="h-4 w-4 group-hover/btn:scale-110 transition-transform duration-200" />
            </Button>
          </div>
        </CardContent>
        
        {/* شريط تدرج خفيف في الأسفل */}
        <motion.div 
          className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-primary/50 to-primary w-0 group-hover:w-full transition-all duration-500"
          whileHover={{ width: "100%" }}
        />
      </Card>
    </motion.div>
  );
};

export default CustomerCard;