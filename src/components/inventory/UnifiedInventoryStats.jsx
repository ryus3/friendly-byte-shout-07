import React from 'react';
import InventoryStats from './InventoryStats';
import DepartmentOverviewCards from './DepartmentOverviewCards';

/**
 * مكون موحد لعرض إحصائيات المخزون وكروت الأقسام
 * يستخدم النظام الموحد لجلب البيانات
 */
const UnifiedInventoryStats = ({ onFilterChange, onDepartmentFilter, extraCard = null }) => {
  return (
    <div className="space-y-6">
      {/* إحصائيات سريعة */}
      <InventoryStats onFilterChange={onFilterChange} />
      {/* كروت الأقسام + بطاقة إضافية إن وجدت */}
      <DepartmentOverviewCards onDepartmentFilter={onDepartmentFilter} extraCard={extraCard} />
    </div>
  );
};

export default UnifiedInventoryStats;