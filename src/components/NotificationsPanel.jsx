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
  new_order_employee: OrderIcon,
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
  // إشعارات المخزون - ألوان برتقالية وحمراء واضحة
  low_stock: { 
    bg: 'bg-gradient-to-r from-orange-100 to-amber-100 dark:from-orange-900/40 dark:to-amber-900/40', 
    border: 'border-l-4 border-orange-500 shadow-md shadow-orange-200 dark:shadow-orange-900/30',
    text: 'text-orange-900 dark:text-orange-100 font-medium', 
    icon: 'text-orange-600 dark:text-orange-400',
    dot: 'bg-orange-500 shadow-lg shadow-orange-300 dark:shadow-orange-700',
    pulse: 'animate-pulse bg-gradient-to-r from-orange-200 to-amber-200 dark:from-orange-800/60 dark:to-amber-800/60'
  },
  stock_warning: { 
    bg: 'bg-gradient-to-r from-red-100 to-orange-100 dark:from-red-900/40 dark:to-orange-900/40', 
    border: 'border-l-4 border-red-500 shadow-md shadow-red-200 dark:shadow-red-900/30',
    text: 'text-red-900 dark:text-red-100 font-medium', 
    icon: 'text-red-600 dark:text-red-400',
    dot: 'bg-red-500 shadow-lg shadow-red-300 dark:shadow-red-700',
    pulse: 'animate-pulse bg-gradient-to-r from-red-200 to-orange-200 dark:from-red-800/60 dark:to-orange-800/60'
  },
  
  // إشعارات الطلبات - ألوان زرقاء وخضراء واضحة
  order_completed: { 
    bg: 'bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/40 dark:to-emerald-900/40', 
    border: 'border-l-4 border-green-500 shadow-md shadow-green-200 dark:shadow-green-900/30',
    text: 'text-green-900 dark:text-green-100 font-medium', 
    icon: 'text-green-600 dark:text-green-400',
    dot: 'bg-green-500 shadow-lg shadow-green-300 dark:shadow-green-700',
    pulse: 'animate-pulse bg-gradient-to-r from-green-200 to-emerald-200 dark:from-green-800/60 dark:to-emerald-800/60'
  },
  order_shipped: { 
    bg: 'bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40', 
    border: 'border-l-4 border-blue-500 shadow-md shadow-blue-200 dark:shadow-blue-900/30',
    text: 'text-blue-900 dark:text-blue-100 font-medium', 
    icon: 'text-blue-600 dark:text-blue-400',
    dot: 'bg-blue-500 shadow-lg shadow-blue-300 dark:shadow-blue-700',
    pulse: 'animate-pulse bg-gradient-to-r from-blue-200 to-indigo-200 dark:from-blue-800/60 dark:to-indigo-800/60'
  },
  order_status_update: { 
    bg: 'bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-indigo-900/40 dark:to-purple-900/40', 
    border: 'border-l-4 border-indigo-500 shadow-md shadow-indigo-200 dark:shadow-indigo-900/30',
    text: 'text-indigo-900 dark:text-indigo-100 font-medium', 
    icon: 'text-indigo-600 dark:text-indigo-400',
    dot: 'bg-indigo-500 shadow-lg shadow-indigo-300 dark:shadow-indigo-700',
    pulse: 'animate-pulse bg-gradient-to-r from-indigo-200 to-purple-200 dark:from-indigo-800/60 dark:to-purple-800/60'
  },
  new_order: { 
    bg: 'bg-gradient-to-r from-cyan-100 to-blue-100 dark:from-cyan-900/40 dark:to-blue-900/40', 
    border: 'border-l-4 border-cyan-500 shadow-md shadow-cyan-200 dark:shadow-cyan-900/30',
    text: 'text-cyan-900 dark:text-cyan-100 font-medium', 
    icon: 'text-cyan-600 dark:text-cyan-400',
    dot: 'bg-cyan-500 shadow-lg shadow-cyan-300 dark:shadow-cyan-700',
    pulse: 'animate-pulse bg-gradient-to-r from-cyan-200 to-blue-200 dark:from-cyan-800/60 dark:to-blue-800/60'
  },
  new_order_employee: { 
    bg: 'bg-gradient-to-r from-teal-100 to-cyan-100 dark:from-teal-900/40 dark:to-cyan-900/40', 
    border: 'border-l-4 border-teal-500 shadow-md shadow-teal-200 dark:shadow-teal-900/30',
    text: 'text-teal-900 dark:text-teal-100 font-medium', 
    icon: 'text-teal-600 dark:text-teal-400',
    dot: 'bg-teal-500 shadow-lg shadow-teal-300 dark:shadow-teal-700',
    pulse: 'animate-pulse bg-gradient-to-r from-teal-200 to-cyan-200 dark:from-teal-800/60 dark:to-cyan-800/60'
  },
  
  // إشعارات المستخدمين والتسجيل - ألوان بنفسجية
  new_registration: { 
    bg: 'bg-gradient-to-r from-purple-100 to-violet-100 dark:from-purple-900/40 dark:to-violet-900/40', 
    border: 'border-l-4 border-purple-500 shadow-md shadow-purple-200 dark:shadow-purple-900/30',
    text: 'text-purple-900 dark:text-purple-100 font-medium', 
    icon: 'text-purple-600 dark:text-purple-400',
    dot: 'bg-purple-500 shadow-lg shadow-purple-300 dark:shadow-purple-700',
    pulse: 'animate-pulse bg-gradient-to-r from-purple-200 to-violet-200 dark:from-purple-800/60 dark:to-violet-800/60'
  },
  
  // إشعارات الأرباح والتحاسب - ألوان ذهبية وخضراء
  profit_settlement: { 
    bg: 'bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/40 dark:to-amber-900/40', 
    border: 'border-l-4 border-yellow-500 shadow-md shadow-yellow-200 dark:shadow-yellow-900/30',
    text: 'text-yellow-900 dark:text-yellow-100 font-medium', 
    icon: 'text-yellow-600 dark:text-yellow-400',
    dot: 'bg-yellow-500 shadow-lg shadow-yellow-300 dark:shadow-yellow-700',
    pulse: 'animate-pulse bg-gradient-to-r from-yellow-200 to-amber-200 dark:from-yellow-800/60 dark:to-amber-800/60'
  },
  profit_settlement_request: { 
    bg: 'bg-gradient-to-r from-emerald-100 to-green-100 dark:from-emerald-900/40 dark:to-green-900/40', 
    border: 'border-l-4 border-emerald-500 shadow-md shadow-emerald-200 dark:shadow-emerald-900/30',
    text: 'text-emerald-900 dark:text-emerald-100 font-medium', 
    icon: 'text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500 shadow-lg shadow-emerald-300 dark:shadow-emerald-700',
    pulse: 'animate-pulse bg-gradient-to-r from-emerald-200 to-green-200 dark:from-emerald-800/60 dark:to-green-800/60'
  },
  employee_settlement_completed: { 
    bg: 'bg-gradient-to-r from-lime-100 to-green-100 dark:from-lime-900/40 dark:to-green-900/40', 
    border: 'border-l-4 border-lime-500 shadow-md shadow-lime-200 dark:shadow-lime-900/30',
    text: 'text-lime-900 dark:text-lime-100 font-medium', 
    icon: 'text-lime-600 dark:text-lime-400',
    dot: 'bg-lime-500 shadow-lg shadow-lime-300 dark:shadow-lime-700',
    pulse: 'animate-pulse bg-gradient-to-r from-lime-200 to-green-200 dark:from-lime-800/60 dark:to-green-800/60'
  },
  settlement_request: { 
    bg: 'bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-900/40 dark:to-teal-900/40', 
    border: 'border-l-4 border-emerald-500 shadow-md shadow-emerald-200 dark:shadow-emerald-900/30',
    text: 'text-emerald-900 dark:text-emerald-100 font-medium', 
    icon: 'text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500 shadow-lg shadow-emerald-300 dark:shadow-emerald-700',
    pulse: 'animate-pulse bg-gradient-to-r from-emerald-200 to-teal-200 dark:from-emerald-800/60 dark:to-teal-800/60'
  },
  
  // إشعارات الذكاء الاصطناعي - ألوان زرقاء متدرجة
  ai_order: { 
    bg: 'bg-gradient-to-r from-sky-100 to-blue-100 dark:from-sky-900/40 dark:to-blue-900/40', 
    border: 'border-l-4 border-sky-500 shadow-md shadow-sky-200 dark:shadow-sky-900/30',
    text: 'text-sky-900 dark:text-sky-100 font-medium', 
    icon: 'text-sky-600 dark:text-sky-400',
    dot: 'bg-sky-500 shadow-lg shadow-sky-300 dark:shadow-sky-700',
    pulse: 'animate-pulse bg-gradient-to-r from-sky-200 to-blue-200 dark:from-sky-800/60 dark:to-blue-800/60'
  },
  
  // إشعارات النظام العامة - ألوان رمادية أنيقة
  system: { 
    bg: 'bg-gradient-to-r from-slate-100 to-gray-100 dark:from-slate-900/40 dark:to-gray-900/40', 
    border: 'border-l-4 border-slate-500 shadow-md shadow-slate-200 dark:shadow-slate-900/30',
    text: 'text-slate-900 dark:text-slate-100 font-medium', 
    icon: 'text-slate-600 dark:text-slate-400',
    dot: 'bg-slate-500 shadow-lg shadow-slate-300 dark:shadow-slate-700',
    pulse: 'animate-pulse bg-gradient-to-r from-slate-200 to-gray-200 dark:from-slate-800/60 dark:to-gray-800/60'
  },
  inventory_update: { 
    bg: 'bg-gradient-to-r from-violet-100 to-purple-100 dark:from-violet-900/40 dark:to-purple-900/40', 
    border: 'border-l-4 border-violet-500 shadow-md shadow-violet-200 dark:shadow-violet-900/30',
    text: 'text-violet-900 dark:text-violet-100 font-medium', 
    icon: 'text-violet-600 dark:text-violet-400',
    dot: 'bg-violet-500 shadow-lg shadow-violet-300 dark:shadow-violet-700',
    pulse: 'animate-pulse bg-gradient-to-r from-violet-200 to-purple-200 dark:from-violet-800/60 dark:to-purple-800/60'
  },
  inventory_cleanup: { 
    bg: 'bg-gradient-to-r from-indigo-100 to-blue-100 dark:from-indigo-900/40 dark:to-blue-900/40', 
    border: 'border-l-4 border-indigo-500 shadow-md shadow-indigo-200 dark:shadow-indigo-900/30',
    text: 'text-indigo-900 dark:text-indigo-100 font-medium', 
    icon: 'text-indigo-600 dark:text-indigo-400',
    dot: 'bg-indigo-500 shadow-lg shadow-indigo-300 dark:shadow-indigo-700',
    pulse: 'animate-pulse bg-gradient-to-r from-indigo-200 to-blue-200 dark:from-indigo-800/60 dark:to-blue-800/60'
  },
  order_deleted: { 
    bg: 'bg-gradient-to-r from-rose-100 to-red-100 dark:from-rose-900/40 dark:to-red-900/40', 
    border: 'border-l-4 border-rose-500 shadow-md shadow-rose-200 dark:shadow-rose-900/30',
    text: 'text-rose-900 dark:text-rose-100 font-medium', 
    icon: 'text-rose-600 dark:text-rose-400',
    dot: 'bg-rose-500 shadow-lg shadow-rose-300 dark:shadow-rose-700',
    pulse: 'animate-pulse bg-gradient-to-r from-rose-200 to-red-200 dark:from-rose-800/60 dark:to-red-800/60'
  },
  default: { 
    bg: 'bg-gradient-to-r from-gray-100 to-slate-100 dark:from-gray-900/40 dark:to-slate-900/40', 
    border: 'border-l-4 border-gray-500 shadow-md shadow-gray-200 dark:shadow-gray-900/30',
    text: 'text-gray-900 dark:text-gray-100 font-medium', 
    icon: 'text-gray-600 dark:text-gray-400',
    dot: 'bg-gray-500 shadow-lg shadow-gray-300 dark:shadow-gray-700',
    pulse: 'animate-pulse bg-gradient-to-r from-gray-200 to-slate-200 dark:from-gray-800/60 dark:to-slate-800/60'
  }
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
    } else if (notification.type === 'order_status_update' || notification.type === 'new_order' || notification.type === 'new_order_employee') {
      // استخراج معرف الطلب من البيانات أو الرسالة للتنقل المباشر
      const data = notification.data || {};
      const orderId = data.order_id;
      const orderNumber = data.order_number;
      
      // إشعارات تحديث الحالة تذهب لمتابعة الطلبات
      if (notification.type === 'order_status_update') {
        if (orderId) {
          navigate(`/employee-follow-up?highlight=${orderId}`);
        } else if (orderNumber) {
          navigate(`/employee-follow-up?search=${encodeURIComponent(orderNumber)}`);
        } else {
          navigate('/employee-follow-up');
        }
      } else {
        // الطلبات الجديدة تذهب لصفحة الطلبات
        if (orderId) {
          navigate(`/orders?highlight=${orderId}`);
        } else if (orderNumber) {
          navigate(`/orders?search=${encodeURIComponent(orderNumber)}`);
        } else {
          // استخراج رقم الطلب من الرسالة كبديل
          const orderMatch = notification.message.match(/#(\w+)|رقم (\w+)|طلب (\w+)/);
          const extractedOrderNumber = orderMatch ? (orderMatch[1] || orderMatch[2] || orderMatch[3]) : '';
          
          if (extractedOrderNumber) {
            navigate(`/orders?search=${encodeURIComponent(extractedOrderNumber)}`);
          } else {
            navigate('/orders?status=pending');
          }
        }
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
    } else if (notification.type === 'profit_settlement_request' || notification.type === 'settlement_request') {
      // طلب تحاسب من موظف - التوجه لصفحة متابعة الموظفين مع الفلترة
      console.log('🔔 إشعار طلب التحاسب:', notification);
      
      const data = notification.data || {};
      const employeeId = data.employee_id || data.employeeId;
      const orderIds = data.order_ids || data.orderIds || [];
      
      console.log('🔍 بيانات طلب التحاسب:', { employeeId, orderIds, data });
      
      if (employeeId && orderIds && orderIds.length > 0) {
        // توجيه مع معاملات الفلترة
        console.log('📍 توجيه لصفحة متابعة الموظفين مع الطلبات المحددة');
        navigate(`/employee-follow-up?employee=${employeeId}&orders=${orderIds.join(',')}&highlight=settlement`);
      } else {
        // توجيه عادي إذا لم تكن البيانات متوفرة
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

  const getNotificationTypeLabel = (type) => {
    const typeLabels = {
      low_stock: 'مخزون منخفض',
      stock_warning: 'تحذير مخزون',
      order_completed: 'طلب مكتمل',
      order_shipped: 'طلب مشحون',
      new_order: 'طلب جديد',
      new_order_employee: 'طلب موظف',
      new_registration: 'تسجيل جديد',
      profit_settlement: 'تسوية أرباح',
      profit_settlement_request: 'طلب تسوية',
      employee_settlement_completed: 'تسوية مكتملة',
      ai_order: 'طلب ذكي',
      system: 'نظام',
      inventory_update: 'تحديث مخزون',
      inventory_cleanup: 'تنظيف مخزون',
      order_deleted: 'طلب محذوف',
      default: 'عام'
    };
    return typeLabels[type] || 'عام';
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
        <Button 
          variant="ghost" 
          size="icon" 
          className="relative hover:bg-primary/10 transition-all duration-300 hover:scale-110 rounded-xl"
        >
          <Bell className="h-5 w-5" />
          {unreadFilteredCount > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 20 }}
            >
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-6 w-6 justify-center rounded-full p-0 font-bold text-xs animate-bounce shadow-lg border-2 border-white"
              >
                {unreadFilteredCount > 99 ? "99+" : unreadFilteredCount}
              </Badge>
            </motion.div>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-96 md:w-[420px] rounded-2xl p-0 overflow-hidden shadow-2xl border-2 bg-background/95 backdrop-blur-xl" align="end">
        <DropdownMenuLabel className="flex justify-between items-center px-6 py-4 bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10 border-b-2 border-border/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-xl">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <span className="font-bold text-xl bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              الإشعارات
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-9 px-3 bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-300 rounded-xl font-medium shadow-sm transition-all duration-200 hover:scale-105" 
              onClick={() => navigate('/notifications')} 
              title="عرض كل الإشعارات"
            >
              <Eye className="w-4 h-4 mr-1" />
              عرض الكل
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-9 px-3 bg-green-100 text-green-700 hover:bg-green-200 border border-green-300 rounded-xl font-medium shadow-sm transition-all duration-200 hover:scale-105" 
              onClick={handleMarkAllAsRead} 
              title="تحديد الكل كمقروء" 
              disabled={unreadFilteredCount === 0}
            >
              <Check className="w-4 h-4 mr-1" />
              تحديد الكل
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-9 px-3 bg-red-100 text-red-700 hover:bg-red-200 border border-red-300 rounded-xl font-medium shadow-sm transition-all duration-200 hover:scale-105" 
              onClick={handleClearAll} 
              title="حذف الكل" 
              disabled={allNotifications.length === 0}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              مسح الكل
            </Button>
          </div>
        </DropdownMenuLabel>
        <ScrollArea className="h-96 px-3 py-2">
          <div className="space-y-3 py-2">
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
                      initial={{ opacity: 0, y: 20, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, x: -20, scale: 0.9, transition: { duration: 0.2 } }}
                      whileHover={{ scale: 1.02, y: -2 }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                      className="relative group"
                    >
                      <div 
                        className={cn(
                          "flex items-start gap-4 p-4 cursor-pointer transition-all duration-300 rounded-2xl relative overflow-hidden", 
                          colors.bg,
                          colors.border,
                          !(notification.is_read || notification.read) && "ring-2 ring-primary/20 shadow-xl",
                          "hover:shadow-2xl hover:scale-[1.02] transform-gpu"
                        )}
                        onClick={(e) => handleNotificationClick(e, notification)}
                      >
                        {/* تأثير الخلفية المتحركة للإشعارات غير المقروءة */}
                        {!(notification.is_read || notification.read) && (
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse"></div>
                        )}
                        
                        <div className={cn(
                          "p-3 rounded-xl shrink-0 shadow-lg transform transition-transform group-hover:scale-110 relative z-10", 
                          colors.icon,
                          "bg-white/90 backdrop-blur-sm border border-white/20"
                        )}>
                          <IconComponent />
                        </div>
                        
                        <div className="flex-1 min-w-0 relative z-10">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <h3 className={cn("font-bold text-base leading-tight", colors.text)}>
                              {notification.title}
                            </h3>
                            <div className="flex items-center gap-2 shrink-0">
                              {!(notification.is_read || notification.read) && (
                                <div className={cn("w-3 h-3 rounded-full animate-pulse shadow-lg", colors.dot)}></div>
                              )}
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-7 w-7 p-0 opacity-60 hover:opacity-100 transition-opacity bg-white/20 hover:bg-white/40 rounded-xl backdrop-blur-sm"
                                title="وضع كمقروء"
                                onClick={(e) => handleMarkAsRead(e, notification.id)}
                              >
                                <Eye className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          
                          <p className={cn("text-sm leading-relaxed mb-3", colors.text, "opacity-90")}>
                            {notification.message}
                          </p>
                          
                          <div className="flex items-center justify-between pt-2 border-t border-white/20">
                            <div className="flex items-center gap-2">
                              <Clock className="w-3 h-3 opacity-60" />
                              <p className={cn("text-sm font-medium", colors.text, "opacity-75")}>
                                {formatRelativeTime(notification.created_at)}
                              </p>
                            </div>
                            {notification.type && (
                              <Badge 
                                variant="secondary" 
                                className={cn(
                                  "text-xs px-3 py-1 h-6 rounded-full font-bold shadow-md border", 
                                  colors.bg, 
                                  colors.text,
                                  "bg-white/30 border-white/40 backdrop-blur-sm"
                                )}
                              >
                                {getNotificationTypeLabel(notification.type)}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })
              ) : (
                <div className="text-center py-16 px-4">
                  <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center shadow-lg">
                    <Bell className="w-10 h-10 text-gray-400" />
                  </div>
                  <p className="text-xl font-bold text-muted-foreground mb-2">لا توجد إشعارات</p>
                  <p className="text-sm text-muted-foreground/60">ستظهر الإشعارات الجديدة هنا</p>
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