import React from 'react';
import { Inbox, MessageSquare, Bot, AlertTriangle, Clock } from 'lucide-react';

const StatBox = ({ icon: Icon, title, subtitle, value, gradient, textColor = "text-white", iconBg = "bg-white/20" }) => (
  <article className={`group relative overflow-hidden rounded-xl p-3 md:p-4 ${gradient} shadow-lg hover:shadow-xl transition-all duration-500 hover:scale-[1.02] border border-white/10`}>
    <div className="relative flex items-start justify-between gap-2">
      <div className="flex-1 min-w-0">
        <h4 className={`text-xs md:text-sm font-bold tracking-tight ${textColor} drop-shadow-sm`}>{title}</h4>
        <p className={`text-[10px] md:text-xs ${textColor}/80 mt-0.5 drop-shadow-sm`}>{subtitle}</p>
      </div>
      <div className={`shrink-0 rounded-lg ${iconBg} backdrop-blur-sm p-1.5 md:p-2 ring-1 ring-white/20 shadow-lg`}>
        <Icon className={`w-3 h-3 md:w-4 md:h-4 ${textColor} drop-shadow-sm`} />
      </div>
    </div>
    <div className="relative mt-2 md:mt-3">
      <div className={`text-xl md:text-2xl font-extrabold leading-none ${textColor} drop-shadow-md`}>{value}</div>
      <div className={`text-[10px] md:text-xs mt-0.5 ${textColor}/70 font-medium drop-shadow-sm`}>طلب</div>
    </div>
    <div className="absolute -bottom-4 -right-4 w-16 h-16 rounded-full bg-white/10 blur-xl" />
    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
  </article>
);

const AiOrdersHeaderStats = ({ totalCount, telegramCount, aiCount, needReviewCount }) => {
  return (
    <section aria-label="ملخص الطلبات الذكية" className="w-full">
      <div className="grid grid-cols-5 gap-3 md:gap-4">
        <StatBox
          icon={Inbox}
          title="إجمالي الطلبات"
          subtitle="طلبات واردة"
          value={totalCount}
          gradient="bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700"
          textColor="text-white"
          iconBg="bg-white/25"
        />
        <StatBox
          icon={Clock}
          title="في الانتظار"
          subtitle="قيد المراجعة"
          value={telegramCount}
          gradient="bg-gradient-to-br from-orange-500 via-orange-600 to-red-500"
          textColor="text-white"
          iconBg="bg-white/25"
        />
        <StatBox
          icon={AlertTriangle}
          title="تحتاج مراجعة"
          subtitle="مراجعة عاجلة"
          value={needReviewCount}
          gradient="bg-gradient-to-br from-red-500 via-red-600 to-red-700"
          textColor="text-white"
          iconBg="bg-white/25"
        />
        <StatBox
          icon={MessageSquare}
          title="من التليغرام"
          subtitle="تيليغرام بوت"
          value={telegramCount}
          gradient="bg-gradient-to-br from-cyan-500 via-blue-500 to-blue-600"
          textColor="text-white"
          iconBg="bg-white/25"
        />
        <StatBox
          icon={Bot}
          title="الذكاء الاصطناعي"
          subtitle="مساعد ذكي"
          value={aiCount}
          gradient="bg-gradient-to-br from-purple-500 via-pink-500 to-pink-600"
          textColor="text-white"
          iconBg="bg-white/25"
        />
      </div>
    </section>
  );
};

export default AiOrdersHeaderStats;
