import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PackageX, Shield, User } from 'lucide-react';
import usePermissionBasedData from '@/hooks/usePermissionBasedData';
import StockNotificationSettings from './StockNotificationSettings';

const RestrictedStockSettings = () => {
  const { canViewAllData, isAdmin, isEmployee } = usePermissionBasedData();
  const [isOpen, setIsOpen] = React.useState(false);

  // فقط المديرون يمكنهم الوصول لإعدادات المخزون
  if (!canViewAllData) {
    return (
      <Card className="opacity-50 cursor-not-allowed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PackageX className="w-5 h-5 text-gray-400" />
            إعدادات المخزون
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <Shield className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-muted-foreground mb-2">
              هذه الإعدادات مخصصة للمديرين فقط
            </p>
            <Badge variant="outline">
              <User className="w-3 h-3 ml-1" />
              صلاحية محدودة
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card 
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => setIsOpen(true)}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PackageX className="w-5 h-5 text-amber-600" />
            إعدادات المخزون
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-2">
            إدارة تنبيهات المخزون المنخفض وحدود التنبيه
          </p>
          <Badge variant="default">
            <Shield className="w-3 h-3 ml-1" />
            إدارة كاملة
          </Badge>
        </CardContent>
      </Card>

      <StockNotificationSettings 
        open={isOpen} 
        onOpenChange={setIsOpen} 
      />
    </>
  );
};

export default RestrictedStockSettings;