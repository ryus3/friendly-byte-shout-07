import React, { useMemo } from 'react';
import usePermissionBasedData from '@/hooks/usePermissionBasedData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff, User, Users } from 'lucide-react';

const PermissionBasedNotifications = ({ notifications, children }) => {
  const { 
    getNotificationsForUser, 
    isAdmin,
    isEmployee,
    user 
  } = usePermissionBasedData();

  // فلترة الإشعارات حسب المستخدم
  const filteredNotifications = useMemo(() => {
    return getNotificationsForUser(notifications);
  }, [notifications, getNotificationsForUser]);

  // إحصائيات الإشعارات
  const notificationStats = useMemo(() => {
    const unread = filteredNotifications.filter(n => !n.is_read).length;
    const personal = filteredNotifications.filter(n => n.user_id === user?.user_id || n.user_id === user?.id).length;
    const general = filteredNotifications.filter(n => n.user_id === null).length;
    
    return { unread, personal, general, total: filteredNotifications.length };
  }, [filteredNotifications, user]);

  if (filteredNotifications.length === 0) {
    return (
      <Card className="text-center py-8">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <BellOff className="w-12 h-12 text-muted-foreground" />
          </div>
          <CardTitle className="text-muted-foreground">
            لا توجد إشعارات
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            لم تصلك أي إشعارات بعد
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
      {/* إحصائيات الإشعارات */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-700">
            <Bell className="w-5 h-5" />
            إشعاراتك
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{notificationStats.total}</div>
              <div className="text-xs text-muted-foreground">المجموع</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{notificationStats.unread}</div>
              <div className="text-xs text-muted-foreground">غير مقروءة</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{notificationStats.personal}</div>
              <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <User className="w-3 h-3" />
                شخصية
              </div>
            </div>
            {isAdmin && (
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{notificationStats.general}</div>
                <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <Users className="w-3 h-3" />
                  عامة
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* المحتوى المفلتر */}
      {React.Children.map(children, child => 
        React.cloneElement(child, { 
          notifications: filteredNotifications,
          canViewAll: isAdmin
        })
      )}
    </div>
  );
};

export default PermissionBasedNotifications;