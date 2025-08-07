/**
 * ملف التوافق العكسي - يربط InventoryContext القديم مع SuperProvider الجديد
 * يضمن عدم كسر أي من الملفات الموجودة وتوجيه كل شيء للنظام الموحد
 */

// إعادة توجيه كامل للنظام الموحد
export { 
  useSuper as useInventory,
  SuperProvider as InventoryProvider 
} from '@/contexts/SuperProvider';

// تصدير default أيضاً للتوافق التام
export default useSuper;