import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Filter, 
  Search, 
  Calendar,
  ShoppingCart,
  Package,
  DollarSign,
  Minus,
  Plus,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const CashMovementsList = ({ movements = [], cashSources = [] }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, in, out
  const [filterSource, setFilterSource] = useState('all');
  const [filterReference, setFilterReference] = useState('all');

  // تصفية الحركات
  const filteredMovements = movements.filter(movement => {
    const matchesSearch = movement.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || movement.movement_type === filterType;
    const matchesSource = filterSource === 'all' || movement.cash_source_id === filterSource;
    const matchesReference = filterReference === 'all' || movement.reference_type === filterReference;
    
    return matchesSearch && matchesType && matchesSource && matchesReference;
  });

  const getMovementIcon = (referenceType) => {
    switch (referenceType) {
      case 'purchase': return Package;
      case 'order': return ShoppingCart;
      case 'expense': return FileText;
      case 'capital_injection': return Plus;
      case 'withdrawal': return Minus;
      default: return DollarSign;
    }
  };

  const getMovementTypeLabel = (referenceType) => {
    const labels = {
      'purchase': 'شراء بضاعة',
      'purchase_refund': 'استرداد مشتريات',
      'order': 'بيع طلب',
      'order_payment': 'تحصيل طلب',
      'expense': 'مصروف',
      'capital_injection': 'إضافة رأس مال',
      'capital_withdrawal': 'سحب رأس مال',
      'withdrawal': 'سحب أموال',
      'deposit': 'إيداع أموال',
      'profit_settlement': 'تحاسب أرباح',
      'employee_dues': 'مستحقات موظفين',
      'salary': 'راتب موظف',
      'transfer': 'تحويل بين القصص',
      'adjustment': 'تعديل رصيد',
      'inventory_purchase': 'شراء مخزون',
      'revenue': 'إيراد مبيعات'
    };
    return labels[referenceType] || 'حركة مالية';
  };

  const getMovementColor = (movementType) => {
    return movementType === 'in' 
      ? 'text-green-600 bg-green-50 border-green-200' 
      : 'text-red-600 bg-red-50 border-red-200';
  };

  const referenceTypes = [...new Set(movements.map(m => m.reference_type))];

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <ArrowUpCircle className="w-5 h-5 text-primary" />
            حركات النقد
          </CardTitle>
          
          {/* فلاتر البحث */}
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="بحث في الوصف..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full sm:w-48"
              />
            </div>
            
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue placeholder="النوع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأنواع</SelectItem>
                <SelectItem value="in">داخل</SelectItem>
                <SelectItem value="out">خارج</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterSource} onValueChange={setFilterSource}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="المصدر" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المصادر</SelectItem>
                {cashSources.map(source => (
                  <SelectItem key={source.id} value={source.id}>
                    {source.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterReference} onValueChange={setFilterReference}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="التصنيف" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل التصنيفات</SelectItem>
                {referenceTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {getMovementTypeLabel(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {filteredMovements.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>لا توجد حركات مالية</p>
          </div>
        ) : (
           <div className="divide-y">
            {filteredMovements.map((movement) => {
              const MovementIcon = getMovementIcon(movement.reference_type);
              const cashSource = cashSources.find(s => s.id === movement.cash_source_id);
              
              return (
                <div key={movement.id} className="p-3 sm:p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start sm:items-center gap-3">
                    {/* أيقونة نوع الحركة */}
                    <div className={cn(
                      "flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full border flex-shrink-0",
                      getMovementColor(movement.movement_type)
                    )}>
                      {movement.movement_type === 'in' ? (
                        <ArrowUpCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                      ) : (
                        <ArrowDownCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                      )}
                    </div>

                    {/* تفاصيل الحركة */}
                    <div className="flex-1 min-w-0">
                      {/* الوصف والمبلغ في خط واحد للهاتف */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-start gap-1 min-w-0 flex-1">
                          <MovementIcon className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <p className="font-medium text-xs sm:text-sm leading-tight">
                            {movement.description}
                          </p>
                        </div>
                        
                        {/* المبلغ */}
                        <div className="text-right flex-shrink-0">
                          <p className={cn(
                            "font-bold text-sm sm:text-lg leading-tight",
                            movement.movement_type === 'in' ? 'text-green-600' : 'text-red-600'
                          )}>
                            {movement.movement_type === 'in' ? '+' : '-'}
                            {(movement.amount || 0).toLocaleString()} د.ع
                          </p>
                        </div>
                      </div>
                      
                      {/* التفاصيل الإضافية */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>
                            {format(new Date(movement.created_at), 'dd/MM/yyyy HH:mm', { locale: ar })}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2 flex-wrap">
                          {cashSource && (
                            <div className="flex items-center gap-1">
                              <span className="hidden sm:inline">•</span>
                              <span className="truncate">{cashSource.name}</span>
                            </div>
                          )}
                          
                          <Badge variant="outline" className="text-xs py-0 px-1">
                            {getMovementTypeLabel(movement.reference_type)}
                          </Badge>
                          
                          <span className="text-xs text-muted-foreground ml-auto sm:ml-0">
                            الرصيد: {(movement.balance_after || 0).toLocaleString()} د.ع
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CashMovementsList;