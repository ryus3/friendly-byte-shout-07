import { 
  Package, 
  Truck, 
  CheckCircle, 
  XCircle,
  RotateCcw,
  PackageCheck,
  Clock,
  AlertTriangle,
  MapPin
} from 'lucide-react';

/**
 * نظام موحد لترجمة وعرض حالات الطلبات
 * يستخدم الألوان الجميلة المحددة في index.css
 */

// ترجمة الحالات مع الألوان والأيقونات الموحدة
const STATUS_TRANSLATIONS = {
  // الحالات الأساسية
  'فعال': {
    label: 'قيد التجهيز',
    icon: Package,
    color: 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white border border-yellow-300/50 shadow-lg shadow-yellow-400/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  },
  'pending': {
    label: 'قيد التجهيز',
    icon: Package,
    color: 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white border border-yellow-300/50 shadow-lg shadow-yellow-400/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  },
  'shipped': {
    label: 'تم الشحن',
    icon: Truck,
    color: 'bg-gradient-to-r from-status-shipped-start to-status-shipped-end text-white border border-status-shipped-border shadow-lg shadow-status-shipped-shadow/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  },
  'delivery': {
    label: 'قيد التوصيل',
    icon: Truck,
    color: 'bg-gradient-to-r from-status-delivery-start to-status-delivery-end text-white border border-status-delivery-border shadow-lg shadow-status-delivery-shadow/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  },
  'delivered': {
    label: 'تم التسليم',
    icon: CheckCircle,
    color: 'bg-gradient-to-r from-status-delivered-start to-status-delivered-end text-white border border-status-delivered-border shadow-lg shadow-status-delivered-shadow/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  },
  'completed': {
    label: 'مكتمل',
    icon: CheckCircle,
    color: 'bg-gradient-to-r from-status-completed-start to-status-completed-end text-white border border-status-completed-border shadow-lg shadow-status-completed-shadow/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  },
  'returned': {
    label: 'راجعة',
    icon: RotateCcw,
    color: 'bg-gradient-to-r from-status-returned-start to-status-returned-end text-white border border-status-returned-border shadow-lg shadow-status-returned-shadow/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  },
  'returned_in_stock': {
    label: 'راجع للمخزن',
    icon: PackageCheck,
    color: 'bg-gradient-to-r from-status-returned-stock-start to-status-returned-stock-end text-white border border-status-returned-stock-border shadow-lg shadow-status-returned-stock-shadow/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  },
  'return_received': {
    label: 'راجع للمخزن',
    icon: PackageCheck,
    color: 'bg-gradient-to-r from-status-returned-stock-start to-status-returned-stock-end text-white border border-status-returned-stock-border shadow-lg shadow-status-returned-stock-shadow/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  },
  'cancelled': {
    label: 'ملغي',
    icon: XCircle,
    color: 'bg-gradient-to-r from-status-cancelled-start to-status-cancelled-end text-white border border-status-cancelled-border shadow-lg shadow-status-cancelled-shadow/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  }
};

// حالات خاصة من شركات التوصيل
const DELIVERY_STATUS_PATTERNS = {
  // حالات التسليم
  'تسليم|مسلم|deliver': {
    label: null, // سيتم عرض النص الأصلي
    icon: CheckCircle,
    color: 'bg-gradient-to-r from-status-delivered-start to-status-delivered-end text-white border border-status-delivered-border shadow-lg shadow-status-delivered-shadow/40'
  },
  // حالات الرفض والإلغاء
  'رفض|ملغي|إلغاء|reject|cancel': {
    label: null,
    icon: XCircle,
    color: 'bg-gradient-to-r from-red-500 to-red-600 text-white border border-red-300/50 shadow-lg shadow-red-400/40'
  },
  // حالات قيد التوصيل
  'في الطريق|طريق|جاري التوصيل|مندوب|shipping': {
    label: null,
    icon: MapPin,
    color: 'bg-gradient-to-r from-orange-500 to-amber-500 text-white border border-orange-300/50 shadow-lg shadow-orange-400/40'
  },
  // حالات التأجيل - لون بنفسجي جميل
  'تأجيل|مؤجل|postpone|delay': {
    label: null,
    icon: Clock,
    color: 'bg-gradient-to-r from-purple-500 to-violet-600 text-white border border-purple-300/50 shadow-lg shadow-purple-400/40'
  },
  // حالات عدم وجود العميل
  'عدم وجود|لا يمكن الوصول|غائب|absent': {
    label: null,
    icon: AlertTriangle,
    color: 'bg-gradient-to-r from-gray-500 to-slate-500 text-white border border-gray-300/50 shadow-lg shadow-gray-400/40'
  },
  // حالات الإرجاع
  'راجع|مرجع|إرجاع|return': {
    label: null,
    icon: RotateCcw,
    color: 'bg-gradient-to-r from-status-returned-start to-status-returned-end text-white border border-status-returned-border shadow-lg shadow-status-returned-shadow/40'
  },
  // حالة خاصة: قيد التوصيل للزبون (في عهدة المندوب) - لون تركوازي جميل مع أيقونة أصغر
  'قيد التوصيل الى الزبون|قيد التوصيل للزبون|في عهدة المندوب|في عهده المندوب': {
    label: 'للزبون',
    icon: MapPin,
    color: 'bg-gradient-to-r from-teal-400 to-cyan-500 text-white border border-teal-300/50 shadow-lg shadow-teal-400/40'
  },
  // في مكتب المحافظة
  'في مكتب المحافظة|مكتب المحافظة': {
    label: null,
    icon: MapPin,
    color: 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white border border-indigo-300/50 shadow-lg shadow-indigo-400/40'
  },
  // في الطريق الى مكتب المحافظة  
  'في الطريق الى مكتب المحافظة|في الطريق الى المكتب|طريق المحافظة': {
    label: null,
    icon: Truck,
    color: 'bg-gradient-to-r from-orange-500 to-amber-500 text-white border border-orange-300/50 shadow-lg shadow-orange-400/40'
  },
  // لا يرد
  'لا يرد|ما يرد|عدم الرد|no answer': {
    label: null,
    icon: AlertTriangle,
    color: 'bg-gradient-to-r from-red-500 to-rose-600 text-white border border-red-300/50 shadow-lg shadow-red-400/40'
  },
  // مغلق
  'مغلق|مقفل|closed': {
    label: null,
    icon: AlertTriangle,
    color: 'bg-gradient-to-r from-gray-500 to-slate-500 text-white border border-gray-300/50 shadow-lg shadow-gray-400/40'
  },
  // مؤجل - لون بنفسجي جميل
  'مؤجل|تأجيل|postponed|delayed': {
    label: null,
    icon: Clock,
    color: 'bg-gradient-to-r from-purple-500 to-violet-600 text-white border border-purple-300/50 shadow-lg shadow-purple-400/40'
  }
};

/**
 * الدالة الرئيسية لترجمة حالة الطلب
 * @param {string} status - حالة الطلب الأساسية
 * @param {string} deliveryStatus - حالة التوصيل (للطلبات الخارجية)
 * @param {boolean} isLocalOrder - هل هو طلب محلي
 * @returns {object} كائن يحتوي على التسمية والأيقونة واللون
 */
export const translateOrderStatus = (status, deliveryStatus = null, isLocalOrder = true) => {
  // للطلبات المحلية، استخدم status فقط
  if (isLocalOrder) {
    return getStatusConfig(status);
  }

  // للطلبات الخارجية، استخدم delivery_status أولاً
  if (deliveryStatus) {
    // التحقق من الترجمات المحددة أولاً
    const translatedConfig = getStatusConfig(deliveryStatus);
    if (translatedConfig.label !== deliveryStatus) {
      return translatedConfig;
    }

    // البحث في patterns شركات التوصيل
    return getDeliveryStatusConfig(deliveryStatus);
  }

  // fallback للحالة الأساسية
  return getStatusConfig(status);
};

/**
 * الحصول على تكوين حالة محددة
 */
const getStatusConfig = (status) => {
  if (!status) {
    return getDefaultConfig('غير محدد');
  }

  // البحث في الترجمات المحددة
  const config = STATUS_TRANSLATIONS[status];
  if (config) {
      return {
        label: config.label,
        icon: config.icon,
        color: config.color
      };
  }

  // إذا لم توجد ترجمة محددة، اعرض النص كما هو
  return getDefaultConfig(status);
};

/**
 * الحصول على تكوين حالات شركة التوصيل
 */
const getDeliveryStatusConfig = (deliveryStatus) => {
  if (!deliveryStatus || typeof deliveryStatus !== 'string') {
    return getDefaultConfig('غير محدد');
  }

  const statusLower = deliveryStatus.toLowerCase();

  // البحث في patterns شركات التوصيل
  for (const [pattern, config] of Object.entries(DELIVERY_STATUS_PATTERNS)) {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(statusLower)) {
      return {
        label: config.label || deliveryStatus, // عرض النص الأصلي إذا لم توجد ترجمة
        icon: config.icon,
        color: config.color + ' px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
      };
    }
  }

  // حالة افتراضية للحالات غير المعروفة
  return {
    label: deliveryStatus,
    icon: Package,
    color: 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white border border-purple-300/50 shadow-lg shadow-purple-400/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  };
};

/**
 * التكوين الافتراضي للحالات غير المعروفة
 */
const getDefaultConfig = (status) => {
  return {
    label: status || 'غير معروف',
    icon: AlertTriangle,
    color: 'bg-gradient-to-r from-gray-500 to-slate-500 text-white border border-gray-300/50 shadow-lg shadow-gray-400/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  };
};

/**
 * دعم النظام القديم - استخدام alwaseet-statuses إذا كان متوفراً
 */
export const getStatusConfigFromAlWaseet = (stateId) => {
  try {
    // Import using ES6 import instead of require
    import('@/lib/alwaseet-statuses').then(module => {
      const statusConfig = module.getStatusConfig(stateId);
      return {
        label: statusConfig.text,
        icon: statusConfig.icon,
        color: statusConfig.color + ' font-bold rounded-lg px-3 py-1.5 text-xs'
      };
    }).catch(() => {
      return null;
    });
    
    // Fallback for immediate return - avoid require
    return null;
  } catch (error) {
    console.error('Error loading Al-Waseet status config:', error);
    return null;
  }
};

/**
 * دالة مساعدة للحصول على تكوين مُحسن لمكون معين
 */
export const getStatusForComponent = (order, componentType = 'default') => {
  const isLocalOrder = !order.tracking_number || 
                      order.tracking_number.startsWith('RYUS-') || 
                      order.delivery_partner === 'محلي';

  // Special case for Al-Waseet state_id = '3' - force translation to "قيد التوصيل"
  if (order.state_id === '3' || order.state_id === 3) {
    return {
      label: 'قيد التوصيل',
      icon: MapPin,
      color: 'bg-gradient-to-r from-status-delivery-start to-status-delivery-end text-white border border-status-delivery-border shadow-lg shadow-status-delivery-shadow/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
    };
  }

  // استخدام المترجم الموحد
  return translateOrderStatus(order.status, order.delivery_status, isLocalOrder);
};

export default {
  translateOrderStatus,
  getStatusForComponent,
  getStatusConfigFromAlWaseet
};