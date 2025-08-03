import React from 'react';
import SettledDuesDialog from '@/components/accounting/SettledDuesDialog';

/**
 * مكون موحد لعرض مستحقات مدفوعة
 * يستخدم في 3 أماكن:
 * 1. متابعة الموظفين (EmployeeFollowUpPage)
 * 2. ملخص الأرباح (ProfitsSummaryPage) 
 * 3. المركز المالي (AccountingPage)
 */
const UnifiedSettledDuesDialog = ({ 
  open, 
  onOpenChange, 
  invoices, 
  allUsers, 
  profits = [], 
  orders = [],
  timePeriod = 'all'
}) => {
  return (
    <SettledDuesDialog
      open={open}
      onOpenChange={onOpenChange}
      invoices={invoices}
      allUsers={allUsers}
      profits={profits}
      orders={orders}
      timePeriod={timePeriod}
    />
  );
};

export default UnifiedSettledDuesDialog;