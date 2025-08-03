import React from 'react';
import InventoryStats from './InventoryStats';
import DepartmentOverviewCards from './DepartmentOverviewCards';

/**
 * مكون موحد لعرض إحصائيات المخزون وكروت الأقسام
 * يستخدم النظام الموحد لجلب البيانات
 */
const UnifiedInventoryStats = ({ onFilterChange, onDepartmentFilter }) => {
  return (
    <div className="space-y-6">
      {/* إحصائيات سريعة */}
      <InventoryStats onFilterChange={onFilterChange} />
      
      {/* كروت الأقسام */}
      <DepartmentOverviewCards onDepartmentFilter={onDepartmentFilter} />
    </div>
  );
};

export default UnifiedInventoryStats;