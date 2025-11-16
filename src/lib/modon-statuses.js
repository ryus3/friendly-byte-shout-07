// نظام شامل لحالات MODON مع إدارة المخزون والحذف
// MODON comprehensive status system with stock and deletion management

import { 
  Package, 
  Truck, 
  CheckCircle, 
  XCircle,
  RotateCcw,
  MapPin,
  Clock,
  AlertTriangle,
  Building,
  RefreshCw,
  Home,
  ArrowLeft,
  Ban,
  PhoneOff
} from 'lucide-react';

// تعريف كامل لحالات MODON بناءً على الوثائق المتاحة
// Based on webhook documentation and API responses
export const MODON_STATUS_DEFINITIONS = {
  // الحالة الوحيدة التي يمكن حذفها - طلب جديد
  '1': {
    text: 'طلب جديد',
    icon: Package,
    localStatus: 'pending', 
    canDelete: true,  // ✅ الحالة الوحيدة التي يمكن حذفها
    canEdit: true,
    releasesStock: false,
    receiptReceived: false,
    isFinal: false,
    color: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white border border-blue-300/50 shadow-lg shadow-blue-400/40',
    description: 'طلب جديد - يمكن الحذف والتعديل'
  },

  // الحالة 2 - تم الاستلام من قبل المندوب
  '2': {
    text: 'تم استلام الطلب من قبل المندوب',
    icon: Truck,
    localStatus: 'shipped',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    receiptReceived: false,
    isFinal: false,
    color: 'bg-gradient-to-r from-orange-500 to-amber-600 text-white border border-orange-300/50 shadow-lg shadow-orange-400/40',
    description: 'تم الشحن - لا يمكن الحذف أو التعديل'
  },

  // حالات التوصيل - قيد التوصيل
  '3': {
    text: 'قيد التوصيل الى الزبون',
    icon: MapPin,
    localStatus: 'delivery',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    receiptReceived: false,
    isFinal: false,
    color: 'bg-gradient-to-r from-status-delivery-start to-status-delivery-end text-white border border-status-delivery-border shadow-lg shadow-status-delivery-shadow/40',
    description: 'قيد التوصيل - في عهدة المندوب'
  },

  // الحالات النهائية - تحرر المخزون
  '4': {
    text: 'تم التسليم للزبون',
    icon: CheckCircle,
    localStatus: 'delivered',
    canDelete: false,
    canEdit: false,
    releasesStock: true, // ✅ تحرر المحجوز -> مباع
    receiptReceived: true,
    isFinal: true,
    color: 'bg-gradient-to-r from-green-500 to-emerald-600 text-white border border-green-300/50 shadow-lg shadow-green-400/40',
    description: 'تم التسليم - يحرر المحجوز ويصبح مباع'
  },

  // حالات المرتجع - تبقى محجوزة
  '5': {
    text: 'مرتجع - في المخزن',
    icon: RotateCcw,
    localStatus: 'returned',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    receiptReceived: false,
    isFinal: false,
    color: 'bg-gradient-to-r from-yellow-500 to-amber-600 text-white border border-yellow-300/50 shadow-lg shadow-yellow-400/40',
    description: 'راجع - يبقى محجوز'
  },

  '6': {
    text: 'قيد الارجاع',
    icon: ArrowLeft,
    localStatus: 'returned',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    receiptReceived: false,
    isFinal: false,
    color: 'bg-gradient-to-r from-orange-500 to-red-600 text-white border border-orange-300/50 shadow-lg shadow-orange-400/40',
    description: 'راجع - يبقى محجوز'
  },

  '7': {
    text: 'تم الارجاع الى التاجر',
    icon: Home,
    localStatus: 'returned_in_stock',
    canDelete: false,
    canEdit: false,
    releasesStock: true, // ✅ تحرر المحجوز -> يعود للمخزن
    receiptReceived: true,
    isFinal: true,
    color: 'bg-gradient-to-r from-emerald-500 to-green-600 text-white border border-emerald-300/50 shadow-lg shadow-emerald-400/40',
    description: 'تم الإرجاع للتاجر - يحرر المحجوز ويضاف للمخزن'
  },

  // حالات المشاكل
  '8': {
    text: 'لا يرد',
    icon: PhoneOff,
    localStatus: 'delivery',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    receiptReceived: false,
    isFinal: false,
    color: 'bg-gradient-to-r from-red-500 to-rose-600 text-white border border-red-300/50 shadow-lg shadow-red-400/40',
    description: 'يحتاج معالجة - لا يرد'
  },

  '9': {
    text: 'مغلق',
    icon: Ban,
    localStatus: 'delivery',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    receiptReceived: false,
    isFinal: false,
    color: 'bg-gradient-to-r from-gray-500 to-slate-600 text-white border border-gray-300/50 shadow-lg shadow-gray-400/40',
    description: 'يحتاج معالجة - مغلق'
  },

  '10': {
    text: 'مؤجل',
    icon: Clock,
    localStatus: 'delivery',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    receiptReceived: false,
    isFinal: false,
    color: 'bg-gradient-to-r from-yellow-500 to-amber-600 text-white border border-yellow-300/50 shadow-lg shadow-yellow-400/40',
    description: 'يحتاج معالجة - مؤجل'
  },

  '11': {
    text: 'الغاء الطلب',
    icon: XCircle,
    localStatus: 'returned',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    receiptReceived: false,
    isFinal: false,
    color: 'bg-gradient-to-r from-red-500 to-rose-600 text-white border border-red-300/50 shadow-lg shadow-red-400/40',
    description: 'راجع - يبقى محجوز'
  },

  '12': {
    text: 'رفض الطلب',
    icon: XCircle,
    localStatus: 'returned',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    receiptReceived: false,
    isFinal: false,
    color: 'bg-gradient-to-r from-red-500 to-rose-600 text-white border border-red-300/50 shadow-lg shadow-red-400/40',
    description: 'راجع - يبقى محجوز'
  },

  '13': {
    text: 'اعادة الارسال الى الزبون',
    icon: RefreshCw,
    localStatus: 'delivery',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    receiptReceived: false,
    isFinal: false,
    color: 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white border border-blue-300/50 shadow-lg shadow-blue-400/40',
    description: 'قيد التوصيل - إعادة الإرسال'
  },

  '14': {
    text: 'في موقع الفرز',
    icon: Building,
    localStatus: 'delivery',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    receiptReceived: false,
    isFinal: false,
    color: 'bg-gradient-to-r from-cyan-500 to-teal-600 text-white border border-cyan-300/50 shadow-lg shadow-cyan-400/40',
    description: 'قيد التوصيل - في موقع الفرز'
  },

  '15': {
    text: 'في مكتب',
    icon: Building,
    localStatus: 'delivery',
    canDelete: false,
    canEdit: false,
    releasesStock: false,
    receiptReceived: false,
    isFinal: false,
    color: 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white border border-indigo-300/50 shadow-lg shadow-indigo-400/40',
    description: 'قيد التوصيل - في المكتب'
  }
};

// دوال مساعدة للتحقق من الصلاحيات
export const canDeleteModonOrder = (statusId) => {
  const status = MODON_STATUS_DEFINITIONS[String(statusId)];
  return status ? status.canDelete : false;
};

export const canEditModonOrder = (statusId) => {
  const status = MODON_STATUS_DEFINITIONS[String(statusId)];
  return status ? status.canEdit : false;
};

export const releasesModonStock = (statusId) => {
  const status = MODON_STATUS_DEFINITIONS[String(statusId)];
  return status ? status.releasesStock : false;
};

export const getModonStatusConfig = (statusId, statusText = '', currentStatus = null) => {
  const status = MODON_STATUS_DEFINITIONS[String(statusId)];
  if (!status) {
    // ✅ CRITICAL: لا تُرجع حالة افتراضية - أبقِ الحالة كما هي
    console.error(`❌ [MODON-STATUS] حالة غير معروفة: ${statusId} - النص: ${statusText}`);
    return {
      text: statusText || 'حالة غير معروفة',
      icon: AlertTriangle,
      localStatus: currentStatus || 'unknown', // ✅ لا تغيير افتراضي
      canDelete: false,
      canEdit: false,
      releasesStock: false,
      receiptReceived: false,
      isFinal: false,
      color: 'bg-gradient-to-r from-gray-500 to-slate-600 text-white border border-gray-300/50 shadow-lg shadow-gray-400/40',
      description: 'حالة غير معروفة - لم يتم التعديل'
    };
  }
  return status;
};

// إحصائيات الحالات
export const getModonStatusStats = () => {
  const stats = {
    total: 0,
    canDelete: 0,
    cannotDelete: 0,
    releasesStock: 0,
    final: 0
  };

  Object.values(MODON_STATUS_DEFINITIONS).forEach(status => {
    stats.total++;
    if (status.canDelete) stats.canDelete++;
    else stats.cannotDelete++;
    if (status.releasesStock) stats.releasesStock++;
    if (status.isFinal) stats.final++;
  });

  return stats;
};

// تصدير جميع الحالات كمصفوفة للعرض
export const getAllModonStatuses = () => {
  return Object.entries(MODON_STATUS_DEFINITIONS).map(([id, status]) => ({
    id,
    ...status
  }));
};
