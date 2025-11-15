// نظام شامل لحالات الوسيط مع إدارة المخزون والحذف
// Al-Waseet comprehensive status system with stock and deletion management

import { 
  Package, 
  Truck, 
  CheckCircle, 
  XCircle,
  RotateCcw,
  PackageCheck,
  MapPin,
  Calendar,
  Clock,
  AlertTriangle,
  Building,
  RefreshCw,
  Home,
  ArrowLeft,
  Ban,
  Phone,
  PhoneOff
} from 'lucide-react';

// تعريف كامل لجميع حالات الوسيط مع قواعد المخزون والحذف
export const ALWASEET_STATUS_DEFINITIONS = {
  // الحالات الأساسية - يمكن الحذف والتعديل
  '0': {
    text: 'معطل او غير فعال',
    icon: XCircle,
    internalStatus: 'pending',
    canDelete: true,
    canEdit: true,
    releasesStock: false,
    color: 'bg-gradient-to-r from-gray-500 to-slate-600 text-white border border-gray-300/50 shadow-lg shadow-gray-400/40',
    description: 'حالة معطلة - يمكن الحذف والتعديل'
  },
  '1': {
    text: 'فعال ( قيد التجهير)',
    icon: Package,
    internalStatus: 'pending', 
    canDelete: true,
    canEdit: true,
    releasesStock: false,
    color: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border border-blue-300/50 shadow-lg shadow-blue-400/40',
    description: 'قيد التجهيز - يمكن الحذف والتعديل'
  },

  // الحالات النشطة - لا يمكن الحذف أو التعديل
  '2': {
    text: 'تم الاستلام من قبل المندوب',
    icon: Truck,
    internalStatus: 'shipped',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    color: 'bg-gradient-to-r from-orange-500 to-amber-600 text-white border border-orange-300/50 shadow-lg shadow-orange-400/40',
    description: 'تم الشحن - لا يمكن الحذف أو التعديل'
  },
  '3': {
    text: 'قيد التوصيل الى الزبون (في عهدة المندوب)',
    icon: MapPin,
    internalStatus: 'delivery',
    localStatus: 'delivery',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    color: 'bg-gradient-to-r from-status-delivery-start to-status-delivery-end text-white border border-status-delivery-border shadow-lg shadow-status-delivery-shadow/40',
    description: 'قيد التوصيل - في عهدة المندوب'
  },
  '4': {
    text: 'تم التسليم للزبون',
    icon: CheckCircle,
    internalStatus: 'delivered',
    localStatus: 'delivered',
    canDelete: false,
    canEdit: false,
    releasesStock: true, // الحالة الوحيدة التي تحرر المخزون للبيع
    color: 'bg-gradient-to-r from-green-500 to-emerald-600 text-white border border-green-300/50 shadow-lg shadow-green-400/40',
    description: 'تم التسليم - يحرر المحجوز ويصبح مباع'
  },
  '5': {
    text: 'في موقع فرز بغداد',
    icon: Building,
    internalStatus: 'shipped',
    localStatus: 'shipped',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    color: 'bg-gradient-to-r from-cyan-500 to-teal-600 text-white border border-cyan-300/50 shadow-lg shadow-cyan-400/40',
    description: 'تم الشحن - في موقع الفرز'
  },
  '6': {
    text: 'في مكتب',
    icon: Building,
    internalStatus: 'shipped',
    localStatus: 'shipped',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    color: 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white border border-indigo-300/50 shadow-lg shadow-indigo-400/40',
    description: 'تم الشحن - في المكتب'
  },
  '7': {
    text: 'في الطريق الى مكتب المحافظة',
    icon: Truck,
    internalStatus: 'shipped',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    color: 'bg-gradient-to-r from-amber-500 to-orange-600 text-white border border-amber-300/50 shadow-lg shadow-amber-400/40',
    description: 'تم الشحن - في الطريق إلى مكتب المحافظة'
  },
  '8': {
    text: 'في مخزن بغداد',
    icon: Building,
    internalStatus: 'shipped',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    color: 'bg-gradient-to-r from-blue-600 to-indigo-700 text-white border border-blue-400/50 shadow-lg shadow-blue-500/40',
    description: 'تم الشحن - في مخزن بغداد'
  },
  '9': {
    text: 'في طريقه للمحافظة',
    icon: Truck,
    internalStatus: 'shipped',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    color: 'bg-gradient-to-r from-orange-600 to-amber-700 text-white border border-orange-400/50 shadow-lg shadow-orange-500/40',
    description: 'تم الشحن - في الطريق للمحافظة'
  },
  '10': {
    text: 'وصل الى مكتب المحافظة',
    icon: MapPin,
    internalStatus: 'shipped',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    color: 'bg-gradient-to-r from-green-600 to-teal-700 text-white border border-green-400/50 shadow-lg shadow-green-500/40',
    description: 'تم الشحن - وصل لمكتب المحافظة'
  },
  '11': {
    text: 'تم استلامه من قبل المكتب',
    icon: PackageCheck,
    internalStatus: 'shipped',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    color: 'bg-gradient-to-r from-cyan-600 to-blue-700 text-white border border-cyan-400/50 shadow-lg shadow-cyan-500/40',
    description: 'تم الشحن - تم استلامه من المكتب'
  },

  // حالات الإرجاع - محجوز
  '12': {
    text: 'في مخزن مرتجع المحافظة',
    icon: RotateCcw,
    internalStatus: 'returned', // راجع - يبقى محجوز
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    color: 'bg-gradient-to-r from-yellow-500 to-amber-600 text-white border border-yellow-300/50 shadow-lg shadow-yellow-400/40',
    description: 'راجع - يبقى محجوز'
  },
  '13': {
    text: 'في مخزن مرتجع بغداد',
    icon: RotateCcw,
    internalStatus: 'returned', // راجع - يبقى محجوز
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    color: 'bg-gradient-to-r from-yellow-500 to-amber-600 text-white border border-yellow-300/50 shadow-lg shadow-yellow-400/40',
    description: 'راجع - يبقى محجوز'
  },
  '14': {
    text: 'اعادة الارسال الى الزبون',
    icon: RefreshCw,
    internalStatus: 'shipped',
    localStatus: 'shipped',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    color: 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white border border-blue-300/50 shadow-lg shadow-blue-400/40',
    description: 'تم الشحن - إعادة الإرسال'
  },
  '15': {
    text: 'ارجاع الى التاجر',
    icon: ArrowLeft,
    internalStatus: 'returned', // راجع - يبقى محجوز
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    color: 'bg-gradient-to-r from-orange-500 to-red-600 text-white border border-orange-300/50 shadow-lg shadow-orange-400/40',
    description: 'راجع - يبقى محجوز'
  },
  '16': {
    text: 'قيد الارجاع الى التاجر (في عهدة المندوب)',
    icon: ArrowLeft,
    internalStatus: 'returned', // راجع - يبقى محجوز
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    color: 'bg-gradient-to-r from-orange-500 to-red-600 text-white border border-orange-300/50 shadow-lg shadow-orange-400/40',
    description: 'راجع - يبقى محجوز'
  },
  '17': {
    text: 'تم الارجاع الى التاجر',
    icon: Home,
    internalStatus: 'returned_in_stock', // تم الإرجاع للتاجر
    canDelete: false,
    canEdit: false,
    releasesStock: true, // الحالة الوحيدة الأخرى التي تحرر المخزون
    color: 'bg-gradient-to-r from-emerald-500 to-green-600 text-white border border-emerald-300/50 shadow-lg shadow-emerald-400/40',
    description: 'تم الإرجاع للتاجر - يحرر المحجوز ويضاف للمخزن'
  },

  // حالات خاصة
  '18': {
    text: 'تغيير سعر',
    icon: RefreshCw,
    internalStatus: 'delivery',
    localStatus: 'delivery',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    color: 'bg-gradient-to-r from-purple-500 to-pink-600 text-white border border-purple-300/50 shadow-lg shadow-purple-400/40',
    description: 'قيد التوصيل - تغيير السعر'
  },
  '19': {
    text: 'ارجاع بعد الاستلام',
    icon: RotateCcw,
    internalStatus: 'returned', // راجع - يبقى محجوز
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    color: 'bg-gradient-to-r from-red-500 to-pink-600 text-white border border-red-300/50 shadow-lg shadow-red-400/40',
    description: 'راجع - يبقى محجوز'
  },
  '20': {
    text: 'تبديل بعد التوصيل',
    icon: RefreshCw,
    internalStatus: 'returned', // راجع - يبقى محجوز
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    color: 'bg-gradient-to-r from-indigo-500 to-blue-600 text-white border border-indigo-300/50 shadow-lg shadow-indigo-400/40',
    description: 'راجع - يبقى محجوز'
  },
  '21': {
    text: 'تم التسليم للزبون واستلام منة الاسترجاع',
    icon: PackageCheck,
    internalStatus: 'partial_delivery',
    localStatus: 'partial_delivery',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    requiresManualProcessing: true,
    color: 'bg-gradient-to-r from-purple-500 to-pink-600 text-white border border-purple-300/50 shadow-lg shadow-purple-400/40',
    description: 'تسليم جزئي - يحتاج معالجة يدوية لتحديد المسلّم والمرجع'
  },
  '22': {
    text: 'ارسال الى الفزر',
    icon: Building,
    internalStatus: 'delivery',
    localStatus: 'delivery',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    color: 'bg-gradient-to-r from-slate-500 to-gray-600 text-white border border-slate-300/50 shadow-lg shadow-slate-400/40',
    description: 'قيد التوصيل - إرسال للفرز'
  },
  '23': {
    text: 'ارسال الى مخزن الارجاعات',
    icon: RotateCcw,
    internalStatus: 'returned',
    localStatus: 'returned',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    color: 'bg-gradient-to-r from-orange-500 to-yellow-600 text-white border border-orange-300/50 shadow-lg shadow-orange-400/40',
    description: 'راجع - إرسال لمخزن الإرجاعات'
  },
  '24': {
    text: 'تم تغيير محافظة الزبون',
    icon: MapPin,
    internalStatus: 'delivery',
    localStatus: 'delivery',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    color: 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white border border-blue-300/50 shadow-lg shadow-blue-400/40',
    description: 'قيد التوصيل - تغيير المحافظة'
  },

  // حالات المشاكل - تحتاج معالجة
  '25': {
    text: 'لا يرد',
    icon: PhoneOff,
    internalStatus: 'delivery',
    localStatus: 'delivery',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    color: 'bg-gradient-to-r from-red-500 to-rose-600 text-white border border-red-300/50 shadow-lg shadow-red-400/40',
    description: 'قيد التوصيل - لا يرد'
  },
  '26': {
    text: 'لا يرد بعد الاتفاق',
    icon: PhoneOff,
    internalStatus: 'delivery',
    localStatus: 'delivery',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    color: 'bg-gradient-to-r from-red-500 to-rose-600 text-white border border-red-300/50 shadow-lg shadow-red-400/40',
    description: 'قيد التوصيل - لا يرد بعد الاتفاق'
  },
  '27': {
    text: 'مغلق',
    icon: Ban,
    internalStatus: 'delivery',
    localStatus: 'delivery',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    color: 'bg-gradient-to-r from-gray-500 to-slate-600 text-white border border-gray-300/50 shadow-lg shadow-gray-400/40',
    description: 'قيد التوصيل - مغلق'
  },
  '28': {
    text: 'مغلق بعد الاتفاق',
    icon: Ban,
    internalStatus: 'delivery',
    localStatus: 'delivery',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    color: 'bg-gradient-to-r from-gray-500 to-slate-600 text-white border border-gray-300/50 shadow-lg shadow-gray-400/40',
    description: 'قيد التوصيل - مغلق بعد الاتفاق'
  },
  '29': {
    text: 'مؤجل',
    icon: Clock,
    internalStatus: 'delivery',
    localStatus: 'delivery',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    color: 'bg-gradient-to-r from-yellow-500 to-amber-600 text-white border border-yellow-300/50 shadow-lg shadow-yellow-400/40',
    description: 'قيد التوصيل - مؤجل'
  },
  '30': {
    text: 'مؤجل لحين اعادة الطلب لاحقا',
    icon: Clock,
    internalStatus: 'delivery',
    localStatus: 'delivery',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    color: 'bg-gradient-to-r from-yellow-500 to-amber-600 text-white border border-yellow-300/50 shadow-lg shadow-yellow-400/40',
    description: 'قيد التوصيل - مؤجل لإعادة الطلب'
  },

  // حالات الإلغاء والرفض
  '31': {
    text: 'الغاء الطلب',
    icon: XCircle,
    internalStatus: 'returned', // راجع - يبقى محجوز
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    color: 'bg-gradient-to-r from-red-500 to-rose-600 text-white border border-red-300/50 shadow-lg shadow-red-400/40',
    description: 'راجع - يبقى محجوز'
  },
  '32': {
    text: 'رفض الطلب',
    icon: XCircle,
    internalStatus: 'returned', // راجع - يبقى محجوز
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    color: 'bg-gradient-to-r from-red-500 to-rose-600 text-white border border-red-300/50 shadow-lg shadow-red-400/40',
    description: 'راجع - يبقى محجوز'
  },

  // حالات مشاكل إضافية
  '33': {
    text: 'مفصول عن الخدمة',
    icon: Ban,
    internalStatus: 'delivery',
    localStatus: 'delivery',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    color: 'bg-gradient-to-r from-gray-600 to-slate-700 text-white border border-gray-400/50 shadow-lg shadow-gray-500/40',
    description: 'قيد التوصيل - مفصول عن الخدمة'
  },
  '34': {
    text: 'طلب مكرر',
    icon: AlertTriangle,
    internalStatus: 'delivery',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    color: 'bg-gradient-to-r from-orange-600 to-red-700 text-white border border-orange-400/50 shadow-lg shadow-orange-500/40',
    description: 'يحتاج معالجة - طلب مكرر'
  },
  '35': {
    text: 'مستلم مسبقا',
    icon: CheckCircle,
    internalStatus: 'delivery',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    color: 'bg-gradient-to-r from-green-600 to-emerald-700 text-white border border-green-400/50 shadow-lg shadow-green-500/40',
    description: 'يحتاج معالجة - مستلم مسبقاً'
  },
  '36': {
    text: 'الرقم غير معرف',
    icon: Phone,
    internalStatus: 'delivery',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    color: 'bg-gradient-to-r from-purple-600 to-indigo-700 text-white border border-purple-400/50 shadow-lg shadow-purple-500/40',
    description: 'يحتاج معالجة - الرقم غير معرف'
  },
  '37': {
    text: 'الرقم غير داخل في الخدمة',
    icon: PhoneOff,
    internalStatus: 'delivery',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    color: 'bg-gradient-to-r from-red-600 to-rose-700 text-white border border-red-400/50 shadow-lg shadow-red-500/40',
    description: 'يحتاج معالجة - الرقم غير داخل في الخدمة'
  },
  '38': {
    text: 'العنوان غير دقيق',
    icon: MapPin,
    internalStatus: 'delivery',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    color: 'bg-gradient-to-r from-amber-600 to-orange-700 text-white border border-amber-400/50 shadow-lg shadow-amber-500/40',
    description: 'يحتاج معالجة - العنوان غير دقيق'
  },
  '39': {
    text: 'لم يطلب',
    icon: XCircle,
    internalStatus: 'delivery',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    color: 'bg-gradient-to-r from-red-600 to-pink-700 text-white border border-red-400/50 shadow-lg shadow-red-500/40',
    description: 'يحتاج معالجة - لم يطلب'
  },
  '40': {
    text: 'حظر المندوب',
    icon: Ban,
    internalStatus: 'delivery',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    color: 'bg-gradient-to-r from-gray-700 to-slate-800 text-white border border-gray-500/50 shadow-lg shadow-gray-600/40',
    description: 'يحتاج معالجة - حظر المندوب'
  },
  '41': {
    text: 'لا يمكن الاتصال بالرقم',
    icon: PhoneOff,
    internalStatus: 'delivery',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    color: 'bg-gradient-to-r from-red-700 to-rose-800 text-white border border-red-500/50 shadow-lg shadow-red-600/40',
    description: 'يحتاج معالجة - لا يمكن الاتصال بالرقم'
  },
  '42': {
    text: 'تغيير المندوب',
    icon: RefreshCw,
    internalStatus: 'delivery',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    color: 'bg-gradient-to-r from-blue-600 to-cyan-700 text-white border border-blue-400/50 shadow-lg shadow-blue-500/40',
    description: 'قيد التوصيل - تغيير المندوب'
  },
  '43': {
    text: 'تغيير العنوان',
    icon: MapPin,
    internalStatus: 'delivery',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    color: 'bg-gradient-to-r from-purple-600 to-pink-700 text-white border border-purple-400/50 shadow-lg shadow-purple-500/40',
    description: 'قيد التوصيل - تغيير العنوان'
  },
  '44': {
    text: 'اخراج من المخزن وارسالة الى الفرز',
    icon: Package,
    internalStatus: 'delivery',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    color: 'bg-gradient-to-r from-indigo-600 to-purple-700 text-white border border-indigo-400/50 shadow-lg shadow-indigo-500/40',
    description: 'قيد التوصيل - إخراج من المخزن للفرز'
  }
};

