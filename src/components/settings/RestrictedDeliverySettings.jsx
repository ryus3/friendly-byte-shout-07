import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Lock, Shield, Settings, Plus } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { useEmployeeDeliveryAccounts } from '@/hooks/useEmployeeDeliveryAccounts';
import DeliveryManagementDialog from './DeliveryManagementDialog';
import EmployeeDeliveryAccountSetup from './EmployeeDeliveryAccountSetup';

const RestrictedDeliverySettings = () => {
  const { canAccessDeliveryPartners, isAdmin, user } = usePermissions();
  const { hasActiveAccount, currentUserAccount, isCurrentUserConnected } = useEmployeeDeliveryAccounts();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isSetupOpen, setIsSetupOpen] = React.useState(false);

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
          <Badge variant="success">
            {isAdmin ? 'مدير - جميع الصلاحيات' : 'مسموح'}
          </Badge>
        </CardContent>
      </Card>

      {/* إعداد حساب التوصيل الشخصي */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" />
            حسابي في شركة التوصيل
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              قم بربط حسابك الشخصي في شركة التوصيل لمزامنة طلباتك
            </p>
            
            <div className="flex items-center justify-between">
              <div>
                {isCurrentUserConnected ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="success">متصل</Badge>
                    <span className="text-sm text-muted-foreground">
                      {currentUserAccount?.account_code}
                    </span>
                  </div>
                ) : (
                  <Badge variant="secondary">غير متصل</Badge>
                )}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSetupOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                {isCurrentUserConnected ? 'تعديل' : 'إعداد'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <DeliveryManagementDialog 
        open={isOpen} 
        onOpenChange={setIsOpen} 
      />
      
      <EmployeeDeliveryAccountSetup
        open={isSetupOpen}
        onOpenChange={setIsSetupOpen}
      />
    </>
  );
};

export default RestrictedDeliverySettings;