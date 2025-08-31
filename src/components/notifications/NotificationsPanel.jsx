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
import { getStatusConfig } from '@/lib/alwaseet-statuses';
import { useNavigate } from 'react-router-dom';

/**
 * لوحة الإشعارات الأساسية
 */
const NotificationsPanel = ({ allowedTypes = [], canViewAll = false, className = "" }) => {
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
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

  // دالة موحدة للحصول على النص والألوان من مصدر واحد
  const getUnifiedNotificationDisplay = (notification) => {
    // للإشعارات من نوع alwaseet_status_change
    if (notification.type === 'alwaseet_status_change') {
      const stateId = notification.data?.state_id || notification.data?.delivery_status;
      const trackingNumber = notification.data?.tracking_number || notification.data?.order_number || 'غير محدد';
      
      if (stateId) {
        const statusConfig = getStatusConfig(stateId);
        const StatusIcon = statusConfig.icon;
        
        // تحويل ألوان CSS إلى نمط الإشعارات
        const colorClasses = statusConfig.color;
        let colors = {
          bg: 'bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-950/30 dark:to-gray-900/30',
          border: 'border-r-gray-400',
          text: 'text-gray-800 dark:text-gray-200',
          icon: 'text-gray-600',
          dot: 'bg-gray-400'
        };
        
        // استخراج اللون الأساسي من التدرج
        if (colorClasses.includes('green')) {
          colors = {
            bg: 'bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950/30 dark:to-green-900/30',
            border: 'border-r-green-500',
            text: 'text-green-800 dark:text-green-200',
            icon: 'text-green-600',
            dot: 'bg-green-500'
          };
        } else if (colorClasses.includes('blue')) {
          colors = {
            bg: 'bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950/30 dark:to-blue-900/30',
            border: 'border-r-blue-500',
            text: 'text-blue-800 dark:text-blue-200',
            icon: 'text-blue-600',
            dot: 'bg-blue-500'
          };
        } else if (colorClasses.includes('orange') || colorClasses.includes('amber')) {
          colors = {
            bg: 'bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-950/30 dark:to-orange-900/30',
            border: 'border-r-orange-500',
            text: 'text-orange-800 dark:text-orange-200',
            icon: 'text-orange-600',
            dot: 'bg-orange-500'
          };
        } else if (colorClasses.includes('yellow')) {
          colors = {
            bg: 'bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-950/30 dark:to-yellow-900/30',
            border: 'border-r-yellow-500',
            text: 'text-yellow-800 dark:text-yellow-200',
            icon: 'text-yellow-600',
            dot: 'bg-yellow-500'
          };
        } else if (colorClasses.includes('red') || colorClasses.includes('rose')) {
          colors = {
            bg: 'bg-gradient-to-r from-red-50 to-red-100 dark:from-red-950/30 dark:to-red-900/30',
            border: 'border-r-red-500',
            text: 'text-red-800 dark:text-red-200',
            icon: 'text-red-600',
            dot: 'bg-red-500'
          };
        }
        
        return {
          text: `${statusConfig.text} ${trackingNumber}`,
          icon: <StatusIcon className={`w-4 h-4 ${colors.icon}`} />,
          colors
        };
      }
    }
    
    // للأنواع الأخرى، استخدم النظام القديم
    return {
      text: notification.message,
      icon: getStandardNotificationIcon(notification),
      colors: getStandardNotificationColors(notification)
    };
  };

  // الأيقونات العادية للأنواع الأخرى
  const getStandardNotificationIcon = (notification) => {
    const iconProps = { className: "w-4 h-4" };
    
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

  // ألوان عادية للأنواع الأخرى
  const getStandardNotificationColors = (notification) => {
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

  // التنقل الذكي عند النقر على الإشعار
  const handleNotificationClick = async (notification) => {
    // وضع علامة كمقروء
    await handleMarkAsRead(notification.id);
    
    // إغلاق لوحة الإشعارات
    setIsOpen(false);
    
    // التنقل حسب نوع الإشعار
    switch (notification.type) {
      case 'alwaseet_status_change':
        // الانتقال لصفحة متابعة الطلبات مع تمرير معرف الطلب
        const orderId = notification.data?.order_id;
        if (orderId) {
          navigate(`/orders?highlight=${orderId}`);
        }
        break;
        
      case 'low_stock':
        // الانتقال لصفحة المخزون مع فلترة المنتج
        const productId = notification.data?.product_id;
        if (productId) {
          navigate(`/inventory?filter=${productId}`);
        } else {
          navigate('/inventory');
        }
        break;
        
      case 'new_order':
        // الانتقال لصفحة الطلبات
        navigate('/orders');
        break;
        
      case 'profit_settlement':
        // الانتقال لصفحة الأرباح
        navigate('/profits');
        break;
        
      case 'employee_registration':
        // الانتقال لصفحة إدارة الموظفين
        navigate('/manage-employees');
        break;
        
      default:
        // للأنواع الأخرى، الانتقال للوحة التحكم
        navigate('/');
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

  // معالجة السحب لإغلاق اللوحة في جميع الاتجاهات
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    setSwipeState({
      isDragging: true,
      startY: touch.clientY,
      startX: touch.clientX,
      currentY: touch.clientY,
      currentX: touch.clientX
    });
  };

  const handleTouchMove = (e) => {
    if (!swipeState.isDragging) return;
    
    const touch = e.touches[0];
    const deltaY = Math.abs(touch.clientY - swipeState.startY);
    const deltaX = Math.abs(touch.clientX - swipeState.startX);
    
    // عتبة منخفضة للسحب السريع في أي اتجاه
    const threshold = 25;
    if (deltaY > threshold || deltaX > threshold) {
      setIsOpen(false);
      setSwipeState({ isDragging: false, startY: 0, currentY: 0, startX: 0, currentX: 0 });
      return;
    }
    
    setSwipeState(prev => ({ 
      ...prev, 
      currentY: touch.clientY,
      currentX: touch.clientX 
    }));
  };

  const handleTouchEnd = () => {
    if (!swipeState.isDragging) return;
    
    const deltaY = Math.abs(swipeState.currentY - swipeState.startY);
    const deltaX = Math.abs(swipeState.currentX - swipeState.startX);
    
    // إغلاق اللوحة إذا كان السحب كافياً في أي اتجاه
    if (deltaY > 30 || deltaX > 30) {
      setIsOpen(false);
    }
    
    setSwipeState({ isDragging: false, startY: 0, currentY: 0, startX: 0, currentX: 0 });
  };

  // معالجة السحب بالماوس مع دعم جميع الاتجاهات
  const handleMouseDown = (e) => {
    // منع السحب إذا كان الضغط على الأزرار أو النصوص
    if (e.target.closest('button') || e.target.closest('a')) return;
    
    setSwipeState({
      isDragging: true,
      startY: e.clientY,
      startX: e.clientX,
      currentY: e.clientY,
      currentX: e.clientX
    });
  };

  const handleMouseMove = (e) => {
    if (!swipeState.isDragging) return;
    
    const deltaY = Math.abs(e.clientY - swipeState.startY);
    const deltaX = Math.abs(e.clientX - swipeState.startX);
    
    // عتبة منخفضة للسحب السريع
    const threshold = 25;
    if (deltaY > threshold || deltaX > threshold) {
      setIsOpen(false);
      setSwipeState({ isDragging: false, startY: 0, currentY: 0, startX: 0, currentX: 0 });
    }
    
    setSwipeState(prev => ({ 
      ...prev, 
      currentY: e.clientY,
      currentX: e.clientX 
    }));
  };

  const handleMouseUp = () => {
    if (!swipeState.isDragging) return;
    
    const deltaY = Math.abs(swipeState.currentY - swipeState.startY);
    const deltaX = Math.abs(swipeState.currentX - swipeState.startX);
    
    // إذا كان السحب كافي في أي اتجاه
    if (deltaY > 30 || deltaX > 30) {
      setIsOpen(false);
    }
    
    setSwipeState({ isDragging: false, startY: 0, currentY: 0, startX: 0, currentX: 0 });
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
                    const displayData = getUnifiedNotificationDisplay(notification);
                    
                    return (
                      <div
                        key={notification.id}
                        className={`p-4 border-r-4 cursor-pointer hover:opacity-80 transition-all duration-200 ${
                          !notification.is_read ? 'shadow-sm' : ''
                        } ${displayData.colors.bg} ${displayData.colors.border}`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-1">
                            {displayData.icon}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <h4 className={`text-sm font-medium ${
                              !notification.is_read ? displayData.colors.text : 'text-muted-foreground'
                            }`}>
                              {notification.title}
                            </h4>
                            <p className={`text-xs mt-1 line-clamp-2 ${
                              !notification.is_read ? displayData.colors.text : 'text-muted-foreground'
                            }`}>
                              {displayData.text}
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                              {formatDistanceToNow(new Date(notification.created_at), {
                                addSuffix: true,
                                locale: ar
                              })}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            {!notification.is_read && (
                              <div className={`w-2 h-2 rounded-full ${displayData.colors.dot}`}></div>
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