-- حذف الأرباح الوهمية للموظفين المحذوفين الذين لم يعودوا في profiles
DELETE FROM profits 
WHERE employee_id NOT IN (
  SELECT user_id FROM profiles WHERE user_id IS NOT NULL
)
AND employee_id IS NOT NULL;