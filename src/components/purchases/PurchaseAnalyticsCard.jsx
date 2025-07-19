import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Package, DollarSign, Calendar } from 'lucide-react';

const PurchaseAnalyticsCard = ({ purchases = [] }) => {
  // تحليل البيانات
  const thisMonth = new Date().getMonth();
  const thisYear = new Date().getFullYear();
  
  const monthlyPurchases = purchases.filter(p => {
    const purchaseDate = new Date(p.created_at);
    return purchaseDate.getMonth() === thisMonth && purchaseDate.getFullYear() === thisYear;
  });
  
  const totalAmount = purchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);
  const monthlyAmount = monthlyPurchases.reduce((sum, p) => sum + (p.total_amount || 0), 0);
  
  const topSuppliers = purchases.reduce((acc, purchase) => {
    const supplier = purchase.supplier_name || 'غير محدد';
    acc[supplier] = (acc[supplier] || 0) + (purchase.total_amount || 0);
    return acc;
  }, {});
  
  const sortedSuppliers = Object.entries(topSuppliers)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3);

  const averageOrderValue = purchases.length > 0 ? totalAmount / purchases.length : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">إجمالي المشتريات</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{purchases.length}</div>
          <p className="text-xs text-muted-foreground">
            {monthlyPurchases.length} هذا الشهر
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">إجمالي القيمة</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalAmount.toLocaleString()} د.ع</div>
          <p className="text-xs text-muted-foreground">
            {monthlyAmount.toLocaleString()} د.ع هذا الشهر
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">متوسط قيمة الفاتورة</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{averageOrderValue.toLocaleString()} د.ع</div>
          <p className="text-xs text-muted-foreground">
            معدل الإنفاق
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">أهم الموردين</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {sortedSuppliers.length > 0 ? sortedSuppliers.map(([supplier, amount], index) => (
              <div key={supplier} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground truncate">{supplier}</span>
                <Badge variant={index === 0 ? "default" : "secondary"} className="text-xs">
                  {amount.toLocaleString()}
                </Badge>
              </div>
            )) : (
              <p className="text-xs text-muted-foreground">لا توجد بيانات</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PurchaseAnalyticsCard;