import React, { useState } from 'react';
import { 
  Bell, Package, CheckCircle, AlertTriangle, Trash2, Check, Eye, UserPlus, Bot,
  ShoppingCart, TrendingDown, Star, Gift, Clock, CreditCard, Truck, 
  MessageSquare, Heart, Award, AlertCircle, Info, Zap, Target
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
import { toast } from '@/components/ui/use-toast';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useNotificationsSystem } from '@/contexts/NotificationsSystemContext';
import PendingRegistrations from './dashboard/PendingRegistrations';
import AiOrdersManager from './dashboard/AiOrdersManager';
import { formatDistanceToNowStrict } from 'date-fns';
import { ar } from 'date-fns/locale';

// أيقونات احترافية مخصصة
const StockWarningIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="4" width="18" height="16" rx="2" className="fill-orange-50 stroke-orange-500" strokeWidth="1.5"/>
    <path d="M8 10v4M12 8v6M16 12v2" className="stroke-orange-600" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="19" cy="5" r="2" className="fill-red-500"/>
    <path d="M18 4l2 2M20 4l-2 2" className="stroke-white" strokeWidth="1" strokeLinecap="round"/>
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
    <circle cx="18" cy="6" r="3" className="fill-blue-500"/>
  </svg>
);

const OrderIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" className="fill-blue-50 stroke-blue-500" strokeWidth="1.5"/>
    <circle cx="9" cy="9" r="2" className="fill-blue-200"/>
    <path d="m21 15-3-3H12l-1 3" className="stroke-blue-600" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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
  // ألوان حسب نوع الإشعار
  low_stock: { bg: 'bg-red-50 border-red-200', text: 'text-red-800', icon: 'text-red-600' },
  stock_warning: { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-800', icon: 'text-orange-600' },
  order_completed: { bg: 'bg-green-50 border-green-200', text: 'text-green-800', icon: 'text-green-600' },
  order_shipped: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-800', icon: 'text-blue-600' },
  new_order: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-800', icon: 'text-blue-600' },
  new_registration: { bg: 'bg-purple-50 border-purple-200', text: 'text-purple-800', icon: 'text-purple-600' },
  profit_settlement: { bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-800', icon: 'text-yellow-600' },
  system: { bg: 'bg-primary/5 border-primary/20', text: 'text-primary', icon: 'text-primary' },
  default: { bg: 'bg-gray-50 border-gray-200', text: 'text-gray-800', icon: 'text-gray-600' },
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
    
    // التنقل حسب نوع الإشعار مع الفلترة المناسبة
    if (notification.type === 'new_registration') {
      setShowPendingRegistrations(true);
    } else if (notification.type === 'new_ai_order') {
      setShowAiOrdersManager(true);
    } else if (notification.type === 'low_stock' || notification.type === 'stock_warning') {
      // التنقل لصفحة المخزون مع فلترة المخزون المنخفض
      navigate('/inventory?filter=low_stock');
    } else if (notification.type === 'new_order') {
      // التنقل لصفحة الطلبات مع فلترة الطلبات الجديدة
      navigate('/orders?status=pending');
    } else if (notification.type === 'order_completed') {
      // التنقل لصفحة الطلبات مع فلترة الطلبات المكتملة
      navigate('/orders?status=completed');
    } else if (notification.type === 'profit_settlement') {
      // التنقل لصفحة الأرباح
      navigate('/profits-summary');
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
          navigate(`/profits-summary?invoice=${notification.related_entity_id}`);
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
    markAsRead(id);
    toast({ title: "تم تحديد الإشعار كمقروء" });
  };

  const handleMarkAllAsRead = (e) => {
    e.stopPropagation();
    markAllAsRead();
    toast({ title: "تم تحديد الكل كمقروء" });
  };

  const handleClearAll = (e) => {
    e.stopPropagation();
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
      <DropdownMenuContent className="w-80 md:w-96 glass-effect p-2" align="end">
        <DropdownMenuLabel className="flex justify-between items-center px-2 py-1.5">
          <span className="font-bold">الإشعارات</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate('/notifications')} title="عرض كل الإشعارات">
              <Eye className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleMarkAllAsRead} title="تحديد الكل كمقروء" disabled={unreadFilteredCount === 0}>
              <Check className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={handleClearAll} title="حذف الكل" disabled={allNotifications.length === 0}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-80">
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
                    <DropdownMenuItem 
                      className={cn(
                        "flex items-start gap-3 p-3 cursor-pointer transition-all duration-300 my-1 rounded-lg border-r-4", 
                        colors.bg,
                        (notification.is_read || notification.read) ? "opacity-70" : "shadow-md hover:shadow-lg",
                        !(notification.is_read || notification.read) && "ring-1 ring-primary/20",
                      )}
                      onClick={(e) => handleNotificationClick(e, notification)}
                    >
                      <div className="mt-1">
                        <IconComponent />
                      </div>
                      <div className="flex-1">
                        <p className={cn("font-semibold text-sm", colors.text, !(notification.is_read || notification.read) && "font-bold")}>{notification.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{notification.message}</p>
                        <p className="text-[10px] text-muted-foreground/70 mt-1">{formatRelativeTime(notification.created_at)}</p>
                      </div>
                      {!(notification.is_read || notification.read) && (
                        <div className="absolute top-1/2 -translate-y-1/2 right-2 w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                      )}
                    </DropdownMenuItem>
                     {!(notification.is_read || notification.read) && (
                      <div className="absolute top-1/2 -translate-y-1/2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7"
                          title="وضع كمقروء"
                          onClick={(e) => handleMarkAsRead(e, notification.id)}
                        >
                          <Eye className="w-4 h-4 text-primary" />
                        </Button>
                      </div>
                    )}
                  </motion.div>
                )
              })
            ) : (
              <div className="text-center text-muted-foreground py-10 px-4">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-50"/>
                <p>لا توجد إشعارات جديدة.</p>
              </div>
            )}
          </AnimatePresence>
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