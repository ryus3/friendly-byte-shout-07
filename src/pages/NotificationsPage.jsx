import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Bell, CheckCircle, Trash2, Filter, Volume2, VolumeX, Search, Eye, EyeOff, Settings, AlertTriangle, Package, Users, TrendingUp, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useSuper } from '@/contexts/SuperProvider';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNowStrict } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import NotificationSettingsDialog from '@/components/settings/NotificationSettingsDialog';
import { NotificationSettings } from '@/components/notifications/NotificationSettings';
import ScrollingText from '@/components/ui/scrolling-text';
import { getStatusConfig } from '@/lib/alwaseet-statuses';
import { getStatusForComponent } from '@/lib/order-status-translator';

// أيقونات نظيفة بدون رموز مزعجة
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

const iconMap = {
  low_stock: <StockWarningIcon />,
  stock_warning: <StockWarningIcon />,
  order_completed: <OrderSuccessIcon />,
  order_status_changed: <SystemIcon />,
  order_status_update: <SystemIcon />,
  alwaseet_status_change: <SystemIcon />,
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

const NotificationsPage = () => {
  const { notifications, markAsRead, markAllAsRead, clearAll, deleteNotification, addNotification } = useNotifications();
  const { orders } = useSuper(); // النظام الموحد للطلبات
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const formatRelativeTime = (dateString, updatedAt = null) => {
    try {
      // استخدام آخر تحديث أو وقت الإنشاء (الأحدث)
      const createTime = new Date(dateString);
      const updateTime = updatedAt ? new Date(updatedAt) : null;
      const displayTime = updateTime && updateTime > createTime ? updateTime : createTime;
      
      return formatDistanceToNowStrict(displayTime, { addSuffix: true, locale: ar });
    } catch (error) {
      return 'منذ فترة';
    }
  };

  // دالة للتحقق من كون الإشعار محدث مؤخراً
  const isNotificationUpdated = (notification) => {
    if (!notification.updated_at) return false;
    
    const createdTime = new Date(notification.created_at);
    const updatedTime = new Date(notification.updated_at);
    
    // إذا كان الفرق أكثر من دقيقة، يعتبر محدث
    return updatedTime.getTime() - createdTime.getTime() > 60000;
  };

  // دوال مساعدة لاستخراج tracking/state عند غياب data (نفس منطق NotificationsPanel)
  const parseAlwaseetStateIdFromMessage = (msg = '') => {
    const m = msg.match(/\b(تم التسليم|تم الإلغاء|لا يرد|تم الإرجاع|تم الاستلام)/);
    if (!m) return null;
    switch (m[1]) {
      case 'تم الاستلام': return '2';
      case 'تم التسليم': return '4';
      case 'تم الإرجاع': return '17';
      case 'لا يرد': return '26';
      case 'تم الإلغاء': return '31';
      default: return null;
    }
  };
  
  const parseTrackingFromMessage = (msg = '') => {
    const m = msg.match(/\b(\d{6,})\b/);
    return m ? m[1] : null;
  };

  // دمج الإشعارات ومنع التكرار (نفس منطق NotificationsPanel)
  const uniqueMap = new Map();
  notifications.forEach(n => {
    let uniqueKey = n.id;
    
    // إشعارات الوسيط - دمج محسن لمنع التكرار
    if (n.type === 'alwaseet_status_change' || n.type === 'order_status_update') {
      const tracking = n.data?.tracking_number || n.data?.order_number || parseTrackingFromMessage(n.message);
      const orderId = n.data?.order_id;
      const sid = n.data?.state_id || n.data?.delivery_status || parseAlwaseetStateIdFromMessage(n.message) || n.data?.status_id;
      
      if (orderId && sid) {
        // استخدام order_id + state_id للدمج الدقيق
        uniqueKey = `status_change_${orderId}_${sid}`;
      } else if (tracking && sid) {
        uniqueKey = `status_change_${tracking}_${sid}`;
      } else if (tracking) {
        uniqueKey = `status_change_${tracking}_${(n.message || '').slice(0, 32)}`;
      }
    }
    
    if (!uniqueKey || uniqueKey === n.id) {
      // إشعارات أخرى - منع التكرار بناءً على المحتوى
      const normalize = (s) => (s || '').toString().toLowerCase().replace(/\s+/g, ' ').trim();
      uniqueKey = n.id || `${n.type}|${normalize(n.title)}|${normalize(n.message)}`;
    }
    
    // دمج الإشعارات - إعطاء الأولوية للأحدث أو المخصص للمستخدم
    const existing = uniqueMap.get(uniqueKey);
    if (!existing) {
      uniqueMap.set(uniqueKey, n);
    } else {
      // إعطاء الأولوية للإشعار المخصص للمستخدم إذا وجد
      const currentIsUserSpecific = n.target_user_id || n.user_id;
      const existingIsUserSpecific = existing.target_user_id || existing.user_id;
      
      if (currentIsUserSpecific && !existingIsUserSpecific) {
        uniqueMap.set(uniqueKey, n);
      } else if (!currentIsUserSpecific && existingIsUserSpecific) {
        // الاحتفاظ بالموجود
      } else {
        // إعطاء الأولوية للأحدث
        const currentTime = new Date(n.updated_at || n.created_at);
        const existingTime = new Date(existing.updated_at || existing.created_at);
        if (currentTime > existingTime) {
          uniqueMap.set(uniqueKey, n);
        }
      }
    }
  });

  const uniqueNotifications = Array.from(uniqueMap.values());

  const filteredNotifications = uniqueNotifications.filter(notification => {
    const matchesSearch = notification.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         notification.message.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'all' || 
                         (filter === 'unread' && !notification.is_read) ||
                         (filter === 'read' && notification.is_read);
    return matchesSearch && matchesFilter;
  });

  const unreadCount = uniqueNotifications.filter(n => !n.is_read).length;

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

  // دالة تنظيف الإشعارات التلقائي
  const handleCleanupOldNotifications = async () => {
    try {
      const { data, error } = await supabase.rpc('daily_notifications_cleanup');
      
      if (error) {
        console.error('خطأ في تنظيف الإشعارات:', error);
        toast({
          title: "خطأ في التنظيف",
          description: "حدث خطأ أثناء تنظيف الإشعارات القديمة",
          variant: "destructive"
        });
        return;
      }

      // إعادة تحميل الإشعارات
      if (window.refreshNotifications) {
        window.refreshNotifications(true);
      }

      toast({
        title: "تم التنظيف بنجاح",
        description: data?.message || `تم حذف ${data?.total_deleted || 0} إشعار قديم`,
        variant: "default"
      });

    } catch (error) {
      console.error('خطأ غير متوقع في التنظيف:', error);
      toast({
        title: "خطأ في النظام",
        description: "حدث خطأ غير متوقع أثناء التنظيف",
        variant: "destructive"
      });
    }
  };

  return (
    <>
      <Helmet>
        <title>إدارة الإشعارات - نظام إدارة المتجر</title>
      </Helmet>

      <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
        {/* إعدادات الإشعارات */}
        <div className="hidden md:block">
          <NotificationSettings />
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 lg:gap-6">
          <div className="space-y-3">
            <h1 className="text-xl md:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-primary via-blue-600 to-primary bg-clip-text text-transparent">
              إدارة الإشعارات
            </h1>
            <p className="text-muted-foreground text-sm md:text-base lg:text-lg">تحكم شامل وإدارة احترافية لجميع الإشعارات</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 justify-center lg:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSettingsOpen(true)}
              className="gap-1.5 glass-effect border-gradient bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-300/30 hover:border-purple-400/50 text-purple-700 hover:text-purple-800 hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-300"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">إعدادات</span>
            </Button>
            <Button
              variant={soundEnabled ? "default" : "outline"}
              size="sm"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={cn(
                "gap-1.5 glass-effect transition-all duration-300 hover:shadow-lg",
                soundEnabled 
                  ? "bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 shadow-green-500/25" 
                  : "border-gray-300/30 hover:border-gray-400/50 text-gray-600 hover:text-gray-700"
              )}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span className="hidden sm:inline">{soundEnabled ? 'مفعل' : 'معطل'}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCleanupOldNotifications}
              className="gap-1.5 glass-effect bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border-blue-300/30 hover:border-blue-400/50 text-blue-700 hover:text-blue-800 hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">تنظيف</span>
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={clearAll}
              disabled={uniqueNotifications.length === 0}
              className="gap-1.5 glass-effect bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 hover:shadow-lg hover:shadow-red-500/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">حذف الكل</span>
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              className="gap-1.5 glass-effect bg-gradient-to-r from-violet-600 via-purple-600 to-blue-600 hover:from-violet-700 hover:via-purple-700 hover:to-blue-700 hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle className="w-4 h-4" />
              <span className="hidden sm:inline">قراءة الكل</span>
            </Button>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden"
        >
          <Card className="bg-gradient-to-r from-primary/10 via-blue-500/10 to-primary/10 border-primary/20 dark:from-primary/5 dark:via-blue-500/5 dark:to-primary/5 dark:border-primary/15 shadow-lg">
            <CardContent className="p-3 md:p-6">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-6 lg:gap-8">
                <div className="flex items-center gap-4 lg:gap-6">
                  <div className="p-3 lg:p-4 rounded-2xl bg-primary/15 border border-primary/25 dark:bg-primary/10 dark:border-primary/20">
                    <Bell className="w-6 h-6 lg:w-8 lg:h-8 text-primary" />
                  </div>
                  <div className="text-center lg:text-right">
                    <h3 className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-primary via-blue-600 to-primary bg-clip-text text-transparent mb-2">
                      إحصائيات الإشعارات
                    </h3>
                    <p className="text-muted-foreground text-sm lg:text-base">نظرة شاملة على جميع الإشعارات</p>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center justify-center gap-4 lg:gap-8">
                  <div className="text-center min-w-[80px]">
                    <div className="text-2xl lg:text-3xl font-bold text-primary">
                      {uniqueNotifications.length}
                    </div>
                    <div className="text-xs lg:text-sm text-muted-foreground mt-1">المجموع</div>
                  </div>
                  
                  <Separator orientation="vertical" className="h-8 md:h-12 bg-border/50" />
                  
                  <div className="text-center min-w-[80px]">
                    <div className="text-2xl lg:text-3xl font-bold text-red-500 dark:text-red-400">
                      {unreadCount}
                    </div>
                    <div className="text-xs lg:text-sm text-muted-foreground mt-1">غير مقروءة</div>
                  </div>
                  
                  <Separator orientation="vertical" className="h-8 md:h-12 bg-border/50" />
                  
                  <div className="text-center min-w-[80px]">
                    <div className="text-2xl lg:text-3xl font-bold text-green-600 dark:text-green-500">
                      {uniqueNotifications.length - unreadCount}
                    </div>
                    <div className="text-xs lg:text-sm text-muted-foreground mt-1">مقروءة</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <Card className="bg-gradient-to-r from-primary/10 via-blue-500/10 to-primary/10 border-primary/20 dark:from-primary/5 dark:via-blue-500/5 dark:to-primary/5 dark:border-primary/15 shadow-lg">
          <CardHeader className="border-b border-border/50 bg-gradient-to-r from-primary/5 via-blue-500/5 to-primary/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 lg:p-3 rounded-xl bg-primary/15 border border-primary/25 dark:bg-primary/10 dark:border-primary/20">
                  <Bell className="w-5 h-5 lg:w-6 lg:h-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg lg:text-xl font-bold bg-gradient-to-r from-primary via-blue-600 to-primary bg-clip-text text-transparent">
                    قائمة الإشعارات
                  </CardTitle>
                  <CardDescription className="text-muted-foreground text-sm">جميع الإشعارات في مكان واحد</CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative p-3 md:p-6">
            <ScrollArea className="h-[calc(100vh-280px)] md:h-[65vh]">
              <AnimatePresence>
                {filteredNotifications.length > 0 ? (
        <div className="space-y-2 md:space-y-3">
                    {filteredNotifications.map((notification) => (
                       <motion.div
                          key={notification.id}
                          layout
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                           transition={{ duration: 0.3 }}
                           className={cn(
                              "notification-item-enhanced relative p-2 md:p-4 rounded-xl md:rounded-2xl border transition-all duration-300 hover:shadow-lg group",
                             notification.is_read 
                               ? "notification-read" 
                               : "notification-unread"
                           )}
                        >
                           {!notification.is_read && (
                             <div className="absolute top-0 left-0 w-full h-1 bg-primary"></div>
                           )}
                          
                          <div className="relative flex items-start justify-between gap-3 md:gap-6">
                            <div className="flex items-start gap-3 md:gap-4 flex-1 min-w-0">
                               <div className={cn(
                                 "p-2 md:p-3 rounded-xl border transition-all duration-300 flex-shrink-0",
                                 notification.is_read 
                                   ? "bg-muted/50 border-border/30" 
                                   : "bg-primary/10 border-primary/30"
                               )}>
                                 {iconMap[notification.type] || iconMap[notification.icon] || iconMap.Bell}
                               </div>
                              
                              <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1 md:mb-2">
                                     <div className="flex-1 min-w-0 max-w-[calc(100vw-140px)] md:max-w-none">
                                       <ScrollingText
                                         text={(() => {
                                        // ✅ تخصيص العنوان لإشعارات تحديث حالة الطلب
                                        if (notification.type === 'alwaseet_status_change' || notification.type === 'order_status_update' || notification.type === 'order_status_changed') {
                                          const data = notification.data || {};
                                          const orderId = data.order_id;
                                          
                                          // ✅ Fallback: استخراج tracking_number من message إذا لم يوجد order_id
                                          const trackingFromMessage = !orderId ? parseTrackingFromMessage(notification.message) : null;
                                          const searchKey = orderId || trackingFromMessage || data.tracking_number || data.order_number;
                                          
                                          // البحث عن الطلب من النظام الموحد
                                          if (searchKey && orders && orders.length > 0) {
                                            const foundOrder = orders.find(order => 
                                              order.id === searchKey || 
                                              order.tracking_number === searchKey ||
                                              order.order_number === searchKey
                                            );
                                            if (foundOrder) {
                                              // عرض "المدينة - المنطقة"
                                              const city = (foundOrder.customer_city || '').trim() || 'غير محدد';
                                              const region = (foundOrder.customer_province || '').trim() || 'غير محدد';
                                              return `${city} - ${region}`;
                                            }
                                          }
                                          
                                          // للإشعارات القديمة بدون order_id
                                          if (data.customer_city || data.customer_address) {
                                            const city = data.customer_city || 'غير محدد';
                                            const region = data.customer_province || 'غير محدد';
                                            return `${city} - ${region}`;
                                          }
                                        }
                                        
                                         // العنوان الافتراضي
                                         return notification.title || 'إشعار جديد';
                                       })()}
                                         maxWidth="100%"
                                         className={cn(
                                           "font-bold text-sm md:text-base",
                                           !notification.is_read 
                                             ? "bg-gradient-to-r from-violet-600 via-purple-600 to-blue-600 bg-clip-text text-transparent" 
                                             : "text-foreground"
                                         )}
                                       />
                                     </div>
                                   {!notification.is_read && (
                                     <div className="relative flex-shrink-0">
                                       <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-gradient-to-r from-violet-500 via-purple-500 to-blue-500 animate-pulse" />
                                       <div className="absolute inset-0 w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-gradient-to-r from-violet-500 via-purple-500 to-blue-500 animate-ping opacity-40" />
                                     </div>
                                   )}
                                 </div>
                                <div className="text-xs md:text-sm text-muted-foreground line-clamp-1 md:line-clamp-2 mb-2 md:mb-3 leading-relaxed">
                                  {(() => {
                                    // تنسيق موحد للإشعارات المتعلقة بالطلبات - استخدام النظام الموحد
                                    if (notification.type === 'alwaseet_status_change' || notification.type === 'order_status_update' || notification.type === 'order_status_changed') {
                                      const data = notification.data || {};
                                      const orderId = data.order_id;
                                      
                                      // البحث عن الطلب الفعلي من النظام الموحد
                                      if (orderId && orders && orders.length > 0) {
                                        const foundOrder = orders.find(order => order.id === orderId);
                                        if (foundOrder) {
                                          // استخدام نفس منطق صفحة الطلبات
                                          const statusInfo = getStatusForComponent(foundOrder);
                                          const displayText = `${foundOrder.tracking_number || foundOrder.order_number} ${statusInfo.label}`;
                                          
                                          return displayText.length > 35 ? (
                                            <ScrollingText text={displayText} className="w-full" />
                                          ) : displayText;
                                        }
                                      }
                                      
                                      // البديل للإشعارات القديمة بدون order_id
                                      const trackingNumber = data.tracking_number || parseTrackingFromMessage(notification.message);
                                      const stateId = data.state_id || parseAlwaseetStateIdFromMessage(notification.message);
                                      
                                      if (trackingNumber && stateId) {
                                        const statusConfig = getStatusConfig(Number(stateId));
                                        const correctDeliveryStatus = statusConfig.text || data.delivery_status;
                                        
                                        const tempOrder = {
                                          tracking_number: trackingNumber,
                                          delivery_partner: 'الوسيط',
                                          delivery_status: correctDeliveryStatus,
                                          status: data.status,
                                          state_id: stateId
                                        };
                                        
                                        const statusInfo = getStatusForComponent(tempOrder);
                                        const displayText = `${trackingNumber} ${statusInfo.label}`;
                                        
                                        return displayText.length > 35 ? (
                                          <ScrollingText text={displayText} className="w-full" />
                                        ) : displayText;
                                      }
                                    }
                                   
                                   // للإشعارات العادية - استخدام ScrollingText للنصوص الطويلة
                                   const message = notification.message || '';
                                   return message.length > 35 ? (
                                     <ScrollingText text={message} className="w-full" />
                                   ) : message;
                                  })()}
                                </div>
                                <div className="flex items-center gap-2 mt-3">
                                  <Clock className="w-4 h-4 text-primary/60" />
                                  <p className="text-sm text-muted-foreground font-medium">
                                    {formatRelativeTime(notification.created_at, notification.updated_at)}
                                  </p>
                                </div>
                            </div>
                          </div>
                            <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-2 flex-shrink-0">
                              {!notification.is_read && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => markAsRead(notification.id)}
                                  className="notification-action-btn-primary gap-1.5 text-xs sm:text-sm w-full sm:w-auto h-7 px-2"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">قراءة</span>
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteNotification(notification.id)}
                                className="notification-action-btn-danger gap-1.5 text-xs sm:text-sm w-full sm:w-auto h-7 px-2"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">حذف</span>
                              </Button>
                            </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-16"
                  >
                    <div className="p-6 rounded-3xl bg-gradient-to-br from-primary/10 to-accent/10 backdrop-blur-sm border border-primary/20 inline-block mb-6">
                      <Bell className="w-16 h-16 text-primary/60" />
                    </div>
                    <h3 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-3">
                      لا توجد إشعارات
                    </h3>
                    <p className="text-muted-foreground text-lg max-w-md mx-auto">
                      {searchTerm || filter !== 'all' ? 'لا توجد إشعارات تطابق المعايير المحددة' : 'لم يتم العثور على أي إشعارات'}
                    </p>
                  </motion.div>
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