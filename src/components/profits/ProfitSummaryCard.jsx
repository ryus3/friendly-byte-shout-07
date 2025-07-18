import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, TrendingUp, Users, Wallet } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useInventory } from '@/contexts/InventoryContext';

const ProfitSummaryCard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { orders, calculateProfit } = useInventory();

  const profitSummary = useMemo(() => {
    if (!orders || !user) return { myProfit: 0, totalPendingProfit: 0, settledProfit: 0 };

    const myOrders = orders.filter(order => 
      order.created_by === user.id && order.status === 'delivered'
    );

    const myProfit = myOrders.reduce((sum, order) => {
      const profit = calculateProfit ? calculateProfit(order) : 0;
      return sum + (profit.employeeProfit || 0);
    }, 0);

    const pendingOrders = myOrders.filter(order => 
      !order.invoice_received && (order.profitStatus || 'pending') === 'pending'
    );
    
    const totalPendingProfit = pendingOrders.reduce((sum, order) => {
      const profit = calculateProfit ? calculateProfit(order) : 0;
      return sum + (profit.employeeProfit || 0);
    }, 0);

    const settledProfit = myProfit - totalPendingProfit;

    return { myProfit, totalPendingProfit, settledProfit };
  }, [orders, user, calculateProfit]);

  const formatCurrency = (amount) => {
    return `${amount.toLocaleString()} د.ع`;
  };

  const handleViewDetails = () => {
    navigate('/profits-summary');
  };

  const profitItems = [
    {
      title: 'إجمالي الأرباح',
      value: profitSummary.myProfit,
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'أرباح معلقة',
      value: profitSummary.totalPendingProfit,
      icon: Wallet,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
    {
      title: 'أرباح محققة',
      value: profitSummary.settledProfit,
      icon: TrendingUp,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    }
  ];

  return (
    <Card className="glass-effect h-full border-border/60 overflow-hidden">
      <CardHeader className="bg-gradient-to-l from-primary/5 to-accent/5 border-b border-border/50">
        <CardTitle className="flex items-center gap-3 text-xl text-foreground">
          <div className="p-2 rounded-lg bg-primary/10">
            <DollarSign className="w-6 h-6 text-primary" />
          </div>
          ملخص الأرباح
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="space-y-4">
          {profitItems.map((item, index) => (
            <motion.div
              key={item.title}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/20 hover:bg-muted/30 transition-all duration-200"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${item.bgColor}`}>
                  <item.icon className={`w-4 h-4 ${item.color}`} />
                </div>
                <span className="text-sm font-medium text-foreground">{item.title}</span>
              </div>
              <span className={`text-sm font-bold ${item.color}`}>
                {formatCurrency(item.value)}
              </span>
            </motion.div>
          ))}
          
          <div className="pt-2 border-t border-border/50">
            <Button 
              variant="outline" 
              className="w-full text-primary border-primary/20 hover:bg-primary/10 hover:border-primary/40 transition-all" 
              onClick={handleViewDetails}
            >
              <TrendingUp className="w-4 h-4 ml-2" />
              عرض التفاصيل الكاملة
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfitSummaryCard;