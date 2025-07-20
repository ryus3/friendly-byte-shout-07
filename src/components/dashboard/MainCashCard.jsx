import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/utils';
import { Wallet, TrendingUp, TrendingDown, Plus, Minus, DollarSign, Receipt, ShoppingCart } from 'lucide-react';
import { motion } from 'framer-motion';

const MainCashCard = ({ mainCashBalance, breakdown, loading }) => {
  const [showDetails, setShowDetails] = useState(false);

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">القاصة الرئيسية</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold animate-pulse">جاري التحميل...</div>
        </CardContent>
      </Card>
    );
  }

  const getBalanceColor = (balance) => {
    if (balance > 0) return 'text-green-600';
    if (balance < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const items = [
    {
      label: 'رأس المال الأساسي',
      value: breakdown?.initialCapital || 0,
      icon: DollarSign,
      color: 'text-blue-600'
    },
    {
      label: 'الحقن الرأسمالية',
      value: breakdown?.capitalInjections || 0,
      icon: Plus,
      color: 'text-green-600'
    },
    {
      label: 'السحوبات الرأسمالية',
      value: -(breakdown?.capitalWithdrawals || 0),
      icon: Minus,
      color: 'text-red-600'
    },
    {
      label: 'الأرباح المحققة',
      value: breakdown?.realizedProfits || 0,
      icon: TrendingUp,
      color: 'text-emerald-600'
    },
    {
      label: 'المصاريف العامة',
      value: -(breakdown?.totalExpenses || 0),
      icon: Receipt,
      color: 'text-orange-600'
    },
    {
      label: 'المشتريات المدفوعة',
      value: -(breakdown?.totalPurchases || 0),
      icon: ShoppingCart,
      color: 'text-purple-600'
    }
  ];

  return (
    <>
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">القاصة الرئيسية</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${getBalanceColor(mainCashBalance)}`}>
            {formatCurrency(mainCashBalance)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            الرصيد الإجمالي للشركة
          </p>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-3 w-full"
            onClick={() => setShowDetails(true)}
          >
            عرض التفاصيل
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              تفاصيل القاصة الرئيسية
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {items.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-4 w-4 ${item.color}`} />
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                  <Badge variant={item.value >= 0 ? "default" : "destructive"} className="font-mono">
                    {formatCurrency(Math.abs(item.value))}
                  </Badge>
                </motion.div>
              );
            })}
            
            <div className="border-t pt-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10">
                <div className="flex items-center gap-3">
                  <Wallet className="h-5 w-5 text-primary" />
                  <span className="font-semibold">الرصيد النهائي</span>
                </div>
                <Badge 
                  variant={mainCashBalance >= 0 ? "default" : "destructive"}
                  className="text-lg font-bold font-mono"
                >
                  {formatCurrency(mainCashBalance)}
                </Badge>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MainCashCard;