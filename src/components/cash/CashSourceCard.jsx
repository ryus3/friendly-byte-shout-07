import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wallet, CreditCard, Smartphone, Plus, Minus, MoreHorizontal, TrendingUp, TrendingDown, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const CashSourceCard = ({ 
  cashSource, 
  movements = [], 
  onAddCash, 
  onWithdrawCash, 
  onViewDetails,
  onDelete,
  realBalance, // للقاصة الرئيسية
  className 
}) => {
  const getSourceIcon = (type) => {
    switch (type) {
      case 'bank': return CreditCard;
      case 'digital_wallet': return Smartphone;
      default: return Wallet;
    }
  };

  const getSourceColor = (type) => {
    switch (type) {
      case 'bank': return 'from-blue-500 to-blue-600';
      case 'digital_wallet': return 'from-purple-500 to-purple-600';
      default: return 'from-green-500 to-green-600';
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'bank': return 'بنك';
      case 'digital_wallet': return 'محفظة إلكترونية';
      default: return 'نقد';
    }
  };

  const SourceIcon = getSourceIcon(cashSource.type);
  const recentMovements = movements.slice(0, 3);
  
  // حساب إحصائيات سريعة
  const todayMovements = movements.filter(m => {
    const today = new Date().toDateString();
    const movementDate = new Date(m.created_at).toDateString();
    return today === movementDate;
  });
  
  const todayIn = todayMovements
    .filter(m => m.movement_type === 'in')
    .reduce((sum, m) => sum + (m.amount || 0), 0);
    
  const todayOut = todayMovements
    .filter(m => m.movement_type === 'out')
    .reduce((sum, m) => sum + (m.amount || 0), 0);

  return (
    <Card className={cn("overflow-hidden hover:shadow-lg transition-all duration-200", className)}>
      <CardHeader className={`bg-gradient-to-r ${getSourceColor(cashSource.type)} text-white pb-2`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <SourceIcon className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-white">
                {cashSource.name}
              </CardTitle>
              <Badge variant="secondary" className="bg-white/20 text-white border-0 mt-1">
                {getTypeLabel(cashSource.type)}
              </Badge>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-white hover:bg-white/20"
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onViewDetails?.(cashSource)}>
                عرض التفاصيل
              </DropdownMenuItem>
              {cashSource.name !== 'القاصة الرئيسية' && (
                <DropdownMenuItem 
                  onClick={() => onDelete?.(cashSource)}
                  className="text-red-600"
                >
                  <Trash2 className="w-4 h-4 ml-2" />
                  حذف المصدر
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {/* الرصيد الحالي */}
        <div className="text-center mb-4">
          <p className="text-sm text-muted-foreground mb-1">الرصيد الحالي</p>
          <p className="text-2xl font-bold text-primary">
            {cashSource.name === 'القاصة الرئيسية' && realBalance !== undefined 
              ? realBalance.toLocaleString() 
              : (cashSource.current_balance || 0).toLocaleString()
            } د.ع
          </p>
          {cashSource.name === 'القاصة الرئيسية' && (
            <p className="text-xs text-muted-foreground mt-1">
              رأس المال + صافي الأرباح
            </p>
          )}
        </div>

        {/* إحصائيات اليوم */}
        {(todayIn > 0 || todayOut > 0) && (
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="text-center p-2 bg-green-50 rounded-lg">
              <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
                <TrendingUp className="w-3 h-3" />
                <span className="text-xs font-medium">داخل اليوم</span>
              </div>
              <p className="text-sm font-semibold text-green-700">
                {todayIn.toLocaleString()} د.ع
              </p>
            </div>
            <div className="text-center p-2 bg-red-50 rounded-lg">
              <div className="flex items-center justify-center gap-1 text-red-600 mb-1">
                <TrendingDown className="w-3 h-3" />
                <span className="text-xs font-medium">خارج اليوم</span>
              </div>
              <p className="text-sm font-semibold text-red-700">
                {todayOut.toLocaleString()} د.ع
              </p>
            </div>
          </div>
        )}

        {/* الحركات الأخيرة */}
        {recentMovements.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-medium text-muted-foreground mb-2">آخر الحركات</p>
            <div className="space-y-1">
              {recentMovements.map((movement) => (
                <div key={movement.id} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground truncate max-w-[120px]">
                    {movement.description}
                  </span>
                  <span className={cn(
                    "font-semibold",
                    movement.movement_type === 'in' ? 'text-green-600' : 'text-red-600'
                  )}>
                    {movement.movement_type === 'in' ? '+' : '-'}
                    {(movement.amount || 0).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* أزرار العمليات */}
        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            className="flex-1 text-green-600 border-green-200 hover:bg-green-50"
            onClick={() => onAddCash?.(cashSource)}
          >
            <Plus className="w-4 h-4 ml-1" />
            إضافة
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
            onClick={() => onWithdrawCash?.(cashSource)}
          >
            <Minus className="w-4 h-4 ml-1" />
            سحب
          </Button>
        </div>

        {/* وصف المصدر */}
        {cashSource.description && (
          <p className="text-xs text-muted-foreground mt-3 text-center">
            {cashSource.description}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default CashSourceCard;