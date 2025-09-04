import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Bell, CheckCircle, Trash2, Settings, Sparkles, BarChart3, Layers, Zap, Clock, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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

  const filteredNotifications = uniqueNotifications;

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

      <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5">
        <div className="container mx-auto p-4 md:p-6 space-y-6">
          {/* Header Section */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary/10 via-primary/5 to-secondary/10 p-8 backdrop-blur-sm border border-primary/20"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-secondary/5 opacity-60" />
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-2">
                <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary via-primary to-secondary bg-clip-text text-transparent flex items-center gap-4">
                  <Sparkles className="w-10 h-10 text-primary animate-pulse" />
                  إدارة الإشعارات
                </h1>
                <p className="text-muted-foreground text-lg">مركز التحكم الشامل في جميع الإشعارات والتنبيهات</p>
              </div>
              
              {/* Statistics Bar */}
              <div className="flex items-center gap-6 bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  <span className="text-sm text-muted-foreground">الإجمالي:</span>
                  <span className="text-lg font-bold text-primary">{notifications.length}</span>
                </div>
                <div className="w-px h-6 bg-white/20" />
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-amber-500" />
                  <span className="text-sm text-muted-foreground">غير مقروءة:</span>
                  <span className="text-lg font-bold text-amber-600">{unreadCount}</span>
                </div>
                <div className="w-px h-6 bg-white/20" />
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-sm text-muted-foreground">مقروءة:</span>
                  <span className="text-lg font-bold text-green-600">{notifications.length - unreadCount}</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Action Buttons Bar */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex justify-between items-center bg-white/50 dark:bg-gray-900/50 backdrop-blur-md rounded-2xl p-4 border border-white/20"
          >
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSettingsOpen(true)}
                className="gap-2 bg-white/80 hover:bg-white border-primary/20 hover:border-primary/40 transition-all duration-300"
              >
                <Settings className="w-4 h-4" />
                إعدادات الإشعارات
              </Button>
              <Button
                variant={soundEnabled ? "default" : "outline"}
                size="sm"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="gap-2 transition-all duration-300"
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                الصوت {soundEnabled ? 'مفعل' : 'معطل'}
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={markAllAsRead} 
                disabled={unreadCount === 0}
                className="gap-2 bg-green-50 hover:bg-green-100 border-green-200 hover:border-green-300 text-green-700 hover:text-green-800 transition-all duration-300"
              >
                <CheckCircle className="w-4 h-4" />
                قراءة الكل
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={clearAll} 
                disabled={notifications.length === 0}
                className="gap-2 bg-red-50 hover:bg-red-100 border-red-200 hover:border-red-300 text-red-700 hover:text-red-800 transition-all duration-300"
              >
                <Trash2 className="w-4 h-4" />
                حذف الكل
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCleanupOldNotifications}
                className="gap-2 bg-blue-50 hover:bg-blue-100 border-blue-200 hover:border-blue-300 text-blue-700 hover:text-blue-800 transition-all duration-300"
              >
                <Layers className="w-4 h-4" />
                تنظيف تلقائي
              </Button>
            </div>
          </motion.div>

          {/* Main Notifications Area */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="relative overflow-hidden rounded-3xl bg-white/60 dark:bg-gray-900/60 backdrop-blur-md border border-white/20 shadow-2xl"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
            <div className="relative z-10 p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-gradient-to-r from-primary/20 to-secondary/20">
                    <Bell className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">قائمة الإشعارات</h2>
                    <p className="text-muted-foreground">جميع الإشعارات والتنبيهات الخاصة بك</p>
                  </div>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestNotification}
                  className="gap-2 bg-gradient-to-r from-primary/10 to-secondary/10 hover:from-primary/20 hover:to-secondary/20 border-primary/20 hover:border-primary/40 transition-all duration-300"
                >
                  <Zap className="w-4 h-4" />
                  إشعار تجريبي
                </Button>
              </div>

              <Separator className="mb-6" />

              <ScrollArea className="h-[65vh]">
                <AnimatePresence>
                  {filteredNotifications.length > 0 ? (
                    <div className="space-y-4">
                      {filteredNotifications.map((notification, index) => (
                        <motion.div
                          key={notification.id}
                          layout
                          initial={{ opacity: 0, y: 20, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, x: -20, scale: 0.95 }}
                          transition={{ delay: index * 0.05 }}
                          className={cn(
                            "group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:scale-[1.02]",
                            "bg-gradient-to-r from-white/80 to-white/60 dark:from-gray-800/80 dark:to-gray-800/60",
                            "backdrop-blur-md border-white/30 shadow-lg hover:shadow-2xl",
                            notification.is_read 
                              ? "opacity-70 hover:opacity-100" 
                              : "border-primary/30 shadow-primary/10 bg-gradient-to-r from-primary/5 to-secondary/5"
                          )}
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-secondary/5 opacity-50" />
                          <div className="relative z-10 p-5">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-4 flex-1">
                                <div className="relative">
                                  <div className={cn(
                                    "p-3 rounded-xl transition-all duration-300",
                                    notification.is_read 
                                      ? "bg-gray-100 dark:bg-gray-700" 
                                      : "bg-gradient-to-r from-primary/20 to-secondary/20 shadow-lg"
                                  )}>
                                    {iconMap[notification.type] || iconMap[notification.icon] || iconMap.Bell}
                                  </div>
                                  {!notification.is_read && (
                                    <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-gradient-to-r from-primary to-secondary animate-pulse shadow-lg" />
                                  )}
                                </div>
                                
                                <div className="flex-1 min-w-0 space-y-2">
                                  <div className="flex items-center gap-3">
                                    <h3 className={cn(
                                      "font-bold text-base md:text-lg leading-tight",
                                      !notification.is_read && "bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent"
                                    )}>
                                      {notification.title}
                                    </h3>
                                    {!notification.is_read && (
                                      <span className="px-2 py-1 rounded-full bg-gradient-to-r from-primary to-secondary text-white text-xs font-semibold animate-pulse">
                                        جديد
                                      </span>
                                    )}
                                  </div>
                                  
                                  <div className="text-sm md:text-base text-foreground/80 font-medium leading-relaxed">
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
                                            
                                            return displayText.length > 50 ? (
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
                                          
                                          return displayText.length > 50 ? (
                                            <ScrollingText text={displayText} className="w-full" />
                                          ) : displayText;
                                        }
                                      }
                                     
                                     // للإشعارات العادية - استخدام ScrollingText للنصوص الطويلة
                                     const message = notification.message || '';
                                     return message.length > 50 ? (
                                       <ScrollingText text={message} className="w-full" />
                                     ) : message;
                                    })()}
                                  </div>
                                  
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Clock className="w-3 h-3" />
                                    <span>{formatRelativeTime(notification.created_at, notification.updated_at)}</span>
                                    {isNotificationUpdated(notification) && (
                                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-semibold">
                                        محدث
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                                {!notification.is_read && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => markAsRead(notification.id)}
                                    className="gap-2 bg-green-50 hover:bg-green-100 border-green-200 hover:border-green-300 text-green-700 hover:text-green-800 transition-all duration-300"
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                    <span className="hidden sm:inline">قراءة</span>
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => deleteNotification(notification.id)}
                                  className="gap-2 bg-red-50 hover:bg-red-100 border-red-200 hover:border-red-300 text-red-700 hover:text-red-800 transition-all duration-300"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  <span className="hidden sm:inline">حذف</span>
                                </Button>
                              </div>
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
                      <div className="relative mb-6">
                        <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-r from-primary/20 to-secondary/20 flex items-center justify-center">
                          <Bell className="w-12 h-12 text-primary opacity-50" />
                        </div>
                        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary/10 to-secondary/10 animate-ping" />
                      </div>
                      <h3 className="text-2xl font-bold mb-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                        لا توجد إشعارات
                      </h3>
                      <p className="text-muted-foreground text-lg">
                        ستظهر هنا جميع الإشعارات والتنبيهات الجديدة
                      </p>
                    </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </ScrollArea>
            </div>
          </motion.div>
        </div>

        <NotificationSettingsDialog 
          open={isSettingsOpen} 
          onOpenChange={setIsSettingsOpen} 
        />
      </>
  );
};

export default NotificationsPage;