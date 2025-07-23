import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import Loader from '@/components/ui/loader';
import PurchasePrintButton from './PurchasePrintButton';


const PurchasesList = ({ purchases, isLoading, onViewDetails, onDelete }) => {
  if (isLoading) {
    return <div className="flex justify-center items-center h-64"><Loader /></div>;
  }

  if (purchases.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          لا توجد فواتير مشتريات لعرضها.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>رقم الفاتورة</TableHead>
            <TableHead>المورد</TableHead>
            <TableHead>تاريخ الشراء</TableHead>
            <TableHead>عدد الأصناف</TableHead>
            <TableHead>تكلفة الشحن</TableHead>
            <TableHead>تكلفة التحويل</TableHead>
            <TableHead>الإجمالي</TableHead>
            <TableHead>إجراءات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {purchases.map((purchase) => (
            <TableRow key={purchase.id}>
              <TableCell className="font-mono text-xs">{purchase.purchase_number || purchase.id}</TableCell>
              <TableCell className="font-semibold">{purchase.supplier_name || purchase.supplier || 'غير محدد'}</TableCell>
              <TableCell>{format(new Date(purchase.purchase_date || purchase.created_at), 'd MMM yyyy', { locale: ar })}</TableCell>
              <TableCell>
                <Badge variant="secondary">{purchase.items?.length || 0}</Badge>
              </TableCell>
              <TableCell className="text-orange-600 font-medium">{(purchase.shipping_cost || 0).toLocaleString()} د.ع</TableCell>
              <TableCell className="text-purple-600 font-medium">{(purchase.transfer_cost || 0).toLocaleString()} د.ع</TableCell>
              <TableCell className="font-bold text-primary">{(purchase.total_amount || 0).toLocaleString()} د.ع</TableCell>
               <TableCell>
                 <div className="flex gap-1">
                   <Button variant="ghost" size="sm" onClick={() => onViewDetails(purchase)} className="text-blue-600 hover:text-blue-700">
                     <Eye className="w-4 h-4" />
                     <span className="sr-only">عرض التفاصيل</span>
                   </Button>
                    <PurchasePrintButton purchase={purchase} />
                    
                   <Button variant="ghost" size="sm" onClick={() => onDelete?.(purchase)} className="text-red-600 hover:text-red-700">
                     <Trash2 className="w-4 h-4" />
                     <span className="sr-only">حذف</span>
                   </Button>
                 </div>
               </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
};

export default PurchasesList;