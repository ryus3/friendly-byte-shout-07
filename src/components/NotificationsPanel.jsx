import React, { useState } from 'react';
import { 
  Bell, Package, CheckCircle, AlertTriangle, Trash2, Check, Eye, UserPlus, Bot,
  ShoppingCart, TrendingDown, Star, Gift, Clock, CreditCard, Truck, 
  MessageSquare, Heart, Award, AlertCircle, Info, Zap, Target, MoreHorizontal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useNotificationsSystem } from '@/contexts/NotificationsSystemContext';
import PendingRegistrations from './dashboard/PendingRegistrations';
import AiOrdersManager from './dashboard/AiOrdersManager';
import { formatDistanceToNowStrict } from 'date-fns';
import { ar } from 'date-fns/locale';

// أيقونات نظيفة بدون رموز مزعجة
const StockWarningIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="4" width="18" height="16" rx="2" className="fill-orange-50 stroke-orange-500" strokeWidth="1.5"/>
    <path d="M8 10v4M12 8v6M16 12v2" className="stroke-orange-600" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const OrderSuccessIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" className="fill-green-50 stroke-green-500" strokeWidth="1.5"/>
    <path d="M9 12l2 2 4-4" className="stroke-green-600" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const UserRegistrationIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="8" r="3" className="fill-purple-50 stroke-purple-500" strokeWidth="1.5"/>
    <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" className="fill-purple-50 stroke-purple-500" strokeWidth="1.5"/>
  </svg>
);

const ProfitSettlementIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="6" width="18" height="12" rx="2" className="fill-emerald-50 stroke-emerald-500" strokeWidth="1.5"/>
    <circle cx="12" cy="12" r="2" className="fill-emerald-500"/>
    <path d="M8 12h8M10 9l2-2 2 2M10 15l2 2 2-2" className="stroke-emerald-600" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const AiOrderIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" className="fill-blue-50 stroke-blue-500" strokeWidth="1.5"/>
    <circle cx="8" cy="8" r="1" className="fill-blue-500"/>
    <circle cx="16" cy="8" r="1" className="fill-blue-500"/>
    <path d="M8 14s1.5 2 4 2 4-2 4-2" className="stroke-blue-600" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const OrderIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" className="fill-blue-50 stroke-blue-500" strokeWidth="1.5"/>
    <circle cx="9" cy="9" r="2" className="fill-blue-200"/>
  </svg>
);

const SystemIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" className="fill-primary/10 stroke-primary" strokeWidth="1.5"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0" className="stroke-primary" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const ProfitIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" className="fill-yellow-100 stroke-yellow-500" strokeWidth="1.5"/>
    <circle cx="12" cy="12" r="3" className="fill-yellow-300"/>
  </svg>
);

const iconMap = {
  // أيقونات حسب النوع
  low_stock: StockWarningIcon,
  stock_warning: StockWarningIcon,
  order_completed: OrderSuccessIcon,
  order_shipped: OrderIcon,
  new_order: OrderIcon,
  new_registration: UserRegistrationIcon,
  profit_settlement: ProfitIcon,
  profit_settlement_request: ProfitSettlementIcon,
  system: SystemIcon,
  // ألوان حسب النوع
  AlertTriangle: StockWarningIcon,
  Package: StockWarningIcon,
  CheckCircle: OrderSuccessIcon,
  ShoppingCart: OrderIcon,
  UserPlus: UserRegistrationIcon,
  Bot: SystemIcon,
  Bell: SystemIcon,
  // احتياطي
  default: SystemIcon,
};

