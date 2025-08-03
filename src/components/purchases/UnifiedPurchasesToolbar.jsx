import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { usePurchases } from '@/hooks/useImprovedPurchases';
import PurchasesToolbar from './PurchasesToolbar';

/**
 * مكون موحد لشريط أدوات المشتريات
 * يستخدم النظام الموحد للصلاحيات وجلب البيانات
 */
const UnifiedPurchasesToolbar = ({
  viewMode,
  onViewModeChange,
  searchTerm,
  onSearchChange,
  sortBy,
  onSortChange,
  dateFilter,
  onDateFilterChange,
  statusFilter,
  onStatusFilterChange,
  supplierFilter,
  onSupplierFilterChange
}) => {
  const { canViewAllPurchases, filterDataByUser } = usePermissions();
  const { purchases } = usePurchases();

  // تصفية المشتريات حسب صلاحيات المستخدم للحصول على قائمة الموردين
  const filteredPurchases = canViewAllPurchases 
    ? purchases 
    : filterDataByUser(purchases, 'created_by');

  // استخراج قائمة الموردين الفريدة
  const suppliers = React.useMemo(() => {
    const uniqueSuppliers = [...new Set(
      filteredPurchases
        .map(p => p.supplier_name)
        .filter(Boolean)
    )].sort();
    return uniqueSuppliers;
  }, [filteredPurchases]);

  return (
    <PurchasesToolbar
      viewMode={viewMode}
      onViewModeChange={onViewModeChange}
      searchTerm={searchTerm}
      onSearchChange={onSearchChange}
      sortBy={sortBy}
      onSortChange={onSortChange}
      dateFilter={dateFilter}
      onDateFilterChange={onDateFilterChange}
      statusFilter={statusFilter}
      onStatusFilterChange={onStatusFilterChange}
      supplierFilter={supplierFilter}
      onSupplierFilterChange={onSupplierFilterChange}
      suppliers={suppliers}
    />
  );
};

export default UnifiedPurchasesToolbar;