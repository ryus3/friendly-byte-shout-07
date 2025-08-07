/**
 * إصلاحات اتساق البيانات
 * يحل المشاكل المكتشفة في النظام
 */

import { supabase } from '@/integrations/supabase/client';
import { getUserUUID } from './userIdUtils';

/**
 * إصلاح تناقضات معرفات المستخدمين في جدول معين
 * @param {string} tableName - اسم الجدول
 * @param {string} userIdColumn - اسم عمود معرف المستخدم
 * @param {Object} user - كائن المستخدم الحالي
 */
export const fixUserIdConsistency = async (tableName, userIdColumn, user) => {
  if (!user) return;
  
  const correctUUID = getUserUUID(user);
  if (!correctUUID) return;
  
  try {
    // البحث عن السجلات التي تحتوي على معرفات غير صحيحة
    const { data: inconsistentRecords } = await supabase
      .from(tableName)
      .select('id, ' + userIdColumn)
      .or(`${userIdColumn}.eq.${user.id},${userIdColumn}.eq.${user.user_id}`)
      .neq(userIdColumn, correctUUID);
    
    if (inconsistentRecords?.length > 0) {
      console.log(`🔧 إصلاح ${inconsistentRecords.length} سجل في جدول ${tableName}`);
      
      // تحديث السجلات بالمعرف الصحيح
      for (const record of inconsistentRecords) {
        await supabase
          .from(tableName)
          .update({ [userIdColumn]: correctUUID })
          .eq('id', record.id);
      }
      
      console.log(`✅ تم إصلاح تناقضات معرفات المستخدمين في جدول ${tableName}`);
    }
  } catch (error) {
    console.error(`❌ خطأ في إصلاح تناقضات جدول ${tableName}:`, error);
  }
};

/**
 * فحص شامل لاتساق البيانات
 * @param {Object} user - كائن المستخدم الحالي
 */
export const performDataConsistencyCheck = async (user) => {
  if (!user) return;
  
  console.log('🔍 بدء فحص اتساق البيانات...');
  
  try {
    // فحص الطلبات
    await fixUserIdConsistency('orders', 'created_by', user);
    
    // فحص المنتجات
    await fixUserIdConsistency('products', 'created_by', user);
    
    // فحص المشتريات
    await fixUserIdConsistency('purchases', 'created_by', user);
    
    // فحص الأرباح
    await fixUserIdConsistency('profits', 'employee_id', user);
    
    // فحص الإشعارات
    await fixUserIdConsistency('notifications', 'user_id', user);
    
    console.log('✅ انتهى فحص اتساق البيانات');
  } catch (error) {
    console.error('❌ خطأ في فحص اتساق البيانات:', error);
  }
};

/**
 * إصلاح مشكلة ازدواجية فواتير التسوية
 * @param {Object} user - كائن المستخدم الحالي
 */
export const fixSettlementInvoiceConsistency = async (user) => {
  if (!user) return;
  
  const userUUID = getUserUUID(user);
  const employeeCode = user.employee_code;
  
  if (!userUUID) return;
  
  try {
    // البحث عن فواتير تحتوي على employee_id لكن بدون employee_code
    const { data: incompleteInvoices } = await supabase
      .from('settlement_invoices')
      .select('id, employee_id, employee_code')
      .eq('employee_id', userUUID)
      .is('employee_code', null);
    
    if (incompleteInvoices?.length > 0 && employeeCode) {
      console.log(`🔧 إصلاح ${incompleteInvoices.length} فاتورة تسوية ناقصة`);
      
      // تحديث الفواتير بإضافة employee_code
      for (const invoice of incompleteInvoices) {
        await supabase
          .from('settlement_invoices')
          .update({ employee_code: employeeCode })
          .eq('id', invoice.id);
      }
      
      console.log('✅ تم إصلاح فواتير التسوية الناقصة');
    }
  } catch (error) {
    console.error('❌ خطأ في إصلاح فواتير التسوية:', error);
  }
};

/**
 * إزالة البيانات المكررة
 * @param {string} tableName - اسم الجدول
 * @param {string[]} uniqueColumns - الأعمدة التي يجب أن تكون فريدة
 */
export const removeDuplicateData = async (tableName, uniqueColumns) => {
  try {
    console.log(`🔍 البحث عن البيانات المكررة في جدول ${tableName}...`);
    
    // هذا يتطلب stored procedure في قاعدة البيانات
    // سيتم تنفيذه لاحقاً حسب الحاجة
    
  } catch (error) {
    console.error(`❌ خطأ في إزالة البيانات المكررة من جدول ${tableName}:`, error);
  }
};

/**
 * فحص صحة العلاقات في قاعدة البيانات
 */
export const validateDatabaseRelations = async () => {
  try {
    console.log('🔍 فحص صحة العلاقات في قاعدة البيانات...');
    
    // فحص الطلبات بدون عناصر
    const { data: ordersWithoutItems } = await supabase
      .from('orders')
      .select('id, order_number')
      .not('id', 'in', '(SELECT DISTINCT order_id FROM order_items WHERE order_id IS NOT NULL)');
    
    if (ordersWithoutItems?.length > 0) {
      console.warn(`⚠️ وجدت ${ordersWithoutItems.length} طلب بدون عناصر`);
    }
    
    // فحص المنتجات بدون متغيرات
    const { data: productsWithoutVariants } = await supabase
      .from('products')
      .select('id, name')
      .not('id', 'in', '(SELECT DISTINCT product_id FROM product_variants WHERE product_id IS NOT NULL)');
    
    if (productsWithoutVariants?.length > 0) {
      console.warn(`⚠️ وجدت ${productsWithoutVariants.length} منتج بدون متغيرات`);
    }
    
    console.log('✅ انتهى فحص صحة العلاقات');
  } catch (error) {
    console.error('❌ خطأ في فحص صحة العلاقات:', error);
  }
};