const typeColorMap = {
  // استخدام نظام الألوان من index.css مع تحسينات للتناسق
  low_stock: { 
    bg: 'bg-amber-50/80 dark:bg-amber-900/10 backdrop-blur-sm', 
    border: 'border-r-4 border-amber-500 dark:border-amber-400',
    text: 'text-foreground', 
    icon: 'text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500'
  },
  stock_warning: { 
    bg: 'bg-orange-50/80 dark:bg-orange-900/10 backdrop-blur-sm', 
    border: 'border-r-4 border-orange-500 dark:border-orange-400',
    text: 'text-foreground', 
    icon: 'text-orange-600 dark:text-orange-400',
    dot: 'bg-orange-500'
  },
  out_of_stock: { 
    bg: 'bg-red-50/80 dark:bg-red-900/10 backdrop-blur-sm', 
    border: 'border-r-4 border-red-500 dark:border-red-400',
    text: 'text-foreground', 
    icon: 'text-red-600 dark:text-red-400',
    dot: 'bg-red-500'
  },
  order_completed: { 
    bg: 'bg-green-50/80 dark:bg-green-900/10 backdrop-blur-sm', 
    border: 'border-r-4 border-green-500 dark:border-green-400',
    text: 'text-foreground', 
    icon: 'text-green-600 dark:text-green-400',
    dot: 'bg-green-500'
  },
  order_shipped: { 
    bg: 'bg-blue-50/80 dark:bg-blue-900/10 backdrop-blur-sm', 
    border: 'border-r-4 border-blue-500 dark:border-blue-400',
    text: 'text-foreground', 
    icon: 'text-blue-600 dark:text-blue-400',
    dot: 'bg-blue-500'
  },
  new_order: { 
    bg: 'bg-blue-50/80 dark:bg-blue-900/10 backdrop-blur-sm', 
    border: 'border-r-4 border-primary dark:border-primary',
    text: 'text-foreground', 
    icon: 'text-primary',
    dot: 'bg-primary'
  },
  ai_order: { 
    bg: 'bg-blue-50/80 dark:bg-blue-900/10 backdrop-blur-sm', 
    border: 'border-r-4 border-primary dark:border-primary',
    text: 'text-foreground', 
    icon: 'text-primary',
    dot: 'bg-primary'
  },
  new_registration: { 
    bg: 'bg-purple-50/80 dark:bg-purple-900/10 backdrop-blur-sm', 
    border: 'border-r-4 border-purple-500 dark:border-purple-400',
    text: 'text-foreground', 
    icon: 'text-purple-600 dark:text-purple-400',
    dot: 'bg-purple-500'
  },
  profit_settlement: { 
    bg: 'bg-yellow-50/80 dark:bg-yellow-900/10 backdrop-blur-sm', 
    border: 'border-r-4 border-yellow-500 dark:border-yellow-400',
    text: 'text-foreground', 
    icon: 'text-yellow-600 dark:text-yellow-400',
    dot: 'bg-yellow-500'
  },
  profit_settlement_request: { 
    bg: 'bg-emerald-50/80 dark:bg-emerald-900/10 backdrop-blur-sm', 
    border: 'border-r-4 border-emerald-500 dark:border-emerald-400',
    text: 'text-foreground', 
    icon: 'text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500'
  },
  system: { 
    bg: 'bg-slate-50/80 dark:bg-slate-900/10 backdrop-blur-sm', 
    border: 'border-r-4 border-slate-500 dark:border-slate-400',
    text: 'text-foreground', 
    icon: 'text-slate-600 dark:text-slate-400',
    dot: 'bg-slate-500'
  },
  default: { 
    bg: 'bg-slate-50/80 dark:bg-slate-900/10 backdrop-blur-sm', 
    border: 'border-r-4 border-slate-500 dark:border-slate-400',
    text: 'text-foreground', 
    icon: 'text-slate-600 dark:text-slate-400',
    dot: 'bg-slate-500'
  },
};

