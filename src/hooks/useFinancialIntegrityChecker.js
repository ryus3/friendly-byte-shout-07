/**
 * نظام فحص وتنظيف التكرار المالي
 * يكتشف ويصحح المصاريف والحركات المكررة
 */

import { supabase } from '@/integrations/supabase/client';

export const useFinancialIntegrityChecker = () => {

  // فحص التكرار في الحركات المالية
  const checkDuplicateMovements = async () => {
    try {
      const { data: duplicates, error } = await supabase
        .from('cash_movements')
        .select(`
          reference_id,
          reference_type,
          amount,
          created_at,
          description
        `)
        .eq('reference_type', 'expense')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // تجميع الحركات حسب المرجع والمبلغ
      const grouped = {};
      duplicates.forEach(movement => {
        const key = `${movement.reference_id}_${movement.amount}`;
        if (!grouped[key]) {
          grouped[key] = [];
        }
        grouped[key].push(movement);
      });

      // البحث عن التكرارات
      const foundDuplicates = Object.entries(grouped)
        .filter(([key, movements]) => movements.length > 1)
        .map(([key, movements]) => ({
          referenceId: movements[0].reference_id,
          amount: movements[0].amount,
          count: movements.length,
          movements: movements.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        }));

      return foundDuplicates;
    } catch (error) {
      console.error('خطأ في فحص التكرار:', error);
      return [];
    }
  };

  // فحص التطابق بين المصاريف والحركات
  const checkExpenseMovementConsistency = async () => {
    try {
      // جلب المصاريف المعتمدة
      const { data: expenses, error: expensesError } = await supabase
        .from('expenses')
        .select('id, amount, description, category, expense_type')
        .eq('status', 'approved')
        .neq('expense_type', 'system');

      if (expensesError) throw expensesError;

      // جلب الحركات المالية للمصاريف
      const { data: movements, error: movementsError } = await supabase
        .from('cash_movements')
        .select('reference_id, amount, movement_type')
        .eq('reference_type', 'expense');

      if (movementsError) throw movementsError;

      // فحص التطابق
      const inconsistencies = [];
      
      expenses.forEach(expense => {
        const relatedMovements = movements.filter(m => m.reference_id === expense.id);
        
        if (relatedMovements.length === 0) {
          inconsistencies.push({
            type: 'missing_movement',
            expense,
            issue: 'مصروف بدون حركة مالية'
          });
        } else if (relatedMovements.length > 1) {
          inconsistencies.push({
            type: 'duplicate_movement',
            expense,
            movements: relatedMovements,
            issue: 'مصروف له أكثر من حركة مالية'
          });
        } else {
          const movement = relatedMovements[0];
          if (parseFloat(movement.amount) !== parseFloat(expense.amount)) {
            inconsistencies.push({
              type: 'amount_mismatch',
              expense,
              movement,
              issue: 'عدم تطابق المبلغ بين المصروف والحركة'
            });
          }
        }
      });

      return inconsistencies;
    } catch (error) {
      console.error('خطأ في فحص التطابق:', error);
      return [];
    }
  };

  // إصلاح الحركات المكررة (حذف الأحدث)
  const fixDuplicateMovements = async (duplicates) => {
    try {
      const fixResults = [];

      for (const duplicate of duplicates) {
        // حذف الحركات الزائدة (الأحدث) والاحتفاظ بالأقدم
        const movementsToDelete = duplicate.movements.slice(0, -1); // جميع الحركات عدا الأقدم
        
        for (const movement of movementsToDelete) {
          // إنشاء حركة عكسية لتصحيح الرصيد
          const { data: reverseMovement, error: reverseError } = await supabase
            .from('cash_movements')
            .insert({
              cash_source_id: movement.cash_source_id,
              amount: movement.amount,
              movement_type: 'in', // عكس الحركة الأصلية
              reference_type: 'correction',
              reference_id: movement.id,
              description: `تصحيح تكرار: ${movement.description}`,
              balance_before: 0, // سيتم حسابه
              balance_after: 0,  // سيتم حسابه
              created_by: movement.created_by,
              created_at: new Date().toISOString()
            })
            .select()
            .single();

          if (reverseError) {
            console.error('خطأ في إنشاء الحركة العكسية:', reverseError);
          } else {
            fixResults.push({
              originalMovement: movement,
              reverseMovement,
              status: 'corrected'
            });
          }
        }
      }

      return fixResults;
    } catch (error) {
      console.error('خطأ في إصلاح التكرار:', error);
      return [];
    }
  };

  // تقرير شامل عن صحة النظام المالي
  const generateFinancialHealthReport = async () => {
    try {
      console.log('🔍 بدء فحص صحة النظام المالي...');

      const [duplicates, inconsistencies] = await Promise.all([
        checkDuplicateMovements(),
        checkExpenseMovementConsistency()
      ]);

      // حساب إجمالي التكرارات
      const totalDuplicateAmount = duplicates.reduce((sum, dup) => {
        return sum + (parseFloat(dup.amount) * (dup.count - 1)); // المبلغ المكرر
      }, 0);

      const report = {
        timestamp: new Date().toISOString(),
        health: {
          duplicateMovements: duplicates.length,
          totalDuplicateAmount,
          inconsistencies: inconsistencies.length,
          overallHealth: duplicates.length === 0 && inconsistencies.length === 0 ? 'healthy' : 'needs_attention'
        },
        details: {
          duplicates,
          inconsistencies
        },
        recommendations: []
      };

      // إضافة التوصيات
      if (duplicates.length > 0) {
        report.recommendations.push({
          type: 'fix_duplicates',
          message: `تم العثور على ${duplicates.length} حركة مكررة بمبلغ إجمالي ${totalDuplicateAmount.toLocaleString()} د.ع`,
          action: 'fixDuplicateMovements'
        });
      }

      if (inconsistencies.length > 0) {
        report.recommendations.push({
          type: 'fix_inconsistencies',
          message: `تم العثور على ${inconsistencies.length} عدم تطابق بين المصاريف والحركات`,
          action: 'manual_review_required'
        });
      }

      console.log('📊 تقرير صحة النظام المالي:', report);
      return report;

    } catch (error) {
      console.error('خطأ في إنتاج تقرير صحة النظام المالي:', error);
      return {
        timestamp: new Date().toISOString(),
        health: { overallHealth: 'error' },
        error: error.message
      };
    }
  };

  return {
    checkDuplicateMovements,
    checkExpenseMovementConsistency,
    fixDuplicateMovements,
    generateFinancialHealthReport
  };
};

export default useFinancialIntegrityChecker;