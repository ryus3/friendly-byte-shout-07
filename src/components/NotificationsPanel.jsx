import React, { useState } from 'react';
import { 
  Bell, Package, CheckCircle, AlertTriangle, Trash2, Check, Eye, UserPlus, Bot,
  ShoppingCart, TrendingDown, Star, Gift, Clock, CreditCard, Truck, 
  MessageSquare, Heart, Award, AlertCircle, Info, Zap, Target, MoreHorizontal
} from 'lucide-react';
import ScrollingText from '@/components/ui/scrolling-text';
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
import { useSuper } from '@/contexts/SuperProvider';
import PendingRegistrations from './dashboard/PendingRegistrations';
import AiOrdersManager from './dashboard/AiOrdersManager';
import { formatDistanceToNowStrict } from 'date-fns';
import { ar } from 'date-fns/locale';
import { getStatusConfig } from '@/lib/alwaseet-statuses';
import { getStatusForComponent } from '@/lib/order-status-translator';

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

const AiOrderIcon = () => {
  const gradId = React.useId();
  const glowId = React.useId();
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="55%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
        <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.7" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter={`url(#${glowId})`}>
        <path d="M9 4.5a3 3 0 0 0-3 3v.2a3 3 0 0 0-2 2.8v.5a3 3 0 0 0 1.2 2.4A3 3 0 0 0 6 16.5a3 3 0 0 0 3 3 2.5 2.5 0 0 0 2.5-2.5V6.5A2 2 0 0 0 9.5 4.5H9z" stroke={`url(#${gradId})`} strokeWidth="1.4" strokeLinejoin="round" fill="none" />
        <path d="M15 4.5a3 3 0 0 1 3 3v.2a3 3 0 0 1 2 2.8v.5a3 3 0 0 1-1.2 2.4A3 3 0 0 1 18 16.5a3 3 0 0 1-3 3 2.5 2.5 0 0 1-2.5-2.5V6.5A2 2 0 0 1 14.5 4.5H15z" stroke={`url(#${gradId})`} strokeWidth="1.4" strokeLinejoin="round" fill="none" />
        <path d="M12 9.5l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7L12 9.5z" fill={`url(#${gradId})`} />
        <circle cx="7.5" cy="10" r="0.7" fill={`url(#${gradId})`} />
        <circle cx="16.5" cy="10" r="0.7" fill={`url(#${gradId})`} />
        <circle cx="9" cy="15" r="0.6" fill={`url(#${gradId})`} opacity="0.8" />
        <circle cx="15" cy="15" r="0.6" fill={`url(#${gradId})`} opacity="0.8" />
      </g>
    </svg>
  );
};

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

// أيقونة احترافية لإيراد الطلب — ورقة نقدية مع وميض ذهبي/زمردي
const RevenueReceivedIcon = () => {
  const gradId = React.useId();
  const glowId = React.useId();
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="55%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
        <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter={`url(#${glowId})`}>
        <rect x="2.5" y="6" width="19" height="12" rx="2.2" fill={`url(#${gradId})`} fillOpacity="0.18" stroke={`url(#${gradId})`} strokeWidth="1.4" />
        <circle cx="12" cy="12" r="2.8" fill="none" stroke={`url(#${gradId})`} strokeWidth="1.4" />
        <path d="M12 10.4v3.2M10.9 11.2c.3-.4.9-.5 1.4-.3.5.2.6.7.2 1-.4.3-1 .2-1.4.1-.4-.1-.6.3-.3.6.4.4 1.1.5 1.6.3" stroke={`url(#${gradId})`} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <circle cx="5.5" cy="12" r="0.9" fill={`url(#${gradId})`} />
        <circle cx="18.5" cy="12" r="0.9" fill={`url(#${gradId})`} />
        <path d="M19.5 4.5l.7 1.4 1.4.7-1.4.7-.7 1.4-.7-1.4-1.4-.7 1.4-.7.7-1.4z" fill={`url(#${gradId})`} opacity="0.8" />
      </g>
    </svg>
  );
};

