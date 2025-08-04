import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import UnifiedAnalyticsSystem from './UnifiedAnalyticsSystem';

/**
 * نظام التقارير الموحد المتصل بالنظام المالي
 * يعرض التحليلات والتقارير المناسبة حسب صلاحيات المستخدم
 */
const UnifiedReportsSystem = () => {
  const { hasPermission, canViewAllData } = usePermissions();

  return (
    <div className="space-y-6">
      <UnifiedAnalyticsSystem 
        canViewAll={canViewAllData}
        userPermissions={{
          viewFinancialReports: hasPermission('view_financial_reports'),
          viewInventoryReports: hasPermission('view_inventory_reports'),
          viewSalesReports: hasPermission('view_sales_reports'),
          exportReports: hasPermission('export_reports')
        }}
      />
    </div>
  );
};

export default UnifiedReportsSystem;