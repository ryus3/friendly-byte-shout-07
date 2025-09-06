import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  RefreshCw, 
  Zap, 
  Users, 
  Truck, 
  RotateCcw,
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
  isAdmin
}) => {
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
                onClick={smartSync}
                disabled={syncing || syncingEmployee}
                className="w-full h-auto flex flex-col items-center gap-2 p-4 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white border-0 shadow-lg hover:shadow-emerald-500/25"
              >
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  {syncing && <RefreshCw className="h-4 w-4 animate-spin" />}
                </div>
                <div className="text-center">
                  <div className="font-bold text-sm">مزامنة سريعة</div>
                  <div className="text-xs opacity-90">فواتير جديدة فقط</div>
                </div>
              </Button>
            </motion.div>

            {/* مزامنة شاملة */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                onClick={comprehensiveSync}
                disabled={syncing || syncingEmployee || !isAdmin}
                className="w-full h-auto flex flex-col items-center gap-2 p-4 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white border-0 shadow-lg hover:shadow-blue-500/25"
              >
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {syncing && <RefreshCw className="h-4 w-4 animate-spin" />}
                </div>
                <div className="text-center">
                  <div className="font-bold text-sm">مزامنة شاملة</div>
                  <div className="text-xs opacity-90">جميع الموظفين</div>
                </div>
              </Button>
            </motion.div>

            {/* مزامنة الطلبات فقط */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                onClick={() => syncOrdersOnly()}
                disabled={syncing || syncingEmployee}
                className="w-full h-auto flex flex-col items-center gap-2 p-4 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white border-0 shadow-lg hover:shadow-orange-500/25"
              >
                <div className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  {syncingEmployee && <RefreshCw className="h-4 w-4 animate-spin" />}
                </div>
                <div className="text-center">
                  <div className="font-bold text-sm">تحديث الطلبات</div>
                  <div className="text-xs opacity-90">حالات التوصيل</div>
                </div>
              </Button>
            </motion.div>

            {/* إعادة تحميل البيانات */}
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                onClick={() => window.location.reload()}
                disabled={syncing || syncingEmployee}
                variant="outline"
                className="w-full h-auto flex flex-col items-center gap-2 p-4 border-2 border-gray-300 hover:border-gray-400 hover:bg-gray-50 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-gray-800/50"
              >
                <RotateCcw className="h-5 w-5" />
                <div className="text-center">
                  <div className="font-bold text-sm">إعادة تحميل</div>
                  <div className="text-xs opacity-70">البيانات المحلية</div>
                </div>
              </Button>
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
                  <li>• <strong>المزامنة السريعة:</strong> تجلب الفواتير الجديدة فقط (الأسرع)</li>
                  <li>• <strong>المزامنة الشاملة:</strong> تجلب جميع البيانات (للمديرين فقط)</li>
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