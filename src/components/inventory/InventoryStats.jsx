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
        <h3 className="text-2xl sm:text-3xl font-bold text-foreground mt-2">{(value || 0).toLocaleString()}</h3>
      </div>
      <div className={cn("w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110", colorClass)}>
        <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
      </div>
    </div>
  </div>
);

const InventoryStats = ({ inventoryItems, lowStockCount, reservedStockCount, onFilterChange, onViewArchive, onRestoreProduct }) => {
  if (!inventoryItems) {
    return null; // or a loader/skeleton component
  }
  const totalProducts = inventoryItems.length; // عدد المنتجات الفعلي
  const allVariants = inventoryItems.flatMap(i => i.variants || []);
  const highStockCount = allVariants.filter(v => v.stockLevel === 'high').length;
  const mediumStockCount = allVariants.filter(v => v.stockLevel === 'medium').length;
  const outOfStockCount = allVariants.filter(v => (v.quantity || 0) === 0).length;
  
  // حساب المنتجات المؤرشفة (المنتجات التي جميع مقاساتها نافذة)
  const archivedProductsCount = inventoryItems.filter(item => 
    item.variants && item.variants.length > 0 && 
    item.variants.every(v => (v.quantity || 0) === 0)
  ).length;

  const stats = [
    { title: 'إجمالي المنتجات', value: totalProducts, icon: Package, colorClass: 'bg-gradient-to-tr from-blue-500 to-cyan-400', delay: 0, onClick: () => onFilterChange('all') },
    { title: 'مخزون محجوز', value: reservedStockCount || 0, icon: Archive, colorClass: 'bg-gradient-to-tr from-purple-500 to-violet-400', delay: 0.1, onClick: () => onFilterChange('reserved') },
    { title: 'مخزون جيد', value: highStockCount, icon: TrendingUp, colorClass: 'bg-gradient-to-tr from-green-500 to-emerald-400', delay: 0.2, onClick: () => onFilterChange('high') },
    { title: 'مخزون متوسط', value: mediumStockCount, icon: TrendingDown, colorClass: 'bg-gradient-to-tr from-orange-400 to-yellow-500', delay: 0.3, onClick: () => onFilterChange('medium') },
    { title: 'مخزون منخفض', value: lowStockCount, icon: AlertTriangle, colorClass: 'bg-gradient-to-tr from-red-500 to-orange-500', delay: 0.4, onClick: () => onFilterChange('low') },
    { title: 'مخزون نافذ', value: outOfStockCount, icon: PackageX, colorClass: 'bg-gradient-to-tr from-gray-600 to-gray-800', delay: 0.5, onClick: () => onFilterChange('out-of-stock') },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map(stat => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>
      
      {/* إزالة كارت الأرشيف من هنا لأنه سيظهر في الصف الموحد */}
    </div>
  );
};

export default InventoryStats;