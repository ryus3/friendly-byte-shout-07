import React from 'react';
import { Truck, Shield, RotateCcw, Lock } from 'lucide-react';

const items = [
  { icon: Truck, title: 'شحن سريع', text: 'توصيل لجميع المحافظات' },
  { icon: Shield, title: 'ضمان أصلي', text: 'منتجات معتمدة 100٪' },
  { icon: RotateCcw, title: 'إرجاع سهل', text: 'خلال 7 أيام' },
  { icon: Lock, title: 'دفع آمن', text: 'الدفع عند الاستلام' },
];

const TrustStrip = () => (
  <section className="px-3 sm:px-6 mt-10">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map(({ icon: Icon, title, text }) => (
        <div key={title} className="glass p-4 flex items-center gap-3" style={{ borderRadius: 18 }}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, rgb(var(--aurora-violet) / 0.25), rgb(var(--aurora-cyan) / 0.25))' }}>
            <Icon className="w-5 h-5" style={{ color: 'rgb(var(--aurora-cyan))' }} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-black" style={{ color: 'var(--aurora-text)' }}>{title}</div>
            <div className="text-[11px]" style={{ color: 'var(--aurora-text-dim)' }}>{text}</div>
          </div>
        </div>
      ))}
    </div>
  </section>
);

export default TrustStrip;
