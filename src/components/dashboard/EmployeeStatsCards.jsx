import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  DollarSign, 
  ShoppingCart, 
  TrendingUp, 
  Clock, 
  CheckCircle,
  AlertTriangle,
  Bot,
  MapPin,
  Star,
  Receipt
} from 'lucide-react';
import StatCard from '@/components/dashboard/StatCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import EmployeeSettlementDialog from '@/components/dashboard/EmployeeSettlementDialog';

const EmployeeStatsCards = ({ stats, userRole, canRequestSettlement, user }) => {
  const [showSettlementDialog, setShowSettlementDialog] = useState(false);

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

  const profitCards = [
    {
      title: "أرباحي المعلقة",
      value: `${(stats.pendingProfits || 0).toLocaleString()} د.ع`,
      icon: Clock,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      description: "أرباح في انتظار التحاسب"
    },
    {
      title: "أرباحي المستلمة",
      value: `${(stats.settledProfits || 0).toLocaleString()} د.ع`,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50",
      description: "أرباح تم تسليمها"
    },
    {
      title: "إجمالي أرباحي",
      value: `${(stats.totalProfits || 0).toLocaleString()} د.ع`,
      icon: DollarSign,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      description: "مجموع جميع أرباحي"
    }
  ];

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

      {/* كروت الأرباح */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-foreground flex items-center">
            <DollarSign className="ml-2 h-5 w-5 text-green-600" />
            أرباحي المالية
          </h2>
          {canRequestSettlement && stats.pendingProfits > 0 && 
           user?.role !== 'super_admin' && 
           user?.role !== 'manager' && 
           !user?.roles?.includes('super_admin') && 
           !user?.roles?.includes('manager') && (
            <Button 
              onClick={() => setShowSettlementDialog(true)}
              size="sm"
              className="bg-green-600 hover:bg-green-700"
            >
              <Receipt className="ml-2 h-4 w-4" />
              طلب تحاسب
            </Button>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {profitCards.map((card, index) => (
            <motion.div
              key={card.title}
              custom={index + 4}
              initial="hidden"
              animate="visible"
              variants={cardVariants}
            >
              <StatCard
                title={card.title}
                value={card.value}
                icon={card.icon}
                description={card.description}
                className="hover:shadow-lg transition-shadow duration-300"
              />
            </motion.div>
          ))}
        </div>
      </div>

      {/* إشعارات مهمة */}
      {(stats.pendingOrders > 5 || stats.pendingProfits > 100000) && (
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
            {stats.pendingProfits > 100000 && (
              <p>• لديك أرباح معلقة بقيمة {stats.pendingProfits.toLocaleString()} د.ع</p>
            )}
          </div>
        </motion.div>
      )}

      {/* مربع حوار طلب التحاسب */}
      {canRequestSettlement && 
       user?.role !== 'super_admin' && 
       user?.role !== 'manager' && 
       !user?.roles?.includes('super_admin') && 
       !user?.roles?.includes('manager') && (
        <EmployeeSettlementDialog
          open={showSettlementDialog}
          onOpenChange={setShowSettlementDialog}
          pendingProfits={stats.pendingProfits}
        />
      )}
    </div>
  );
};

export default EmployeeStatsCards;