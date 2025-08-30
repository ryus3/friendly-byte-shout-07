import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Bell, BellOff, Trash2, Check, CheckCheck, X, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUnifiedNotifications } from '@/contexts/UnifiedNotificationsContext';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

const UnifiedNotificationsDisplay = () => {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications
  } = useUnifiedNotifications();
  
  const [isOpen, setIsOpen] = useState(false);

  const getNotificationIcon = (type) => {
    const iconMap = {
      order_created: '🛍️',
      order_updated: '📦',
      low_stock: '⚠️',
      alwaseet_status_change: '🚚',
      settlement_request: '💰',
      employee_registration: '👤',
      system_alert: '🔔'
    };
    return iconMap[type] || '🔔';
  };

  const getNotificationColors = (type, priority = 'normal') => {
    const colorMap = {
      order_created: {
        bg: 'from-green-50 to-emerald-100 dark:from-green-900/20 dark:to-emerald-800/20',
        border: 'border-green-200 dark:border-green-700',
        text: 'text-green-700 dark:text-green-300',
        dot: 'bg-green-500'
      },
      order_updated: {
        bg: 'from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20',
        border: 'border-blue-200 dark:border-blue-700',
        text: 'text-blue-700 dark:text-blue-300',
        dot: 'bg-blue-500'
      },
      low_stock: {
        bg: 'from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20',
        border: 'border-red-200 dark:border-red-700',
        text: 'text-red-700 dark:text-red-300',
        dot: 'bg-red-500'
      },
      alwaseet_status_change: {
        bg: 'from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20',
        border: 'border-purple-200 dark:border-purple-700',
        text: 'text-purple-700 dark:text-purple-300',
        dot: 'bg-purple-500'
      },
      settlement_request: {
        bg: 'from-amber-50 to-yellow-100 dark:from-amber-900/20 dark:to-yellow-800/20',
        border: 'border-amber-200 dark:border-yellow-700',
        text: 'text-amber-700 dark:text-yellow-300',
        dot: 'bg-amber-500'
      },
      default: {
        bg: 'from-gray-50 to-gray-100 dark:from-gray-900/20 dark:to-gray-800/20',
        border: 'border-gray-200 dark:border-gray-700',
        text: 'text-gray-700 dark:text-gray-300',
        dot: 'bg-gray-500'
      }
    };

    return colorMap[type] || colorMap.default;
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }
  };

  const handleDeleteNotification = async (e, notificationId) => {
    e.stopPropagation();
    await deleteNotification(notificationId);
  };

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative transition-all duration-300 hover:scale-110",
          isOpen && "bg-primary/10 text-primary"
        )}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-red-500 to-red-600 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </motion.div>
        )}
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 mt-2 w-80 sm:w-96 z-50"
          >
            <Card className="shadow-xl border-border/50 bg-background/95 backdrop-blur-lg">
              <CardContent className="p-0">
                {/* Header */}
                <div className="p-4 border-b border-border/50 bg-gradient-to-r from-primary/5 to-primary/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold text-foreground">الإشعارات</h3>
                      {unreadCount > 0 && (
                        <Badge variant="secondary" className="bg-primary/20 text-primary">
                          {unreadCount} جديد
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {unreadCount > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={markAllAsRead}
                          className="text-xs hover:bg-primary/10"
                        >
                          <CheckCheck className="w-3 h-3 mr-1" />
                          قراءة الكل
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsOpen(false)}
                        className="h-8 w-8 hover:bg-muted/50"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Notifications List */}
                <ScrollArea className="max-h-96">
                  <div className="p-2">
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <BellOff className="w-12 h-12 text-muted-foreground/50 mb-3" />
                        <p className="text-muted-foreground text-sm">لا توجد إشعارات</p>
                      </div>
                    ) : (
                      <AnimatePresence mode="popLayout">
                        {notifications.map((notification, index) => {
                          const colors = getNotificationColors(notification.type, notification.priority);
                          return (
                            <motion.div
                              key={notification.id}
                              layout
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 20 }}
                              transition={{ delay: index * 0.05 }}
                              className={cn(
                                "group relative p-3 mb-2 rounded-lg cursor-pointer transition-all duration-300 hover:shadow-md",
                                `bg-gradient-to-r ${colors.bg}`,
                                `border ${colors.border}`,
                                !notification.read && "ring-1 ring-primary/20"
                              )}
                              onClick={() => handleNotificationClick(notification)}
                            >
                              {/* Notification Content */}
                              <div className="flex items-start gap-3">
                                {/* Icon and Unread Dot */}
                                <div className="relative flex-shrink-0">
                                  <div className="w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center text-sm shadow-sm">
                                    {getNotificationIcon(notification.type)}
                                  </div>
                                  {!notification.read && (
                                    <div className={cn("absolute -top-1 -right-1 w-3 h-3 rounded-full shadow-sm", colors.dot)}></div>
                                  )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <h4 className={cn("font-medium text-sm line-clamp-1", colors.text)}>
                                      {notification.title}
                                    </h4>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => handleDeleteNotification(e, notification.id)}
                                      className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 hover:bg-red-500/20 hover:text-red-600"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                    {notification.message}
                                  </p>
                                  <p className="text-xs text-muted-foreground/70 mt-2">
                                    {formatDistanceToNow(new Date(notification.created_at), {
                                      addSuffix: true,
                                      locale: ar
                                    })}
                                  </p>
                                </div>
                              </div>

                              {/* Background Decoration */}
                              <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -translate-y-8 translate-x-8 opacity-50"></div>
                              <div className="absolute bottom-0 left-0 w-12 h-12 bg-white/5 rounded-full translate-y-6 -translate-x-6 opacity-50"></div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    )}
                  </div>
                </ScrollArea>

                {/* Footer */}
                {notifications.length > 0 && (
                  <div className="p-3 border-t border-border/50 bg-muted/20">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearAllNotifications}
                      className="w-full text-xs hover:bg-red-500/10 hover:text-red-600 hover:border-red-200"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      مسح جميع الإشعارات
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default UnifiedNotificationsDisplay;