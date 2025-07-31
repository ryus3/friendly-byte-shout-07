import React from 'react';
import UnifiedSettledDuesCard from './UnifiedSettledDuesCard';

/**
 * مكون موحد لعرض مستحقات مدفوعة - محدث ومتوافق مع الهاتف
 * يستخدم في 3 أماكن:
 * 1. متابعة الموظفين (EmployeeFollowUpPage)
 * 2. ملخص الأرباح (ProfitsSummaryPage) 
 * 3. المركز المالي (AccountingPage)
 */
const UnifiedSettledDuesDialog = ({ 
  open, 
  onOpenChange, 
  allUsers = [],
  dateRange = null
}) => {
  return (
    <UnifiedSettledDuesCard
      open={open}
      onOpenChange={onOpenChange}
      allUsers={allUsers}
      dateRange={dateRange}
    />
  );
};

export default UnifiedSettledDuesDialog;