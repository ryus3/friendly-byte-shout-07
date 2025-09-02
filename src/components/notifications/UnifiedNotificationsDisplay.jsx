import React, { useMemo } from 'react';
import { Eye, Trash2, Bell, CheckCircle, Package, Users, TrendingUp, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNowStrict } from 'date-fns';
import { ar } from 'date-fns/locale';
import ScrollingText from '@/components/ui/scrolling-text';
import { getStatusForComponent } from '@/lib/order-status-translator';

// أيقونات مخصصة للإشعارات
const StockWarningIcon = () => (
  <svg className="w-4 h-4 md:w-5 md:h-5" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="4" width="18" height="16" rx="2" className="fill-orange-50 stroke-orange-500" strokeWidth="1.5"/>
    <path d="M8 10v4M12 8v6M16 12v2" className="stroke-orange-600" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const OrderSuccessIcon = () => (
  <svg className="w-4 h-4 md:w-5 md:h-5" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" className="fill-green-50 stroke-green-500" strokeWidth="1.5"/>
    <path d="M9 12l2 2 4-4" className="stroke-green-600" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const UserRegistrationIcon = () => (
  <svg className="w-4 h-4 md:w-5 md:h-5" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="8" r="3" className="fill-purple-50 stroke-purple-500" strokeWidth="1.5"/>
    <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" className="fill-purple-50 stroke-purple-500" strokeWidth="1.5"/>
  </svg>
);

const OrderIcon = () => (
  <svg className="w-4 h-4 md:w-5 md:h-5" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" className="fill-blue-50 stroke-blue-500" strokeWidth="1.5"/>
    <circle cx="9" cy="9" r="2" className="fill-blue-200"/>
  </svg>
);

const SystemIcon = () => (
  <svg className="w-4 h-4 md:w-5 md:h-5" viewBox="0 0 24 24" fill="none">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" className="fill-primary/10 stroke-primary" strokeWidth="1.5"/>
  </svg>
);

// خريطة الأيقونات
const iconMap = {
  low_stock: <StockWarningIcon />,
  stock_warning: <StockWarningIcon />,
  order_completed: <OrderSuccessIcon />,
  order_status_update: <OrderIcon />,
  alwaseet_status_change: <OrderIcon />,
  new_order: <OrderIcon />,
  new_registration: <UserRegistrationIcon />,
  system: <SystemIcon />,
  AlertTriangle: <StockWarningIcon />,
  Package: <StockWarningIcon />,
  CheckCircle: <OrderSuccessIcon />,
  UserPlus: <UserRegistrationIcon />,
  Bot: <SystemIcon />,
  Bell: <SystemIcon />,
};

// الألوان حسب النوع
const typeColorMap = {
  order_status_update: {
    bg: "bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/50",
    border: "border-blue-200 dark:border-blue-800",
    text: "text-blue-900 dark:text-blue-100",
    icon: "text-blue-600 dark:text-blue-400",
    dot: "bg-blue-500"
  },
  alwaseet_status_change: {
    bg: "bg-gradient-to-r from-indigo-50 to-indigo-100 dark:from-indigo-950/50 dark:to-indigo-900/50",
    border: "border-indigo-200 dark:border-indigo-800",
    text: "text-indigo-900 dark:text-indigo-100",
    icon: "text-indigo-600 dark:text-indigo-400",
    dot: "bg-indigo-500"
  },
  low_stock: {
    bg: "bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-950/50 dark:to-orange-900/50",
    border: "border-orange-200 dark:border-orange-800",
    text: "text-orange-900 dark:text-orange-100",
    icon: "text-orange-600 dark:text-orange-400",
    dot: "bg-orange-500"
  },
  order_completed: {
    bg: "bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/50",
    border: "border-green-200 dark:border-green-800",
    text: "text-green-900 dark:text-green-100",
    icon: "text-green-600 dark:text-green-400",
    dot: "bg-green-500"
  },
  new_registration: {
    bg: "bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950/50 dark:to-purple-900/50",
    border: "border-purple-200 dark:border-purple-800",
    text: "text-purple-900 dark:text-purple-100",
    icon: "text-purple-600 dark:text-purple-400",
    dot: "bg-purple-500"
  },
  ai_order: {
    bg: "bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-950/50 dark:to-emerald-900/50",
    border: "border-emerald-200 dark:border-emerald-800",
    text: "text-emerald-900 dark:text-emerald-100",
    icon: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500"
  },
  default: {
    bg: "bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-700/50",
    border: "border-gray-200 dark:border-gray-700",
    text: "text-gray-900 dark:text-gray-100",
    icon: "text-gray-600 dark:text-gray-400",
    dot: "bg-gray-500"
  }
};

// دالة تنسيق الوقت النسبي
const formatRelativeTime = (dateString) => {
  try {
    return formatDistanceToNowStrict(new Date(dateString), { addSuffix: true, locale: ar });
  } catch (error) {
    return 'منذ فترة';
  }
};

// دالة استخراج معلومات من رسالة الوسيط
const parseAlwaseetStateIdFromMessage = (message) => {
  if (!message) return null;
  const match = message.match(/\b(\d+)\s*(في\s*مخزن|تم\s*التسليم|قيد\s*التوصيل|تم\s*الإرجاع|لا\s*يرد|الغاء|رفض)/i);
  return match ? match[1] : null;
};

const parseTrackingFromMessage = (message) => {
  if (!message) return null;
  const match = message.match(/^(\d+)\s/);
  return match ? match[1] : null;
};

// دالة معالجة عرض الإشعار
const processNotificationDisplay = (notification) => {
  // للإشعارات من الوسيط
  if (notification.type === 'alwaseet_status_change' || notification.type === 'order_status_update') {
    const stateId = notification.data?.state_id || notification.data?.delivery_status || parseAlwaseetStateIdFromMessage(notification.message);
    const trackingNumber = notification.data?.tracking_number || parseTrackingFromMessage(notification.message);
    
    if (stateId && trackingNumber) {
      const statusConfig = getStatusForComponent({
        tracking_number: trackingNumber,
        delivery_status: stateId,
        state_id: stateId,
        delivery_partner: 'alwaseet'
      });
      
      return {
        ...notification,
        displayMessage: `${trackingNumber} ${statusConfig.label}`,
        displayTitle: notification.title || 'تحديث حالة الطلب'
      };
    }
  }
  
  // للإشعارات العادية
  return {
    ...notification,
    displayMessage: notification.message,
    displayTitle: notification.title
  };
};

const UnifiedNotificationsDisplay = ({ 
  notifications = [], 
  onMarkAsRead, 
  onDelete, 
  onMarkAllAsRead, 
  onClearAll,
  isDropdown = false,
  className = "" 
}) => {
  
  // معالجة الإشعارات لعرض صحيح
  const processedNotifications = useMemo(() => {
    return notifications.map(processNotificationDisplay);
  }, [notifications]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // عرض مكثف للقائمة المنسدلة
  if (isDropdown) {
    return (
      <div className={cn("space-y-2 max-h-96 overflow-auto", className)}>
        {processedNotifications.length > 0 ? (
          processedNotifications.slice(0, 10).map((notification) => {
            const colors = typeColorMap[notification.type] || typeColorMap.default;
            
            return (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg transition-all duration-200 hover:shadow-md cursor-pointer",
                  colors.bg,
                  colors.border,
                  "border",
                  !notification.is_read && "shadow-md"
                )}
              >
                <div className={cn("flex-shrink-0 mt-1", colors.icon)}>
                  {iconMap[notification.type] || iconMap[notification.icon] || iconMap.Bell}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className={cn("font-medium text-sm truncate", colors.text)}>
                      {notification.displayTitle}
                    </h4>
                    {!notification.is_read && (
                      <div className={cn("w-2 h-2 rounded-full animate-pulse", colors.dot)} />
                    )}
                  </div>
                  
                  <div className="text-xs text-muted-foreground mb-1 max-w-[200px]">
                    <ScrollingText text={notification.displayMessage} maxWidth="200px" />
                  </div>
                  
                  <p className="text-xs text-muted-foreground/70">
                    {formatRelativeTime(notification.created_at)}
                  </p>
                </div>
                
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!notification.is_read && onMarkAsRead && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMarkAsRead(notification.id);
                      }}
                    >
                      <Eye className="w-3 h-3" />
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(notification.id);
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </motion.div>
            );
          })
        ) : (
          <div className="text-center py-8">
            <Bell className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground">لا توجد إشعارات</p>
          </div>
        )}
        
        {processedNotifications.length > 10 && (
          <div className="text-center pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              و {processedNotifications.length - 10} إشعار أخرى...
            </p>
          </div>
        )}
      </div>
    );
  }

  // عرض كامل للصفحة
  return (
    <div className={cn("space-y-4", className)}>
      {/* أزرار الإجراءات */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="px-3 py-1">
            {unreadCount} غير مقروء
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {onMarkAllAsRead && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onMarkAllAsRead} 
              disabled={unreadCount === 0}
              className="text-xs sm:text-sm"
            >
              <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 ml-1" />
              <span className="hidden sm:inline">تحديد الكل كمقروء</span>
              <span className="sm:hidden">قراءة الكل</span>
            </Button>
          )}
          {onClearAll && (
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={onClearAll} 
              disabled={notifications.length === 0}
              className="text-xs sm:text-sm"
            >
              <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 ml-1" />
              <span className="hidden sm:inline">حذف الكل</span>
              <span className="sm:hidden">حذف</span>
            </Button>
          )}
        </div>
      </div>

      {/* قائمة الإشعارات */}
      <AnimatePresence>
        {processedNotifications.length > 0 ? (
          <div className="space-y-3">
            {processedNotifications.map((notification) => {
              const colors = typeColorMap[notification.type] || typeColorMap.default;
              
              return (
                <motion.div
                  key={notification.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className={cn(
                    "p-4 rounded-lg border transition-all duration-200 hover:shadow-md",
                    colors.bg,
                    colors.border,
                    !notification.is_read && "shadow-md"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={cn("mt-1 flex-shrink-0", colors.icon)}>
                        {iconMap[notification.type] || iconMap[notification.icon] || iconMap.Bell}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={cn(
                            "font-semibold text-sm md:text-base truncate",
                            colors.text,
                            !notification.is_read && "font-bold"
                          )}>
                            {notification.displayTitle}
                          </h3>
                          {!notification.is_read && (
                            <div className={cn("w-2 h-2 rounded-full animate-pulse flex-shrink-0", colors.dot)} />
                          )}
                        </div>
                        
                        <div className="text-xs md:text-sm text-muted-foreground mb-2">
                          <ScrollingText text={notification.displayMessage} maxWidth="400px" />
                        </div>
                        
                        <p className="text-xs text-muted-foreground/70">
                          {formatRelativeTime(notification.created_at)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 flex-shrink-0">
                      {!notification.is_read && onMarkAsRead && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onMarkAsRead(notification.id)}
                          title="تحديد كمقروء"
                          className="h-8 w-8 sm:h-10 sm:w-10"
                        >
                          <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDelete(notification.id)}
                          title="حذف الإشعار"
                          className="text-destructive hover:text-destructive h-8 w-8 sm:h-10 sm:w-10"
                        >
                          <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <Bell className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">لا توجد إشعارات</h3>
            <p className="text-muted-foreground">لم يتم العثور على أي إشعارات</p>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default UnifiedNotificationsDisplay;