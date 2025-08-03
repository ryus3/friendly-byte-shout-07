import React from 'react';
import InventoryStats from './InventoryStats';
import DepartmentOverviewCards from './DepartmentOverviewCards';

/**
 * مكون موحد لعرض إحصائيات المخزون وكروت الأقسام
 * يستخدم النظام الموحد لجلب البيانات
 */
const UnifiedInventoryStats = ({ onFilterChange, onDepartmentFilter, archivedCount, onArchiveClick }) => {
  return (
    <div className="space-y-6">
      {/* إحصائيات سريعة */}
      <InventoryStats onFilterChange={onFilterChange} />
      
      {/* كروت الأقسام مع الأرشيف */}
      <DepartmentOverviewCards 
        onDepartmentFilter={onDepartmentFilter} 
        archivedCount={archivedCount}
        onArchiveClick={onArchiveClick}
      />
    </div>
  );
};

export default UnifiedInventoryStats;