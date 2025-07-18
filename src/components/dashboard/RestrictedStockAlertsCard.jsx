import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TriangleAlert, Shield, User } from 'lucide-react';
import usePermissionBasedData from '@/hooks/usePermissionBasedData';
import StockAlertsCard from './StockAlertsCard';

const RestrictedStockAlertsCard = () => {
  const { canViewAllData, isAdmin } = usePermissionBasedData();

  // فقط المديرون يمكنهم عرض تنبيهات المخزون
  if (!canViewAllData) {
    return (
      <Card className="w-full border-border/40 shadow-sm bg-card/50 backdrop-blur-sm opacity-50">
        <CardHeader className="pb-4 border-b border-border/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TriangleAlert className="w-5 h-5 text-gray-400" />
              <CardTitle className="text-lg font-semibold text-muted-foreground">تنبيهات المخزون</CardTitle>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">هذه البيانات مخصصة للمديرين فقط</p>
        </CardHeader>
        <CardContent className="p-4">
          <div className="text-center py-8">
            <Shield className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p className="text-sm text-muted-foreground mb-2">
              تنبيهات المخزون مخصصة للمديرين
            </p>
            <Badge variant="outline">
              <User className="w-3 h-3 ml-1" />
              صلاحية محدودة
            </Badge>
          </div>
        </CardContent>
      </Card>
    );
  }

  // إذا كان مدير، عرض كارد التنبيهات الكامل
  return <StockAlertsCard />;
};

export default RestrictedStockAlertsCard;