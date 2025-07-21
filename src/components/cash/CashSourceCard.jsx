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

  const getSourceColor = (name, type) => {
    // ألوان مخصصة لكل مصدر
    if (name === 'القاصة الرئيسية') return 'from-indigo-600 to-purple-600';
    if (name === 'قاصة المنزل') return 'from-emerald-600 to-teal-600';
    
    switch (type) {
      case 'bank': return 'from-blue-600 to-cyan-600';
      case 'digital_wallet': return 'from-violet-600 to-purple-600';
      default: return 'from-amber-600 to-orange-600';
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
    <Card className={cn(
      "overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-primary/20 hover:scale-[1.02] border-0",
      "bg-gradient-to-br from-card to-card/50 backdrop-blur-sm shadow-lg shadow-primary/5",
      "before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/5 before:to-transparent before:pointer-events-none before:rounded-lg",
      className
    )}>
      <CardHeader className={cn(
        `bg-gradient-to-br ${getSourceColor(cashSource.name, cashSource.type)} text-white pb-3 relative`,
        "before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/10 before:to-transparent before:pointer-events-none"
      )}>
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

      <CardContent className="p-6">
        {/* الرصيد الحالي */}
        <div className="text-center mb-6">
          <p className="text-sm text-muted-foreground mb-2">الرصيد الحالي</p>
          <p className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            {(realBalance !== undefined ? realBalance : cashSource.current_balance || 0).toLocaleString()} د.ع
          </p>
          {cashSource.name === 'القاصة الرئيسية' && (
            <p className="text-xs text-muted-foreground mt-2 px-3 py-1 bg-muted/50 rounded-full inline-block">
              رأس المال + صافي الأرباح
            </p>
          )}
          {cashSource.name !== 'القاصة الرئيسية' && (
            <p className="text-xs text-muted-foreground mt-2 px-3 py-1 bg-muted/50 rounded-full inline-block">
              رصيد فعلي متاح
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
        <div className="flex gap-3">
          <Button 
            size="sm" 
            variant="outline" 
            className={cn(
              "flex-1 group relative overflow-hidden border-2 transition-all duration-300",
              "border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300",
              "hover:shadow-lg hover:shadow-emerald-200/50 hover:scale-105"
            )}
            onClick={() => onAddCash?.(cashSource)}
          >
            <Plus className="w-4 h-4 ml-1 transition-transform group-hover:scale-110" />
            <span className="transition-all duration-300 group-hover:text-emerald-800">
              إضافة
            </span>
            <span className="absolute inset-0 flex items-center justify-center text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-emerald-50/80 backdrop-blur-sm">
              إضافة أموال
            </span>
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className={cn(
              "flex-1 group relative overflow-hidden border-2 transition-all duration-300",
              "border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300",
              "hover:shadow-lg hover:shadow-red-200/50 hover:scale-105"
            )}
            onClick={() => onWithdrawCash?.(cashSource)}
          >
            <Minus className="w-4 h-4 ml-1 transition-transform group-hover:scale-110" />
            <span className="transition-all duration-300 group-hover:text-red-800">
              سحب
            </span>
            <span className="absolute inset-0 flex items-center justify-center text-red-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-red-50/80 backdrop-blur-sm">
              سحب أموال
            </span>
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