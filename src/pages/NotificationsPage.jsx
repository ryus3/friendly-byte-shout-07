import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { 
  Bell, Package, CheckCircle, AlertTriangle, Trash2, Check, Eye, UserPlus, Bot,
  ShoppingCart, TrendingDown, Star, Gift, Clock, CreditCard, Truck, 
  MessageSquare, Heart, Award, AlertCircle, Info, Zap, Target, MoreHorizontal,
  Volume2, VolumeX, Search, Settings, Users, TrendingUp, Filter
} from 'lucide-react';
import ScrollingText from '@/components/ui/scrolling-text';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useNotifications } from '@/contexts/NotificationsContext';
import { useNotificationsSystem } from '@/contexts/NotificationsSystemContext';
import { useSuper } from '@/contexts/SuperProvider';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNowStrict } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import NotificationSettingsDialog from '@/components/settings/NotificationSettingsDialog';
import { getStatusConfig } from '@/lib/alwaseet-statuses';

// دالة محسنة للحصول على ألوان إشعارات الوسيط حسب state_id
const getAlWaseetNotificationColors = (stateId) => {
  if (!stateId) {
    return {
      bg: 'bg-gradient-to-r from-sky-50 to-cyan-100 dark:from-sky-950/30 dark:to-cyan-900/30',
      border: 'border-r-4 border-sky-400 dark:border-sky-500',
      text: 'text-sky-900 dark:text-sky-100',
      icon: 'text-sky-600 dark:text-sky-400',
      dot: 'bg-sky-500'
    };
  }

  // تحديد الألوان الحيوية حسب state_id - ألوان جميلة وحيوية
  switch (String(stateId)) {
    case '2': // استلام المندوب - فيروزي حيوي
      return {
        bg: 'bg-gradient-to-r from-teal-50 to-teal-100 dark:from-teal-950/30 dark:to-teal-900/30',
        border: 'border-r-4 border-teal-500 dark:border-teal-400',
        text: 'text-teal-900 dark:text-teal-100',
        icon: 'text-teal-600 dark:text-teal-400',
        dot: 'bg-teal-500'
      };
    case '4': // تم التسليم - أخضر زمردي
      return {
        bg: 'bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/30',
        border: 'border-r-4 border-emerald-500 dark:border-emerald-400',
        text: 'text-emerald-900 dark:text-emerald-100',
        icon: 'text-emerald-600 dark:text-emerald-400',
        dot: 'bg-emerald-500'
      };
    case '17': // إرجاع - بنفسجي رائع
      return {
        bg: 'bg-gradient-to-r from-violet-50 to-violet-100 dark:from-violet-950/30 dark:to-violet-900/30',
        border: 'border-r-4 border-violet-500 dark:border-violet-400',
        text: 'text-violet-900 dark:text-violet-100',
        icon: 'text-violet-600 dark:text-violet-400',
        dot: 'bg-violet-500'
      };
    case '25':
    case '26': // لا يرد - ذهبي حيوي
      return {
        bg: 'bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-950/30 dark:to-amber-900/30',
        border: 'border-r-4 border-amber-500 dark:border-amber-400',
        text: 'text-amber-900 dark:text-amber-100',
        icon: 'text-amber-600 dark:text-amber-400',
        dot: 'bg-amber-500'
      };
    case '27':
    case '28':
    case '33':
    case '40': // حالات خاصة - بنفسجي نيلي مميز
      return {
        bg: 'bg-gradient-to-r from-indigo-50 to-violet-100 dark:from-indigo-950/30 dark:to-violet-900/30',
        border: 'border-r-4 border-indigo-500 dark:border-indigo-400',
        text: 'text-indigo-900 dark:text-indigo-100',
        icon: 'text-indigo-600 dark:text-indigo-400',
        dot: 'bg-indigo-500'
      };
    case '31':
    case '32': // إلغاء/رفض - أحمر وردي
      return {
        bg: 'bg-gradient-to-r from-rose-50 to-red-100 dark:from-rose-950/30 dark:to-red-900/30',
        border: 'border-r-4 border-rose-500 dark:border-rose-400',
        text: 'text-rose-900 dark:text-rose-100',
        icon: 'text-rose-600 dark:text-rose-400',
        dot: 'bg-rose-500'
      };
    default:
      // استخدام النظام المحسن للحالات الأخرى
      const statusConfig = getStatusConfig(Number(stateId));
      const color = statusConfig.color || 'sky';
      
      switch (color) {
        case 'green':
          return {
            bg: 'bg-gradient-to-r from-emerald-50 to-green-100 dark:from-emerald-950/30 dark:to-green-900/30',
            border: 'border-r-4 border-emerald-500 dark:border-emerald-400',
            text: 'text-emerald-900 dark:text-emerald-100',
            icon: 'text-emerald-600 dark:text-emerald-400',
            dot: 'bg-emerald-500'
          };
        case 'red':
          return {
            bg: 'bg-gradient-to-r from-rose-50 to-red-100 dark:from-rose-950/30 dark:to-red-900/30',
            border: 'border-r-4 border-rose-500 dark:border-rose-400',
            text: 'text-rose-900 dark:text-rose-100',
            icon: 'text-rose-600 dark:text-rose-400',
            dot: 'bg-rose-500'
          };
        case 'yellow':
        case 'orange':
          return {
            bg: 'bg-gradient-to-r from-amber-50 to-orange-100 dark:from-amber-950/30 dark:to-orange-900/30',
            border: 'border-r-4 border-amber-500 dark:border-amber-400',
            text: 'text-amber-900 dark:text-amber-100',
            icon: 'text-amber-600 dark:text-amber-400',
            dot: 'bg-amber-500'
          };
        case 'gray':
        case 'grey':
          return {
            bg: 'bg-gradient-to-r from-violet-50 to-purple-100 dark:from-violet-950/30 dark:to-purple-900/30',
            border: 'border-r-4 border-violet-500 dark:border-violet-400',
            text: 'text-violet-900 dark:text-violet-100',
            icon: 'text-violet-600 dark:text-violet-400',
            dot: 'bg-violet-500'
          };
        case 'blue':
        default:
          return {
            bg: 'bg-gradient-to-r from-sky-50 to-cyan-100 dark:from-sky-950/30 dark:to-cyan-900/30',
            border: 'border-r-4 border-sky-500 dark:border-sky-400',
            text: 'text-sky-900 dark:text-sky-100',
            icon: 'text-sky-600 dark:text-sky-400',
            dot: 'bg-sky-500'
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

// أيقونة خصومات المدن
const CityDiscountIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" className="fill-orange-100 stroke-orange-500" strokeWidth="1.5"/>
    <circle cx="12" cy="12" r="3" className="fill-orange-400"/>
    <text x="12" y="15" textAnchor="middle" className="fill-orange-700 text-[6px] font-bold">%</text>
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
  city_discount_selected: CityDiscountIcon,
  city_discounts: CityDiscountIcon,
  alwaseet_status_change: OrderIcon,
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
  // ألوان أكثر إشراقاً قليلاً مع الحفاظ على التصميم
  low_stock: { 
    bg: 'bg-amber-100/90 dark:bg-amber-900/20 backdrop-blur-sm', 
    border: 'border-r-4 border-amber-600 dark:border-amber-300',
    text: 'text-foreground', 
    icon: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-600'
  },
  stock_warning: { 
    bg: 'bg-orange-100/90 dark:bg-orange-900/20 backdrop-blur-sm', 
    border: 'border-r-4 border-orange-600 dark:border-orange-300',
    text: 'text-foreground', 
    icon: 'text-orange-700 dark:text-orange-300',
    dot: 'bg-orange-600'
  },
  out_of_stock: { 
    bg: 'bg-red-100/90 dark:bg-red-900/20 backdrop-blur-sm', 
    border: 'border-r-4 border-red-600 dark:border-red-300',
    text: 'text-foreground', 
    icon: 'text-red-700 dark:text-red-300',
    dot: 'bg-red-600'
  },
  order_completed: { 
    bg: 'bg-green-100/90 dark:bg-green-900/20 backdrop-blur-sm', 
    border: 'border-r-4 border-green-600 dark:border-green-300',
    text: 'text-foreground', 
    icon: 'text-green-700 dark:text-green-300',
    dot: 'bg-green-600'
  },
  order_shipped: { 
    bg: 'bg-blue-50/80 dark:bg-blue-900/10 backdrop-blur-sm', 
    border: 'border-r-4 border-blue-500 dark:border-blue-400',
    text: 'text-foreground', 
    icon: 'text-blue-600 dark:text-blue-400',
    dot: 'bg-blue-500'
  },
  alwaseet_status_change: { 
    bg: 'bg-gradient-to-r from-sky-50 to-cyan-100 dark:from-sky-950/30 dark:to-cyan-900/30', 
    border: 'border-r-4 border-sky-500 dark:border-sky-400',
    text: 'text-sky-900 dark:text-sky-100', 
    icon: 'text-sky-600 dark:text-sky-400',
    dot: 'bg-sky-500'
  },
  order_status_changed: { 
    bg: 'bg-gradient-to-r from-sky-50 to-cyan-100 dark:from-sky-950/30 dark:to-cyan-900/30', 
    border: 'border-r-4 border-sky-500 dark:border-sky-400',
    text: 'text-sky-900 dark:text-sky-100', 
    icon: 'text-sky-600 dark:text-sky-400',
    dot: 'bg-sky-500'
  },
  city_discount_selected: {
    bg: 'bg-gradient-to-r from-orange-50 to-amber-100 dark:from-orange-950/30 dark:to-amber-900/30',
    border: 'border-r-4 border-orange-500 dark:border-orange-400',
    text: 'text-orange-900 dark:text-orange-100',
    icon: 'text-orange-600 dark:text-orange-400',
    dot: 'bg-orange-500'
  },
  city_discounts: {
    bg: 'bg-gradient-to-r from-orange-50 to-amber-100 dark:from-orange-950/30 dark:to-amber-900/30',
    border: 'border-r-4 border-orange-500 dark:border-orange-400',
    text: 'text-orange-900 dark:text-orange-100',
    icon: 'text-orange-600 dark:text-orange-400',
    dot: 'bg-orange-500'
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
    bg: 'bg-gradient-to-r from-violet-50 to-purple-100 dark:from-violet-950/30 dark:to-purple-900/30', 
    border: 'border-r-4 border-violet-500 dark:border-violet-400',
    text: 'text-violet-900 dark:text-violet-100', 
    icon: 'text-violet-600 dark:text-violet-400',
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
    bg: 'bg-gradient-to-r from-indigo-50 to-blue-100 dark:from-indigo-950/30 dark:to-blue-900/30', 
    border: 'border-r-4 border-indigo-500 dark:border-indigo-400',
    text: 'text-indigo-900 dark:text-indigo-100', 
    icon: 'text-indigo-600 dark:text-indigo-400',
    dot: 'bg-indigo-500'
  },
  default: { 
    bg: 'bg-gradient-to-r from-sky-50 to-cyan-100 dark:from-sky-950/30 dark:to-cyan-900/30', 
    border: 'border-r-4 border-sky-500 dark:border-sky-400',
    text: 'text-sky-900 dark:text-sky-100', 
    icon: 'text-sky-600 dark:text-sky-400',
    dot: 'bg-sky-500'
  },
};

const NotificationsPage = () => {
  const { notifications, markAsRead, markAllAsRead, clearAll, deleteNotification, addNotification } = useNotifications();
  const { notifications: systemNotifications, markAsRead: markSystemAsRead, markAllAsRead: markAllSystemAsRead, deleteNotification: deleteSystemNotification } = useNotificationsSystem();
  const { orders } = useSuper();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // دمج الإشعارات من المصادر المختلفة وإزالة التكرار
  const allNotifications = [...notifications, ...systemNotifications]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .filter((notification, index, self) => 
      index === self.findIndex(n => n.id === notification.id)
    );

  const formatRelativeTime = (dateString) => {
    try {
      return formatDistanceToNowStrict(new Date(dateString), { addSuffix: true, locale: ar });
    } catch (error) {
      return 'منذ فترة';
    }
  };

  const filteredNotifications = allNotifications.filter(notification => {
    const matchesSearch = notification.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         notification.message.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'all' || 
                         (filter === 'unread' && !notification.is_read) ||
                         (filter === 'read' && notification.is_read);
    return matchesSearch && matchesFilter;
  });

  const unreadCount = allNotifications.filter(n => !n.is_read).length;
  const totalCount = allNotifications.length;
  const readCount = totalCount - unreadCount;

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
    if (notification.type === 'alwaseet_status_change' || notification.type === 'order_status_update') {
      const data = notification.data || {};
      const trackingNumber = data.tracking_number || '';
      if (trackingNumber) {
        navigate(`/my-orders?search=${encodeURIComponent(trackingNumber)}&highlight=order`);
      } else {
        navigate('/my-orders');
      }
    } else if (notification.type === 'city_discount_selected' || notification.type === 'city_discounts') {
      navigate('/customers-management?tab=city-discounts');
    } else if (notification.type === 'new_registration') {
      navigate('/dashboard?highlight=pending-registrations');
    } else if (notification.type === 'profit_settlement_request') {
      navigate('/profits-management?highlight=settlements');
    } else if (notification.type === 'low_stock' || notification.type === 'stock_warning') {
      navigate('/inventory');
    } else if (notification.link && notification.link !== '#') {
      navigate(notification.link);
    }
  };

  const handleMarkAsRead = (notification) => {
    if (notification.related_entity_type) {
      markSystemAsRead(notification.id);
    } else {
      markAsRead(notification.id);
    }
  };

  const handleDeleteNotification = (notification) => {
    if (notification.related_entity_type) {
      deleteSystemNotification(notification.id);
    } else {
      deleteNotification(notification.id);
    }
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead();
    markAllSystemAsRead();
  };

  const handleClearAll = () => {
    clearAll();
    // لا نحذف systemNotifications هنا لأنها قد تحتوي على إشعارات مهمة
  };

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
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmISBjiS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUEJXfI8N2QQAoUXrTp66hVFApGn+DyvmIQBjeS2vfNcSUE');
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
              <div className="text-xl md:text-2xl font-bold text-primary">{totalCount}</div>
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
              <div className="text-xl md:text-2xl font-bold text-green-600">{readCount}</div>
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
                <Button variant="outline" size="sm" onClick={handleMarkAllAsRead} disabled={unreadCount === 0} className="text-xs sm:text-sm">
                  <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 ml-1" />
                  <span className="hidden sm:inline">تحديد الكل كمقروء</span>
                  <span className="sm:hidden">قراءة الكل</span>
                </Button>
                <Button variant="destructive" size="sm" onClick={handleClearAll} disabled={totalCount === 0} className="text-xs sm:text-sm">
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
                    {filteredNotifications.map((notification) => {
                      const IconComponent = iconMap[notification.type] || iconMap.default;
                      let colorScheme = typeColorMap[notification.type] || typeColorMap.default;

                      // استخدام ألوان مخصصة لإشعارات الوسيط
                      if (notification.type === 'alwaseet_status_change' && notification.data?.state_id) {
                        colorScheme = getAlWaseetNotificationColors(notification.data.state_id);
                      }

                      return (
                        <motion.div
                          key={notification.id}
                          layout
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          className={cn(
                            "p-4 rounded-lg transition-all duration-200 hover:shadow-md cursor-pointer",
                            colorScheme.bg,
                            colorScheme.border,
                            !notification.is_read && "shadow-lg ring-1 ring-primary/20"
                          )}
                          onClick={(e) => handleNotificationClick(e, notification)}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1">
                              <div className={cn("mt-1 flex-shrink-0", colorScheme.icon)}>
                                <IconComponent />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                                    <ScrollingText text={notification.title} maxWidth="250px" />
                                  </h3>
                                  {!notification.is_read && (
                                    <div className={cn("w-2 h-2 rounded-full animate-pulse flex-shrink-0", colorScheme.dot)} />
                                  )}
                                </div>
                                <p className="text-xs leading-relaxed text-gray-950 dark:text-gray-50 mb-2">
                                  <ScrollingText text={notification.message} maxWidth="250px" />
                                </p>
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
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMarkAsRead(notification);
                                  }}
                                  title="تحديد كمقروء"
                                  className="h-8 w-8 sm:h-10 sm:w-10"
                                >
                                  <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteNotification(notification);
                                }}
                                title="حذف الإشعار"
                                className="text-destructive hover:text-destructive h-8 w-8 sm:h-10 sm:w-10"
                              >
                                <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
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