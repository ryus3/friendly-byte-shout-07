import React from 'react';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Coins as HandCoins } from 'lucide-react';
import { motion } from 'framer-motion';

const SettlementRequestCard = ({ pendingProfit, onSettle }) => {
  if (pendingProfit <= 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg text-primary">لديك مستحقات معلقة!</CardTitle>
            <p className="text-muted-foreground">مبلغ {pendingProfit.toLocaleString()} د.ع جاهز للمحاسبة.</p>
          </div>
          <Button onClick={onSettle}>
            <HandCoins className="w-4 h-4 ml-2" />
            طلب محاسبة
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default SettlementRequestCard;