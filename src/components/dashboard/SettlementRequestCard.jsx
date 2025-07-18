import React from 'react';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Coins as HandCoins } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/UnifiedAuthContext';

const SettlementRequestCard = ({ pendingProfit, onSettle }) => {
  const { user } = useAuth();
  
  // إضافة تسجيل للتشخيص
  console.log('🔍 SettlementRequestCard Debug:', {
    user: user?.full_name,
    role: user?.role,
    roles: user?.roles,
    pendingProfit,
    shouldShow: !(user?.role === 'super_admin' || user?.role === 'manager' || user?.roles?.includes('super_admin') || user?.roles?.includes('manager'))
  });
  
  // إخفاء الكارد للمديرين والسوبر أدمن - تحقق من الدور وقائمة الأدوار
  if (user?.role === 'super_admin' || 
      user?.role === 'manager' || 
      user?.roles?.includes('super_admin') || 
      user?.roles?.includes('manager')) {
    console.log('❌ إخفاء طلب المحاسبة للمدير');
    return null;
  }
  
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