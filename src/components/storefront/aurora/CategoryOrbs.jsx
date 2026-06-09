import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Tag } from 'lucide-react';

const CategoryOrbs = ({ slug, employeeId }) => {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data } = await supabase
        .from('categories')
        .select('id, name, image_url')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .limit(12);
      if (mounted) setCategories(data || []);
    };
    load();
    return () => { mounted = false; };
  }, [employeeId]);

  if (!categories.length) return null;

  return (
    <section className="px-3 sm:px-6 mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg sm:text-xl font-black aurora-gradient-text">تسوّق حسب الفئة</h2>
        <Link to={`/storefront/${slug}/products`} className="text-xs font-bold" style={{ color: 'rgb(var(--aurora-cyan))' }}>
          عرض الكل
        </Link>
      </div>
      <div className="aurora-rail">
        {categories.map((c) => (
          <Link
            key={c.id}
            to={`/storefront/${slug}/products?category=${c.id}`}
            className="group flex flex-col items-center gap-2 w-[88px] sm:w-[104px]"
          >
            <div className="aurora-ring relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden glass-hi"
              style={{ padding: 3 }}>
              <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
                style={{ background: 'var(--aurora-bg-2)' }}>
                {c.image_url ? (
                  <img src={c.image_url} alt={c.name} loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                ) : (
                  <Tag className="w-7 h-7" style={{ color: 'rgb(var(--aurora-violet))' }} />
                )}
              </div>
            </div>
            <span className="text-xs sm:text-sm font-bold text-center line-clamp-1" style={{ color: 'var(--aurora-text)' }}>
              {c.name}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
};

export default CategoryOrbs;
