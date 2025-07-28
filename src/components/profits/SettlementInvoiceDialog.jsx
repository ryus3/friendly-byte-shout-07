import React, { useState } from 'react';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { FileText, Eye } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useInventory } from '@/contexts/InventoryContext';
import OrderDetailsDialog from '@/components/orders/OrderDetailsDialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const SettlementInvoiceDialog = ({ invoice, open, onOpenChange, allUsers }) => {
    const { orders } = useInventory();
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    if (!invoice?.data) return null;

    const invoiceData = invoice.data;
    const employeeName = allUsers.find(u => u.id === invoiceData.employee_id)?.full_name || 'موظف';
    const generatorName = allUsers.find(u => u.id === invoiceData.generated_by)?.full_name || 'المدير';
    
    // البحث عن الطلبات التي تم دفع مستحقاتها
    const settledOrdersDetails = (invoiceData.order_ids || []).map(orderId => {
        return orders.find(o => o.id === orderId);
    }).filter(Boolean);

    // تنسيق التاريخ والوقت
    const formatDateTime = (dateString) => {
        if (!dateString) return 'غير محدد';
        try {
            const date = parseISO(dateString);
            return format(date, 'dd/MM/yyyy HH:mm', { locale: ar });
        } catch (error) {
            return 'تاريخ غير صحيح';
        }
    };

    const handleViewOrder = (order) => {
        setSelectedOrder(order);
        setIsDetailsOpen(true);
    };

    return (
        <>
            <AlertDialog open={open} onOpenChange={onOpenChange}>
                <AlertDialogContent className="max-w-4xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <FileText /> فاتورة تسوية {invoiceData.invoice_number}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            <div className="space-y-2">
                                <p>اسم الموظف: <strong>{employeeName}</strong></p>
                                <p>تاريخ التسوية: <strong>{formatDateTime(invoiceData.generated_at)}</strong></p>
                                <p>تم الإنشاء بواسطة: <strong>{generatorName}</strong></p>
                                <p>طريقة الدفع: <strong>{invoiceData.payment_method === 'cash' ? 'نقداً' : invoiceData.payment_method}</strong></p>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="my-4">
                        <p className="text-2xl font-bold text-primary text-center">
                            إجمالي المبلغ: {(invoiceData.total_amount || 0).toLocaleString()} د.ع
                        </p>
                    </div>
                    <h4 className="font-semibold mb-2">الطلبات المسددة ({settledOrdersDetails.length}):</h4>
                    <ScrollArea className="h-[45vh] pr-4">
                        <Accordion type="single" collapsible className="w-full">
                            {settledOrdersDetails.map((order) => (
                                <AccordionItem value={`order-${order.id}`} key={order.id}>
                                    <AccordionTrigger>
                                        <div className="flex justify-between w-full pr-4 items-center">
                                            <div className="flex flex-col items-start">
                                                <span>طلب #{order.order_number || order.trackingnumber} - {order.customer_name || order.customerinfo?.name}</span>
                                                <span className="text-sm text-muted-foreground">
                                                    {formatDateTime(order.created_at)} - {(order.final_amount || order.total_amount || 0).toLocaleString()} د.ع
                                                </span>
                                            </div>
                                            <Button variant="ghost" size="icon" className="mr-2" onClick={(e) => { e.stopPropagation(); handleViewOrder(order); }}>
                                                <Eye className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="px-4 py-2 bg-muted/50 rounded-md">
                                            <div className="grid grid-cols-2 gap-4 mb-4">
                                                <div>
                                                    <p className="font-medium">عنوان العميل:</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {order.customer_address || order.customerinfo?.address || 'غير محدد'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="font-medium">رقم الهاتف:</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {order.customer_phone || order.customerinfo?.phone || 'غير محدد'}
                                                    </p>
                                                </div>
                                            </div>
                                            <p className="font-semibold mb-2">المنتجات:</p>
                                            <ul className="list-disc pl-5 space-y-1 text-sm">
                                                {(order.items || []).map((item, index) => (
                                                    <li key={item.sku || index}>
                                                        {item.productName || item.product_name} 
                                                        {item.color ? ` (${item.color}` : ''}
                                                        {item.size ? `, ${item.size})` : item.color ? ')' : ''} 
                                                        - الكمية: {item.quantity} 
                                                        - السعر: {(item.total || item.total_price || 0).toLocaleString()} د.ع
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </ScrollArea>
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