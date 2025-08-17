import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import SettlementRequestCard from './SettlementRequestCard';

/**
 * مكون موحد لكارت طلب التسوية في لوحة التحكم
 * يستخدم نظام الصلاحيات الموحد لتحديد المستخدمين المؤهلين
 */
const UnifiedSettlementRequestCard = ({ pendingProfit, onSettle, ...props }) => {
  const { hasPermission, isEmployee } = usePermissions();
  
  // الموظفون يرون كارت التسوية إذا كان لديهم أرباح معلقة
  // المديرون لا يرون الكارت (لأنهم لا يحتاجون تسوية)
  const shouldShowCard = isEmployee && 
                         hasPermission('request_settlement') && 
                         pendingProfit > 0;

  if (!shouldShowCard) {
    return null;
  }

  return (
    <SettlementRequestCard
      {...props}
      pendingProfit={pendingProfit}
      onSettle={onSettle}
    />
  );
};

export default UnifiedSettlementRequestCard;