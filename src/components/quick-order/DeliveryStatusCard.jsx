import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ServerCrash, Wifi, Map, Truck } from 'lucide-react';

const DeliveryStatusCard = ({ mode, activePartner, isLoggedIn, onManageClick }) => {
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
  const title = isLocal ? "الوضع المحلي مفعل" : (isLoggedIn ? "متصل بشركة التوصيل" : "غير متصل");
  const description = isLocal ? "سيتم إنشاء الطلبات داخل النظام فقط." : (isLoggedIn ? `الطلبات جاهزة للإرسال إلى شركة التوصيل.` : "يجب تسجيل الدخول لشركة التوصيل للمتابعة.");
  const buttonText = isLocal ? "تغيير الوضع" : (isLoggedIn ? "إدارة" : "تسجيل الدخول");

  return (
    <motion.div variants={cardVariants} initial="initial" animate="animate" className={`relative p-5 rounded-xl shadow-lg overflow-hidden ${getCardStyle()}`}>
      <Icon className="absolute -right-4 -bottom-4 w-28 h-28 opacity-10" />
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-lg bg-white/20 flex items-center justify-center">
            <Icon className="w-7 h-7 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-xl">{title}</h3>
            <p className="text-sm opacity-90">{description}</p>
          </div>
        </div>
        {(isChoiceMode || !isLoggedIn) && (
          <Button 
            type="button" 
            size="sm" 
            variant="outline" 
            className="bg-white/10 text-white border-white/30 hover:bg-white/20 hover:text-white backdrop-blur-sm" 
            onClick={onManageClick}
          >
            <Truck className="w-4 h-4 ml-2" />
            {buttonText}
          </Button>
        )}
      </div>
    </motion.div>
  );
};

export default DeliveryStatusCard;