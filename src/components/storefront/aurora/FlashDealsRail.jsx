import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Clock } from 'lucide-react';

const useCountdown = (targetMs) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, targetMs - now);
  const h = String(Math.floor(diff / 3600000)).padStart(2, '0');
  const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
  const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
  return `${h}:${m}:${s}`;
};

const FlashDealsRail = ({ slug, products = [] }) => {
  // End in ~6 hours from first load (per session)
  const [endsAt] = useState(() => Date.now() + 6 * 3600000);
  const remaining = useCountdown(endsAt);
  if (!products.length) return null;

  return (
    <section className="px-3 sm:px-6 mt-8">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5" style={{ color: 'rgb(var(--aurora-fuchsia))' }} />
          <h2 className="text-lg sm:text-xl font-black aurora-gradient-text">صفقات سريعة</h2>
        </div>
        <div className="flex items-center gap-2 glass px-3 py-1.5 text-xs font-bold" style={{ borderRadius: 999 }}>
          <Clock className="w-3.5 h-3.5" style={{ color: 'rgb(var(--aurora-cyan))' }} />
          <span style={{ color: 'var(--aurora-text)' }}>{remaining}</span>
        </div>
      </div>
      <div className="aurora-rail">
        {products.slice(0, 8).map((p) => {
          const v = p.variants?.find(x => {
            const q = x.inventory?.quantity ?? 0;
            const r = x.inventory?.reserved_quantity ?? 0;
            return (q - r) > 0;
          });
          if (!v) return null;
          const img = v.images?.[0] || p.image;
          const price = v.price;
          const old = Math.round(price * 1.4);
          const pct = Math.round(((old - price) / old) * 100);
          return (
            <Link
              key={p.id}
              to={`/storefront/${slug}/product/${p.id}`}
              className="glass overflow-hidden w-[180px] sm:w-[200px] block group"
              style={{ borderRadius: 'var(--aurora-radius)' }}
            >
              <div className="relative aspect-square overflow-hidden">
                {img && (
                  <img src={img} alt={p.name} loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                )}
                <span className="absolute top-2 inset-inline-start-2 text-[10px] font-extrabold px-2 py-1 rounded-full text-white aurora-pulse"
                  style={{ background: 'linear-gradient(135deg, rgb(var(--aurora-fuchsia)), rgb(var(--aurora-violet)))', insetInlineStart: 8 }}>
                  -{pct}%
                </span>
              </div>
              <div className="p-3 space-y-1">
                <h3 className="text-xs font-bold line-clamp-1" style={{ color: 'var(--aurora-text)' }}>{p.name}</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-black aurora-gradient-text">{price.toLocaleString('ar-IQ')}</span>
                  <span className="text-[10px] line-through" style={{ color: 'var(--aurora-text-dim)' }}>
                    {old.toLocaleString('ar-IQ')}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

export default FlashDealsRail;
