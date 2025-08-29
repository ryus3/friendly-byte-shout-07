import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ServerCrash, Wifi, Map, Truck, ShieldCheck } from 'lucide-react';

const DeliveryStatusCard = ({ mode, activePartner, isLoggedIn, onManageClick, waseetUser }) => {
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
  const title = isLocal ? "الوضع المحلي مفعل" : (isLoggedIn ? "متصل بشركة الوسيط" : "غير متصل");
  const description = isLocal ? "سيتم إنشاء الطلبات داخل النظام فقط." : (isLoggedIn ? `الطلبات جاهزة للإرسال إلى شركة التوصيل ${waseetUser?.username ? `( ${waseetUser.username.toUpperCase()} )` : ''}` : "يجب تسجيل الدخول لشركة التوصيل للمتابعة.");
  const buttonText = "تغيير الوضع";

  return (
    <motion.div dir="rtl" variants={cardVariants} initial="initial" animate="animate" className={`relative p-5 rounded-xl shadow-lg overflow-hidden ${getCardStyle()}`}>
      <Icon className="absolute -left-4 -bottom-4 w-28 h-28 opacity-10" />
      <div className="relative z-10 flex flex-col sm:flex-row-reverse sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4 flex-row-reverse">
          <div className="flex-1 text-right">
            <div className="flex items-center gap-3 mb-1 justify-end">
              <h3 className="font-bold text-xl">{title}</h3>
            </div>
            <div className="text-sm opacity-90 text-right">
              {isLocal ? (
                <p>{description}</p>
              ) : (
                isLoggedIn ? (
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <div className="flex items-center gap-2 flex-row-reverse">
                      <span>الطلبات جاهزة للإرسال إلى شركة التوصيل</span>
                      <ShieldCheck className="w-5 h-5 text-emerald-300" />
                    </div>
                    {waseetUser?.username && (
                      <div className="relative inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-slate-900/90 via-blue-900/90 to-slate-900/90 backdrop-blur-sm border border-blue-400/30 shadow-2xl shadow-blue-500/25">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="bg-gradient-to-r from-sky-300 via-blue-200 to-cyan-300 bg-clip-text text-transparent font-bold text-sm tracking-wide">
                          {waseetUser.username.toUpperCase()}
                        </span>
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      </div>
                    )}
                  </div>
                ) : (
                  <p>{description}</p>
                )
              )}
            </div>
          </div>
          <div className="w-14 h-14 rounded-lg bg-white/20 flex items-center justify-center">
            <Icon className="w-7 h-7 text-white" />
          </div>
        </div>
        <Button 
          type="button" 
          size="sm" 
          variant="outline" 
          className="bg-white/10 text-white border-white/30 hover:bg-white/20 hover:text-white backdrop-blur-sm" 
          onClick={onManageClick}
        >
          {buttonText}
          <Truck className="w-4 h-4 mr-2" />
        </Button>
      </div>
    </motion.div>
  );
};

export default DeliveryStatusCard;