import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  ShoppingCart, 
  TrendingUp, 
  Clock, 
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import StatCard from '@/components/dashboard/StatCard';
import { Badge } from '@/components/ui/badge';

const EmployeeStatsCards = ({ stats, userRole }) => {

  if (!stats) return null;

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.1,
        duration: 0.5,
        ease: "easeOut"
      }
    })
  };

  const statsCards = [
    {
      title: "إجمالي طلباتي",
      value: stats.totalOrders || 0,
      icon: ShoppingCart,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      trend: "+5% من الشهر الماضي",
      description: "جميع الطلبات التي أنشأتها"
    },
    {
      title: "الطلبات المعلقة",
      value: stats.pendingOrders || 0,
      icon: Clock,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      description: "طلبات في انتظار التنفيذ"
    },
    {
      title: "الطلبات المكتملة",
      value: stats.completedOrders || 0,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50",
      description: "طلبات تم تسليمها بنجاح"
    },
    {
      title: "إجمالي المبيعات",
      value: `${(stats.totalRevenue || 0).toLocaleString()} د.ع`,
      icon: TrendingUp,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      description: "قيمة جميع مبيعاتي"
    }
  ];

  // تم حذف كروت الأرباح المالية - سيتم عرضها في صفحة ملخص الأرباح

  return (
    <div className="space-y-6">
      {/* كروت الطلبات والمبيعات */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground">إحصائياتي الشخصية</h2>
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
            {userRole === 'sales_employee' ? 'موظف مبيعات' :
             userRole === 'warehouse_employee' ? 'موظف مخزن' :
             userRole === 'cashier' ? 'كاشير' :
             'موظف'}
          </Badge>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statsCards.map((card, index) => (
            <motion.div
              key={card.title}
              custom={index}
              initial="hidden"
              animate="visible"
              variants={cardVariants}
            >
              <StatCard
                title={card.title}
                value={card.value}
                icon={card.icon}
                trend={card.trend}
                description={card.description}
                className="hover:shadow-lg transition-shadow duration-300"
              />
            </motion.div>
          ))}
        </div>
      </div>

      {/* تم حذف قسم كروت الأرباح المالية من لوحة تحكم الموظف */}

      {/* إشعارات مهمة */}
      {stats.pendingOrders > 5 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-lg p-4"
        >
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-orange-600 ml-2" />
            <h3 className="font-semibold text-orange-800">تنبيهات مهمة</h3>
          </div>
          <div className="mt-2 space-y-1 text-sm text-orange-700">
            {stats.pendingOrders > 5 && (
              <p>• لديك {stats.pendingOrders} طلب معلق يحتاج متابعة</p>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default EmployeeStatsCards;