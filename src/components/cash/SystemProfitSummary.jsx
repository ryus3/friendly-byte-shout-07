import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  ShoppingCart, 
  Package,
  DollarSign,
  Calculator,
  AlertTriangle
} from 'lucide-react';

/**
 * عنصر عرض ملخص الربح العام للنظام
 * يحسب: رأس المال + أرباح المبيعات - المشتريات - المصاريف = الربح العام
 */
const SystemProfitSummary = ({ 
  capitalAmount = 0,
  realizedProfits = 0, 
  totalPurchases = 0,
  totalExpenses = 0,
  className = ""
}) => {
  
  const calculations = useMemo(() => {
    // الربح العام = رأس المال + أرباح المبيعات المحققة - المشتريات - المصاريف
    const totalProfit = capitalAmount + realizedProfits - totalPurchases - totalExpenses;
    
    // النسب المئوية
    const profitMargin = capitalAmount > 0 ? ((realizedProfits / capitalAmount) * 100) : 0;
    const expenseRatio = capitalAmount > 0 ? ((totalExpenses / capitalAmount) * 100) : 0;
    const purchaseRatio = capitalAmount > 0 ? ((totalPurchases / capitalAmount) * 100) : 0;
    
    return {
      totalProfit,
      profitMargin,
      expenseRatio,
      purchaseRatio,
      isPositive: totalProfit >= capitalAmount,
      growth: totalProfit - capitalAmount
    };
  }, [capitalAmount, realizedProfits, totalPurchases, totalExpenses]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('ar-IQ', {
      style: 'decimal',
      minimumFractionDigits: 0
    }).format(Math.abs(amount));
  };

  return (
    <Card className={`${className} border-2 ${calculations.isPositive ? 'border-emerald-200' : 'border-orange-200'}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Calculator className="w-5 h-5 text-primary" />
          الربح العام للنظام
          <Badge variant={calculations.isPositive ? "default" : "destructive"} className="mr-auto">
            {calculations.isPositive ? "ربحي" : "خسارة"}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* الحساب الأساسي */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
            <Wallet className="w-4 h-4 text-blue-600" />
            <div>
              <p className="text-xs text-muted-foreground">رأس المال</p>
              <p className="font-bold text-blue-600">+{formatCurrency(capitalAmount)}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-lg">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <div>
              <p className="text-xs text-muted-foreground">أرباح المبيعات</p>
              <p className="font-bold text-emerald-600">+{formatCurrency(realizedProfits)}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 p-3 bg-orange-50 rounded-lg">
            <Package className="w-4 h-4 text-orange-600" />
            <div>
              <p className="text-xs text-muted-foreground">المشتريات</p>
              <p className="font-bold text-orange-600">-{formatCurrency(totalPurchases)}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
            <TrendingDown className="w-4 h-4 text-red-600" />
            <div>
              <p className="text-xs text-muted-foreground">المصاريف</p>
              <p className="font-bold text-red-600">-{formatCurrency(totalExpenses)}</p>
            </div>
          </div>
        </div>
        
        {/* النتيجة النهائية */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg">
            <div className="flex items-center gap-3">
              <DollarSign className={`w-6 h-6 ${calculations.isPositive ? 'text-emerald-600' : 'text-red-600'}`} />
              <div>
                <p className="text-sm text-muted-foreground">الربح العام</p>
                <p className={`text-xl font-bold ${calculations.isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                  {formatCurrency(calculations.totalProfit)} د.ع
                </p>
              </div>
            </div>
            
            <div className="text-left">
              <p className="text-xs text-muted-foreground">النمو من رأس المال</p>
              <p className={`text-sm font-semibold ${calculations.growth >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {calculations.growth >= 0 ? '+' : ''}{formatCurrency(calculations.growth)} د.ع
              </p>
            </div>
          </div>
        </div>
        
        {/* المؤشرات */}
        <div className="grid grid-cols-3 gap-3 pt-2">
          <div className="text-center p-2 bg-emerald-50 rounded">
            <p className="text-xs text-muted-foreground">هامش الربح</p>
            <p className="font-semibold text-emerald-600">{calculations.profitMargin.toFixed(1)}%</p>
          </div>
          <div className="text-center p-2 bg-orange-50 rounded">
            <p className="text-xs text-muted-foreground">نسبة المشتريات</p>
            <p className="font-semibold text-orange-600">{calculations.purchaseRatio.toFixed(1)}%</p>
          </div>
          <div className="text-center p-2 bg-red-50 rounded">
            <p className="text-xs text-muted-foreground">نسبة المصاريف</p>
            <p className="font-semibold text-red-600">{calculations.expenseRatio.toFixed(1)}%</p>
          </div>
        </div>
        
        {/* تحذيرات */}
        {calculations.expenseRatio > 20 && (
          <div className="flex items-center gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-yellow-600" />
            <p className="text-xs text-yellow-700">تحذير: نسبة المصاريف مرتفعة ({calculations.expenseRatio.toFixed(1)}%)</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SystemProfitSummary;