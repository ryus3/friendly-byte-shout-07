import React from 'react';
import { motion } from 'framer-motion';
import { 
  Plus, 
  Package, 
  ShoppingCart, 
  Users, 
  Calculator, 
  Receipt,
  QrCode,
  Zap,
  Settings,
  BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/UnifiedAuthContext';

const QuickActionsPanel = ({ userPermissions, navigate }) => {
  const { user } = useAuth();
  const quickActions = [
    {
      title: "طلب جديد",
      description: "إنشاء طلب بيع جديد",
      icon: Plus,
      color: "bg-blue-500 hover:bg-blue-600",
      action: () => navigate('/create-order'),
      permission: userPermissions.canCreateOrder
    },
    {
      title: "طلب سريع",
      description: "إنشاء طلب سريع",
      icon: Zap,
      color: "bg-green-500 hover:bg-green-600",
      action: () => navigate('/quick-order'),
      permission: userPermissions.canQuickOrder
    },
    {
      title: "إدارة المنتجات",
      description: "إضافة وتعديل المنتجات",
      icon: Package,
      color: "bg-purple-500 hover:bg-purple-600",
      action: () => navigate('/manage-products'),
      permission: userPermissions.canManageProducts
    },
    {
      title: "عرض المخزون",
      description: "مراقبة حالة المخزون",
      icon: BarChart3,
      color: "bg-orange-500 hover:bg-orange-600",
      action: () => navigate('/inventory'),
      permission: userPermissions.canViewInventory
    },
    {
      title: "قارئ الباركود",
      description: "مسح المنتجات",
      icon: QrCode,
      color: "bg-cyan-500 hover:bg-cyan-600",
      action: () => navigate('/barcode-inventory'),
      permission: userPermissions.canUseBarcode
    },
    {
      title: "طلب تحاسب",
      description: "طلب تسوية الأرباح",
      icon: Receipt,
      color: "bg-emerald-500 hover:bg-emerald-600",
      action: () => navigate('/profits'),
      permission: userPermissions.canRequestSettlement && user?.role !== 'super_admin' && user?.role !== 'manager'
    },
    {
      title: "إدارة الموظفين",
      description: "إدارة حسابات الموظفين",
      icon: Users,
      color: "bg-red-500 hover:bg-red-600",
      action: () => navigate('/employees'),
      permission: userPermissions.canManageEmployees
    },
    {
      title: "المحاسبة",
      description: "عرض التقارير المالية",
      icon: Calculator,
      color: "bg-yellow-500 hover:bg-yellow-600",
      action: () => navigate('/accounting'),
      permission: userPermissions.canViewAccounting
    }
  ];

  const availableActions = quickActions.filter(action => action.permission);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.3
      }
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Settings className="ml-2 h-5 w-5 text-primary" />
          الإجراءات السريعة
        </CardTitle>
        <CardDescription>
          الوصول السريع للمهام الأساسية حسب صلاحياتك
        </CardDescription>
      </CardHeader>
      <CardContent>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          {availableActions.map((action, index) => (
            <motion.div
              key={action.title}
              variants={itemVariants}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                onClick={action.action}
                variant="outline"
                className="w-full h-auto p-4 justify-start text-right hover:shadow-md transition-all duration-200"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="text-right">
                    <div className="font-medium text-sm">{action.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {action.description}
                    </div>
                  </div>
                  <div className={`p-2 rounded-lg ${action.color} text-white`}>
                    <action.icon className="h-4 w-4" />
                  </div>
                </div>
              </Button>
            </motion.div>
          ))}
        </motion.div>
        
        {availableActions.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Settings className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>لا توجد إجراءات سريعة متاحة حسب صلاحياتك الحالية</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default QuickActionsPanel;