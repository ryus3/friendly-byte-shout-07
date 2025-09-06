import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  RefreshCw, 
  Zap, 
  Users, 
  Truck, 
  UserCheck,
  Clock,
  Sparkles,
  Target
} from 'lucide-react';

/**
 * شريط أدوات احترافي للمزامنة - تجميع جميع أزرار المزامنة
 */
const ProfessionalSyncToolbar = ({ 
  syncing, 
  syncingEmployee, 
  smartSync, 
  syncSpecificEmployee, 
  comprehensiveSync, 
  syncOrdersOnly,
  lastComprehensiveSync,
  isAdmin,
  employees = []
}) => {
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const getTimeSinceSync = () => {
    if (!lastComprehensiveSync) return null;
    const diff = Date.now() - new Date(lastComprehensiveSync).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}س ${minutes}د`;
    }
    return `${minutes}د`;
  };

  const timeSinceSync = getTimeSinceSync();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="p-4 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900/10 dark:to-purple-900/10 border-2 border-blue-100 dark:border-blue-800/50">
        <div className="flex flex-col space-y-4">
          {/* العنوان والحالة */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ 
                  rotate: syncing ? 360 : 0,
                  scale: syncing ? 1.1 : 1 
                }}
                transition={{ 
                  rotate: { duration: 2, repeat: syncing ? Infinity : 0, ease: "linear" },
                  scale: { duration: 0.3 }
                }}
                className="p-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg"
              >
                <Sparkles className="h-5 w-5 text-white" />
              </motion.div>
              <div>
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                  مركز المزامنة الذكية
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {syncing 
                    ? "جاري المزامنة الذكية..." 
                    : syncingEmployee 
                    ? "مزامنة موظف محدد..." 
                    : "جاهز للمزامنة"}
                </p>
              </div>
            </div>
            
            {/* مؤشر آخر مزامنة */}
            {timeSinceSync && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                آخر مزامنة: {timeSinceSync}
              </Badge>
            )}
          </div>

          {/* شريط الأزرار الاحترافي */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* مزامنة سريعة ذكية */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                onClick={() => selectedEmployee ? syncSpecificEmployee(selectedEmployee.user_id, selectedEmployee.full_name) : smartSync()}
                disabled={syncing || syncingEmployee}
                className="w-full h-auto flex flex-col items-center gap-2 p-4 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white border-0 shadow-lg hover:shadow-emerald-500/25"
              >
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  {syncing && <RefreshCw className="h-4 w-4 animate-spin" />}
                </div>
                <div className="text-center">
                  <div className="font-bold text-sm">مزامنة سريعة</div>
                  <div className="text-xs opacity-90">
                    {selectedEmployee ? `للموظف: ${selectedEmployee.full_name}` : 'لجميع الموظفين'}
                  </div>
                </div>
              </Button>
            </motion.div>

            {/* مزامنة شاملة */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                onClick={() => selectedEmployee ? syncSpecificEmployee(selectedEmployee.user_id, selectedEmployee.full_name) : comprehensiveSync()}
                disabled={syncing || syncingEmployee || (!selectedEmployee && !isAdmin)}
                className="w-full h-auto flex flex-col items-center gap-2 p-4 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white border-0 shadow-lg hover:shadow-blue-500/25"
              >
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {syncing && <RefreshCw className="h-4 w-4 animate-spin" />}
                </div>
                <div className="text-center">
                  <div className="font-bold text-sm">مزامنة شاملة</div>
                  <div className="text-xs opacity-90">
                    {selectedEmployee ? `للموظف: ${selectedEmployee.full_name}` : 'لجميع الموظفين'}
                  </div>
                </div>
              </Button>
            </motion.div>

            {/* مزامنة الطلبات فقط */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                onClick={() => selectedEmployee ? syncOrdersOnly(selectedEmployee.user_id) : syncOrdersOnly()}
                disabled={syncing || syncingEmployee}
                className="w-full h-auto flex flex-col items-center gap-2 p-4 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white border-0 shadow-lg hover:shadow-orange-500/25"
              >
                <div className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  {syncingEmployee && <RefreshCw className="h-4 w-4 animate-spin" />}
                </div>
                <div className="text-center">
                  <div className="font-bold text-sm">تحديث الطلبات</div>
                  <div className="text-xs opacity-90">
                    {selectedEmployee ? `للموظف: ${selectedEmployee.full_name}` : 'لجميع الموظفين'}
                  </div>
                </div>
              </Button>
            </motion.div>

            {/* اختيار موظف */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="relative"
            >
              <div className="w-full h-auto flex flex-col items-center gap-2 p-4 border-2 border-purple-300 hover:border-purple-400 hover:bg-purple-50 dark:border-purple-600 dark:hover:border-purple-500 dark:hover:bg-purple-800/50 rounded-md">
                <UserCheck className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                <div className="text-center">
                  <div className="font-bold text-sm text-purple-700 dark:text-purple-300">اختيار موظف</div>
                  <div className="text-xs opacity-70 mb-2">للمزامنة المخصصة</div>
                </div>
                <Select value={selectedEmployee?.user_id || "ALL_EMPLOYEES"} onValueChange={(value) => {
                  const emp = value === "ALL_EMPLOYEES" ? null : employees.find(e => e.user_id === value);
                  setSelectedEmployee(emp || null);
                }}>
                  <SelectTrigger className="w-full text-xs">
                    <SelectValue placeholder="جميع الموظفين" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL_EMPLOYEES">جميع الموظفين</SelectItem>
                    {employees.map((emp) => (
                      <SelectItem key={emp.user_id} value={emp.user_id}>
                        {emp.full_name || emp.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </motion.div>
          </div>

          {/* مؤشر التقدم */}
          {(syncing || syncingEmployee) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
            >
              <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                {syncing 
                  ? "جاري المزامنة الذكية - يرجى الانتظار..." 
                  : "جاري مزامنة الموظف المحدد..."}
              </span>
            </motion.div>
          )}

          {/* نصائح الاستخدام */}
          <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">
            <div className="flex items-start gap-2">
              <Target className="h-4 w-4 mt-0.5 text-blue-500 flex-shrink-0" />
              <div>
                <div className="font-medium mb-1">نصائح للاستخدام الأمثل:</div>
                <ul className="space-y-1 text-xs">
                  <li>• <strong>اختيار موظف:</strong> يجعل جميع أزرار المزامنة تعمل للموظف المحدد فقط</li>
                  <li>• <strong>المزامنة السريعة:</strong> تجلب الفواتير الجديدة فقط (الأسرع)</li>
                  <li>• <strong>المزامنة الشاملة:</strong> تجلب جميع البيانات</li>
                  <li>• <strong>تحديث الطلبات:</strong> يحدث حالات التوصيل فقط</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};

export default ProfessionalSyncToolbar;