import React, { useState, useEffect, useRef } from 'react';
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
  const [swipeState, setSwipeState] = useState({ isDragging: false, startY: 0, currentY: 0 });
  const panelRef = useRef(null);

  // فلترة الإشعارات حسب الأنواع المسموحة
  const filteredNotifications = notifications.filter(notification => {
    if (allowedTypes.length === 0) return true;
    return allowedTypes.includes(notification.type);
  });

  // دالة الحصول على ألوان إشعارات الوسيط حسب state_id
  const getAlWaseetNotificationColors = (stateId) => {
    console.log('🎨 تطبيق لون حسب state_id:', stateId);
    
    switch (String(stateId)) {
      case '2': // تم الاستلام من قبل المندوب
        return {
          bg: 'bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30',
          border: 'border-r-blue-500',
          text: 'text-blue-800 dark:text-blue-200',
          icon: 'text-blue-600',
          dot: 'bg-blue-500'
        };
      case '4': // تم التسليم بنجاح
        return {
          bg: 'bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/30',
          border: 'border-r-green-500',
          text: 'text-green-800 dark:text-green-200',
          icon: 'text-green-600',
          dot: 'bg-green-500'
        };
      case '17': // تم الإرجاع
        return {
          bg: 'bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/30',
          border: 'border-r-orange-500',
          text: 'text-orange-800 dark:text-orange-200',
          icon: 'text-orange-600',
          dot: 'bg-orange-500'
        };
      case '25':
      case '26': // العميل لا يرد
        return {
          bg: 'bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-950/30 dark:to-yellow-900/30',
          border: 'border-r-yellow-500',
          text: 'text-yellow-800 dark:text-yellow-200',
          icon: 'text-yellow-600',
          dot: 'bg-yellow-500'
        };
      case '31':
      case '32': // تم الإلغاء
        return {
          bg: 'bg-gradient-to-r from-red-50 to-red-100 dark:from-red-950/30 dark:to-red-900/30',
          border: 'border-r-red-500',
          text: 'text-red-800 dark:text-red-200',
          icon: 'text-red-600',
          dot: 'bg-red-500'
        };
      default:
        return {
          bg: 'bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-950/30 dark:to-gray-900/30',
          border: 'border-r-gray-400',
          text: 'text-gray-800 dark:text-gray-200',
          icon: 'text-gray-600',
          dot: 'bg-gray-400'
        };
    }
  };

  // أيقونات الإشعارات مع الألوان
  const getNotificationIcon = (notification) => {
    const iconProps = { className: "w-4 h-4" };
    
    // للإشعارات من نوع alwaseet_status_change، استخدم الألوان المخصصة
    if (notification.type === 'alwaseet_status_change') {
      // استخراج state_id من عدة مصادر
      let stateId = notification.data?.state_id || 
                   notification.data?.order_status || 
                   notification.data?.new_status;
      
      console.log('🔍 استخراج state_id من الإشعار:', { 
        stateId, 
        data: notification.data, 
        message: notification.message 
      });
      
      // إذا لم توجد، جرب استخراج state_id من النص (للإشعارات القديمة)
      if (!stateId && notification.message) {
        // استخراج state_id من النص بناءً على نوع الرسالة
        if (notification.message.includes('تم الاستلام من قبل المندوب')) {
          stateId = '2';
        } else if (notification.message.includes('تم التسليم بنجاح')) {
          stateId = '4';
        } else if (notification.message.includes('تم الإرجاع')) {
          stateId = '17';
        } else if (notification.message.includes('العميل لا يرد')) {
          stateId = '25';
        } else if (notification.message.includes('تم الإلغاء')) {
          stateId = '31';
        }
        
        console.log('🔍 state_id المستخرج من النص:', stateId);
      }
      
      if (stateId) {
        const colors = getAlWaseetNotificationColors(stateId);
        console.log('🎨 تطبيق أيقونة ملونة:', { stateId, colors });
        return <Info {...iconProps} className={`w-4 h-4 ${colors.icon}`} />;
      }
    }
    
    // الأيقونات العادية للأنواع الأخرى
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

  // ألوان الإشعار الكاملة
  const getNotificationStyles = (notification) => {
    // للإشعارات من نوع alwaseet_status_change، استخدم الألوان المخصصة
    if (notification.type === 'alwaseet_status_change') {
      // استخراج state_id من عدة مصادر
      let stateId = notification.data?.state_id || 
                   notification.data?.order_status || 
                   notification.data?.new_status;
      
      console.log('🔍 استخراج state_id من الإشعار للألوان:', { 
        stateId, 
        data: notification.data, 
        message: notification.message 
      });
      
      // إذا لم توجد، جرب استخراج state_id من النص (للإشعارات القديمة)
      if (!stateId && notification.message) {
        // استخراج state_id من النص بناءً على نوع الرسالة
        if (notification.message.includes('تم الاستلام من قبل المندوب')) {
          stateId = '2';
        } else if (notification.message.includes('تم التسليم بنجاح')) {
          stateId = '4';
        } else if (notification.message.includes('تم الإرجاع')) {
          stateId = '17';
        } else if (notification.message.includes('العميل لا يرد')) {
          stateId = '25';
        } else if (notification.message.includes('تم الإلغاء')) {
          stateId = '31';
        }
        
        console.log('🔍 state_id المستخرج من النص للألوان:', stateId);
      }
      
      if (stateId) {
        const colors = getAlWaseetNotificationColors(stateId);
        console.log('🎨 تطبيق ألوان الوسيط للإشعار:', { stateId, colors, message: notification.message });
        return colors;
      }
    }
    
    // الألوان العادية للأنواع الأخرى
    switch (notification.priority) {
      case 'high':
        return {
          bg: 'bg-gradient-to-r from-red-50 to-red-100 dark:from-red-950/30 dark:to-red-900/30',
          border: 'border-r-red-500',
          text: 'text-red-800 dark:text-red-200',
          icon: 'text-red-600',
          dot: 'bg-red-500'
        };
      case 'medium':
        return {
          bg: 'bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-950/30 dark:to-yellow-900/30',
          border: 'border-r-yellow-500',
          text: 'text-yellow-800 dark:text-yellow-200',
          icon: 'text-yellow-600',
          dot: 'bg-yellow-500'
        };
      default:
        return {
          bg: 'bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-950/30 dark:to-gray-900/30',
          border: 'border-r-gray-400',
          text: 'text-gray-800 dark:text-gray-200',
          icon: 'text-gray-600',
          dot: 'bg-gray-400'
        };
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

  // معالجة السحب لإغلاق اللوحة
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    setSwipeState({
      isDragging: true,
      startY: touch.clientY,
      currentY: touch.clientY
    });
  };

  const handleTouchMove = (e) => {
    if (!swipeState.isDragging) return;
    
    const touch = e.touches[0];
    const deltaY = touch.clientY - swipeState.startY;
    const deltaX = Math.abs(touch.clientX - swipeState.startX || 0);
    
    // السماح بالسحب في أي اتجاه مع عتبة معقولة
    if (Math.abs(deltaY) > 30 || deltaX > 30) {
      setIsOpen(false);
      setSwipeState({ isDragging: false, startY: 0, currentY: 0 });
    }
    
    setSwipeState(prev => ({ ...prev, currentY: touch.clientY }));
  };

  const handleTouchEnd = () => {
    if (!swipeState.isDragging) return;
    
    const deltaY = Math.abs(swipeState.currentY - swipeState.startY);
    
    // إغلاق اللوحة إذا كان السحب كافياً
    if (deltaY > 50) {
      setIsOpen(false);
    }
    
    setSwipeState({ isDragging: false, startY: 0, currentY: 0 });
  };

  // معالجة السحب بالماوس أيضاً
  const handleMouseDown = (e) => {
    setSwipeState({
      isDragging: true,
      startY: e.clientY,
      currentY: e.clientY
    });
  };

  const handleMouseMove = (e) => {
    if (!swipeState.isDragging) return;
    
    const deltaY = Math.abs(e.clientY - swipeState.startY);
    const deltaX = Math.abs(e.clientX - swipeState.startX || 0);
    
    if (deltaY > 30 || deltaX > 30) {
      setIsOpen(false);
      setSwipeState({ isDragging: false, startY: 0, currentY: 0 });
    }
    
    setSwipeState(prev => ({ ...prev, currentY: e.clientY }));
  };

  const handleMouseUp = () => {
    if (!swipeState.isDragging) return;
    
    const deltaY = Math.abs(swipeState.currentY - swipeState.startY);
    
    if (deltaY > 50) {
      setIsOpen(false);
    }
    
    setSwipeState({ isDragging: false, startY: 0, currentY: 0 });
  };

  // إضافة event listeners للماوس
  useEffect(() => {
    if (swipeState.isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [swipeState.isDragging]);

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
        <Card 
          ref={panelRef}
          className={`absolute top-12 right-0 w-80 max-w-sm z-50 shadow-xl border border-border transition-all duration-200 ${
            swipeState.isDragging ? 'opacity-80 scale-95' : ''
          }`}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
        >
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
                  {filteredNotifications.map((notification) => {
                    const styles = getNotificationStyles(notification);
                    
                    return (
                      <div
                        key={notification.id}
                        className={`p-4 border-r-4 cursor-pointer hover:opacity-80 transition-all duration-200 ${
                          !notification.read ? 'shadow-sm' : ''
                        } ${styles.bg} ${styles.border}`}
                        onClick={() => handleMarkAsRead(notification.id)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-1">
                            {getNotificationIcon(notification)}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <h4 className={`text-sm font-medium ${
                              !notification.read ? styles.text : 'text-muted-foreground'
                            }`}>
                              {notification.title}
                            </h4>
                            <p className={`text-xs mt-1 line-clamp-2 ${
                              !notification.read ? styles.text : 'text-muted-foreground'
                            }`}>
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
                              <div className={`w-2 h-2 rounded-full ${styles.dot}`}></div>
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
                    );
                  })}
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