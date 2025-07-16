import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Settings, Shield, Eye, EyeOff } from 'lucide-react';
import usePermissionBasedData from '@/hooks/usePermissionBasedData';

const PermissionsBasedSettings = ({ children }) => {
  const { user, canManageSettings, canViewAllData, isAdmin, isEmployee } = usePermissionBasedData();

  // تصفية العناصر حسب الصلاحيات
  const filterSettingsItems = (items) => {
    if (!items || !Array.isArray(items)) return [];
    
    return React.Children.toArray(children).filter((child) => {
      if (!child?.props?.permission) return true; // إذا لم تكن هناك صلاحية محددة، اعرض العنصر
      
      const permission = child.props.permission;
      
      // صلاحيات خاصة بالمدير فقط
      const adminOnlyPermissions = [
        'manage_settings',
        'manage_employees', 
        'telegram_bot_settings',
        'delivery_settings',
        'manage_variants',
        'view_system_logs'
      ];
      
      if (adminOnlyPermissions.includes(permission)) {
        return isAdmin;
      }
      
      // صلاحيات عامة
      return true;
    });
  };

  const filteredItems = filterSettingsItems(children);

  if (filteredItems.length === 0) {
    return (
      <Card className="text-center py-8">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <EyeOff className="w-12 h-12 text-muted-foreground" />
          </div>
          <CardTitle className="text-muted-foreground">
            لا توجد إعدادات متاحة
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            لا تملك الصلاحيات اللازمة لعرض أو تعديل الإعدادات
          </p>
          <Badge variant="outline" className="mt-2">
            {isEmployee ? 'موظف' : user?.role}
          </Badge>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* معلومات المستخدم */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-700">
            <Shield className="w-5 h-5" />
            صلاحياتك الحالية
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{user?.full_name}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
            <div className="text-right">
              <Badge variant={isAdmin ? "default" : "secondary"}>
                {isAdmin ? 'مدير' : isEmployee ? 'موظف' : user?.role}
              </Badge>
              {canViewAllData && (
                <div className="flex items-center gap-1 mt-1 text-xs text-blue-600">
                  <Eye className="w-3 h-3" />
                  يمكنك عرض جميع البيانات
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* الإعدادات المتاحة */}
      <div className="space-y-4">
        {filteredItems}
      </div>
    </div>
  );
};

export default PermissionsBasedSettings;