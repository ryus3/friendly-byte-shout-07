import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import ProfessionalReportsSystem from './ProfessionalReportsSystem';

/**
 * نظام التقارير الموحد
 * يعرض التقارير المناسبة حسب صلاحيات المستخدم
 */
const UnifiedReportsSystem = () => {
  const { hasPermission, canViewAllData, filterDataByUser } = usePermissions();

  return (
    <div className="space-y-6">
      <ProfessionalReportsSystem 
        canViewAll={canViewAllData}
        filterData={filterDataByUser}
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