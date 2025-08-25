import React, { useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useNotificationsSystem } from '@/contexts/NotificationsSystemContext';
import { Bell, BellOff, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

const NotificationsPanel = ({ allowedTypes = [], canViewAll = false, className = "" }) => {
  const { hasPermission } = usePermissions();
  const { notifications, markAsRead, markAllAsRead, deleteNotification } = useNotificationsSystem();
  const [isOpen, setIsOpen] = useState(false);

  // تصفية الإشعارات حسب الصلاحيات والأنواع المسموحة
  const filteredNotifications = notifications.filter(notification => {
    if (allowedTypes.length > 0 && !allowedTypes.includes(notification.type)) {
      return false;
    }

    // فلترة حسب الصلاحيات
    if (notification.type === 'admin' && !hasPermission('manage_all_data')) {
      return false;
    }
    
    if (notification.type === 'employees' && !hasPermission('manage_employees')) {
      return false;
    }

    return true;
  }).slice(0, 20); // عرض آخر 20 إشعار فقط

  const unreadCount = filteredNotifications.filter(n => !n.read).length;

  // الحصول على الأيقونة المناسبة لنوع الإشعار
  const getNotificationIcon = (type, priority) => {
    const iconProps = {
      className: `w-4 h-4 ${priority === 'high' ? 'text-red-500' : priority === 'medium' ? 'text-orange-500' : 'text-blue-500'}`
    };

    switch (type) {
      case 'stock':
        return <Bell {...iconProps} />;
      case 'order':
      case 'alwaseet_status':
        return <Bell {...iconProps} />;
      case 'system':
        return <Bell {...iconProps} />;
      case 'employees':
        return <Bell {...iconProps} />;
      case 'admin':
        return <Bell {...iconProps} />;
      default:
        return <Bell {...iconProps} />;
    }
  };

  // ألوان الحالات المطابقة لنظام alwaseet-statuses
  const getStatusColorClasses = (notification) => {
    const stateId = notification.metadata?.stateId;
    const type = notification.type;
    
    if (type === 'alwaseet_status' && stateId) {
      // استخدام نفس الألوان من alwaseet-statuses.js
      switch (stateId) {
        case '2': // تم الاستلام من المندوب
          return 'bg-gradient-to-r from-orange-500/10 to-amber-600/10 border-r-orange-500 text-orange-700 dark:text-orange-300';
        case '4': // تم التسليم
          return 'bg-gradient-to-r from-green-500/10 to-emerald-600/10 border-r-green-500 text-green-700 dark:text-green-300';
        case '17': // مرتجع
          return 'bg-gradient-to-r from-gray-500/10 to-slate-600/10 border-r-gray-500 text-gray-700 dark:text-gray-300';
        case '25':
        case '26': // لا يرد
          return 'bg-gradient-to-r from-yellow-500/10 to-amber-600/10 border-r-yellow-500 text-yellow-700 dark:text-yellow-300';
        case '31':
        case '32': // ملغي/مرفوض
          return 'bg-gradient-to-r from-red-500/10 to-rose-600/10 border-r-red-500 text-red-700 dark:text-red-300';
        default:
          return 'bg-gradient-to-r from-blue-500/10 to-blue-600/10 border-r-blue-500 text-blue-700 dark:text-blue-300';
      }
    }
    
    // ألوان افتراضية للأنواع الأخرى
    switch (notification.priority) {
      case 'high': return 'border-r-red-500 bg-red-50 dark:bg-red-950/30';
      case 'medium': return 'border-r-orange-500 bg-orange-50 dark:bg-orange-950/30';
      case 'low': return 'border-r-blue-500 bg-blue-50 dark:bg-blue-950/30';
      default: return 'border-r-gray-500 bg-gray-50 dark:bg-gray-950/30';
    }
  };

  const handleMarkAsRead = (notificationId) => {
    markAsRead(notificationId);
  };

  const handleMarkAllAsRead = () => {
    const unreadIds = filteredNotifications.filter(n => !n.read).map(n => n.id);
    unreadIds.forEach(id => markAsRead(id));
  };

  const handleDeleteNotification = (notificationId) => {
    deleteNotification(notificationId);
  };

  return (
    <div className={`relative ${className}`}>
      {/* زر الإشعارات */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="relative"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-2 -right-2 px-1 min-w-[1.25rem] h-5 text-xs"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>

      {/* لوحة الإشعارات */}
      {isOpen && (
        <Card className="absolute top-12 right-0 w-80 max-w-sm z-50 shadow-xl border border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Bell className="w-5 h-5" />
                الإشعارات
                {unreadCount > 0 && (
                  <Badge variant="secondary">{unreadCount}</Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleMarkAllAsRead}
                    className="text-xs"
                  >
                    قراءة الكل
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-0">
            <ScrollArea className="h-96">
              {filteredNotifications.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  <BellOff className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>لا توجد إشعارات</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 border-r-4 cursor-pointer hover:bg-muted/50 transition-colors group ${
                        !notification.read ? 'font-medium' : 'opacity-75'
                      } ${getStatusColorClasses(notification)}`}
                      onClick={() => handleMarkAsRead(notification.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-1">
                          {getNotificationIcon(notification.type, notification.priority)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h4 className={`text-sm font-medium ${
                            !notification.read ? 'text-foreground' : 'text-muted-foreground'
                          }`}>
                            {notification.title}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {formatDistanceToNow(new Date(notification.created_at), {
                              addSuffix: true,
                              locale: ar
                            })}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          {!notification.read && (
                            <div className="w-2 h-2 bg-primary rounded-full"></div>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteNotification(notification.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 hover:text-destructive"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default NotificationsPanel;