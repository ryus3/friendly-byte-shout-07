import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { useStorefront } from '@/contexts/StorefrontContext';

const StickyMiniCart = ({ slug }) => {
  const { itemCount = 0, cartTotal = 0 } = useStorefront();
  if (!itemCount) return null;
  return (
    <Link
      to={`/storefront/${slug}/cart`}
      className="aurora-minicart glass-hi flex items-center gap-3 px-4 py-3 hover:scale-105 transition-transform"
      style={{
        borderRadius: 999,
        border: '1px solid var(--aurora-border-hi)',
        boxShadow: 'var(--aurora-neon)',
      }}
    >
      <div className="relative w-10 h-10 rounded-full flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, rgb(var(--aurora-violet)), rgb(var(--aurora-cyan)))' }}>
        <ShoppingBag className="w-5 h-5 text-white" />
        <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-black flex items-center justify-center text-white"
          style={{ background: 'rgb(var(--aurora-fuchsia))', boxShadow: '0 0 10px rgb(var(--aurora-fuchsia) / 0.7)' }}>
          {itemCount}
        </span>
      </div>
      <div className="text-start leading-tight">
        <div className="text-[10px] font-bold" style={{ color: 'var(--aurora-text-dim)' }}>السلة</div>
        <div className="text-sm font-black" style={{ color: 'var(--aurora-text)' }}>
          {cartTotal.toLocaleString('ar-IQ')} <span className="text-[10px]">د.ع</span>
        </div>
      </div>
    </Link>
  );
};

export default StickyMiniCart;