const iconMap = {
  // أيقونات حسب النوع
  low_stock: StockWarningIcon,
  stock_warning: StockWarningIcon,
  order_completed: OrderSuccessIcon,
  order_shipped: SystemIcon,
  order_status_changed: SystemIcon,
  order_status_update: SystemIcon,
  new_order: OrderIcon,
  new_order_employee: SystemIcon,
  new_registration: UserRegistrationIcon,
  profit_settlement: ProfitIcon,
  profit_settlement_request: ProfitSettlementIcon,
  employee_settlement_completed: ProfitSettlementIcon,
  city_discount_selected: CityDiscountIcon,
  city_discounts: CityDiscountIcon,
  alwaseet_status_change: SystemIcon,
  ai_order: AiOrderIcon,
  new_ai_order: AiOrderIcon,
  system: SystemIcon,
  // ألوان حسب النوع
  AlertTriangle: StockWarningIcon,
  Package: StockWarningIcon,
  CheckCircle: OrderSuccessIcon,
  ShoppingCart: OrderIcon,
  UserPlus: UserRegistrationIcon,
  Bot: AiOrderIcon,
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
    bg: 'bg-gradient-to-r from-violet-50/80 to-fuchsia-50/80 dark:from-violet-950/20 dark:to-fuchsia-950/20 backdrop-blur-sm ai-smart-border', 
    border: '',
    text: 'text-foreground', 
    icon: 'text-violet-600 dark:text-violet-400',
    dot: 'bg-gradient-to-br from-violet-500 to-pink-500'
  },
  new_ai_order: { 
    bg: 'bg-gradient-to-r from-violet-50/80 to-fuchsia-50/80 dark:from-violet-950/20 dark:to-fuchsia-950/20 backdrop-blur-sm ai-smart-border', 
    border: '',
    text: 'text-foreground', 
    icon: 'text-violet-600 dark:text-violet-400',
    dot: 'bg-gradient-to-br from-violet-500 to-pink-500'
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

const NotificationsPanel = () => {
  const { notifications, markAsRead, markAllAsRead, clearAll, deleteNotification } = useNotifications();
  const { orders } = useSuper(); // النظام الموحد للطلبات
  const [isOpen, setIsOpen] = useState(false);
  const [showPendingRegistrations, setShowPendingRegistrations] = useState(false);
  const [showAiOrdersManager, setShowAiOrdersManager] = useState(false);
  const navigate = useNavigate();

  const handleNotificationClick = (e, notification) => {
    e.stopPropagation();
    
    // تحديد الإشعار كمقروء
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    
    // التنقل المتقدم مع فلترة دقيقة حسب البيانات
    if (notification.type === 'alwaseet_status_change' || notification.type === 'order_status_update') {
      // إشعارات الطلبات - انتقال لصفحة طلباتي مع فلترة برقم التتبع
      const data = notification.data || {};
      const trackingNumber = data.tracking_number || '';
      if (trackingNumber) {
        navigate(`/my-orders?search=${encodeURIComponent(trackingNumber)}&highlight=order`);
      } else {
        navigate('/my-orders');
      }
    } else if (notification.type === 'city_discount_selected' || notification.type === 'city_discounts') {
      // إشعارات خصومات المدن - انتقال لصفحة العملاء مع تبويب خصومات المدن
      navigate('/customers-management?tab=city-discounts');
    } else if (notification.type === 'new_registration') {
      setShowPendingRegistrations(true);
    } else if (notification.type === 'ai_order' || notification.type === 'new_ai_order') {
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
      const orderNumberFromData = data.tracking_number || data.order_number || data.orderNo || null;
      let orderNumber = orderNumberFromData;
      if (!orderNumber) {
        const orderMatch = notification.message.match(/ORD\d+/) || notification.message.match(/#(\w+)|رقم (\w+)|طلب (\w+)/);
        orderNumber = orderMatch ? (orderMatch[0] || orderMatch[1] || orderMatch[2] || orderMatch[3]) : '';
      }
      // افتح صفحة الطلبات مع تمرير رقم الطلب وتظليل السجل
      const query = new URLSearchParams();
      if (orderNumber) query.set('order', orderNumber);
      if (orderId) query.set('highlight', orderId);
      navigate(`/my-orders?${query.toString()}`);
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
      const data = notification.data || {};
      const employeeId = data.employee_id || data.employeeId;
      const orderIds = data.order_ids || data.orderIds || [];
      if (employeeId && orderIds && orderIds.length > 0) {
        navigate(`/employee-follow-up?employee=${employeeId}&orders=${orderIds.join(',')}&highlight=settlement`);
      } else {
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
    markAllAsRead();
    toast({ title: "تم تحديد الكل كمقروء" });
  };

  const handleClearAll = (e) => {
    e.stopPropagation();
    // Clear all notifications
    clearAll();
    toast({ title: "تم حذف جميع الإشعارات" });
  };

  const formatRelativeTime = (dateString, updatedAt = null) => {
    try {
      // استخدام آخر تحديث أو وقت الإنشاء (الأحدث)
      const createTime = new Date(dateString);
      const updateTime = updatedAt ? new Date(updatedAt) : null;
      const displayTime = updateTime && updateTime > createTime ? updateTime : createTime;
      
      // Make time shorter
      const time = formatDistanceToNowStrict(displayTime, { addSuffix: false, locale: ar });
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

  // دالة للتحقق من كون الإشعار محدث مؤخراً
  const isNotificationUpdated = (notification) => {
    if (!notification.updated_at) return false;
    
    const createdTime = new Date(notification.created_at);
    const updatedTime = new Date(notification.updated_at);
    
    // إذا كان الفرق أكثر من دقيقة، يعتبر محدث
    return updatedTime.getTime() - createdTime.getTime() > 60000;
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
  const isInvalidStatusNotification = (notification) => {
    if (notification.type !== 'alwaseet_status_change') return false;
    const statusCode = notification.data?.state_id || notification.data?.delivery_status || parseAlwaseetStateIdFromMessage(notification.message);
    return !statusCode || ['undefined', 'null', ''].includes(String(statusCode));
  };

  const merged = notifications.filter(n => n.type !== 'welcome' && !isInvalidStatusNotification(n));
  
  const uniqueMap = new Map();
  for (const n of merged) {
    let uniqueKey = n.id;
    
    // إشعارات الوسيط - دمج محسن لمنع التكرار
    if (n.type === 'alwaseet_status_change' || n.type === 'order_status_update') {
      const tracking = n.data?.tracking_number || parseTrackingFromMessage(n.message) || n.data?.order_number;
      const orderId = n.data?.order_id;
      
      if (orderId) {
        // إشعار واحد فقط لكل طلب؛ عند تغير الحالة يتم تحديث نفس الصف
        uniqueKey = `status_change_${orderId}`;
      } else if (tracking) {
        uniqueKey = `status_change_${tracking}`;
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
  }
  
  // دالة للحصول على وقت العرض الصحيح (آخر تحديث أو الإنشاء)
  const getNotificationDisplayTime = (notification) => {
    const createdTime = new Date(notification.created_at);
    const updatedTime = notification.updated_at ? new Date(notification.updated_at) : null;
    
    // إذا كان هناك updated_at وهو أحدث من created_at، استخدمه
    if (updatedTime && updatedTime > createdTime) {
      return updatedTime;
    }
    
    return createdTime;
  };

  // ترتيب الإشعارات بناءً على وقت العرض المحدث وحالة القراءة
  const allNotifications = Array.from(uniqueMap.values())
    .map(notification => ({
      ...notification,
      displayTime: getNotificationDisplayTime(notification),
      isUpdated: isNotificationUpdated(notification)
    }))
    .sort((a, b) => {
      // الإشعارات غير المقروءة أولاً
      if ((a.is_read || a.read) !== (b.is_read || b.read)) {
        return (a.is_read || a.read) ? 1 : -1;
      }
      // ثم بالوقت المحدث
      return b.displayTime.getTime() - a.displayTime.getTime();
    });
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
                allNotifications.map(notification => {
                  const notificationType = notification.type || 'default';
                  
// استخدام ألوان الحالات الموحدة للطلبات
                  let colors;
                  if (notificationType === 'alwaseet_status_change' || notificationType === 'order_status_update' || notificationType === 'order_status_changed') {
                    // للطلبات، استخدام ألوان الحالات من order-status-translator
                    const data = notification.data || {};
                    const orderId = data.order_id;
                    
                    if (orderId && orders && orders.length > 0) {
                      const foundOrder = orders.find(order => order.id === orderId);
                      if (foundOrder) {
                        const statusInfo = getStatusForComponent(foundOrder);
                        // استخراج ألوان من الـ status color class
                        const statusClass = statusInfo.color || '';
                        
                        // تحويل ألوان الحالات إلى ألوان الإشعارات
                        if (statusClass.includes('emerald') || statusClass.includes('green')) {
                          colors = {
                            bg: 'bg-gradient-to-r from-emerald-50 to-green-100 dark:from-emerald-950/30 dark:to-green-900/30',
                            border: 'border-r-4 border-emerald-500 dark:border-emerald-400',
                            text: 'text-emerald-900 dark:text-emerald-100',
                            icon: 'text-emerald-600 dark:text-emerald-400',
                            dot: 'bg-emerald-500'
                          };
                        } else if (statusClass.includes('red') || statusClass.includes('rose')) {
                          colors = {
                            bg: 'bg-gradient-to-r from-rose-50 to-red-100 dark:from-rose-950/30 dark:to-red-900/30',
                            border: 'border-r-4 border-rose-500 dark:border-rose-400',
                            text: 'text-rose-900 dark:text-rose-100',
                            icon: 'text-rose-600 dark:text-rose-400',
                            dot: 'bg-rose-500'
                          };
                        } else if (statusClass.includes('violet') || statusClass.includes('purple')) {
                          colors = {
                            bg: 'bg-gradient-to-r from-violet-50 to-purple-100 dark:from-violet-950/30 dark:to-purple-900/30',
                            border: 'border-r-4 border-violet-500 dark:border-violet-400',
                            text: 'text-violet-900 dark:text-violet-100',
                            icon: 'text-violet-600 dark:text-violet-400',
                            dot: 'bg-violet-500'
                          };
                        } else if (statusClass.includes('orange') || statusClass.includes('amber')) {
                          colors = {
                            bg: 'bg-gradient-to-r from-orange-50 to-amber-100 dark:from-orange-950/30 dark:to-amber-900/30',
                            border: 'border-r-4 border-orange-500 dark:border-orange-400',
                            text: 'text-orange-900 dark:text-orange-100',
                            icon: 'text-orange-600 dark:text-orange-400',
                            dot: 'bg-orange-500'
                          };
                        } else if (statusClass.includes('yellow')) {
                          colors = {
                            bg: 'bg-gradient-to-r from-yellow-50 to-amber-100 dark:from-yellow-950/30 dark:to-amber-900/30',
                            border: 'border-r-4 border-yellow-500 dark:border-yellow-400',
                            text: 'text-yellow-900 dark:text-yellow-100',
                            icon: 'text-yellow-600 dark:text-yellow-400',
                            dot: 'bg-yellow-500'
                          };
                        } else {
                          // افتراضي للطلبات - أزرق
                          colors = {
                            bg: 'bg-gradient-to-r from-blue-50 to-cyan-100 dark:from-blue-950/30 dark:to-cyan-900/30',
                            border: 'border-r-4 border-blue-500 dark:border-blue-400',
                            text: 'text-blue-900 dark:text-blue-100',
                            icon: 'text-blue-600 dark:text-blue-400',
                            dot: 'bg-blue-500'
                          };
                        }
                      } else {
                        // طلب غير موجود، استخدام الألوان الافتراضية
                        colors = typeColorMap[notificationType] || typeColorMap.default;
                      }
                    } else {
                      // fallback للإشعارات القديمة - استخدام ألوان الوسيط إذا كانت متوفرة
                      if (notificationType === 'alwaseet_status_change') {
                        const sid = notification.data?.state_id || parseAlwaseetStateIdFromMessage(notification.message) || notification.data?.status_id;
                        colors = getAlWaseetNotificationColors(sid);
                      } else {
                        colors = typeColorMap[notificationType] || typeColorMap.default;
                      }
                    }
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
                           <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {(() => {
                                  // استخراج العنوان
                                  const titleText = (() => {
                                    // تخصيص العنوان لإشعارات تحديث حالة الطلب
                                    if (notificationType === 'alwaseet_status_change' || notificationType === 'order_status_update' || notificationType === 'order_status_changed') {
                                      const data = notification.data || {};
                                      const orderId = data.order_id;
                                      
                                      // ✅ Fallback: استخراج tracking_number من message إذا لم يوجد order_id
                                      const trackingFromMessage = !orderId ? parseTrackingFromMessage(notification.message) : null;
                                      const searchKey = orderId || trackingFromMessage || data.tracking_number || data.order_number;
                                      
                                       // البحث عن الطلب من النظام الموحد (بـ UUID أو tracking_number)
                                       if (searchKey && orders && orders.length > 0) {
                                         const foundOrder = orders.find(order => 
                                           order.id === searchKey || 
                                           order.tracking_number === searchKey ||
                                           order.order_number === searchKey
                                         );
                                         if (foundOrder) {
                                           // استخدام تنسيق "المدينة - المنطقة" مباشرة
                                           const city = (foundOrder.customer_city || '').trim() || 'غير محدد';
                                           const region = (foundOrder.customer_province || '').trim() || 'غير محدد';
                                           return `${city} - ${region}`;
                                         }
                                      }
                                      
                                       // للإشعارات القديمة بدون order_id، استخدام البيانات من data
                                       if (data.customer_city || data.customer_address) {
                                         const city = data.customer_city || 'غير محدد';
                                         const region = data.customer_province || 'غير محدد';
                                         return `${city} - ${region}`;
                                       }
                                    }
                                    
                                    // العنوان الافتراضي
                                    return notification.title || 'إشعار جديد';
                                   })();
                                   
                                   // إزالة الإيموجي البدائي 🤖 من العناوين القديمة — الأيقونة الاحترافية تظهر يساراً
                                   const cleanTitleText = String(titleText || '').replace(/🤖\s*/g, '').trim() || 'إشعار جديد';
                                   
                                    // استخدام ScrollingText للعناوين الطويلة
                                     return cleanTitleText.length > 22 ? (
                                       <ScrollingText 
                                         text={cleanTitleText} 
                                         className={cn("font-semibold text-sm leading-tight", colors.text)}
                                         maxWidth="170px"
                                       />
                                     ) : (
                                       <h3 className={cn("font-semibold text-sm leading-tight", colors.text)}>
                                         {cleanTitleText}
                                       </h3>
                                     );
                                 })()}
                               </div>
                               <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1 flex-shrink-0 mr-2">
                                {!(notification.is_read || notification.read) && (
                                  <span className={cn("w-2 h-2 rounded-full animate-pulse flex-shrink-0", colors.dot)}></span>
                                )}
                                <Clock className="w-2.5 h-2.5" />
                                {formatRelativeTime(notification.created_at, notification.updated_at)}
                              </p>
                           </div>
                          <div className="text-xs text-foreground font-medium line-clamp-1 mb-1.5">
                            {(() => {
                               // تنسيق موحد للإشعارات المتعلقة بالطلبات - استخدام النظام الموحد
                               if (notificationType === 'alwaseet_status_change' || notificationType === 'order_status_update' || notificationType === 'order_status_changed') {
                                 const data = notification.data || {};
                                 const orderId = data.order_id;
                                 
                                  // البحث عن الطلب الفعلي من النظام الموحد
                                  if (orderId && orders && orders.length > 0) {
                                    const foundOrder = orders.find(order => order.id === orderId);
                                    if (foundOrder) {
                                      // استخدام نفس منطق صفحة الطلبات
                                      const statusInfo = getStatusForComponent(foundOrder);
                                      const displayText = `${foundOrder.tracking_number || foundOrder.qr_id} ${statusInfo.label}`;
                                     
                                      return displayText.length > 30 ? (
                                        <ScrollingText text={displayText} className="" maxWidth="220px" />
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
                                   
                                    return displayText.length > 30 ? (
                                      <ScrollingText text={displayText} className="" maxWidth="220px" />
                                    ) : displayText;
                                 }
                               }
                              
                              // للإشعارات العادية - استخدام ScrollingText للنصوص الطويلة
                              const message = notification.message || '';
                               return message.length > 30 ? (
                                 <ScrollingText text={message} className="" maxWidth="220px" />
                               ) : message;
                            })()}
                          </div>
                          <div className="flex items-center justify-end">
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