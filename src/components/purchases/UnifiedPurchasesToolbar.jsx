import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useImprovedPurchases } from '@/hooks/useImprovedPurchases';
import PurchasesToolbar from './PurchasesToolbar';

/**
 * مكون موحد لشريط أدوات المشتريات
 * يستخدم النظام الموحد للصلاحيات وجلب البيانات
 */
const UnifiedPurchasesToolbar = (props) => {
  const { canViewAllPurchases, filterDataByUser } = usePermissions();
  const { purchases } = useImprovedPurchases();

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
      {...props}
      suppliers={suppliers}
    />
  );
};

export default UnifiedPurchasesToolbar;