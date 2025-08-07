/**
 * ملف التوافق العكسي - يربط InventoryContext القديم مع SuperProvider الجديد
 * يضمن عدم كسر أي من الملفات الموجودة
 */

export { 
  useSuper as useInventory,
  SuperProvider as InventoryProvider 
} from '@/contexts/SuperProvider';