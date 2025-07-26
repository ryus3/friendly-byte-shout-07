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
  Users
} from 'lucide-react';

const CustomerCard = ({ 
  customer, 
  onViewDetails, 
  onSendNotification, 
  onApplyDiscount,
  tierIcons = {}
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

  const getTierColors = (tierName) => {
    const colorMap = {
      'برونزي': {
        gradient: 'from-orange-500 to-red-600',
        darkGradient: 'dark:from-orange-600 dark:to-red-700',
        icon: 'text-white',
        badge: 'bg-gradient-to-br from-orange-500 to-red-600'
      },
      'فضي': {
        gradient: 'from-slate-400 to-slate-600', 
        darkGradient: 'dark:from-slate-500 dark:to-slate-700',
        icon: 'text-white',
        badge: 'bg-gradient-to-br from-slate-400 to-slate-600'
      },
      'ذهبي': {
        gradient: 'from-yellow-400 to-yellow-600',
        darkGradient: 'dark:from-yellow-500 dark:to-yellow-700',
        icon: 'text-white',
        badge: 'bg-gradient-to-br from-yellow-400 to-yellow-600'
      },
      'بلاتيني': {
        gradient: 'from-blue-500 to-blue-700',
        darkGradient: 'dark:from-blue-600 dark:to-blue-800',
        icon: 'text-white',
        badge: 'bg-gradient-to-br from-blue-500 to-blue-700'
      },
      'ماسي': {
        gradient: 'from-purple-500 to-pink-600',
        darkGradient: 'dark:from-purple-600 dark:to-pink-700',
        icon: 'text-white',
        badge: 'bg-gradient-to-br from-purple-500 to-pink-600'
      }
    };
    return colorMap[tierName] || {
      gradient: 'from-gray-400 to-gray-600',
      darkGradient: 'dark:from-gray-500 dark:to-gray-700',
      icon: 'text-white',
      badge: 'bg-gradient-to-br from-gray-400 to-gray-600'
    };
  };

  const customerTier = customer.customer_loyalty?.loyalty_tiers;
  const tierColors = getTierColors(customerTier?.name);
  const TierIcon = getTierIcon(customerTier?.icon);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      whileHover={{ 
        y: -5,
        transition: { duration: 0.2 }
      }}
    >
      <Card className={`
        relative overflow-hidden group cursor-pointer
        bg-gradient-to-br ${tierColors.gradient} ${tierColors.darkGradient} text-white
        border-0 shadow-lg
        hover:shadow-2xl hover:shadow-primary/20
        transition-all duration-300
        hover:scale-105
      `}>
        {/* تأثيرات الخلفية */}
        <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-white/10 rounded-full"></div>
        <div className="absolute -top-2 -left-2 w-12 h-12 bg-white/10 rounded-full"></div>
        
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <motion.h3 
                className="font-bold text-lg text-white group-hover:text-white/90 transition-colors duration-300"
                whileHover={{ scale: 1.02 }}
              >
                {customer.name}
              </motion.h3>
              
              {customer.phone && (
                <motion.div 
                  className="flex items-center gap-1 text-sm text-white/80 mt-1"
                  whileHover={{ x: 2 }}
                  transition={{ duration: 0.2 }}
                >
                  <Phone className="h-3 w-3" />
                  {customer.phone}
                </motion.div>
              )}
              
              {(customer.city || customer.province) && (
                <motion.div 
                  className="flex items-center gap-1 text-sm text-white/80 mt-1"
                  whileHover={{ x: 2 }}
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
                className={`
                  p-2 rounded-xl ${tierColors.badge} text-white
                  shadow-lg group-hover:shadow-xl
                  relative overflow-hidden bg-white/10 backdrop-blur-sm
                `}
                whileHover={{ 
                  rotate: [0, -5, 5, 0],
                  scale: 1.1,
                  transition: { duration: 0.4 }
                }}
              >
                <TierIcon className="h-5 w-5" />
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0"
                  initial={{ x: '-100%' }}
                  whileHover={{ 
                    x: '100%',
                    transition: { duration: 0.8, ease: "easeInOut" }
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
                  <span className="text-sm font-medium">المستوى:</span>
                  <Badge 
                    className={`
                      ${tierColors.badge} text-white
                      px-3 py-1 font-medium
                      shadow-md hover:shadow-lg
                      transition-all duration-300
                    `}
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
                <span className="text-sm font-medium">النقاط:</span>
                <div className="flex items-center gap-1 font-bold text-primary">
                  <Star className="h-4 w-4 fill-current" />
                  {customer.customer_loyalty.total_points?.toLocaleString('ar') || 0}
                </div>
              </motion.div>
              
              {/* عدد الطلبات */}
              <motion.div 
                className="flex items-center justify-between"
                whileHover={{ scale: 1.02 }}
              >
                <span className="text-sm font-medium">الطلبات:</span>
                <div className="flex items-center gap-1 font-medium text-blue-600">
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
                  <span className="text-sm font-medium">المشتريات:</span>
                  <div className="font-medium text-green-600">
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
                  <span className="text-sm font-medium">خصم المستوى:</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
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
        
        {/* شريط تدرج في الأسفل */}
        <motion.div 
          className={`
            absolute bottom-0 left-0 h-1 bg-gradient-to-r ${tierColors.badge}
            w-0 group-hover:w-full transition-all duration-500
          `}
          whileHover={{ width: "100%" }}
        />
      </Card>
    </motion.div>
  );
};

export default CustomerCard;