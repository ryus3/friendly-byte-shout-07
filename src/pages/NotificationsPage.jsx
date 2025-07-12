import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Bell, CheckCircle, Trash2, Filter, Volume2, VolumeX, Search, Eye, EyeOff, Settings, AlertTriangle, Package, Users, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useNotifications } from '@/contexts/NotificationsContext';
import { toast } from '@/components/ui/use-toast';
import { formatDistanceToNowStrict } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import NotificationSettingsDialog from '@/components/settings/NotificationSettingsDialog';

const iconMap = {
  AlertTriangle: <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-red-600" />,
  Package: <Package className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />,
  CheckCircle: <CheckCircle className="w-4 h-4 md:w-5 md:h-5 text-green-600" />,
  UserPlus: <Users className="w-4 h-4 md:w-5 md:h-5 text-purple-600" />,
  Bot: <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-indigo-600" />,
  Bell: <Bell className="w-4 h-4 md:w-5 md:h-5 text-primary" />,
};

const NotificationsPage = () => {
  const { notifications, markAsRead, markAllAsRead, clearAll, deleteNotification, addNotification } = useNotifications();
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const formatRelativeTime = (dateString) => {
    try {
      return formatDistanceToNowStrict(new Date(dateString), { addSuffix: true, locale: ar });
    } catch (error) {
      return 'منذ فترة';
    }
  };

  const filteredNotifications = notifications.filter(notification => {
    const matchesSearch = notification.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         notification.message.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'all' || 
                         (filter === 'unread' && !notification.is_read) ||
                         (filter === 'read' && notification.is_read);
    return matchesSearch && matchesFilter;
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleTestNotification = () => {
    const testTypes = [
      { type: 'info', title: 'إشعار تجريبي', message: 'هذا إشعار تجريبي لاختبار النظام', icon: 'Bell', color: 'blue' },
      { type: 'success', title: 'تم بنجاح', message: 'تم إتمام العملية بنجاح', icon: 'CheckCircle', color: 'green' },
      { type: 'warning', title: 'تنبيه مهم', message: 'يرجى الانتباه لهذا التنبيه', icon: 'AlertTriangle', color: 'orange' },
      { type: 'order', title: 'طلب جديد', message: 'تم استلام طلب جديد رقم #1234', icon: 'Package', color: 'blue' }
    ];
    
    const randomTest = testTypes[Math.floor(Math.random() * testTypes.length)];
    
    addNotification({
      ...randomTest,
      link: '#',
      auto_delete: false
    });

    if (soundEnabled) {
      // تشغيل صوت الإشعار
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmISBjiS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUE');
      audio.play().catch(() => {});
    }

    toast({
      title: "تم إرسال إشعار تجريبي",
      description: `نوع الإشعار: ${randomTest.title}`
    });
  };

  return (
    <>
      <Helmet>
        <title>إدارة الإشعارات - نظام إدارة المتجر</title>
      </Helmet>

      <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold gradient-text">إدارة الإشعارات</h1>
            <p className="text-muted-foreground text-sm md:text-base">إدارة وعرض جميع الإشعارات</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:gap-4">
            <Badge variant="secondary" className="px-2 md:px-3 py-1 text-xs md:text-sm">
              {unreadCount} غير مقروء
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSettingsOpen(true)}
              className="gap-1 md:gap-2 text-xs md:text-sm"
            >
              <Settings className="w-3 h-3 md:w-4 md:h-4" />
              <span className="hidden sm:inline">إعدادات الإشعارات</span>
              <span className="sm:hidden">إعدادات</span>
            </Button>
            <Button
              variant={soundEnabled ? "default" : "outline"}
              size="sm"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="gap-1 md:gap-2 text-xs md:text-sm"
            >
              {soundEnabled ? <Volume2 className="w-3 h-3 md:w-4 md:h-4" /> : <VolumeX className="w-3 h-3 md:w-4 md:h-4" />}
              <span className="hidden sm:inline">الصوت {soundEnabled ? 'مفعل' : 'معطل'}</span>
              <span className="sm:hidden">{soundEnabled ? '🔊' : '🔇'}</span>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <Card className="glass-effect">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm md:text-lg">إجمالي الإشعارات</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold text-primary">{notifications.length}</div>
            </CardContent>
          </Card>

          <Card className="glass-effect">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm md:text-lg">غير مقروءة</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold text-amber-600">{unreadCount}</div>
            </CardContent>
          </Card>

          <Card className="glass-effect col-span-2 md:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm md:text-lg">مقروءة</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold text-green-600">{notifications.length - unreadCount}</div>
            </CardContent>
          </Card>

          <Card className="glass-effect col-span-2 md:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm md:text-lg">الحالة</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs md:text-sm text-primary font-medium">النظام يعمل بكفاءة</div>
            </CardContent>
          </Card>
        </div>

        <Card className="glass-effect">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  قائمة الإشعارات
                </CardTitle>
                <CardDescription>إدارة وعرض جميع الإشعارات</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={markAllAsRead} disabled={unreadCount === 0} className="text-xs sm:text-sm">
                  <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 ml-1" />
                  <span className="hidden sm:inline">تحديد الكل كمقروء</span>
                  <span className="sm:hidden">قراءة الكل</span>
                </Button>
                <Button variant="destructive" size="sm" onClick={clearAll} disabled={notifications.length === 0} className="text-xs sm:text-sm">
                  <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 ml-1" />
                  <span className="hidden sm:inline">حذف الكل</span>
                  <span className="sm:hidden">حذف</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="البحث في الإشعارات..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10 text-sm"
                />
              </div>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-full sm:w-40 md:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الإشعارات</SelectItem>
                  <SelectItem value="unread">غير مقروءة</SelectItem>
                  <SelectItem value="read">مقروءة</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <ScrollArea className="h-[60vh] md:h-96">
              <AnimatePresence>
                {filteredNotifications.length > 0 ? (
                  <div className="space-y-3">
                    {filteredNotifications.map((notification) => (
                      <motion.div
                        key={notification.id}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className={cn(
                          "p-4 rounded-lg border transition-all duration-200 hover:shadow-md",
                          "bg-card/80 backdrop-blur-sm border-border shadow-sm",
                          notification.is_read ? "opacity-75" : "border-primary/20 shadow-md bg-primary/5"
                        )}
                      >
                        <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                            <div className="mt-1 flex-shrink-0">{iconMap[notification.icon] || iconMap.Bell}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className={cn(
                                  "font-semibold text-sm md:text-base truncate",
                                  !notification.is_read && "text-primary"
                                )}>
                                  {notification.title}
                                </h3>
                                {!notification.is_read && (
                                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse flex-shrink-0" />
                                )}
                              </div>
                              <p className="text-xs md:text-sm text-muted-foreground mb-2 line-clamp-2">{notification.message}</p>
                              <p className="text-xs text-muted-foreground/70">
                                {formatRelativeTime(notification.created_at)}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 flex-shrink-0">
                            {!notification.is_read && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => markAsRead(notification.id)}
                                title="تحديد كمقروء"
                                className="h-8 w-8 sm:h-10 sm:w-10"
                              >
                                <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteNotification(notification.id)}
                              title="حذف الإشعار"
                              className="text-destructive hover:text-destructive h-8 w-8 sm:h-10 sm:w-10"
                            >
                              <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Bell className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h3 className="text-lg font-semibold mb-2">لا توجد إشعارات</h3>
                    <p className="text-muted-foreground">
                      {searchTerm || filter !== 'all' ? 'لا توجد إشعارات تطابق المعايير المحددة' : 'لم يتم العثور على أي إشعارات'}
                    </p>
                  </div>
                )}
              </AnimatePresence>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <NotificationSettingsDialog 
        open={isSettingsOpen} 
        onOpenChange={setIsSettingsOpen} 
      />
    </>
  );
};

export default NotificationsPage;