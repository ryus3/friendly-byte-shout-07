import React from 'react';

/**
 * ⚡ Skeleton fallback لانتقال صفحات Lazy.
 * يمنع "الشاشة السوداء الفارغة" بين الصفحات ويعطي إحساساً بالسرعة.
 * لا يلمس أي منطق عمل — مجرد عنصر بصري.
 */
const Shimmer = ({ className = '' }) => (
  <div className={`animate-pulse rounded-lg bg-muted/60 ${className}`} />
);

const RouteFallback = () => {
  return (
    <div
      className="min-h-dvh w-full bg-background px-3 sm:px-4 md:px-6 pt-4 pb-24 lg:pb-6"
      dir="rtl"
      aria-hidden="true"
    >
      {/* عنوان وهمي */}
      <div className="flex items-center justify-between mb-5">
        <Shimmer className="h-7 w-40" />
        <Shimmer className="h-9 w-9 rounded-full" />
      </div>

      {/* شريط أزرار/فلاتر */}
      <div className="flex flex-wrap gap-2 mb-5">
        <Shimmer className="h-9 w-28" />
        <Shimmer className="h-9 w-24" />
        <Shimmer className="h-9 w-32" />
      </div>

      {/* شبكة كروت */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Shimmer key={i} className="h-28 sm:h-32" />
        ))}
      </div>

      {/* قائمة عناصر */}
      <div className="mt-6 space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Shimmer key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
};

export default RouteFallback;
