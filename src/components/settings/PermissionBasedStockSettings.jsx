import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import StockNotificationSettings from './StockNotificationSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Package } from 'lucide-react';

const PermissionBasedStockSettings = ({ open, onOpenChange }) => {
  const { canManageFinances, isAdmin, isSalesEmployee } = usePermissions();
  
  // فقط المديرون وأصحاب صلاحية إدارة المالية يمكنهم الوصول
  const canAccessStockSettings = canManageFinances || isAdmin;
  
  if (!canAccessStockSettings) {
    return (
      <div className="flex items-center justify-center p-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <Shield className="w-5 h-5" />
              صلاحيات محدودة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-3">
              <Package className="w-12 h-12 mx-auto text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground">
                لا يمكنك الوصول لإعدادات المخزون المتقدمة
              </p>
              <p className="text-xs text-muted-foreground">
                يمكنك مشاهدة تنبيهات المخزون فقط
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <StockNotificationSettings 
      open={open} 
      onOpenChange={onOpenChange}
    />
  );
};

export default PermissionBasedStockSettings;