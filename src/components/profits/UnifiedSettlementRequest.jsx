import React from 'react';
import { useUnifiedPermissionsSystem } from '@/hooks/useUnifiedPermissionsSystem';
import SettlementRequest from './SettlementRequest';

/**
 * مكون موحد لطلبات التسوية - يستخدم نظام الصلاحيات الموحد
 * المديرون: يرون جميع طلبات التسوية
 * الموظفون: يرون طلبات التسوية الخاصة بهم فقط
 */
const UnifiedSettlementRequest = (props) => {
  const { hasPermission, canViewAllData, isEmployee } = useUnifiedPermissionsSystem();
  
  // فحص صلاحية إنشاء طلبات التسوية - الموظفون يمكنهم طلب التسوية
  const canRequestSettlement = isEmployee || 
                               hasPermission('create_settlement_request') || 
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