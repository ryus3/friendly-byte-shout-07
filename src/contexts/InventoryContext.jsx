/**
 * ملف التوافق العكسي - يربط InventoryContext القديم مع SuperProvider الجديد
 * يضمن عدم كسر أي من الملفات الموجودة وتوجيه كل شيء للنظام الموحد
 */

// إعادة توجيه كامل للنظام الموحد
import { useSuper, SuperProvider } from '@/contexts/SuperProvider';

export { 
  useSuper as useInventory,
  SuperProvider as InventoryProvider 
};

// تصدير default أيضاً للتوافق التام
export default useSuper;