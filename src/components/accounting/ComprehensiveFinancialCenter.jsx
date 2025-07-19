import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  AlertTriangle,
  PiggyBank,
  Wallet,
  CreditCard,
  BarChart3,
  Calculator,
  Receipt,
  ShoppingCart,
  Package,
  Users,
  Target,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { useInventory } from '@/contexts/InventoryContext';
import { supabase } from '@/lib/customSupabaseClient';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const ComprehensiveFinancialCenter = () => {
  const { settings, orders, accounting, products } = useInventory();
  const [financialData, setFinancialData] = useState({
    capital: 0,
    totalSpent: 0,
    spentBySource: {},
    remaining: 0,
    utilizationRate: 0,
    totalRevenue: 0,
    totalProfit: 0,
    totalExpenses: 0,
    inventoryValue: 0,
    netWorth: 0
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadComprehensiveFinancialData();
  }, [settings, orders, accounting, products]);

  const loadComprehensiveFinancialData = async () => {
    try {
      setLoading(true);
      
      // رأس المال من الإعدادات
      const capital = settings?.capital || 0;
      
      // المعاملات المالية
      const { data: transactions, error } = await supabase
        .from('financial_transactions')
        .select('*')
        .eq('transaction_type', 'expense')
        .eq('status', 'completed');

      if (error) throw error;

      // تجميع المصاريف حسب المصدر
      const spentBySource = transactions.reduce((acc, transaction) => {
        const metadata = transaction.metadata || {};
        const source = metadata.payment_source || 'capital';
        
        if (!acc[source]) {
          acc[source] = 0;
        }
        acc[source] += parseFloat(transaction.amount || 0);
        
        return acc;
      }, {});

      // إحصائيات الطلبات
      const deliveredOrders = orders?.filter(order => order.status === 'delivered') || [];
      const totalRevenue = deliveredOrders.reduce((sum, order) => sum + (order.final_amount || order.total_amount || 0), 0);
      
      // إحصائيات المصاريف
      const totalExpenses = accounting?.expenses?.reduce((sum, expense) => sum + (expense.amount || 0), 0) || 0;
      
      // قيمة المخزون
      const inventoryValue = products?.reduce((sum, product) => {
        const quantity = product.quantity || 0;
        const costPrice = product.cost_price || 0;
        return sum + (quantity * costPrice);
      }, 0) || 0;

      const totalSpent = Object.values(spentBySource).reduce((sum, amount) => sum + amount, 0);
      const remaining = capital - (spentBySource.capital || 0);
      const utilizationRate = capital > 0 ? ((spentBySource.capital || 0) / capital) * 100 : 0;
      const totalProfit = totalRevenue - totalExpenses;
      const netWorth = capital + totalProfit + inventoryValue;

      setFinancialData({
        capital,
        totalSpent,
        spentBySource,
        remaining,
        utilizationRate,
        totalRevenue,
        totalProfit,
        totalExpenses,
        inventoryValue,
        netWorth
      });
      
    } catch (error) {
      console.error('خطأ في تحميل البيانات المالية:', error);
    } finally {
      setLoading(false);
    }
  };

  const financialSummaryCards = useMemo(() => [
    {
      title: 'رأس المال الأساسي',
      value: financialData.capital,
      icon: PiggyBank,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      change: null
    },
    {
      title: 'إجمالي الإيرادات',
      value: financialData.totalRevenue,
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      change: null
    },
    {
      title: 'إجمالي المصاريف',
      value: financialData.totalExpenses,
      icon: TrendingDown,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      change: null
    },
    {
      title: 'صافي الربح',
      value: financialData.totalProfit,
      icon: Calculator,
      color: financialData.totalProfit >= 0 ? 'text-green-600' : 'text-red-600',
      bgColor: financialData.totalProfit >= 0 ? 'bg-green-50' : 'bg-red-50',
      change: null
    },
    {
      title: 'قيمة المخزون',
      value: financialData.inventoryValue,
      icon: Package,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      change: null
    },
    {
      title: 'صافي الثروة',
      value: financialData.netWorth,
      icon: Target,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      change: null
    }
  ], [financialData]);

  const getSourceName = (source) => {
    switch (source) {
      case 'capital': return 'رأس المال';
      case 'cash': return 'القاصة النقدية';
      case 'loan': return 'قرض/تمويل خارجي';
      case 'other': return 'مصدر آخر';
      default: return source;
    }
  };

  const getSourceIcon = (source) => {
    switch (source) {
      case 'capital': return <PiggyBank className="h-4 w-4" />;
      case 'cash': return <Wallet className="h-4 w-4" />;
      case 'loan': return <CreditCard className="h-4 w-4" />;
      default: return <DollarSign className="h-4 w-4" />;
    }
  };

  const getHealthStatus = () => {
    if (financialData.utilizationRate < 50) {
      return { status: 'ممتاز', color: 'text-green-600', icon: CheckCircle2 };
    } else if (financialData.utilizationRate < 80) {
      return { status: 'جيد', color: 'text-yellow-600', icon: AlertCircle };
    } else {
      return { status: 'تحذير', color: 'text-red-600', icon: AlertTriangle };
    }
  };

  const healthStatus = getHealthStatus();

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            المركز المالي الشامل
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 animate-pulse">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-gray-200 rounded"></div>
              ))}
            </div>
            <div className="h-40 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* نظرة عامة سريعة */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            المركز المالي الشامل
            <Badge variant="outline" className={`${healthStatus.color} border-current`}>
              <healthStatus.icon className="h-3 w-3 mr-1" />
              {healthStatus.status}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {financialSummaryCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.title} className={`p-4 rounded-lg border ${card.bgColor}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{card.title}</p>
                      <p className={`text-2xl font-bold ${card.color}`}>
                        {card.value.toLocaleString()} د.ع
                      </p>
                    </div>
                    <Icon className={`h-8 w-8 ${card.color}`} />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* تفاصيل مصادر التمويل */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
          <TabsTrigger value="sources">مصادر التمويل</TabsTrigger>
          <TabsTrigger value="analysis">تحليل مالي</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* معدل استخدام رأس المال */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">معدل استخدام رأس المال</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">المستخدم من رأس المال</span>
                  <span className="text-lg font-bold">
                    {financialData.utilizationRate.toFixed(1)}%
                  </span>
                </div>
                <Progress value={financialData.utilizationRate} className="h-3" />
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="text-center p-2 bg-red-50 rounded">
                    <p className="text-muted-foreground">المستخدم</p>
                    <p className="font-bold text-red-600">
                      {(financialData.spentBySource.capital || 0).toLocaleString()} د.ع
                    </p>
                  </div>
                  <div className="text-center p-2 bg-green-50 rounded">
                    <p className="text-muted-foreground">المتبقي</p>
                    <p className="font-bold text-green-600">
                      {financialData.remaining.toLocaleString()} د.ع
                    </p>
                  </div>
                </div>
                {financialData.utilizationRate > 80 && (
                  <div className="flex items-center gap-2 text-red-600 text-sm p-2 bg-red-50 rounded">
                    <AlertTriangle className="h-4 w-4" />
                    تحذير: معدل استخدام رأس المال مرتفع جداً
                  </div>
                )}
              </CardContent>
            </Card>

            {/* الأرباح والخسائر */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">الأرباح والخسائر</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">إجمالي الإيرادات</span>
                    <span className="font-medium text-green-600">
                      +{financialData.totalRevenue.toLocaleString()} د.ع
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">إجمالي المصاريف</span>
                    <span className="font-medium text-red-600">
                      -{financialData.totalExpenses.toLocaleString()} د.ع
                    </span>
                  </div>
                  <hr />
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">صافي الربح</span>
                    <span className={`font-bold text-lg ${financialData.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {financialData.totalProfit >= 0 ? '+' : ''}{financialData.totalProfit.toLocaleString()} د.ع
                    </span>
                  </div>
                </div>
                
                {/* هامش الربح */}
                <div className="pt-2 border-t">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">هامش الربح</span>
                    <span className="font-medium">
                      {financialData.totalRevenue > 0 
                        ? ((financialData.totalProfit / financialData.totalRevenue) * 100).toFixed(1)
                        : 0}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sources" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>تفصيل مصادر التمويل المستخدمة</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(financialData.spentBySource).map(([source, amount]) => (
                  <div key={source} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {getSourceIcon(source)}
                      <div>
                        <div className="font-medium">{getSourceName(source)}</div>
                        <div className="text-sm text-muted-foreground">
                          {((amount / financialData.totalSpent) * 100).toFixed(1)}% من إجمالي المصاريف
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">
                        {amount.toLocaleString()} د.ع
                      </div>
                    </div>
                  </div>
                ))}
                
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between font-bold text-lg">
                    <span>إجمالي المصاريف</span>
                    <span>{financialData.totalSpent.toLocaleString()} د.ع</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>نمو الثروة</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center p-4 bg-indigo-50 rounded-lg">
                    <p className="text-sm text-muted-foreground">صافي الثروة الحالي</p>
                    <p className="text-3xl font-bold text-indigo-600">
                      {financialData.netWorth.toLocaleString()} د.ع
                    </p>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>رأس المال الأساسي:</span>
                      <span>{financialData.capital.toLocaleString()} د.ع</span>
                    </div>
                    <div className="flex justify-between">
                      <span>الأرباح المحققة:</span>
                      <span className={financialData.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {financialData.totalProfit >= 0 ? '+' : ''}{financialData.totalProfit.toLocaleString()} د.ع
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>قيمة المخزون:</span>
                      <span>{financialData.inventoryValue.toLocaleString()} د.ع</span>
                    </div>
                    <hr />
                    <div className="flex justify-between font-bold">
                      <span>إجمالي الثروة:</span>
                      <span>{financialData.netWorth.toLocaleString()} د.ع</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>مؤشرات الأداء</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-sm">العائد على رأس المال</span>
                    </div>
                    <span className="font-bold text-green-600">
                      {financialData.capital > 0 
                        ? ((financialData.totalProfit / financialData.capital) * 100).toFixed(1)
                        : 0}%
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-blue-600" />
                      <span className="text-sm">نسبة المخزون للثروة</span>
                    </div>
                    <span className="font-bold text-blue-600">
                      {financialData.netWorth > 0 
                        ? ((financialData.inventoryValue / financialData.netWorth) * 100).toFixed(1)
                        : 0}%
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-purple-600" />
                      <span className="text-sm">كفاءة استخدام رأس المال</span>
                    </div>
                    <span className="font-bold text-purple-600">
                      {financialData.utilizationRate < 50 ? 'ممتاز' : 
                       financialData.utilizationRate < 80 ? 'جيد' : 'يحتاج تحسين'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ComprehensiveFinancialCenter;