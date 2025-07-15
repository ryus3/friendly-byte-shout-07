import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Archive, Package, User, Hash, Calendar, Phone, MapPin, Users } from 'lucide-react';
import { formatDistanceToNow, isValid, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ReservedStockDialog = ({ open, onOpenChange, reservedOrders, allUsers }) => {
  const [selectedEmployee, setSelectedEmployee] = useState('all');

  const employeesInvolved = useMemo(() => {
    if (!reservedOrders || !allUsers) return [];
    const employeeIds = [...new Set(reservedOrders.map(o => o.created_by))];
    return allUsers.filter(u => employeeIds.includes(u.id));
  }, [reservedOrders, allUsers]);

  const filteredDisplayOrders = useMemo(() => {
    if (!reservedOrders) return [];
    if (selectedEmployee === 'all') {
      return reservedOrders;
    }
    return reservedOrders.filter(o => o.created_by === selectedEmployee);
  }, [reservedOrders, selectedEmployee]);

  const formatDate = (dateString) => {
    if (!dateString) return 'لا يوجد تاريخ';
    const date = parseISO(dateString);
    if (!isValid(date)) return 'تاريخ غير صالح';
    return formatDistanceToNow(date, { addSuffix: true, locale: ar });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Archive />
            الطلبات قيد التجهيز
          </DialogTitle>
          <DialogDescription>
            قائمة بالطلبات التي حجزت كميات من المخزون وهي بانتظار المعالجة.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-muted-foreground" />
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="فلترة حسب الموظف" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الموظفين</SelectItem>
                {employeesInvolved.map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
        </div>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 py-4">
            {filteredDisplayOrders && filteredDisplayOrders.length > 0 ? (
              filteredDisplayOrders.map((order) => (
                <div key={order.id} className="bg-card border rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-lg text-primary flex items-center gap-2">
                        <Hash className="w-4 h-4" /> {order.trackingnumber || 'لا يوجد رقم تتبع'}
                      </h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(order.created_at)}
                      </p>
                    </div>
                    <Badge variant='secondary'>
                      قيد التجهيز
                    </Badge>
                  </div>
                  <div className="border-t pt-3">
                    <p className="font-semibold text-base mb-2">معلومات الزبون:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <p className="flex items-center gap-2"><User className="w-4 h-4 text-muted-foreground"/> {order.customerinfo?.name || 'غير معروف'}</p>
                      <p className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground"/> {order.customerinfo?.phone || 'غير معروف'}</p>
                      <p className="col-span-2 flex items-center gap-2"><MapPin className="w-4 h-4 text-muted-foreground"/> {`${order.customerinfo?.address || ''}, ${order.customerinfo?.city || ''}, ${order.customerinfo?.province || ''}`}</p>
                    </div>
                     <p className="text-sm text-muted-foreground mt-2">الموظف المسؤول: {order.employeeName}</p>
                  </div>
                  <div className="border-t pt-3">
                    <p className="font-semibold text-base mb-2">المنتجات المحجوزة:</p>
                    <div className="space-y-2">
                      {order.items && Array.isArray(order.items) ? order.items.map(item => (
                        <div key={item.id} className="flex items-center justify-between p-2 bg-secondary/50 rounded-md">
                          <div className="flex items-center gap-3">
                            <img src={item.image || '/placeholder.png'} alt={item.productName || 'منتج'} className="w-10 h-10 rounded-md object-cover"/>
                            <div>
                               <p className="font-semibold">{item.productName || 'منتج غير معروف'}</p>
                               <p className="text-xs text-muted-foreground">{item.color || 'لون'} / {item.size || 'مقاس'}</p>
                            </div>
                          </div>
                          <p className="font-bold">{item.quantity || 0}x</p>
                        </div>
                      )) : (
                        <p className="text-muted-foreground text-sm">لا توجد عناصر للطلب</p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-muted-foreground mb-2">لا توجد طلبات محجوزة</h3>
                <p className="text-muted-foreground">لا توجد حالياً أي طلبات في حالة الانتظار تطابق الفلتر.</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default ReservedStockDialog;