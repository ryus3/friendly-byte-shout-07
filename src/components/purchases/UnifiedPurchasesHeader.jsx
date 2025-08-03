import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { usePurchases } from '@/hooks/useImprovedPurchases';
import PurchasesHeader from './PurchasesHeader';

/**
 * مكون موحد لرأس صفحة المشتريات
 * يستخدم النظام الموحد للصلاحيات
 */
const UnifiedPurchasesHeader = ({ onAdd, onImport, onExport }) => {
  const { hasPermission } = usePermissions();
  
  // فحص صلاحية إضافة المشتريات
  const canAddPurchases = hasPermission('manage_purchases') || hasPermission('manage_all_data');

  return (
    <PurchasesHeader
      onAdd={onAdd}
      onImport={onImport}
      onExport={onExport}
      hasPermission={canAddPurchases}
    />
  );
};

export default UnifiedPurchasesHeader;