const NotificationsPanel = () => {
  const { notifications, markAsRead, markAllAsRead, clearAll, deleteNotification } = useNotifications();
  const { notifications: systemNotifications, markAsRead: markSystemAsRead, markAllAsRead: markAllSystemAsRead, deleteNotification: deleteSystemNotification } = useNotificationsSystem();
  const [isOpen, setIsOpen] = useState(false);
  const [showPendingRegistrations, setShowPendingRegistrations] = useState(false);
  const [showAiOrdersManager, setShowAiOrdersManager] = useState(false);
  const navigate = useNavigate();

  const handleNotificationClick = (e, notification) => {
    e.stopPropagation();
    
    // تحديد الإشعار كمقروء
    if (!notification.is_read) {
      if (notification.related_entity_type) {
        markSystemAsRead(notification.id);
      } else {
        markAsRead(notification.id);
      }
    }
    
    // التنقل المتقدم مع فلترة دقيقة حسب البيانات
    if (notification.type === 'new_registration') {
      setShowPendingRegistrations(true);
    } else if (notification.type === 'ai_order') {
      setShowAiOrdersManager(true);
    } else if (notification.type === 'low_stock' || notification.type === 'stock_warning') {
      // استخراج اسم المنتج من الرسالة للفلترة الدقيقة
      const productMatch = notification.message.match(/المنتج "([^"]+)"/);
      const productName = productMatch ? productMatch[1] : '';
      
      if (productName) {
        // التنقل للمخزون مع البحث عن المنتج المحدد
        navigate(`/inventory?search=${encodeURIComponent(productName)}&filter=low_stock`);
      } else {
        navigate('/inventory?filter=low_stock');
      }
    } else if (notification.type === 'order_status_update' || notification.type === 'new_order') {
      // استخراج رقم الطلب من الرسالة
      const orderMatch = notification.message.match(/#(\w+)|رقم (\w+)|طلب (\w+)/);
      const orderNumber = orderMatch ? (orderMatch[1] || orderMatch[2] || orderMatch[3]) : '';
      
      if (orderNumber) {
        // التنقل للطلبات مع البحث عن الطلب المحدد
        navigate(`/orders?search=${encodeURIComponent(orderNumber)}`);
      } else {
        navigate('/orders?status=pending');
      }
    } else if (notification.type === 'order_completed') {
      // استخراج رقم الطلب المكتمل
      const orderMatch = notification.message.match(/#(\w+)|رقم (\w+)|طلب (\w+)/);
      const orderNumber = orderMatch ? (orderMatch[1] || orderMatch[2] || orderMatch[3]) : '';
      
      if (orderNumber) {
        navigate(`/orders?search=${encodeURIComponent(orderNumber)}&status=completed`);
      } else {
        navigate('/orders?status=completed');
      }
    } else if (notification.type === 'profit_settlement_request') {
      // طلب تحاسب من موظف - التنقل لصفحة متابعة الموظفين مع الطلبات المحددة
      const data = notification.data || {};
      const employeeId = data.employee_id || data.employeeId;
      const orderIds = data.order_ids || data.orderIds || [];
      
      if (employeeId && orderIds.length > 0) {
        navigate(`/employee-follow-up?employee=${employeeId}&orders=${orderIds.join(',')}&highlight=settlement`);
      } else {
        navigate('/employee-follow-up?filter=pending_settlement');
      }
    } else if (notification.type === 'profit_settlement') {
      navigate('/employee-follow-up');
    } else if (notification.related_entity_type) {
      // إشعارات النظام الجديد
      switch (notification.related_entity_type) {
        case 'order':
          navigate(`/orders?highlight=${notification.related_entity_id}`);
          break;
        case 'settlement_request':
          navigate(`/employee-follow-up`);
          break;
        case 'settlement_invoice':
          navigate(`/employee-follow-up`);
          break;
        case 'product':
          navigate(`/inventory?product=${notification.related_entity_id}`);
          break;
        default:
          navigate('/notifications');
      }
    } else if (notification.link && notification.link !== '#') {
      navigate(notification.link);
    } else {
      // الانتقال لصفحة الإشعارات مع فلترة حسب النوع
      navigate(`/notifications?type=${notification.type || 'all'}`);
    }
    setIsOpen(false);
  };

  const handleMarkAsRead = (e, id) => {
    e.stopPropagation();
    // Mark notification as read
    markAsRead(id);
    toast({ title: "تم تحديد الإشعار كمقروء" });
  };

  const handleMarkAllAsRead = (e) => {
    e.stopPropagation();
    // Mark all notifications as read
    markAllAsRead();
    toast({ title: "تم تحديد الكل كمقروء" });
  };

  const handleClearAll = (e) => {
    e.stopPropagation();
    // Clear all notifications
    clearAll();
    toast({ title: "تم حذف جميع الإشعارات" });
  };

  const formatRelativeTime = (dateString) => {
    try {
      // Make time shorter
      const time = formatDistanceToNowStrict(new Date(dateString), { addSuffix: false, locale: ar });
      return time
        .replace(/دقيقة|دقائق/, 'د')
        .replace(/ساعة|ساعات/, 'س')
        .replace(/يوم|أيام/, 'ي')
        .replace(/أسبوع|أسابيع/, 'أ')
        .replace(/شهر|أشهر/, 'ش')
        .replace(/سنة|سنوات/, 'سنة');
    } catch (error) {
      return 'منذ فترة';
    }
  };

  // دمج الإشعارات من النظامين
  const allNotifications = [
    ...notifications.filter(n => n.type !== 'welcome'),
    ...systemNotifications
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  const unreadFilteredCount = allNotifications.filter(n => !n.is_read && !n.read).length;

  return (
    <>
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadFilteredCount > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
            >
              <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 justify-center rounded-full p-0">
                {unreadFilteredCount}
              </Badge>
            </motion.div>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 md:w-96 glass-effect rounded-xl p-0 overflow-hidden" align="end">
        <DropdownMenuLabel className="flex justify-between items-center px-4 py-3 bg-card/50 border-b border-border/50">
          <span className="font-bold text-base gradient-text">الإشعارات</span>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0 hover:bg-muted/50 transition-colors" 
              onClick={() => navigate('/notifications')} 
              title="عرض كل الإشعارات"
            >
              <Eye className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0 hover:bg-green-100 dark:hover:bg-green-900/20 hover:text-green-600 transition-colors" 
              onClick={handleMarkAllAsRead} 
              title="تحديد الكل كمقروء" 
              disabled={unreadFilteredCount === 0}
            >
              <Check className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0 text-destructive hover:bg-red-100 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors" 
              onClick={handleClearAll} 
              title="حذف الكل" 
              disabled={allNotifications.length === 0}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="mx-0 bg-border/50" />
        <ScrollArea className="h-80 px-2">
          <div className="space-y-2 py-2">
            <AnimatePresence>
              {allNotifications.length > 0 ? (
                allNotifications.slice(0, 8).map(notification => {
                  const notificationType = notification.type || 'default';
                  const colors = typeColorMap[notificationType] || typeColorMap.default;
                  const IconComponent = iconMap[notificationType] || iconMap.default;
                  
                  return (
                    <motion.div
                      key={notification.id}
                      layout
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20, transition: { duration: 0.2 } }}
                      className="relative group"
                    >
                      <div 
                        className={cn(
                          "flex items-start gap-3 p-3 cursor-pointer transition-all duration-300 rounded-lg", 
                          colors.bg,
                          colors.border,
                          (notification.is_read || notification.read) ? "opacity-70" : "shadow-sm hover:shadow-md",
                          "hover:scale-[1.01] hover:shadow-lg hover:bg-gradient-to-l hover:from-white/50 hover:to-transparent dark:hover:from-white/10"
                        )}
                        onClick={(e) => handleNotificationClick(e, notification)}
                      >
                        <div className={cn("mt-1 flex-shrink-0", colors.icon)}>
                          <IconComponent />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className={cn("font-semibold text-sm leading-tight", colors.text)}>
                              {notification.title}
                            </h3>
                            {!(notification.is_read || notification.read) && (
                              <div className={cn("w-2 h-2 rounded-full animate-pulse", colors.dot)}></div>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground/80 line-clamp-2 mb-1.5">
                            {notification.message}
                          </p>
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              {formatRelativeTime(notification.created_at)}
                            </p>
                            {!(notification.is_read || notification.read) && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-6 px-2 py-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-background"
                                title="وضع كمقروء"
                                onClick={(e) => handleMarkAsRead(e, notification.id)}
                              >
                                <Eye className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })
              ) : (
                <div className="text-center text-muted-foreground py-12 px-4">
                  <Bell className="w-12 h-12 mx-auto mb-3 opacity-50"/>
                  <p className="text-lg font-medium">لا توجد إشعارات جديدة</p>
                  <p className="text-sm mt-1">ستظهر الإشعارات الجديدة هنا</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
    <AnimatePresence>
      {showPendingRegistrations && (
        <PendingRegistrations onClose={() => setShowPendingRegistrations(false)} />
      )}
      {showAiOrdersManager && (
        <AiOrdersManager onClose={() => setShowAiOrdersManager(false)} />
      )}
    </AnimatePresence>
    </>
  );
};

export default NotificationsPanel;