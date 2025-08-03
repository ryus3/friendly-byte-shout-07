import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import SettlementRequest from './SettlementRequest';

/**
 * مكون موحد لطلبات التسوية - يستخدم نظام الصلاحيات الموحد
 * المديرون: يرون جميع طلبات التسوية
 * الموظفون: يرون طلبات التسوية الخاصة بهم فقط
 */
const UnifiedSettlementRequest = (props) => {
  const { hasPermission, canViewAllData } = usePermissions();
  
  // فحص صلاحية إنشاء طلبات التسوية
  const canRequestSettlement = hasPermission('create_settlement_request') || 
                               hasPermission('manage_profits') || 
                               canViewAllData;

  return (
    <SettlementRequest
      {...props}
      canRequestSettlement={canRequestSettlement}
    />
  );
};

export default UnifiedSettlementRequest;