// دوال مساعدة للتحقق من الصلاحيات
export const canDeleteOrder = (stateId) => {
  const status = ALWASEET_STATUS_DEFINITIONS[String(stateId)];
  return status ? status.canDelete : false;
};

export const canEditOrder = (stateId) => {
  const status = ALWASEET_STATUS_DEFINITIONS[String(stateId)];
  return status ? status.canEdit : false;
};

export const releasesStock = (stateId) => {
  const status = ALWASEET_STATUS_DEFINITIONS[String(stateId)];
  return status ? status.releasesStock : false;
};

export const getStatusConfig = (stateId) => {
  const status = ALWASEET_STATUS_DEFINITIONS[String(stateId)];
  if (!status) {
    return {
      text: 'حالة غير معروفة',
      icon: AlertTriangle,
      internalStatus: 'delivery',
      canDelete: false,
      canEdit: false,
      releasesStock: false,
      color: 'bg-gradient-to-r from-gray-500 to-slate-600 text-white border border-gray-300/50 shadow-lg shadow-gray-400/40',
      description: 'حالة غير معروفة'
    };
  }
  return status;
};

// إحصائيات الحالات
export const getStatusStats = () => {
  const stats = {
    total: Object.keys(ALWASEET_STATUS_DEFINITIONS).length,
    canDelete: 0,
    canEdit: 0,
    releasesStock: 0,
    byType: {
      pending: 0,
      delivery: 0,
      returned: 0,
      delivered: 0,
      returned_in_stock: 0
    }
  };

  Object.values(ALWASEET_STATUS_DEFINITIONS).forEach(status => {
    if (status.canDelete) stats.canDelete++;
    if (status.canEdit) stats.canEdit++;
    if (status.releasesStock) stats.releasesStock++;
    stats.byType[status.internalStatus]++;
  });

  return stats;
};

export default ALWASEET_STATUS_DEFINITIONS;