import React, { useState, useMemo } from 'react';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { FileText, Eye, CalendarDays, User, CheckCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useInventory } from '@/contexts/InventoryContext';
import OrderDetailsDialog from '@/components/orders/OrderDetailsDialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent } from '@/components/ui/card';

const SettlementInvoiceDialog = ({ invoice, open, onOpenChange, allUsers }) => {
    const { orders } = useInventory();
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    if (!invoice) return null;

    const settledBy = allUsers.find(u => u.id === invoice.settled_by_id);
    
    // البحث عن الطلبات المسواة بطرق مختلفة حسب هيكل البيانات
    const settledOrdersDetails = useMemo(() => {
        console.log('🔍 Settlement Invoice Full Data:', invoice);
        
        // البحث في order_ids أو settled_orders
        const orderIds = invoice.order_ids || invoice.settled_orders || [];
        console.log('📋 Order IDs found:', orderIds);
        
        const foundOrders = orderIds.map(orderId => {
            const order = orders.find(o => o.id === orderId);
            console.log(`🔎 Looking for order ${orderId}:`, order);
            return order;
        }).filter(Boolean);
        
        console.log('✅ Found orders:', foundOrders);
        return foundOrders;
    }, [invoice, orders]);

    // حساب البيانات الحقيقية للفاتورة
    const invoiceStats = useMemo(() => {
        console.log('📊 Calculating stats for orders:', settledOrdersDetails);

        let totalRevenue = 0;
        let totalCost = 0;
        let totalOrders = settledOrdersDetails.length;

        settledOrdersDetails.forEach(order => {
            const orderAmount = order.final_amount || order.total_amount || 0;
            totalRevenue += orderAmount;
            console.log(`💰 Order ${order.id}: ${orderAmount} د.ع`);
            
            // حساب التكلفة من المنتجات
            if (order.items && Array.isArray(order.items)) {
                order.items.forEach(item => {
                    const itemCost = (item.costPrice || item.cost_price || 0) * (item.quantity || 0);
                    totalCost += itemCost;
                });
            }
        });

        const stats = {
            totalRevenue,
            totalCost,
            totalOrders,
            profit: totalRevenue - totalCost
        };

        console.log('📈 Final Invoice Stats:', stats);
        return stats;
    }, [settledOrdersDetails]);

    const handleViewOrder = (order) => {
        setSelectedOrder(order);
        setIsDetailsOpen(true);
    };

    return (
        <>
            <AlertDialog open={open} onOpenChange={onOpenChange}>
                 <AlertDialogContent className="max-w-6xl h-[90vh] overflow-hidden">
                     <AlertDialogHeader className="pb-4">
                         <AlertDialogTitle className="text-center text-xl font-bold text-primary">
                             فاتورة تسوية مستحقات الموظفين
                         </AlertDialogTitle>
                         <AlertDialogDescription className="text-center text-muted-foreground">
                             تفاصيل فاتورة التسوية للمستحقات المدفوعة
                         </AlertDialogDescription>
                     </AlertDialogHeader>
                     
                     {/* كروت المعلومات الأساسية في سطر واحد */}
                     <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                         <Card className="border-l-4 border-l-primary">
                             <CardContent className="p-4">
                                 <div className="flex items-center gap-2 mb-2">
                                     <FileText className="w-5 h-5 text-primary" />
                                     <span className="text-sm font-medium text-muted-foreground">رقم الفاتورة</span>
                                 </div>
                                 <p className="text-lg font-bold">#{invoice.invoice_number}</p>
                             </CardContent>
                         </Card>
                         
                         <Card className="border-l-4 border-l-blue-500">
                             <CardContent className="p-4">
                                 <div className="flex items-center gap-2 mb-2">
                                     <User className="w-5 h-5 text-blue-500" />
                                     <span className="text-sm font-medium text-muted-foreground">الموظف</span>
                                 </div>
                                 <p className="text-lg font-bold">{settledBy?.full_name || 'غير محدد'}</p>
                             </CardContent>
                         </Card>
                         
                         <Card className="border-l-4 border-l-green-500">
                             <CardContent className="p-4">
                                 <div className="flex items-center gap-2 mb-2">
                                     <CalendarDays className="w-5 h-5 text-green-500" />
                                     <span className="text-sm font-medium text-muted-foreground">تاريخ الإصدار</span>
                                 </div>
                                 <p className="text-lg font-bold">
                                     {format(parseISO(invoice.settlement_date), 'd/M/yyyy', { locale: ar })}
                                 </p>
                             </CardContent>
                         </Card>
                         
                         <Card className="border-l-4 border-l-emerald-500">
                             <CardContent className="p-4">
                                 <div className="flex items-center gap-2 mb-2">
                                     <CheckCircle className="w-5 h-5 text-emerald-500" />
                                     <span className="text-sm font-medium text-muted-foreground">حالة التسوية</span>
                                 </div>
                                 <p className="text-lg font-bold text-emerald-600">مكتملة</p>
                             </CardContent>
                         </Card>
                     </div>

                     {/* إحصائيات الفاتورة */}
                     <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                         <Card className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
                             <CardContent className="p-4 text-center">
                                 <p className="text-sm text-muted-foreground mb-1">عدد الطلبات</p>
                                 <p className="text-2xl font-bold text-blue-600">{invoiceStats.totalOrders}</p>
                             </CardContent>
                         </Card>
                         
                         <Card className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
                             <CardContent className="p-4 text-center">
                                 <p className="text-sm text-muted-foreground mb-1">إجمالي الإيرادات</p>
                                 <p className="text-2xl font-bold text-green-600">{invoiceStats.totalRevenue.toLocaleString()} د.ع</p>
                             </CardContent>
                         </Card>
                         
                         <Card className="bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900">
                             <CardContent className="p-4 text-center">
                                 <p className="text-sm text-muted-foreground mb-1">إجمالي التكلفة</p>
                                 <p className="text-2xl font-bold text-orange-600">{invoiceStats.totalCost.toLocaleString()} د.ع</p>
                             </CardContent>
                         </Card>
                         
                         <Card className="bg-gradient-to-r from-primary/10 to-primary/20">
                             <CardContent className="p-4 text-center">
                                 <p className="text-sm text-muted-foreground mb-1">المبلغ المسوى</p>
                                 <p className="text-2xl font-bold text-primary">{invoice.total_amount.toLocaleString()} د.ع</p>
                             </CardContent>
                         </Card>
                     </div>

                     {/* تفاصيل الطلبات المسواة */}
                     <div className="flex-1 overflow-hidden">
                         <h4 className="font-semibold mb-4 text-lg">الطلبات المسواة ({settledOrdersDetails.length} طلب)</h4>
                         <ScrollArea className="h-[300px] w-full border rounded-lg">
                             <Table>
                                 <TableHeader>
                                     <TableRow>
                                         <TableHead className="text-right">رقم الطلب</TableHead>
                                         <TableHead className="text-right">العميل</TableHead>
                                         <TableHead className="text-right">التاريخ</TableHead>
                                         <TableHead className="text-right">المبلغ</TableHead>
                                         <TableHead className="text-right">الحالة</TableHead>
                                         <TableHead className="text-right">إجراءات</TableHead>
                                     </TableRow>
                                 </TableHeader>
                                 <TableBody>
                                     {settledOrdersDetails.map((order) => (
                                         <TableRow key={order.id} className="hover:bg-muted/50">
                                             <TableCell className="font-medium">
                                                 #{order.order_number || order.trackingnumber}
                                             </TableCell>
                                             <TableCell>{order.customer_name}</TableCell>
                                             <TableCell>
                                                 {format(new Date(order.created_at), 'd/M/yyyy', { locale: ar })}
                                             </TableCell>
                                             <TableCell className="font-bold">
                                                 {(order.final_amount || order.total_amount || 0).toLocaleString()} د.ع
                                             </TableCell>
                                             <TableCell>
                                                 <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                                                     مكتمل
                                                 </span>
                                             </TableCell>
                                             <TableCell>
                                                 <Button 
                                                     variant="ghost" 
                                                     size="sm" 
                                                     onClick={() => handleViewOrder(order)}
                                                     className="h-8 w-8 p-0"
                                                 >
                                                     <Eye className="w-4 h-4" />
                                                 </Button>
                                             </TableCell>
                                         </TableRow>
                                     ))}
                                 </TableBody>
                             </Table>
                         </ScrollArea>
                     </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel>إغلاق</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            {selectedOrder && (
                <OrderDetailsDialog 
                    order={selectedOrder} 
                    open={isDetailsOpen} 
                    onOpenChange={setIsDetailsOpen}
                    canEditStatus={false}
                />
            )}
        </>
    );
};

export default SettlementInvoiceDialog;