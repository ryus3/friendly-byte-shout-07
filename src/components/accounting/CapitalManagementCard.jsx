import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  AlertTriangle,
  PiggyBank,
  Wallet,
  CreditCard,
  BarChart3
} from 'lucide-react';
import { useInventory } from '@/contexts/InventoryContext';
import { supabase } from '@/lib/customSupabaseClient';

const CapitalManagementCard = () => {
  const { settings } = useInventory();
  const [financialData, setFinancialData] = useState({
    capital: 0,
    totalSpent: 0,
    spentBySource: {},
    remaining: 0,
    utilizationRate: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFinancialData();
  }, [settings]);

  const loadFinancialData = async () => {
    try {
      setLoading(true);
      
      // الحصول على رأس المال من الإعدادات
      const capital = settings?.capital || 0;
      
      // الحصول على المعاملات المالية (المصاريف)
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

      const totalSpent = Object.values(spentBySource).reduce((sum, amount) => sum + amount, 0);
      const remaining = capital - (spentBySource.capital || 0);
      const utilizationRate = capital > 0 ? ((spentBySource.capital || 0) / capital) * 100 : 0;

      setFinancialData({
        capital,
        totalSpent,
        spentBySource,
        remaining,
        utilizationRate
      });
      
    } catch (error) {
      console.error('خطأ في تحميل البيانات المالية:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const getUtilizationColor = (rate) => {
    if (rate < 50) return 'text-green-600';
    if (rate < 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getUtilizationBadgeColor = (rate) => {
    if (rate < 50) return 'bg-green-100 text-green-800 border-green-300';
    if (rate < 80) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-red-100 text-red-800 border-red-300';
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            إدارة رأس المال
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-8 bg-gray-200 rounded mb-4"></div>
              <div className="h-20 bg-gray-200 rounded"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          إدارة رأس المال
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* نظرة عامة على رأس المال */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <PiggyBank className="h-8 w-8 mx-auto mb-2 text-blue-600" />
              <div className="text-sm text-muted-foreground">رأس المال الأساسي</div>
              <div className="text-lg font-bold">
                {financialData.capital.toLocaleString()} د.ع
              </div>
            </div>
            
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <TrendingDown className="h-8 w-8 mx-auto mb-2 text-red-600" />
              <div className="text-sm text-muted-foreground">المستخدم من رأس المال</div>
              <div className="text-lg font-bold text-red-600">
                {(financialData.spentBySource.capital || 0).toLocaleString()} د.ع
              </div>
            </div>
            
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 text-green-600" />
              <div className="text-sm text-muted-foreground">الباقي من رأس المال</div>
              <div className="text-lg font-bold text-green-600">
                {financialData.remaining.toLocaleString()} د.ع
              </div>
            </div>
          </div>

          {/* معدل الاستخدام */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">معدل استخدام رأس المال</span>
              <Badge variant="outline" className={getUtilizationBadgeColor(financialData.utilizationRate)}>
                {financialData.utilizationRate.toFixed(1)}%
              </Badge>
            </div>
            <Progress value={financialData.utilizationRate} className="h-3" />
            {financialData.utilizationRate > 80 && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertTriangle className="h-4 w-4" />
                تحذير: معدل استخدام رأس المال مرتفع
              </div>
            )}
          </div>

          {/* تفصيل المصاريف حسب المصدر */}
          <div className="space-y-3">
            <div className="text-sm font-medium">تفصيل المصاريف حسب مصدر التمويل</div>
            <div className="space-y-2">
              {Object.entries(financialData.spentBySource).map(([source, amount]) => (
                <div key={source} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center gap-2">
                    {getSourceIcon(source)}
                    <span className="text-sm">{getSourceName(source)}</span>
                  </div>
                  <span className="font-medium">
                    {amount.toLocaleString()} د.ع
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* إجمالي المصاريف */}
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">إجمالي المصاريف من جميع المصادر</span>
              <span className="text-lg font-bold">
                {financialData.totalSpent.toLocaleString()} د.ع
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CapitalManagementCard;