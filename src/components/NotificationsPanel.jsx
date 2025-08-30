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
import { useUnifiedNotifications } from '@/contexts/UnifiedNotificationsContext';
import PendingRegistrations from './dashboard/PendingRegistrations';
import AiOrdersManager from './dashboard/AiOrdersManager';
import { formatDistanceToNowStrict } from 'date-fns';
import { ar } from 'date-fns/locale';
import { getStatusConfig } from '@/lib/alwaseet-statuses';

// دالة محسنة للحصول على ألوان إشعارات الوسيط حسب state_id
const getAlWaseetNotificationColors = (stateId) => {
  if (!stateId) {
    return {
      bg: 'bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900/10 dark:to-slate-800/10',
      border: 'border-r-4 border-slate-300 dark:border-slate-600',
      text: 'text-foreground',
      icon: 'text-slate-600 dark:text-slate-400',
      dot: 'bg-slate-500'
    };
  }

  // تحديد الألوان حسب state_id بدقة
  switch (String(stateId)) {
    case '2': // استلام المندوب - أزرق
      return {
        bg: 'bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20',
        border: 'border-r-4 border-blue-400 dark:border-blue-500',
        text: 'text-blue-900 dark:text-blue-100',
        icon: 'text-blue-600 dark:text-blue-400',
        dot: 'bg-blue-500'
      };
    case '4': // تم التسليم - أخضر
      return {
        bg: 'bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20',
        border: 'border-r-4 border-green-400 dark:border-green-500',
        text: 'text-green-900 dark:text-green-100',
        icon: 'text-green-600 dark:text-green-400',
        dot: 'bg-green-500'
      };
    case '17': // إرجاع - رمادي
      return {
        bg: 'bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900/20 dark:to-gray-800/20',
        border: 'border-r-4 border-gray-400 dark:border-gray-500',
        text: 'text-gray-900 dark:text-gray-100',
        icon: 'text-gray-600 dark:text-gray-400',
        dot: 'bg-gray-500'
      };
    case '25':
    case '26': // لا يرد - أصفر/برتقالي
      return {
        bg: 'bg-gradient-to-r from-yellow-50 to-orange-100 dark:from-yellow-900/20 dark:to-orange-800/20',
        border: 'border-r-4 border-yellow-400 dark:border-yellow-500',
        text: 'text-yellow-900 dark:text-yellow-100',
        icon: 'text-yellow-600 dark:text-yellow-400',
        dot: 'bg-yellow-500'
      };
    case '31':
    case '32': // إلغاء/رفض - أحمر
      return {
        bg: 'bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20',
        border: 'border-r-4 border-red-400 dark:border-red-500',
        text: 'text-red-900 dark:text-red-100',
        icon: 'text-red-600 dark:text-red-400',
        dot: 'bg-red-500'
      };
    default:
      // استخدام النظام القديم للحالات الأخرى
      const statusConfig = getStatusConfig(Number(stateId));
      const color = statusConfig.color || 'blue';
      
      switch (color) {
        case 'green':
          return {
            bg: 'bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/10 dark:to-green-800/10',
            border: 'border-r-4 border-green-500 dark:border-green-400',
            text: 'text-foreground',
            icon: 'text-green-600 dark:text-green-400',
            dot: 'bg-green-500'
          };
        case 'red':
          return {
            bg: 'bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/10 dark:to-red-800/10',
            border: 'border-r-4 border-red-500 dark:border-red-400',
            text: 'text-foreground',
            icon: 'text-red-600 dark:text-red-400',
            dot: 'bg-red-500'
          };
        case 'yellow':
        case 'orange':
          return {
            bg: 'bg-gradient-to-r from-yellow-50 to-orange-100 dark:from-yellow-900/10 dark:to-orange-800/10',
            border: 'border-r-4 border-yellow-500 dark:border-yellow-400',
            text: 'text-foreground',
            icon: 'text-yellow-600 dark:text-yellow-400',
            dot: 'bg-yellow-500'
          };
        case 'gray':
        case 'grey':
          return {
            bg: 'bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900/10 dark:to-gray-800/10',
            border: 'border-r-4 border-gray-500 dark:border-gray-400',
            text: 'text-foreground',
            icon: 'text-gray-600 dark:text-gray-400',
            dot: 'bg-gray-500'
          };
        case 'blue':
        default:
          return {
            bg: 'bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/10 dark:to-blue-800/10',
            border: 'border-r-4 border-blue-500 dark:border-blue-400',
            text: 'text-foreground',
            icon: 'text-blue-600 dark:text-blue-400',
            dot: 'bg-blue-500'
          };
      }
  }
};

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
  order_status_changed: OrderIcon,
  new_order: OrderIcon,
  new_order_employee: SystemIcon,
  new_registration: UserRegistrationIcon,
  profit_settlement: ProfitIcon,
  profit_settlement_request: ProfitSettlementIcon,
  employee_settlement_completed: ProfitSettlementIcon,
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
  alwaseet_status_change: { 
    bg: 'bg-blue-50/80 dark:bg-blue-900/10 backdrop-blur-sm', 
    border: 'border-r-4 border-blue-500 dark:border-blue-400',
    text: 'text-foreground', 
    icon: 'text-blue-600 dark:text-blue-400',
    dot: 'bg-blue-500'
  },
  order_status_changed: { 
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
  new_order_employee: { 
    bg: 'bg-yellow-50/80 dark:bg-yellow-900/10 backdrop-blur-sm', 
    border: 'border-r-4 border-yellow-500 dark:border-yellow-400',
    text: 'text-foreground', 
    icon: 'text-yellow-600 dark:text-yellow-400',
    dot: 'bg-yellow-500'
  },
  ai_order: { 
    bg: 'bg-slate-50/80 dark:bg-slate-900/10 backdrop-blur-sm', 
    border: 'border-r-4 border-transparent',
    text: 'text-foreground', 
    icon: 'text-indigo-600 dark:text-indigo-400',
    dot: 'bg-violet-500'
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
  employee_settlement_completed: { 
    bg: 'bg-green-50/80 dark:bg-green-900/10 backdrop-blur-sm', 
    border: 'border-r-4 border-green-500 dark:border-green-400',
    text: 'text-foreground', 
    icon: 'text-green-600 dark:text-green-400',
    dot: 'bg-green-500'
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
  const { notifications, markAsRead, markAllAsRead, clearAllNotifications, deleteNotification } = useUnifiedNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [showPendingRegistrations, setShowPendingRegistrations] = useState(false);
  const [showAiOrdersManager, setShowAiOrdersManager] = useState(false);
  const navigate = useNavigate();

  const handleNotificationClick = (e, notification) => {
    e.stopPropagation();
    
    // تحديد الإشعار كمقروء
    if (!notification.read) {
      markAsRead(notification.id);
    }
    
    // التنقل المتقدم مع فلترة دقيقة حسب البيانات
    if (notification.type === 'new_registration') {
      setShowPendingRegistrations(true);
    } else if (notification.type === 'ai_order') {
      // افتح نافذة طلبات الذكاء الاصطناعي فوق لوحة التحكم مع تحديد الطلب
      const aiOrderId = notification?.data?.ai_order_id || notification?.data?.id || notification?.related_entity_id;
      window.dispatchEvent(new CustomEvent('openAiOrdersManager', { detail: { aiOrderId } }));
      setIsOpen(false);
      return;
    } else if (notification.type === 'low_stock' || notification.type === 'stock_warning') {
      // استخراج اسم المنتج من الرسالة للفلترة الدقيقة
      const productMatch = notification.message.match(/المنتج "([^"]+)"/);
      const productName = productMatch ? productMatch[1] : '';
      if (productName) {
        navigate(`/inventory?search=${encodeURIComponent(productName)}&filter=low_stock`);
      } else {
        navigate('/inventory?filter=low_stock');
      }
    } else if (notification.type === 'order_status_changed' || notification.type === 'order_status_update' || notification.type === 'new_order' || notification.type === 'new_order_employee') {
      // استخراج بيانات الطلب: نحاول من data أولاً ثم من النص
      const data = notification.data || {};
      const orderId = data.order_id || data.id || null;
      const orderNumberFromData = data.order_number || data.orderNo || null;
      let orderNumber = orderNumberFromData;
      if (!orderNumber) {
        const orderMatch = notification.message.match(/ORD\d+/) || notification.message.match(/#(\w+)|رقم (\w+)|طلب (\w+)/);
        orderNumber = orderMatch ? (orderMatch[0] || orderMatch[1] || orderMatch[2] || orderMatch[3]) : '';
      }
      // افتح صفحة متابعة الطلبات مع تمرير رقم الطلب وتظليل السجل
      const query = new URLSearchParams();
      if (orderNumber) query.set('order', orderNumber);
      if (orderId) query.set('highlight', orderId);
      navigate(`/employee-follow-up?${query.toString()}`);
      // اطلب تحديثاً فورياً احتياطياً
      window.dispatchEvent(new CustomEvent('orderCreated', { detail: { id: orderId, orderNumber } }));
    } else if (notification.type === 'order_completed') {
      // استخراج رقم الطلب المكتمل
      const orderMatch = notification.message.match(/#(\w+)|رقم (\w+)|طلب (\w+)/);
      const orderNumber = orderMatch ? (orderMatch[1] || orderMatch[2] || orderMatch[3]) : '';
      if (orderNumber) {
        navigate(`/orders?search=${encodeURIComponent(orderNumber)}&status=completed`);
      } else {
        navigate('/orders?status=completed');
      }
    } else if (notification.type === 'profit_settlement_request' || notification.type === 'settlement_request') {
      // طلب تحاسب من موظف - التوجه لصفحة متابعة الموظفين مع الفلترة
      console.log('🔔 إشعار طلب التحاسب:', notification);
      const data = notification.data || {};
      const employeeId = data.employee_id || data.employeeId;
      const orderIds = data.order_ids || data.orderIds || [];
      console.log('🔍 بيانات طلب التحاسب:', { employeeId, orderIds, data });
      if (employeeId && orderIds && orderIds.length > 0) {
        console.log('📍 توجيه لصفحة متابعة الموظفين مع الطلبات المحددة');
        navigate(`/employee-follow-up?employee=${employeeId}&orders=${orderIds.join(',')}&highlight=settlement`);
      } else {
        console.warn('⚠️ بيانات التحاسب غير مكتملة، توجيه عادي');
        navigate('/employee-follow-up');
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
          navigate('/employee-follow-up');
          break;
        case 'settlement_invoice':
          navigate('/employee-follow-up');
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
    clearAllNotifications();
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

  // تحسين دمج الإشعارات ومنع التكرار الذكي
  // دوال مساعدة لاستخراج tracking/state عند غياب data
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
  const allNotifications = notifications.filter(n => n.type !== 'welcome');
  
  const sortedNotifications = allNotifications.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const unreadFilteredCount = sortedNotifications.filter(n => !n.read).length;

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
              disabled={sortedNotifications.length === 0}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="mx-0 bg-border/50" />
        <ScrollArea className="h-80 px-2">
          <div className="space-y-2 py-2">
            <AnimatePresence>
              {sortedNotifications.length > 0 ? (
                sortedNotifications.slice(0, 8).map(notification => {
                  const notificationType = notification.type || 'default';
                  
                  // استخدام ألوان الوسيط إذا كان الإشعار من نوع alwaseet_status_change
                  let colors;
                  if (notificationType === 'alwaseet_status_change') {
                    const sid = notification.data?.state_id || parseAlwaseetStateIdFromMessage(notification.message) || notification.data?.status_id;
                    colors = getAlWaseetNotificationColors(sid);
                  } else {
                    colors = typeColorMap[notificationType] || typeColorMap.default;
                  }
                  
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
                      {notificationType === 'ai_order' && (
                        <span className="pointer-events-none absolute inset-y-0 right-0 w-1.5 rounded-r bg-gradient-to-b from-indigo-500 via-violet-500 to-blue-500 opacity-90" />
                      )}
                      <div 
                        className={cn(
                          "flex items-start gap-3 p-3 cursor-pointer transition-all duration-300 rounded-lg", 
                          colors.bg,
                          colors.border,
                          (notification.read) ? "opacity-70" : "shadow-sm hover:shadow-md",
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
                            {!notification.read && (
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
                            {!notification.read && (
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