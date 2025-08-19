import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ServerCrash, Wifi, Map, Truck, Settings, ChevronDown } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const DeliveryStatusCard = ({ mode, activePartner, isLoggedIn, onManageClick, waseetUser, onSwitchPartner, availablePartners = {} }) => {
  const isLocal = activePartner === 'local';
  const isChoiceMode = mode === 'choice';

  const cardVariants = {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  const getCardStyle = () => {
    if (isLocal) {
      return "bg-gradient-to-br from-blue-500 to-cyan-600 border-cyan-400/50 text-white";
    }
    if (isLoggedIn) {
      return "bg-gradient-to-br from-green-500 to-emerald-600 border-emerald-400/50 text-white";
    }
    return "bg-gradient-to-br from-red-500 to-rose-600 border-rose-400/50 text-white";
  };

  const Icon = isLocal ? Map : (isLoggedIn ? Wifi : ServerCrash);
  
  const getDeliveryCompanyName = () => {
    if (activePartner === 'alwaseet') return 'الوسيط';
    return 'شركة التوصيل';
  };
  
  const title = isLocal ? "الوضع المحلي مفعل" : (isLoggedIn ? `متصل بشركة ${getDeliveryCompanyName()}` : "غير متصل");
  const description = isLocal 
    ? "سيتم إنشاء الطلبات داخل النظام فقط." 
    : isLoggedIn 
      ? `الطلبات جاهزة للإرسال إلى شركة ${getDeliveryCompanyName()}.`
      : "يجب تسجيل الدخول لشركة التوصيل للمتابعة.";
  const buttonText = isLocal ? "تغيير الوضع" : (isLoggedIn ? "إدارة" : "تسجيل الدخول");

  const hasMultiplePartners = Object.keys(availablePartners).length > 1;

  return (
    <motion.div variants={cardVariants} initial="initial" animate="animate" className={`relative p-5 rounded-xl shadow-lg overflow-hidden ${getCardStyle()}`}>
      <Icon className="absolute -right-4 -bottom-4 w-28 h-28 opacity-10" />
      <div className="relative z-10 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-lg bg-white/20 flex items-center justify-center">
            <Icon className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-xl">{title}</h3>
              {isLoggedIn && waseetUser?.username && (
                <Badge variant="secondary" className="bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-400 text-sm font-bold shadow-md px-3 py-1">
                  {waseetUser.username}
                </Badge>
              )}
            </div>
            <p className="text-sm opacity-90">{description}</p>
          </div>
          <Button 
            type="button" 
            size="sm" 
            variant="ghost" 
            className="bg-white/10 text-white border border-white/20 hover:bg-white/20 hover:text-white backdrop-blur-sm h-8 w-8 p-0" 
            onClick={onManageClick}
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>

        {/* Partner Selection - Only when multiple partners available and logged in */}
        {hasMultiplePartners && isLoggedIn && (
          <div className="flex-1">
            <Select value={activePartner} onValueChange={onSwitchPartner}>
              <SelectTrigger className="bg-white/10 border-white/30 text-white hover:bg-white/20">
                <SelectValue />
                <ChevronDown className="w-4 h-4 opacity-70" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(availablePartners).map(([key, partner]) => (
                  <SelectItem key={key} value={key}>
                    {partner.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default DeliveryStatusCard;