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
  // ألوان حسب نوع الإشعار - تصميم احترافي كما في الصورة
  low_stock: { 
    bg: 'bg-gradient-to-r from-orange-50 to-red-50 border-l-orange-400', 
    text: 'text-orange-900', 
    icon: 'text-orange-600',
    glow: 'shadow-orange-200/50'
  },
  stock_warning: { 
    bg: 'bg-gradient-to-r from-amber-50 to-orange-50 border-l-amber-400', 
    text: 'text-amber-900', 
    icon: 'text-amber-600',
    glow: 'shadow-amber-200/50'
  },
  order_completed: { 
    bg: 'bg-gradient-to-r from-green-50 to-emerald-50 border-l-green-400', 
    text: 'text-green-900', 
    icon: 'text-green-600',
    glow: 'shadow-green-200/50'
  },
  order_shipped: { 
    bg: 'bg-gradient-to-r from-blue-50 to-sky-50 border-l-blue-400', 
    text: 'text-blue-900', 
    icon: 'text-blue-600',
    glow: 'shadow-blue-200/50'
  },
  new_order: { 
    bg: 'bg-gradient-to-r from-blue-50 to-indigo-50 border-l-blue-500', 
    text: 'text-blue-900', 
    icon: 'text-blue-700',
    glow: 'shadow-blue-200/50'
  },
  new_registration: { 
    bg: 'bg-gradient-to-r from-purple-50 to-violet-50 border-l-purple-400', 
    text: 'text-purple-900', 
    icon: 'text-purple-600',
    glow: 'shadow-purple-200/50'
  },
  profit_settlement: { 
    bg: 'bg-gradient-to-r from-yellow-50 to-amber-50 border-l-yellow-400', 
    text: 'text-yellow-900', 
    icon: 'text-yellow-600',
    glow: 'shadow-yellow-200/50'
  },
  system: { 
    bg: 'bg-gradient-to-r from-primary/5 to-primary/10 border-l-primary', 
    text: 'text-primary', 
    icon: 'text-primary',
    glow: 'shadow-primary/20'
  },
  default: { 
    bg: 'bg-gradient-to-r from-slate-50 to-gray-50 border-l-slate-400', 
    text: 'text-slate-900', 
    icon: 'text-slate-600',
    glow: 'shadow-slate-200/50'
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
    } else if (notification.type === 'new_ai_order') {
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
    } else if (notification.type === 'profit_settlement') {
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
      <DropdownMenuContent className="w-80 md:w-96 bg-gradient-to-br from-background/98 to-card/95 backdrop-blur-xl border-2 border-primary/30 shadow-2xl rounded-2xl p-3" align="end">
        <DropdownMenuLabel className="flex justify-between items-center px-3 py-2 mb-1">
          <span className="font-bold text-lg bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">الإشعارات</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10" onClick={() => navigate('/notifications')} title="عرض كل الإشعارات">
              <Eye className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-green-100" onClick={handleMarkAllAsRead} title="تحديد الكل كمقروء" disabled={unreadFilteredCount === 0}>
              <Check className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-red-100" onClick={handleClearAll} title="حذف الكل" disabled={allNotifications.length === 0}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-2" />
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
                    className="relative group mb-2"
                  >
                    <div 
                      className={cn(
                        "flex items-start gap-4 p-4 cursor-pointer transition-all duration-300 rounded-xl border-r-4 backdrop-blur-sm", 
                        colors.bg,
                        colors.glow,
                        (notification.is_read || notification.read) ? "opacity-60 hover:opacity-80" : "shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 ring-2 ring-primary/20",
                        "hover:scale-[1.02] hover:bg-gradient-to-r hover:from-primary/5 hover:to-accent/10"
                      )}
                      onClick={(e) => handleNotificationClick(e, notification)}
                    >
                      <div className="mt-0.5">
                        <IconComponent />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("font-semibold text-base leading-tight", colors.text, !(notification.is_read || notification.read) && "font-bold text-primary")}>{notification.title}</p>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1 leading-relaxed">{notification.message}</p>
                        <div className="flex items-center justify-between mt-3">
                          <p className="text-xs text-muted-foreground/70 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatRelativeTime(notification.created_at)}
                          </p>
                          {!(notification.is_read || notification.read) && (
                            <div className="w-2 h-2 rounded-full bg-gradient-to-r from-primary to-primary-foreground animate-pulse shadow-sm"></div>
                          )}
                        </div>
                      </div>
                       {!(notification.is_read || notification.read) && (
                        <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 bg-white/80 hover:bg-white"
                            title="وضع كمقروء"
                            onClick={(e) => handleMarkAsRead(e, notification.id)}
                          >
                            <Eye className="w-4 h-4 text-primary" />
                          </Button>
                        </div>
                      )}
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