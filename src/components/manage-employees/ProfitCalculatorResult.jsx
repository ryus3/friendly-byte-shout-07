import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, DollarSign, Target, Calculator } from 'lucide-react';

const ProfitCalculatorResult = ({ 
  employee, 
  product, 
  quantity, 
  employeeProfitRules, 
  calculateProfit 
}) => {
  // البحث عن قواعد الربح للموظف
  const employeeRules = employeeProfitRules[employee?.user_id || employee?.id] || [];
  
  // محاكاة عنصر الطلب
  const mockOrderItem = {
    productId: product?.id,
    price: product?.base_price || 0,
    cost_price: product?.cost_price || 0,
    quantity: quantity || 1
  };

  // حساب الربح باستخدام الدالة الموجودة
  const employeeProfit = calculateProfit ? calculateProfit(mockOrderItem, employee?.user_id || employee?.id) : 0;
  
  // حساب الربح الإجمالي
  const totalProfit = (mockOrderItem.price - mockOrderItem.cost_price) * mockOrderItem.quantity;
  const managerProfit = totalProfit - employeeProfit;

  // البحث عن القاعدة المطبقة
  const appliedRule = employeeRules.find(rule => {
    if (rule.rule_type === 'product' && rule.target_id === String(product?.id)) {
      return true;
    }
    // يمكن إضافة منطق للفئات والأقسام هنا
    return false;
  });

  const defaultRule = !appliedRule;

  return (
    <div className="space-y-4">
      {/* معلومات أساسية */}
      <div className="grid grid-cols-2 gap-4">
        <div className="text-center">
          <p className="text-lg font-bold text-blue-600">{employeeProfit.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">ربح الموظف (د.ع)</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-green-600">{managerProfit.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">ربح الإدارة (د.ع)</p>
        </div>
      </div>

      {/* تفاصيل الحساب */}
      <Card className="bg-muted/30">
        <CardContent className="p-3">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>سعر البيع:</span>
              <span className="font-medium">{mockOrderItem.price.toLocaleString()} د.ع</span>
            </div>
            <div className="flex justify-between">
              <span>سعر التكلفة:</span>
              <span className="font-medium">{mockOrderItem.cost_price.toLocaleString()} د.ع</span>
            </div>
            <div className="flex justify-between">
              <span>الكمية:</span>
              <span className="font-medium">{quantity}</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-semibold">
              <span>إجمالي الربح:</span>
              <span className="text-green-600">{totalProfit.toLocaleString()} د.ع</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* القاعدة المطبقة */}
      <div className="flex items-center gap-2">
        <Target className="w-4 h-4" />
        <span className="text-sm font-medium">القاعدة المطبقة:</span>
        {appliedRule ? (
          <Badge variant="secondary" className="text-xs">
            {appliedRule.rule_type === 'product' ? 'قاعدة منتج مخصصة' : 'قاعدة عامة'} - 
            {appliedRule.profit_amount > 0 
              ? `${appliedRule.profit_amount.toLocaleString()} د.ع` 
              : `${appliedRule.profit_percentage}%`
            }
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs">
            القاعدة الافتراضية (هامش الربح الطبيعي)
          </Badge>
        )}
      </div>

      {/* نصائح */}
      {defaultRule && (
        <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg">
          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm font-medium">نصيحة:</span>
          </div>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            يمكنك إنشاء قاعدة ربح مخصصة لهذا المنتج أو الموظف لتحسين التحفيز
          </p>
        </div>
      )}
    </div>
  );
};

export default ProfitCalculatorResult;