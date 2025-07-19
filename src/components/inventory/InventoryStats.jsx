import React from 'react';
import { Package, TrendingUp, TrendingDown, AlertTriangle, Archive, PackageX } from 'lucide-react';
import { cn } from '@/lib/utils';
import ArchivedProductsCard from './ArchivedProductsCard';

const StatCard = ({ icon: Icon, title, value, colorClass, delay, onClick }) => (
  <div
    className={cn(
      "relative bg-card rounded-xl p-4 sm:p-6 border transition-all duration-300 animate-fade-in hover-scale",
      "shadow-lg shadow-black/10 dark:shadow-black/30",
      "hover:shadow-2xl hover:shadow-primary/10",
      "dark:hover:shadow-primary/20",
      onClick && "cursor-pointer group"
    )}
    onClick={onClick}
    style={{ animationDelay: `${delay * 100}ms` }}
  >
     <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/10 to-transparent rounded-xl pointer-events-none"></div>
     <div 
       className="absolute inset-px rounded-xl opacity-60"
       style={{
         backgroundImage: `radial-gradient(circle at 40% 30%, hsl(var(--card-foreground) / 0.03), transparent), radial-gradient(circle at 90% 80%, hsl(var(--primary) / 0.05), transparent)`
       }}
     ></div>

    <div className="flex items-start justify-between">
      <div className="flex-1">
        <p className="text-muted-foreground text-sm font-medium">{title}</p>
        <h3 className="text-2xl sm:text-3xl font-bold text-foreground mt-2">{value.toLocaleString()}</h3>
      </div>
      <div className={cn("w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110", colorClass)}>
        <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
      </div>
    </div>
  </div>
);

const InventoryStats = ({ inventoryItems, inventoryStats, lowStockCount, reservedStockCount, onFilterChange, onViewArchive, onRestoreProduct }) => {
  if (!inventoryItems || !inventoryStats) {
    return null; // or a loader/skeleton component
  }
  
  // استخدام البيانات المحسوبة مسبقاً من الصفحة الرئيسية
  const {
    totalVariants,
    lowStockCount: lowStock,
    mediumStockCount: mediumStock, 
    highStockCount: highStock,
    reservedStockCount: reservedStock
  } = inventoryStats;

  const allVariants = inventoryItems.flatMap(i => i.variants || []);
  const outOfStockCount = allVariants.filter(v => (v.quantity || 0) === 0).length;
  
  // حساب المنتجات المؤرشفة (المنتجات التي جميع مقاساتها نافذة)
  const archivedProductsCount = inventoryItems.filter(item => 
    item.variants && item.variants.length > 0 && 
    item.variants.every(v => (v.quantity || 0) === 0)
  ).length;

  const stats = [
    { title: 'إجمالي الأصناف', value: totalVariants, icon: Package, colorClass: 'bg-gradient-to-tr from-blue-500 to-cyan-400', delay: 0, onClick: () => onFilterChange('all') },
    { title: 'مخزون محجوز', value: reservedStock, icon: Archive, colorClass: 'bg-gradient-to-tr from-purple-500 to-violet-400', delay: 0.1, onClick: () => onFilterChange('reserved') },
    { title: 'مخزون جيد', value: highStock, icon: TrendingUp, colorClass: 'bg-gradient-to-tr from-green-500 to-emerald-400', delay: 0.2, onClick: () => onFilterChange('high') },
    { title: 'مخزون متوسط', value: mediumStock, icon: TrendingDown, colorClass: 'bg-gradient-to-tr from-yellow-500 to-orange-400', delay: 0.3, onClick: () => onFilterChange('medium') },
    { title: 'مخزون منخفض', value: lowStock, icon: AlertTriangle, colorClass: 'bg-gradient-to-tr from-red-500 to-rose-400', delay: 0.4, onClick: () => onFilterChange('low') },
    { title: 'مخزون نافذ', value: outOfStockCount, icon: PackageX, colorClass: 'bg-gradient-to-tr from-gray-500 to-gray-600', delay: 0.5, onClick: () => onFilterChange('out-of-stock') },
  ];

  return (
    <div className="space-y-6">
      {/* تخطيط 3+3 كما طلب المستخدم */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.slice(0, 3).map(stat => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* السطر الثاني من الكروت */}
        <div className="md:col-span-2 lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
          {stats.slice(3, 6).map(stat => (
            <StatCard key={stat.title} {...stat} />
          ))}
        </div>
        
        {/* كارت الأرشيف في الجهة الأخرى */}
        <div className="md:col-span-2 lg:col-span-1">
          <ArchivedProductsCard
            archivedCount={archivedProductsCount}
            onViewArchive={onViewArchive}
            onRestoreProduct={onRestoreProduct}
          />
        </div>
      </div>
    </div>
  );
};

export default InventoryStats;