// كارت ونافذة أرباحي من الموظفين - النظام الصحيح المعتمد
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Crown, Eye, Users, TrendingUp } from 'lucide-react';
import { ManagerProfitsDialog } from '@/components/profits/ManagerProfitsDialog';
import { useManagerProfitsFromEmployees } from '@/hooks/useManagerProfitsFromEmployees';

const ManagerProfitsCard = ({ 
  orders = [], 
  employees = [], 
  profits = [],
  title = "أرباحي من الموظفين",
  showDetailedButton = true,
  cardSize = "default" // "small", "default", "large"
}) => {
  const [showDialog, setShowDialog] = useState(false);
  
  // استخدام Hook المشترك
  const { stats } = useManagerProfitsFromEmployees(
    orders,
    employees, 
    profits,
    'month' // افتراضي شهر
  );

  const formatCurrency = (amount) => {
    return `${(Number(amount) || 0).toLocaleString()} د.ع`;
  };

  // تحديد حجم الكارت
  const getCardClasses = () => {
    switch (cardSize) {
      case 'small':
        return 'h-24';
      case 'large':
        return 'h-40';
      default:
        return 'h-32';
    }
  };

  const getContentClasses = () => {
    switch (cardSize) {
      case 'small':
        return 'p-3';
      case 'large':
        return 'p-6';
      default:
        return 'p-4';
    }
  };

  const getTitleSize = () => {
    switch (cardSize) {
      case 'small':
        return 'text-sm';
      case 'large':
        return 'text-lg';
      default:
        return 'text-base';
    }
  };

  const getValueSize = () => {
    switch (cardSize) {
      case 'small':
        return 'text-lg';
      case 'large':
        return 'text-3xl';
      default:
        return 'text-2xl';
    }
  };

  return (
    <>
      <Card className={`cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl relative overflow-hidden border-border/30 ${getCardClasses()}`}>
        <CardContent className={`${getContentClasses()} h-full`}>
          <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-lg p-4 relative overflow-hidden h-full flex flex-col justify-between">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="p-2 bg-white/20 rounded-full backdrop-blur-sm">
                <Crown className="w-5 h-5" />
              </div>
              <p className={`${getTitleSize()} font-medium text-white/90`}>{title}</p>
            </div>
            
            {/* القيمة الرئيسية */}
            <div className="text-center">
              <p className={`${getValueSize()} font-bold text-white leading-tight`}>
                {formatCurrency(stats.totalManagerProfit || 0)}
              </p>
              {cardSize !== 'small' && (
                <p className="text-xs text-white/80 mt-1">
                  من {stats.totalOrders || 0} طلب
                </p>
              )}
            </div>
            
            {/* Footer - إحصائيات إضافية أو زر */}
            {cardSize === 'large' && (
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/20">
                <div className="text-center">
                  <p className="text-xs text-white/80">أرباح معلقة</p>
                  <p className="text-sm font-bold text-white">{formatCurrency(stats.pendingProfit || 0)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-white/80">هامش الربح</p>
                  <p className="text-sm font-bold text-white">{stats.profitMargin || '0.0'}%</p>
                </div>
              </div>
            )}
            
            {/* زر التفاصيل */}
            {showDetailedButton && cardSize !== 'small' && (
              <div className="mt-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="w-full bg-white/20 hover:bg-white/30 border-white/30 hover:border-white/50 text-white text-xs transition-all"
                  onClick={() => setShowDialog(true)}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  التفاصيل
                </Button>
              </div>
            )}
            
            {/* زر التفاصيل للكارت الصغير */}
            {showDetailedButton && cardSize === 'small' && (
              <Button 
                variant="ghost" 
                size="sm"
                className="absolute top-2 left-2 h-6 w-6 p-0 bg-white/20 hover:bg-white/30 border-white/30 text-white"
                onClick={() => setShowDialog(true)}
              >
                <Eye className="h-3 w-3" />
              </Button>
            )}
            
            {/* Badge للحالة */}
            {cardSize !== 'small' && (
              <div className="absolute top-2 left-2">
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30 text-xs">
                  نشط
                </Badge>
              </div>
            )}
            
            {/* تأثيرات الخلفية */}
            <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-white/10 rounded-full"></div>
            <div className="absolute -top-1 -left-1 w-6 h-6 bg-white/10 rounded-full"></div>
          </div>
        </CardContent>
      </Card>

      {/* النافذة المنبثقة */}
      {showDialog && (
        <ManagerProfitsDialog
          isOpen={showDialog}
          onClose={() => setShowDialog(false)}
          orders={orders}
          employees={employees}
          profits={profits}
        />
      )}
    </>
  );
};

export default ManagerProfitsCard;