import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Lock, Shield, Settings, Plus, RefreshCw } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import DeliveryManagementDialog from './DeliveryManagementDialog';
import { UnifiedSyncSettings } from '../delivery/UnifiedSyncSettings';

const RestrictedDeliverySettings = () => {
  const { canAccessDeliveryPartners, isAdmin, user } = usePermissions();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isSyncSettingsOpen, setIsSyncSettingsOpen] = React.useState(false);

  if (!canAccessDeliveryPartners && !isAdmin) {
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
      {/* إعدادات التوصيل الرئيسية */}
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
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="success">
              {isAdmin ? 'مدير - جميع الصلاحيات' : 'مسموح'}
            </Badge>
          </div>
          
          {/* زر إعدادات المزامنة */}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={(e) => {
              e.stopPropagation();
              setIsSyncSettingsOpen(true);
            }}
            className="w-full mt-2"
          >
            <RefreshCw className="w-4 h-4 ml-2" />
            إعدادات المزامنة التلقائية
          </Button>
        </CardContent>
      </Card>


      <DeliveryManagementDialog 
        open={isOpen} 
        onOpenChange={setIsOpen} 
      />
      
      {/* إعدادات المزامنة التلقائية */}
      <UnifiedSyncSettings 
        open={isSyncSettingsOpen} 
        onOpenChange={setIsSyncSettingsOpen} 
      />
    </>
  );
};

export default RestrictedDeliverySettings;