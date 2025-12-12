-- إضافة expense المفقود لفاتورة التسوية RY-FIXED01
INSERT INTO expenses (
  amount,
  category,
  expense_type,
  description,
  receipt_number,
  vendor_name,
  status,
  created_by,
  approved_by
) VALUES (
  18000,
  'مستحقات الموظفين',
  'system',
  'دفع مستحقات الموظف احمد - فاتورة RY-FIXED01 (تصحيح)',
  'RY-FIXED01',
  'احمد',
  'approved',
  '91484496-b887-44f7-9e5d-be9db5567604',
  '91484496-b887-44f7-9e5d-be9db5567604'
);