import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Users, UserCheck } from 'lucide-react';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useEmployeeDeliveryAccounts } from '@/hooks/useEmployeeDeliveryAccounts';

/**
 * مؤشر لعرض حالة ظهور الطلب للمدير والموظف
 */
const OrderVisibilityIndicator = ({ order }) => {
  const { user } = useAuth();
  const { hasActiveAccount } = useEmployeeDeliveryAccounts();
  
  if (!order) return null;

  const isManager = user?.email === 'ryusbrand@gmail.com' || user?.id === '91484496-b887-44f7-9e5d-be9db5567604';
  const isOwner = order.created_by === user?.id;
  const hasEmployeeAccount = hasActiveAccount();

  if (isManager) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">
          <Users className="w-3 h-3 mr-1" />
          مدير - يرى جميع الطلبات
        </Badge>
        {order.created_by !== user?.id && (
          <Badge variant="secondary" className="text-xs">
            طلب موظف
          </Badge>
        )}
      </div>
    );
  }

  if (isOwner) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="success" className="text-xs">
          <Eye className="w-3 h-3 mr-1" />
          طلبي
        </Badge>
        {hasEmployeeAccount ? (
          <Badge variant="outline" className="text-xs">
            <UserCheck className="w-3 h-3 mr-1" />
            حساب متصل
          </Badge>
        ) : (
          <Badge variant="destructive" className="text-xs">
            <EyeOff className="w-3 h-3 mr-1" />
            حساب غير متصل
          </Badge>
        )}
      </div>
    );
  }

  return (
    <Badge variant="secondary" className="text-xs">
      <EyeOff className="w-3 h-3 mr-1" />
      مخفي
    </Badge>
  );
};

export default OrderVisibilityIndicator;