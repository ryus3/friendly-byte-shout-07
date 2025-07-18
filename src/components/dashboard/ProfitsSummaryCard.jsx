import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  DollarSign, 
  TrendingUp, 
  CheckCircle, 
  Clock, 
  Users, 
  Hourglass,
  BarChart3,
  PiggyBank,
  Wallet,
  Calculator
} from 'lucide-react';
import StatCard from '@/components/dashboard/StatCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ProfitsSummaryCard = ({ stats, userRole, user, hasPermission }) => {
  const [selectedPeriod, setSelectedPeriod] = useState('monthly');

  if (!stats) return null;

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.05,
        duration: 0.3,
        ease: "easeOut"
      }
    })
  };

  // تحديد البيانات حسب الصلاحيات
  const canViewAllData = hasPermission('view_all_profits') || userRole === 'super_admin' || userRole === 'manager';
  
  const profitCards = [
    {
      title: canViewAllData ? "الأرباح المستلمة" : "أرباحي المستلمة",
      value: `${(stats.settledProfits || 0).toLocaleString()} د.ع`,
      icon: CheckCircle,
      gradient: "from-green-500 to-emerald-600",
      bgGradient: "from-green-50 to-emerald-50",
      description: canViewAllData ? "إجمالي الأرباح المحصلة" : "أرباحي المحصلة"
    },
    {
      title: canViewAllData ? "الأرباح المعلقة" : "أرباحي المعلقة", 
      value: `${(stats.pendingProfits || 0).toLocaleString()} د.ع`,
      icon: Hourglass,
      gradient: "from-orange-500 to-amber-600",
      bgGradient: "from-orange-50 to-amber-50",
      description: canViewAllData ? "أرباح في انتظار التحصيل" : "أرباحي المعلقة"
    },
    {
      title: canViewAllData ? "أرباح المدير" : "أرباح إضافية",
      value: `${(stats.managerProfits || 0).toLocaleString()} د.ع`,
      icon: PiggyBank,
      gradient: "from-purple-500 to-violet-600", 
      bgGradient: "from-purple-50 to-violet-50",
      description: canViewAllData ? "أرباح الإدارة" : "أرباح متنوعة"
    },
    {
      title: "المستحقات المدفوعة",
      value: `${(stats.paidDues || 0).toLocaleString()} د.ع`,
      icon: Wallet,
      gradient: "from-blue-500 to-cyan-600",
      bgGradient: "from-blue-50 to-cyan-50", 
      description: "مستحقات تم دفعها"
    },
    {
      title: "المصاريف العامة",
      value: `${(stats.generalExpenses || 290000).toLocaleString()} د.ع`,
      icon: Calculator,
      gradient: "from-red-500 to-rose-600",
      bgGradient: "from-red-50 to-rose-50",
      description: "إجمالي المصروفات"
    },
    {
      title: "راتب الموظفين",
      value: `${(stats.employeeSalaries || 0).toLocaleString()} د.ع`,
      icon: Users,
      gradient: "from-indigo-500 to-blue-600",
      bgGradient: "from-indigo-50 to-blue-50",
      description: "مجموع رواتب الفريق"
    }
  ];

  return (
    <Card className="bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 border-2 border-primary/20">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 space-x-reverse">
            <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                ملخص الأرباح
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                عرض مفصل للأرباح من كل طلب. يمكنك استخدام الفلتر لتخصيص العرض.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">يومي</SelectItem>
                <SelectItem value="weekly">أسبوعي</SelectItem>
                <SelectItem value="monthly">شهري</SelectItem>
                <SelectItem value="yearly">سنوي</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="outline" className="bg-gradient-to-r from-blue-100 to-purple-100 text-blue-800 border-blue-200">
              {canViewAllData ? 'عرض شامل' : 'عرض شخصي'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {profitCards.map((card, index) => (
            <motion.div
              key={card.title}
              custom={index}
              initial="hidden"
              animate="visible"
              variants={cardVariants}
            >
              <Card className={`bg-gradient-to-br ${card.bgGradient} border-2 border-transparent hover:border-primary/30 transition-all duration-300 hover:shadow-lg`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`p-2 bg-gradient-to-r ${card.gradient} rounded-lg`}>
                      <card.icon className="h-5 w-5 text-white" />
                    </div>
                    <div className="text-right">
                      <h3 className="text-sm font-medium text-muted-foreground">{card.title}</h3>
                      <p className="text-lg font-bold">{card.value}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{card.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="border-t pt-4">
          <h3 className="text-lg font-semibold mb-3 flex items-center">
            <TrendingUp className="ml-2 h-5 w-5 text-blue-600" />
            تفاصيل الأرباح
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            عرض مفصل للأرباح من كل طلب. يمكنك استخدام الفلتر لتخصيص العرض حسب التاريخ والموظف والحالة.
            يتم حساب الأرباح بناءً على الطلبات المسلمة والمؤكدة فقط.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfitsSummaryCard;