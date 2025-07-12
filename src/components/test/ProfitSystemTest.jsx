import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/components/ui/use-toast';

const ProfitSystemTest = () => {
  const { calculateProfit, products, employeeProfitRules } = useInventory();
  const { allUsers } = useAuth();
  const [testResults, setTestResults] = useState([]);

  const runProfitTests = () => {
    const tests = [];
    
    // اختبار 1: حساب الربح الأساسي
    const testItem1 = {
      productId: products[0]?.id,
      price: 100000,
      cost_price: 60000,
      quantity: 2
    };
    
    const employee = allUsers.find(u => u.role === 'employee');
    if (employee && testItem1.productId) {
      const profit1 = calculateProfit(testItem1, employee.id);
      const expectedProfit = (100000 - 60000) * 2; // 80,000
      
      tests.push({
        test: 'حساب الربح الأساسي',
        expected: expectedProfit,
        actual: profit1,
        passed: profit1 === expectedProfit,
        details: `سعر البيع: ${testItem1.price}, سعر التكلفة: ${testItem1.cost_price}, الكمية: ${testItem1.quantity}`
      });
    }

    // اختبار 2: حساب الربح مع قاعدة منتج محددة
    if (employee && testItem1.productId) {
      const productRule = employeeProfitRules[employee.id]?.find(r => 
        r.rule_type === 'product' && r.target_id === String(testItem1.productId)
      );
      
      if (productRule) {
        const profit2 = calculateProfit(testItem1, employee.id);
        const expectedProfit2 = productRule.profit_amount * testItem1.quantity;
        
        tests.push({
          test: 'حساب الربح مع قاعدة منتج محددة',
          expected: expectedProfit2,
          actual: profit2,
          passed: profit2 === expectedProfit2,
          details: `قاعدة الربح: ${productRule.profit_amount} × ${testItem1.quantity}`
        });
      }
    }

    // اختبار 3: حساب الربح مع بيانات ناقصة
    const testItem3 = {
      productId: products[0]?.id,
      price: null,
      cost_price: 60000,
      quantity: 1
    };
    
    if (employee) {
      const profit3 = calculateProfit(testItem3, employee.id);
      tests.push({
        test: 'حساب الربح مع بيانات ناقصة (سعر فارغ)',
        expected: 0,
        actual: profit3,
        passed: profit3 === 0,
        details: 'يجب أن يُرجع 0 عند عدم وجود سعر'
      });
    }

    // اختبار 4: حساب الربح بدون موظف
    const profit4 = calculateProfit(testItem1, null);
    tests.push({
      test: 'حساب الربح بدون موظف',
      expected: 0,
      actual: profit4,
      passed: profit4 === 0,
      details: 'يجب أن يُرجع 0 عند عدم وجود معرف موظف'
    });

    setTestResults(tests);
    
    const passedTests = tests.filter(t => t.passed).length;
    const totalTests = tests.length;
    
    if (passedTests === totalTests) {
      toast({
        title: "✅ نظام الأرباح يعمل بشكل صحيح",
        description: `نجح ${passedTests} من ${totalTests} اختبارات`,
        variant: "success"
      });
    } else {
      toast({
        title: "⚠️ يوجد مشاكل في نظام الأرباح",
        description: `نجح ${passedTests} من ${totalTests} اختبارات فقط`,
        variant: "destructive"
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>اختبار نظام الأرباح</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={runProfitTests}>تشغيل الاختبارات</Button>
        
        {testResults.length > 0 && (
          <div className="space-y-2">
            {testResults.map((test, index) => (
              <div key={index} className={`p-3 rounded border ${test.passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center gap-2">
                  <span className={test.passed ? 'text-green-600' : 'text-red-600'}>
                    {test.passed ? '✅' : '❌'}
                  </span>
                  <strong>{test.test}</strong>
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {test.details}
                </div>
                <div className="text-sm mt-1">
                  متوقع: {test.expected.toLocaleString()} د.ع | فعلي: {test.actual.toLocaleString()} د.ع
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProfitSystemTest;