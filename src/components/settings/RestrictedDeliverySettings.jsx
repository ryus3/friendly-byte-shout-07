import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lock, Shield } from 'lucide-react';
import usePermissionBasedData from '@/hooks/usePermissionBasedData';
import DeliverySettingsDialog from './DeliverySettingsDialog';

const RestrictedDeliverySettings = () => {
  const { canManageSettings, isAdmin, user } = usePermissionBasedData();
  const [isOpen, setIsOpen] = React.useState(false);

  if (!canManageSettings && !isAdmin) {
    return (
      <Card className="bg-red-50 border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700">
            <Lock className="w-5 h-5" />
            إعدادات التوصيل
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600">
                لا تملك الصلاحيات اللازمة للوصول لإعدادات التوصيل
              </p>
              <Badge variant="destructive" className="mt-2">
                <Shield className="w-3 h-3 ml-1" />
                مقيد
              </Badge>
            </div>
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
            <Shield className="w-5 h-5 text-green-600" />
            إعدادات التوصيل
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-2">
            إدارة رسوم التوصيل والإعدادات المتعلقة بها
          </p>
          <Badge variant="success">
            مسموح - مدير
          </Badge>
        </CardContent>
      </Card>

      <DeliverySettingsDialog 
        open={isOpen} 
        onOpenChange={setIsOpen} 
      />
    </>
  );
};

export default RestrictedDeliverySettings;