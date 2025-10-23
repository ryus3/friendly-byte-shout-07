import { 
  Package, 
  Truck, 
  CheckCircle, 
  XCircle,
  RotateCcw,
  PackageCheck,
  Clock,
  AlertTriangle,
  MapPin,
  Home
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
  '1': {
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
  'partial_delivery': {
    label: 'تسليم جزئي',
    icon: PackageCheck,
    color: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border border-amber-300/50 shadow-lg shadow-amber-400/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
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
  },
  '2': {
    label: 'تم الاستلام من قبل المندوب',
    icon: Truck,
    color: 'bg-gradient-to-r from-orange-500 to-amber-600 text-white border border-orange-300/50 shadow-lg shadow-orange-400/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  },
  '17': {
    label: 'تم الإرجاع إلى التاجر',
    icon: Home,
    color: 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white border border-purple-300/50 shadow-lg shadow-purple-400/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  },
  '3': {
    label: 'قيد التوصيل',
    icon: Truck,
    color: 'bg-gradient-to-r from-status-delivery-start to-status-delivery-end text-white border border-status-delivery-border shadow-lg shadow-status-delivery-shadow/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  },
  '4': {
    label: 'تم التسليم للزبون',
    icon: CheckCircle,
    color: 'bg-gradient-to-r from-green-500 to-emerald-600 text-white border border-green-300/50 shadow-lg shadow-green-400/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  },
  '12': {
    label: 'قيد التوصيل الى الزبون',
    icon: MapPin,
    color: 'bg-gradient-to-r from-teal-400 to-cyan-500 text-white border border-teal-300/50 shadow-lg shadow-teal-400/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  },
  '13': {
    label: 'راجعة للمخزن',
    icon: RotateCcw,
    color: 'bg-gradient-to-r from-orange-500 to-red-600 text-white border border-orange-300/50 shadow-lg shadow-orange-400/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  },
  '23': {
    label: 'ارسال الى مخزن الارجاعات',
    icon: RotateCcw,
    color: 'bg-gradient-to-r from-orange-500 to-yellow-600 text-white border border-orange-300/50 shadow-lg shadow-orange-400/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  }
};

// حالات خاصة من شركات التوصيل
const DELIVERY_STATUS_PATTERNS = {
  // حالات التسليم
  'تسليم|مسلم|deliver': {
    label: null, // سيتم عرض النص الأصلي
    icon: CheckCircle,
    color: 'bg-gradient-to-r from-status-delivered-start to-status-delivered-end text-white border border-status-delivered-border shadow-lg shadow-status-delivered-shadow/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  },
  // حالات الرفض والإلغاء
  'رفض|ملغي|إلغاء|reject|cancel': {
    label: null,
    icon: XCircle,
    color: 'bg-gradient-to-r from-red-500 to-red-600 text-white border border-red-300/50 shadow-lg shadow-red-400/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  },
  // حالات قيد التوصيل
  'في الطريق|طريق|جاري التوصيل|مندوب|shipping': {
    label: null,
    icon: MapPin,
    color: 'bg-gradient-to-r from-orange-500 to-amber-500 text-white border border-orange-300/50 shadow-lg shadow-orange-400/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  },
  // حالات التأجيل - لون بنفسجي جميل
  'تأجيل|مؤجل|postpone|delay': {
    label: null,
    icon: Clock,
    color: 'bg-gradient-to-r from-purple-500 to-violet-600 text-white border border-purple-300/50 shadow-lg shadow-purple-400/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  },
  // حالات عدم وجود العميل
  'عدم وجود|لا يمكن الوصول|غائب|absent': {
    label: null,
    icon: AlertTriangle,
    color: 'bg-gradient-to-r from-gray-500 to-slate-500 text-white border border-gray-300/50 shadow-lg shadow-gray-400/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  },
  // حالات الإرجاع
  'راجع|مرجع|إرجاع|return': {
    label: null,
    icon: RotateCcw,
    color: 'bg-gradient-to-r from-status-returned-start to-status-returned-end text-white border border-status-returned-border shadow-lg shadow-status-returned-shadow/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  },
  // حالة خاصة: قيد التوصيل للزبون (في عهدة المندوب) - لون تركوازي جميل مع أيقونة أصغر
  'قيد التوصيل الى الزبون|قيد التوصيل للزبون|في عهدة المندوب|في عهده المندوب': {
    label: 'للزبون',
    icon: MapPin,
    color: 'bg-gradient-to-r from-teal-400 to-cyan-500 text-white border border-teal-300/50 shadow-lg shadow-teal-400/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  },
  // في مكتب المحافظة
  'في مكتب المحافظة|مكتب المحافظة': {
    label: null,
    icon: MapPin,
    color: 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white border border-indigo-300/50 shadow-lg shadow-indigo-400/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  },
  // في الطريق الى مكتب المحافظة  
  'في الطريق الى مكتب المحافظة|في الطريق الى المكتب|طريق المحافظة': {
    label: null,
    icon: Truck,
    color: 'bg-gradient-to-r from-orange-500 to-amber-500 text-white border border-orange-300/50 shadow-lg shadow-orange-400/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  },
  // لا يرد - رمادي مطفي
  'لا يرد|ما يرد|عدم الرد|no answer': {
    label: null,
    icon: AlertTriangle,
    color: 'bg-gradient-to-r from-slate-500 to-slate-600 text-white border border-slate-300/50 shadow-lg shadow-slate-400/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  },
  // لا يرد بعد الاتفاق - بنفسجي محمر
  'لا يرد بعد الاتفاق|no answer after agreement': {
    label: null,
    icon: AlertTriangle,
    color: 'bg-gradient-to-r from-purple-600 to-violet-700 text-white border border-purple-300/50 shadow-lg shadow-purple-400/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  },
  // مغلق - رمادي أغمق
  'مغلق|مقفل|closed': {
    label: null,
    icon: AlertTriangle,
    color: 'bg-gradient-to-r from-slate-600 to-slate-700 text-white border border-slate-300/50 shadow-lg shadow-slate-400/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  },
  // مغلق بعد الاتفاق - بنفسجي أغمق
  'مغلق بعد الاتفاق|closed after agreement': {
    label: null,
    icon: AlertTriangle,
    color: 'bg-gradient-to-r from-violet-700 to-purple-800 text-white border border-violet-300/50 shadow-lg shadow-violet-400/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  },
  // مؤجل - بنفسجي هادئ
  'مؤجل|تأجيل|postponed|delayed': {
    label: null,
    icon: Clock,
    color: 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white border border-indigo-300/50 shadow-lg shadow-indigo-400/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  },
  // مؤجل لحين اعادة الطلب لاحقا
  'مؤجل لحين اعادة الطلب لاحقا|postponed until reorder': {
    label: null,
    icon: Clock,
    color: 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white border border-indigo-300/50 shadow-lg shadow-indigo-400/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  },
  // الغاء الطلب - أحمر مهني
  'الغاء الطلب|cancel order': {
    label: null,
    icon: XCircle,
    color: 'bg-gradient-to-r from-red-600 to-red-700 text-white border border-red-300/50 shadow-lg shadow-red-400/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  },
  // رفض الطلب - أحمر مهني
  'رفض الطلب|reject order': {
    label: null,
    icon: XCircle,
    color: 'bg-gradient-to-r from-red-500 to-red-600 text-white border border-red-300/50 shadow-lg shadow-red-400/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  },
  // تم تغيير محافظة الزبون - أزرق مهني
  'تم تغيير محافظة الزبون|customer province changed': {
    label: null,
    icon: MapPin,
    color: 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white border border-indigo-300/50 shadow-lg shadow-indigo-400/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  },
  // مفصول عن الخدمة - رمادي إداري
  'مفصول عن الخدمة|disconnected from service': {
    label: null,
    icon: AlertTriangle,
    color: 'bg-gradient-to-r from-gray-700 to-slate-800 text-white border border-gray-300/50 shadow-lg shadow-gray-400/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  },
  // طلب مكرر - رمادي محايد
  'طلب مكرر|duplicate order': {
    label: null,
    icon: AlertTriangle,
    color: 'bg-gradient-to-r from-slate-500 to-slate-600 text-white border border-slate-300/50 shadow-lg shadow-slate-400/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  },
  // مستلم مسبقا - أخضر إيجابي
  'مستلم مسبقا|already received': {
    label: null,
    icon: CheckCircle,
    color: 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white border border-emerald-300/50 shadow-lg shadow-emerald-400/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  },
  // الرقم غير معرف - برتقالي تقني
  'الرقم غير معرف|number not identified': {
    label: null,
    icon: AlertTriangle,
    color: 'bg-gradient-to-r from-orange-600 to-orange-700 text-white border border-orange-300/50 shadow-lg shadow-orange-400/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  },
  // الرقم غير داخل في الخدمة - كهرماني تقني
  'الرقم غير داخل في الخدمة|number not in service': {
    label: null,
    icon: AlertTriangle,
    color: 'bg-gradient-to-r from-amber-600 to-amber-700 text-white border border-amber-300/50 shadow-lg shadow-amber-400/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  },
  // العنوان غير دقيق - أزرق خدمي
  'العنوان غير دقيق|address not accurate': {
    label: null,
    icon: MapPin,
    color: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border border-blue-300/50 shadow-lg shadow-blue-400/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  },
  // لم يطلب - رمادي محايد
  'لم يطلب|did not order': {
    label: null,
    icon: AlertTriangle,
    color: 'bg-gradient-to-r from-slate-500 to-slate-600 text-white border border-slate-300/50 shadow-lg shadow-slate-400/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  },
  // حظر المندوب - أحمر قوي
  'حظر المندوب|delivery agent blocked': {
    label: null,
    icon: XCircle,
    color: 'bg-gradient-to-r from-rose-700 to-rose-800 text-white border border-rose-300/50 shadow-lg shadow-rose-400/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  },
  // لا يمكن الاتصال بالرقم - كهرماني أغمق
  'لا يمكن الاتصال بالرقم|cannot contact number': {
    label: null,
    icon: AlertTriangle,
    color: 'bg-gradient-to-r from-amber-700 to-amber-800 text-white border border-amber-300/50 shadow-lg shadow-amber-400/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
  },
  // تغيير المندوب - أزرق خدمي
  'تغيير المندوب|change delivery agent': {
    label: null,
    icon: Truck,
    color: 'bg-gradient-to-r from-blue-600 to-blue-700 text-white border border-blue-300/50 shadow-lg shadow-blue-400/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
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
        color: config.color // الأبعاد موحدة بالفعل في كل pattern
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

  // معالجة خاصة لحالات الوسيط - أولوية قصوى
  if (order.delivery_status === 'فعال' || order.delivery_status === '1') {
    return {
      label: 'قيد التجهيز',
      icon: Package,
      color: 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white border border-yellow-300/50 shadow-lg shadow-yellow-400/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
    };
  }

  // حالة تم التسليم للزبون (delivery_status = '4')
  if (order.delivery_status === '4') {
    return {
      label: 'تم التسليم للزبون',
      icon: CheckCircle,
      color: 'bg-gradient-to-r from-green-500 to-emerald-600 text-white border border-green-300/50 shadow-lg shadow-green-400/40 px-2 py-1 text-xs max-w-[160px] font-bold rounded-lg'
    };
  }

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