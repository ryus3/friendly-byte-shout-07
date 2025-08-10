import React from 'react';
import { Inbox, MessageSquare, Bot, AlertTriangle } from 'lucide-react';

const StatBox = ({ icon: Icon, title, subtitle, value, gradient, ring }) => (
  <article className={`group relative overflow-hidden rounded-2xl p-4 md:p-5 ${ring} ring-1 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.01]`}>
    <div className={`absolute inset-0 ${gradient} opacity-90`} />
    <div className="relative flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <h4 className="text-sm md:text-[15px] font-bold tracking-tight">{title}</h4>
        <p className="text-[12px] md:text-xs text-muted-foreground/90 mt-0.5">{subtitle}</p>
      </div>
      <div className="shrink-0 rounded-xl bg-background/30 backdrop-blur p-2 ring-1 ring-white/10">
        <Icon className="w-5 h-5 text-foreground/90" />
      </div>
    </div>
    <div className="relative mt-4">
      <div className="text-3xl md:text-4xl font-extrabold leading-none">{value}</div>
      <div className="text-xs md:text-sm mt-1 text-muted-foreground">طلب</div>
    </div>
    <div className="absolute -bottom-8 -left-8 w-28 h-28 rounded-full bg-white/10 blur-2xl" />
  </article>
);

const AiOrdersHeaderStats = ({ totalCount, telegramCount, aiCount, needReviewCount }) => {
  return (
    <section aria-label="ملخص الطلبات الذكية" className="w-full">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatBox
          icon={Inbox}
          title="إجمالي الطلبات"
          subtitle="طلبات واردة"
          value={totalCount}
          gradient="bg-gradient-to-br from-primary/30 via-primary/20 to-primary/10"
          ring="ring-primary/20"
        />
        <StatBox
          icon={MessageSquare}
          title="من التليغرام"
          subtitle="تيليغرام بوت"
          value={telegramCount}
          gradient="bg-gradient-to-br from-accent/30 via-accent/20 to-accent/10"
          ring="ring-accent/20"
        />
        <StatBox
          icon={Bot}
          title="الذكاء الاصطناعي"
          subtitle="مساعد ذكي"
          value={aiCount}
          gradient="bg-gradient-to-br from-secondary/30 via-secondary/20 to-secondary/10"
          ring="ring-secondary/20"
        />
        <StatBox
          icon={AlertTriangle}
          title="تحتاج مراجعة"
          subtitle="مراجعة عاجلة"
          value={needReviewCount}
          gradient="bg-gradient-to-br from-destructive/30 via-destructive/20 to-destructive/10"
          ring="ring-destructive/30"
        />
      </div>
    </section>
  );
};

export default AiOrdersHeaderStats;
