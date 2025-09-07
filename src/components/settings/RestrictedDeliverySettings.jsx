import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Truck, Shield, FileText, Settings, RefreshCw } from 'lucide-react';
import { checkUserPermissions } from '@/lib/permissions';
import { useAuth } from '@/contexts/SuperProvider';
import DeliverySettingsDialog from './DeliverySettingsDialog';
import { UnifiedSyncSettings } from '../delivery/UnifiedSyncSettings';
import { OrdersSyncSettings } from '../delivery/OrdersSyncSettings';

const RestrictedDeliverySettings = () => {
  const { user } = useAuth();
  const hasDeliveryAccess = checkUserPermissions(user, ['delivery_settings']);

  if (!hasDeliveryAccess) {
    return (
      <Card className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
            <Shield className="w-5 h-5" />
            إدارة التوصيل
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600 dark:text-red-400">
                لا تملك الصلاحيات اللازمة للوصول لإدارة التوصيل
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
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">إدارة التوصيل</h2>
        <p className="text-muted-foreground">
          إدارة شاملة لجميع إعدادات التوصيل والمزامنة التلقائية
        </p>
      </div>

      <div className="space-y-6">
        <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
              <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-blue-900 dark:text-blue-100">
                إعدادات التوصيل
              </h3>
              <p className="text-blue-700 dark:text-blue-300 text-sm">
                إدارة إعدادات الشحن والتوصيل
              </p>
            </div>
          </div>
          <DeliverySettingsDialog />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
                <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-green-900 dark:text-green-100">
                  مزامنة فواتير التوصيل
                </h3>
                <p className="text-green-700 dark:text-green-300 text-sm">
                  مزامنة فواتير شركة التوصيل تلقائياً
                </p>
              </div>
            </div>
            <UnifiedSyncSettings />
          </div>
          
          <div className="p-6 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30 border border-orange-200 dark:border-orange-800 rounded-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/50 rounded-lg">
                <RefreshCw className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-orange-900 dark:text-orange-100">
                  مزامنة طلبات متابعة الطلبات
                </h3>
                <p className="text-orange-700 dark:text-orange-300 text-sm">
                  مزامنة تلقائية للطلبات في صفحة متابعة الطلبات
                </p>
              </div>
            </div>
            <OrdersSyncSettings />
          </div>
        </div>
      </div>
    </div>
  );
};

export default RestrictedDeliverySettings;