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
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              إدارة الإشعارات
            </h1>
            <p className="text-muted-foreground text-lg">تحكم شامل وإدارة احترافية لجميع الإشعارات</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="lg"
              onClick={() => setIsSettingsOpen(true)}
              className="gap-2 glass-effect border-primary/20 hover:border-primary/40 text-primary hover:text-primary"
            >
              <Settings className="w-5 h-5" />
              إعدادات الإشعارات
            </Button>
            <Button
              variant={soundEnabled ? "default" : "outline"}
              size="lg"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="gap-2 glass-effect"
            >
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              الصوت {soundEnabled ? 'مفعل' : 'معطل'}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={handleCleanupOldNotifications}
              className="gap-2 glass-effect border-blue-200 hover:border-blue-300 text-blue-600 hover:text-blue-700"
            >
              <Trash2 className="w-5 h-5" />
              تنظيف تلقائي
            </Button>
            <Button
              variant="destructive"
              size="lg"
              onClick={clearAll}
              disabled={notifications.length === 0}
              className="gap-2 glass-effect"
            >
              <Trash2 className="w-5 h-5" />
              حذف الكل
            </Button>
            <Button
              variant="default"
              size="lg"
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              className="gap-2 glass-effect bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
            >
              <CheckCircle className="w-5 h-5" />
              قراءة الكل
            </Button>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="glass-effect bg-gradient-to-r from-background/80 via-background/90 to-background/80 backdrop-blur-xl border-primary/20 shadow-2xl shadow-primary/10">
            <CardContent className="p-8">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
                <div className="flex items-center gap-6">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 backdrop-blur-sm">
                    <Bell className="w-8 h-8 text-primary" />
                  </div>
                  <div className="text-center lg:text-right">
                    <h3 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2">
                      إحصائيات الإشعارات
                    </h3>
                    <p className="text-muted-foreground">نظرة شاملة على جميع الإشعارات</p>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-8">
                  <div className="text-center">
                    <div className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                      {notifications.length}
                    </div>
                    <div className="text-sm text-muted-foreground font-medium">إجمالي الإشعارات</div>
                  </div>
                  
                  <Separator orientation="vertical" className="h-12 bg-gradient-to-b from-transparent via-border to-transparent" />
                  
                  <div className="text-center">
                    <div className="text-4xl font-bold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
                      {unreadCount}
                    </div>
                    <div className="text-sm text-muted-foreground font-medium">غير مقروءة</div>
                  </div>
                  
                  <Separator orientation="vertical" className="h-12 bg-gradient-to-b from-transparent via-border to-transparent" />
                  
                  <div className="text-center">
                    <div className="text-4xl font-bold bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent">
                      {notifications.length - unreadCount}
                    </div>
                    <div className="text-sm text-muted-foreground font-medium">مقروءة</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <Card className="glass-effect bg-gradient-to-b from-background/80 to-background/90 backdrop-blur-xl border-primary/20 shadow-2xl shadow-primary/5">
          <CardHeader className="border-b border-primary/10 bg-gradient-to-r from-primary/5 to-accent/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20">
                  <Bell className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    قائمة الإشعارات
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">جميع الإشعارات في مكان واحد</CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <ScrollArea className="h-[65vh]">
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
                         transition={{ duration: 0.3 }}
                         className={cn(
                           "p-6 rounded-2xl border transition-all duration-300 hover:shadow-xl group",
                           "glass-effect bg-gradient-to-br from-background/80 to-background/90 backdrop-blur-xl",
                           "hover:scale-[1.02] hover:shadow-2xl hover:shadow-primary/10",
                           notification.is_read 
                             ? "border-border/50 shadow-sm" 
                             : "border-primary/30 shadow-lg shadow-primary/5 bg-gradient-to-br from-primary/5 via-background/90 to-accent/5"
                         )}
                       >
                         <div className="flex items-start justify-between gap-6">
                           <div className="flex items-start gap-4 flex-1">
                             <div className="p-3 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 backdrop-blur-sm border border-primary/20 group-hover:shadow-md transition-all duration-300">
                               {iconMap[notification.type] || iconMap[notification.icon] || iconMap.Bell}
                             </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-3">
                                  <h3 className={cn(
                                    "font-bold text-lg truncate",
                                    !notification.is_read 
                                      ? "bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent" 
                                      : "text-foreground"
                                  )}>
                                    {notification.title}
                                  </h3>
                                   <div className="flex items-center gap-2">
                                     {!notification.is_read && (
                                       <div className="relative">
                                         <div className="w-3 h-3 rounded-full bg-gradient-to-r from-primary to-accent animate-pulse" />
                                         <div className="absolute inset-0 w-3 h-3 rounded-full bg-gradient-to-r from-primary to-accent animate-ping opacity-30" />
                                       </div>
                                     )}
                                   </div>
                                </div>
                                <div className="text-sm text-muted-foreground line-clamp-3 mb-4 leading-relaxed">
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
                           <div className="flex items-center gap-2 flex-shrink-0">
                             {!notification.is_read && (
                               <Button
                                 variant="outline"
                                 size="sm"
                                 onClick={() => markAsRead(notification.id)}
                                 className="gap-2 glass-effect border-primary/20 hover:border-primary/40 text-primary hover:text-primary"
                               >
                                 <Eye className="w-4 h-4" />
                                 قراءة
                               </Button>
                             )}
                             <Button
                               variant="outline"
                               size="sm"
                               onClick={() => deleteNotification(notification.id)}
                               className="gap-2 glass-effect border-destructive/20 hover:border-destructive/40 text-destructive hover:text-destructive"
                             >
                               <Trash2 className="w-4 h-4" />
                               حذف
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