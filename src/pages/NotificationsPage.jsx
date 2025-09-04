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
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 lg:gap-6">
          <div className="space-y-3">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-violet-600 via-purple-600 via-blue-600 via-cyan-500 via-teal-500 to-emerald-500 bg-clip-text text-transparent animate-pulse">
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
          <Card className="glass-effect relative overflow-hidden bg-gradient-to-br from-slate-900/20 via-purple-900/20 to-blue-900/20 backdrop-blur-2xl border border-purple-500/30 shadow-2xl shadow-purple-500/20">
            {/* تأثير الضوء المتحرك في الخلفية */}
            <div className="absolute inset-0 bg-gradient-to-r from-violet-600/10 via-purple-600/20 via-blue-600/10 via-cyan-500/20 to-teal-500/10 animate-pulse"></div>
            <div className="absolute inset-0 bg-gradient-to-l from-pink-500/5 via-rose-500/10 to-orange-500/5 animate-pulse delay-1000"></div>
            
            <CardContent className="relative p-6 md:p-8">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-6 lg:gap-8">
                <div className="flex items-center gap-4 lg:gap-6">
                  <div className="relative p-3 lg:p-4 rounded-2xl bg-gradient-to-br from-violet-500/20 via-purple-500/30 to-blue-500/20 backdrop-blur-sm border border-purple-400/30">
                    {/* تأثير الهالة المتوهجة حول الأيقونة */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-400/30 to-purple-400/30 blur-lg animate-pulse"></div>
                    <Bell className="relative w-6 h-6 lg:w-8 lg:h-8 text-purple-300" />
                  </div>
                  <div className="text-center lg:text-right">
                    <h3 className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-violet-400 via-purple-400 via-blue-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent mb-2 animate-pulse">
                      إحصائيات الإشعارات
                    </h3>
                    <p className="text-muted-foreground text-sm lg:text-base">نظرة شاملة على جميع الإشعارات</p>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center justify-center gap-4 lg:gap-8">
                  <div className="text-center min-w-[80px]">
                    <div className="relative text-3xl lg:text-4xl font-bold bg-gradient-to-r from-violet-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
                      {uniqueNotifications.length}
                      {/* تأثير الانعكاس */}
                      <div className="absolute inset-0 bg-gradient-to-r from-violet-400 via-purple-400 to-blue-400 bg-clip-text text-transparent opacity-20 blur-sm"></div>
                    </div>
                    <div className="text-xs lg:text-sm text-muted-foreground font-medium mt-1">إجمالي الإشعارات</div>
                  </div>
                  
                  <Separator orientation="vertical" className="h-8 lg:h-12 bg-gradient-to-b from-transparent via-purple-400/50 to-transparent hidden sm:block" />
                  
                  <div className="text-center min-w-[80px]">
                    <div className="relative text-3xl lg:text-4xl font-bold bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 bg-clip-text text-transparent animate-pulse">
                      {unreadCount}
                      {/* تأثير التوهج للأرقام غير المقروءة */}
                      {unreadCount > 0 && (
                        <div className="absolute inset-0 bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 bg-clip-text text-transparent opacity-30 blur-md animate-ping"></div>
                      )}
                    </div>
                    <div className="text-xs lg:text-sm text-muted-foreground font-medium mt-1">غير مقروءة</div>
                  </div>
                  
                  <Separator orientation="vertical" className="h-8 lg:h-12 bg-gradient-to-b from-transparent via-purple-400/50 to-transparent hidden sm:block" />
                  
                  <div className="text-center min-w-[80px]">
                    <div className="relative text-3xl lg:text-4xl font-bold bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400 bg-clip-text text-transparent">
                      {uniqueNotifications.length - unreadCount}
                      {/* تأثير الانعكاس الأخضر */}
                      <div className="absolute inset-0 bg-gradient-to-r from-green-400 via-emerald-400 to-teal-400 bg-clip-text text-transparent opacity-20 blur-sm"></div>
                    </div>
                    <div className="text-xs lg:text-sm text-muted-foreground font-medium mt-1">مقروءة</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <Card className="glass-effect relative overflow-hidden bg-gradient-to-br from-slate-900/10 via-indigo-900/15 to-purple-900/10 backdrop-blur-2xl border border-violet-500/20 shadow-2xl shadow-violet-500/10">
          {/* تأثير الضوء الخلفي */}
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500/5 via-purple-500/10 to-blue-500/5 animate-pulse"></div>
          
          <CardHeader className="relative border-b border-violet-400/20 bg-gradient-to-r from-violet-500/10 via-purple-500/15 to-blue-500/10 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative p-2 lg:p-3 rounded-xl bg-gradient-to-br from-violet-500/20 via-purple-500/30 to-blue-500/20 backdrop-blur-sm border border-violet-400/30">
                  {/* هالة متوهجة حول الأيقونة */}
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-violet-400/20 to-purple-400/20 blur-md animate-pulse"></div>
                  <Bell className="relative w-5 h-5 lg:w-6 lg:h-6 text-violet-300" />
                </div>
                <div>
                  <CardTitle className="text-lg lg:text-xl font-bold bg-gradient-to-r from-violet-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
                    قائمة الإشعارات
                  </CardTitle>
                  <CardDescription className="text-muted-foreground text-sm">جميع الإشعارات في مكان واحد</CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative p-4 md:p-6">
            <ScrollArea className="h-[60vh] md:h-[65vh]">
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
                            "relative p-4 md:p-6 rounded-2xl border transition-all duration-500 hover:shadow-xl group overflow-hidden",
                            "glass-effect backdrop-blur-2xl",
                            "hover:scale-[1.01] md:hover:scale-[1.02] hover:shadow-2xl",
                            notification.is_read 
                              ? "border-slate-200/30 shadow-sm bg-gradient-to-br from-slate-50/50 to-slate-100/30" 
                              : "border-violet-400/40 shadow-lg shadow-violet-500/10 bg-gradient-to-br from-violet-50/30 via-purple-50/40 to-blue-50/30"
                          )}
                        >
                          {/* تأثيرات الضوء المتحركة للإشعارات غير المقروءة */}
                          {!notification.is_read && (
                            <>
                              <div className="absolute inset-0 bg-gradient-to-r from-violet-500/5 via-purple-500/10 to-blue-500/5 animate-pulse"></div>
                              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-blue-500 animate-pulse"></div>
                            </>
                          )}
                          
                          <div className="relative flex items-start justify-between gap-3 md:gap-6">
                            <div className="flex items-start gap-3 md:gap-4 flex-1 min-w-0">
                              <div className={cn(
                                "relative p-2 md:p-3 rounded-xl backdrop-blur-sm border transition-all duration-300 flex-shrink-0",
                                "group-hover:shadow-lg group-hover:scale-105",
                                notification.is_read 
                                  ? "bg-gradient-to-br from-slate-200/20 to-slate-300/20 border-slate-300/30" 
                                  : "bg-gradient-to-br from-violet-500/20 via-purple-500/30 to-blue-500/20 border-violet-400/40"
                              )}>
                                {/* هالة متوهجة للإشعارات غير المقروءة */}
                                {!notification.is_read && (
                                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-violet-400/20 to-purple-400/20 blur-md animate-pulse"></div>
                                )}
                                <div className="relative">
                                  {iconMap[notification.type] || iconMap[notification.icon] || iconMap.Bell}
                                </div>
                              </div>
                              
                             <div className="flex-1 min-w-0">
                                 <div className="flex items-center gap-2 mb-2 md:mb-3">
                                   <h3 className={cn(
                                     "font-bold text-base md:text-lg truncate flex-1",
                                     !notification.is_read 
                                       ? "bg-gradient-to-r from-violet-600 via-purple-600 to-blue-600 bg-clip-text text-transparent" 
                                       : "text-foreground"
                                   )}>
                                     {notification.title}
                                   </h3>
                                   {!notification.is_read && (
                                     <div className="relative flex-shrink-0">
                                       <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-gradient-to-r from-violet-500 via-purple-500 to-blue-500 animate-pulse" />
                                       <div className="absolute inset-0 w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-gradient-to-r from-violet-500 via-purple-500 to-blue-500 animate-ping opacity-40" />
                                     </div>
                                   )}
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
                            <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-2 flex-shrink-0">
                              {!notification.is_read && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => markAsRead(notification.id)}
                                  className="gap-1.5 glass-effect bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-300/40 hover:border-green-400/60 text-green-700 hover:text-green-800 hover:shadow-lg hover:shadow-green-500/25 transition-all duration-300 text-xs sm:text-sm w-full sm:w-auto"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">قراءة</span>
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteNotification(notification.id)}
                                className="gap-1.5 glass-effect bg-gradient-to-r from-red-500/10 to-pink-500/10 border-red-300/40 hover:border-red-400/60 text-red-700 hover:text-red-800 hover:shadow-lg hover:shadow-red-500/25 transition-all duration-300 text-xs sm:text-sm w-full sm:w-auto"
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