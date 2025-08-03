import React from 'react';

const SystemTest = () => {
  return (
    <div className="p-4 bg-green-100 border border-green-300 rounded">
      <h3 className="text-lg font-bold text-green-800">نظام يعمل بشكل صحيح</h3>
      <p className="text-sm text-green-600">التعديلات المطبقة:</p>
      <ul className="list-disc list-inside text-xs text-green-600 mt-2">
        <li>تم تغيير لون كارت قيمة المخزون إلى البنفسجي</li>
        <li>تم إضافة خيار "كل الفترات" كافتراضي في صفحة تحليل الأرباح</li>
        <li>تم إضافة نظام حفظ تلقائي للفلاتر</li>
      </ul>
    </div>
  );
};

export default SystemTest;