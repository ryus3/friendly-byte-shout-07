import React from 'react';
import { useUnifiedPermissionsSystem } from '@/hooks/useUnifiedPermissionsSystem';
import UnifiedAnalyticsSystem from './UnifiedAnalyticsSystem';

/**
 * نظام التقارير الموحد المتصل بالنظام المالي
 * يعرض التحليلات والتقارير المناسبة حسب صلاحيات المستخدم
 */
const UnifiedReportsSystem = () => {
  const { hasPermission, canViewAllData } = useUnifiedPermissionsSystem();

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