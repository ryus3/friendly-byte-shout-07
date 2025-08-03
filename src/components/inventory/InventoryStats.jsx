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

const InventoryStats = ({ onFilterChange, onViewArchive, onRestoreProduct }) => {
  // استخدام النظام الموحد للإحصائيات - تم الحذف الكامل للحسابات المحلية
  // جميع الإحصائيات تأتي الآن من النظام الموحد في InventoryPage

  // هذا المكون أصبح مُهمل - يجب حذفه أو استبداله بالكامل
  // جميع الإحصائيات تأتي الآن من useInventoryStats في InventoryPage
  
  console.warn('InventoryStats component is deprecated. Use unified stats from InventoryPage instead.');
  
  return (
    <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800/30 rounded-lg">
      <p className="text-yellow-800 dark:text-yellow-200 text-center">
        ⚠️ هذا المكون مُهمل. يتم استخدام النظام الموحد للإحصائيات الآن.
      </p>
    </div>
  );

};

export default InventoryStats;