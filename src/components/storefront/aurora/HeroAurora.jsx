import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Flame } from 'lucide-react';

const HeroAurora = ({ slug, banners = [], products = [] }) => {
  const [index, setIndex] = useState(0);
  const spotRef = useRef(null);

  // Build slides: real banners first, then a generated one from top product
  const slides = (banners && banners.length > 0)
    ? banners.slice(0, 5).map((b, i) => ({
        id: b.id || `b-${i}`,
        title: b.title || 'عروض حصرية',
        subtitle: b.subtitle || 'اكتشف الجديد الآن',
        image: b.image_url || b.image || products[i]?.variants?.[0]?.images?.[0],
        cta: b.cta_text || 'تسوّق الآن',
        link: b.link_url || `/storefront/${slug}/products`,
        badge: b.badge || (i === 0 ? 'حصري' : null),
      }))
    : (products.slice(0, 3).map((p, i) => ({
        id: p.id,
        title: i === 0 ? 'مجموعة الموسم' : p.name,
        subtitle: i === 0 ? 'خصومات تصل إلى 60٪ على الأفضل مبيعاً' : 'وصل حديثاً',
        image: p.variants?.[0]?.images?.[0],
        cta: 'تسوّق الآن',
        link: `/storefront/${slug}/product/${p.id}`,
        badge: i === 0 ? 'خصم 60%' : 'جديد',
      })));

  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), 5500);
    return () => clearInterval(t);
  }, [slides.length]);

  const onMove = useCallback((e) => {
    const el = spotRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX ?? e.touches?.[0]?.clientX ?? 0) - rect.left) / rect.width * 100;
    const y = ((e.clientY ?? e.touches?.[0]?.clientY ?? 0) - rect.top) / rect.height * 100;
    el.style.setProperty('--mx', `${x}%`);
    el.style.setProperty('--my', `${y}%`);
  }, []);

  if (!slides.length) return null;
  const s = slides[index];

  return (
    <section className="px-3 sm:px-6 pt-4">
      <div
        ref={spotRef}
        onMouseMove={onMove}
        onTouchMove={onMove}
        className="aurora-spotlight glass relative overflow-hidden"
        style={{ borderRadius: 'var(--aurora-radius)', minHeight: 'clamp(280px, 42vw, 460px)' }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5 sm:p-8 relative z-10 h-full">
          {/* Text side */}
          <div className="flex flex-col justify-center gap-4 order-2 md:order-1">
            {s.badge && (
              <span
                className="self-start text-xs font-extrabold px-3 py-1.5 rounded-full aurora-pulse"
                style={{
                  background: 'linear-gradient(135deg, rgb(var(--aurora-fuchsia)), rgb(var(--aurora-violet)))',
                  color: 'white',
                }}
              >
                <Flame className="inline w-3 h-3 -mt-0.5 me-1" />
                {s.badge}
              </span>
            )}
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black leading-tight">
              <span className="aurora-gradient-text">{s.title}</span>
            </h1>
            <p className="text-sm sm:text-base max-w-md" style={{ color: 'var(--aurora-text-dim)' }}>
              {s.subtitle}
            </p>
            <Link
              to={s.link}
              className="self-start group inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-white transition-transform hover:scale-105"
              style={{
                background: 'linear-gradient(135deg, rgb(var(--aurora-violet)), rgb(var(--aurora-cyan)))',
                boxShadow: '0 12px 32px rgb(var(--aurora-violet) / 0.45)',
              }}
            >
              {s.cta}
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            </Link>
          </div>

          {/* Image side */}
          <div className="relative order-1 md:order-2 flex items-center justify-center">
            {s.image && (
              <div className="relative w-full aspect-square max-w-[360px] mx-auto">
                <div
                  className="absolute inset-6 rounded-full blur-3xl opacity-60"
                  style={{ background: 'conic-gradient(from 0deg, rgb(var(--aurora-violet)), rgb(var(--aurora-cyan)), rgb(var(--aurora-fuchsia)), rgb(var(--aurora-violet)))' }}
                />
                <img
                  src={s.image}
                  alt={s.title}
                  className="relative w-full h-full object-contain drop-shadow-2xl"
                  style={{ filter: 'drop-shadow(0 24px 48px rgb(var(--aurora-violet) / 0.5))' }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Dots */}
        {slides.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`الشريحة ${i + 1}`}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: i === index ? 28 : 10,
                  background: i === index
                    ? 'linear-gradient(90deg, rgb(var(--aurora-violet)), rgb(var(--aurora-cyan)))'
                    : 'var(--aurora-border-hi)',
                }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default HeroAurora;
