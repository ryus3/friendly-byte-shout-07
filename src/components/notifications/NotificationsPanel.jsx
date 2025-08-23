import React, { useState, useEffect } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useNotificationsSystem } from '@/contexts/NotificationsSystemContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, BellOff, Trash2, CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

/**
 * لوحة الإشعارات الأساسية
 */
const NotificationsPanel = ({ allowedTypes = [], canViewAll = false, className = "" }) => {
  const { hasPermission } = usePermissions();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification
  } = useNotificationsSystem();

  const [isOpen, setIsOpen] = useState(false);

  // فلترة الإشعارات حسب الأنواع المسموحة
  const filteredNotifications = notifications.filter(notification => {
    if (allowedTypes.length === 0) return true;
    return allowedTypes.includes(notification.type);
  });

  // أيقونات الإشعارات مع ألوان حسب الحالة
  const getNotificationIcon = (notification) => {
    const iconProps = { className: "w-4 h-4" };
    
    // إشعارات تغيير حالة الطلب
    if (notification.type === 'order_status_changed') {
      const status = notification.data?.new_status || '';
      const message = notification.message || '';
      
      if (status === 'delivered' || message.includes('تم التسليم')) {
        return <CheckCircle {...iconProps} className="w-4 h-4 text-green-600" />;
      }
      if (status === 'out for delivery' || message.includes('في الطريق') || message.includes('خرج للتوصيل')) {
        return <Info {...iconProps} className="w-4 h-4 text-blue-600" />;
      }
      if (status === 'rejected' || status === 'canceled' || message.includes('رفض') || message.includes('ملغي')) {
        return <X {...iconProps} className="w-4 h-4 text-red-600" />;
      }
      if (message.includes('تأخير') || message.includes('إرجاع') || status === 'delayed' || status === 'returned') {
        return <AlertCircle {...iconProps} className="w-4 h-4 text-orange-600" />;
      }
    }
    
    // أيقونات افتراضية
    switch (notification.type) {
      case 'success':
        return <CheckCircle {...iconProps} className="w-4 h-4 text-green-500" />;
      case 'warning':
        return <AlertCircle {...iconProps} className="w-4 h-4 text-yellow-500" />;
      case 'error':
        return <X {...iconProps} className="w-4 h-4 text-red-500" />;
      default:
        return <Info {...iconProps} className="w-4 h-4 text-blue-500" />;
    }
  };

  // ألوان حسب نوع ووصف الإشعار
  const getNotificationStatusColor = (notification) => {
    // إشعارات تغيير حالة الطلب
    if (notification.type === 'order_status_changed') {
      const status = notification.data?.new_status || '';
      const message = notification.message || '';
      
      // تم التسليم - أخضر
      if (status === 'delivered' || message.includes('تم التسليم')) {
        return 'border-green-500 bg-green-50 dark:bg-green-950/30';
      }
      // في الطريق/خرج للتوصيل - أزرق
      if (status === 'out for delivery' || message.includes('في الطريق') || message.includes('خرج للتوصيل')) {
        return 'border-blue-500 bg-blue-50 dark:bg-blue-950/30';
      }
      // رفض/إلغاء - أحمر
      if (status === 'rejected' || status === 'canceled' || message.includes('رفض') || message.includes('ملغي')) {
        return 'border-red-500 bg-red-50 dark:bg-red-950/30';
      }
      // تأخير/إرجاع - برتقالي
      if (message.includes('تأخير') || message.includes('إرجاع') || status === 'delayed' || status === 'returned') {
        return 'border-orange-500 bg-orange-50 dark:bg-orange-950/30';
      }
    }
    
    // ألوان الأولوية الافتراضية للإشعارات الأخرى
    switch (notification.priority) {
      case 'high':
        return 'border-red-500 bg-red-50 dark:bg-red-950/30';
      case 'medium':
        return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30';
      default:
        return 'border-gray-200 bg-gray-50 dark:bg-gray-950/30';
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      await markAsRead(notificationId);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const handleDeleteNotification = async (notificationId) => {
    try {
      await deleteNotification(notificationId);
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* زر الإشعارات */}
      <Button
        variant="ghost"
        size="sm"
        className="relative"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-2 -right-2 px-1 min-w-[1.2rem] h-5 text-xs"
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
                      className={`p-4 border-r-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                        !notification.read ? 'bg-primary/5' : ''
                      } ${getNotificationStatusColor(notification)}`}
                      onClick={() => handleMarkAsRead(notification.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-1">
                          {getNotificationIcon(notification)}
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