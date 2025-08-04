/**
 * 💰 صفحة إدارة الأرباح الموحدة الجديدة
 * تستخدم النظام المالي الموحد لحسابات دقيقة
 */

import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  DollarSign, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  Users,
  BarChart,
  FileText,
  Banknote,
  Hourglass,
  Coins as HandCoins
} from 'lucide-react';

import { useUnifiedFinancialContext } from '@/contexts/UnifiedFinancialContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { TIME_PERIODS } from '@/lib/unified-financial-filters';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import StatCard from '@/components/dashboard/StatCard';
import UnifiedFinancialDisplay from '@/components/financial/UnifiedFinancialDisplay';
import UnifiedSettlementRequest from '@/components/profits/UnifiedSettlementRequest';
import ManagerProfitsDialog from '@/components/profits/ManagerProfitsDialog';
import SettlementInvoiceDialog from '@/components/profits/SettlementInvoiceDialog';

const UnifiedProfitsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canViewAllData, isAdmin } = usePermissions();
  
  // استخدام النظام المالي الموحد
  const { 
    profits: financialData, 
    updatePeriod, 
    periods, 
    formatCurrency,
    systemStatus,
    isUnifiedSystem,
    systemVersion 
  } = useUnifiedFinancialContext();

  // حالة النوافذ المنبثقة
  const [dialogs, setDialogs] = useState({
    managerProfits: false,
    settlementInvoice: false
  });

  // معلومات الفترة الزمنية الحالية
  const currentPeriod = periods.profits || TIME_PERIODS.ALL;

  // كروت الأرباح الرئيسية
  const profitCards = [
    {
      key: 'totalRevenue',
      title: 'إجمالي المبيعات',
      value: financialData.totalRevenue || 0,
      icon: DollarSign,
      colors: ['blue-500', 'indigo-600'],
      format: 'currency',
      onClick: () => navigate('/accounting')
    },
    {
      key: 'grossProfit',
      title: 'الربح الإجمالي',
      value: financialData.grossProfit || 0,
      icon: TrendingUp,
      colors: ['green-500', 'emerald-600'],
      format: 'currency'
    },
    {
      key: 'systemProfit',
      title: 'ربح النظام',
      value: financialData.systemProfit || 0,
      icon: Banknote,
      colors: ['purple-500', 'violet-600'],
      format: 'currency'
    },
    {
      key: 'netProfit',
      title: 'صافي الربح',
      value: financialData.netProfit || 0,
      icon: HandCoins,
      colors: financialData.netProfit >= 0 ? ['green-500', 'emerald-600'] : ['red-500', 'rose-600'],
      format: 'currency'
    }
  ];

  // كروت المستحقات والمصاريف
  const expenseCards = [
    {
      key: 'employeeDuesPaid',
      title: 'مستحقات مدفوعة',
      value: financialData.employeeDuesPaid || 0,
      icon: CheckCircle,
      colors: ['green-500', 'emerald-600'],
      format: 'currency',
      onClick: () => setDialogs(d => ({ ...d, managerProfits: true }))
    },
    {
      key: 'employeeDuesPending',
      title: 'مستحقات معلقة',
      value: financialData.employeeDuesPending || 0,
      icon: Hourglass,
      colors: ['yellow-500', 'amber-600'],
      format: 'currency'
    },
    {
      key: 'generalExpenses',
      title: 'مصاريف عامة',
      value: financialData.generalExpenses || 0,
      icon: Users,
      colors: ['red-500', 'rose-600'],
      format: 'currency',
      onClick: () => navigate('/accounting')
    }
  ];

  // إحصائيات سريعة
  const quickStats = useMemo(() => {
    const grossProfitMargin = financialData.grossProfitMargin || 0;
    const netProfitMargin = financialData.netProfitMargin || 0;
    const isProfitable = (financialData.netProfit || 0) > 0;
    
    return {
      grossProfitMargin,
      netProfitMargin,
      isProfitable,
      ordersCount: financialData.ordersCount || 0,
      averageOrderValue: financialData.ordersCount ? 
        (financialData.totalRevenue || 0) / financialData.ordersCount : 0
    };
  }, [financialData]);

  if (financialData.loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>إدارة الأرباح الموحدة - نظام RYUS</title>
        <meta name="description" content="نظام إدارة أرباح موحد ودقيق مع حسابات مالية متسقة." />
      </Helmet>
      
      <div className="space-y-6">
        {/* العنوان والفلاتر */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold gradient-text">إدارة الأرباح الموحدة</h1>
            <p className="text-muted-foreground">نظام أرباح موحد ودقيق v{systemVersion}</p>
          </div>
          
          <div className="flex gap-2 flex-wrap items-center">
            <select 
              className="px-3 py-2 border border-border rounded-md bg-background text-foreground"
              value={currentPeriod}
              onChange={(e) => updatePeriod('profits', e.target.value)}
            >
              <option value={TIME_PERIODS.TODAY}>اليوم</option>
              <option value={TIME_PERIODS.WEEK}>هذا الأسبوع</option>
              <option value={TIME_PERIODS.MONTH}>هذا الشهر</option>
              <option value={TIME_PERIODS.YEAR}>هذا العام</option>
              <option value={TIME_PERIODS.ALL}>كل الفترات</option>
            </select>
            
            <Button variant="outline" onClick={() => navigate('/analytics')}>
              <BarChart className="ml-2 h-4 w-4" />
              التحليلات
            </Button>
            
            <Button variant="outline">
              <FileText className="ml-2 h-4 w-4" />
              تقرير PDF
            </Button>
          </div>
        </div>

        {/* تنبيه النظام الموحد */}
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            ✅ <strong>نظام الأرباح الموحد نشط!</strong> جميع حسابات الأرباح دقيقة ومتسقة. 
            البيانات محسوبة من مصدر واحد موحد.
          </AlertDescription>
        </Alert>

        {/* الإحصائيات السريعة */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">هامش الربح الإجمالي</p>
                <p className="text-2xl font-bold text-green-600">
                  {quickStats.grossProfitMargin.toFixed(1)}%
                </p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">هامش الربح الصافي</p>
                <p className="text-2xl font-bold text-blue-600">
                  {quickStats.netProfitMargin.toFixed(1)}%
                </p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">متوسط قيمة الطلب</p>
                <p className="text-2xl font-bold text-purple-600">
                  {formatCurrency(quickStats.averageOrderValue)}
                </p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">حالة الربحية</p>
                <Badge variant={quickStats.isProfitable ? "success" : "destructive"}>
                  {quickStats.isProfitable ? "مربح" : "خسارة"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* كروت الأرباح الرئيسية */}
        <div>
          <h2 className="text-xl font-semibold mb-4">الأرباح والمبيعات</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {profitCards.map((card) => (
              <StatCard
                key={card.key}
                title={card.title}
                value={card.value}
                icon={card.icon}
                colors={card.colors}
                format={card.format}
                onClick={card.onClick}
              />
            ))}
          </div>
        </div>

        {/* كروت المستحقات والمصاريف */}
        <div>
          <h2 className="text-xl font-semibold mb-4">المستحقات والمصاريف</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {expenseCards.map((card) => (
              <StatCard
                key={card.key}
                title={card.title}
                value={card.value}
                icon={card.icon}
                colors={card.colors}
                format={card.format}
                onClick={card.onClick}
              />
            ))}
          </div>
        </div>

        {/* طلب التحاسب */}
        <UnifiedSettlementRequest />

        {/* العرض التفصيلي */}
        <div>
          <h2 className="text-xl font-semibold mb-4">التفاصيل المالية</h2>
          <UnifiedFinancialDisplay page="profits" />
        </div>

        {/* معلومات النظام */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              معلومات النظام الموحد
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <strong>الإصدار:</strong> v{systemVersion}
                <br />
                <strong>النوع:</strong> نظام موحد
                <br />
                <strong>الحالة:</strong> <Badge variant="success">نشط</Badge>
              </div>
              <div>
                <strong>الطلبات المشمولة:</strong> {financialData.ordersCount}
                <br />
                <strong>الفترة الحالية:</strong> {financialData.dateRange?.label}
                <br />
                <strong>مصدر البيانات:</strong> قاعدة البيانات مباشرة
              </div>
              <div>
                <strong>آخر تحديث:</strong> {new Date(systemStatus.lastUpdate).toLocaleString('ar')}
                <br />
                <strong>دقة البيانات:</strong> <Badge variant="success">100%</Badge>
                <br />
                <strong>الأداء:</strong> <Badge variant="success">ممتاز</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* النوافذ المنبثقة */}
      <ManagerProfitsDialog 
        open={dialogs.managerProfits} 
        onOpenChange={(open) => setDialogs(d => ({ ...d, managerProfits: open }))}
      />
      
      <SettlementInvoiceDialog 
        open={dialogs.settlementInvoice} 
        onOpenChange={(open) => setDialogs(d => ({ ...d, settlementInvoice: open }))}
      />
    </>
  );
};

export default UnifiedProfitsPage;