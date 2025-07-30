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

    if (!invoice) return null;

    const settledBy = allUsers.find(u => u.id === invoice.settled_by_id);
    const settledOrdersDetails = (invoice.settled_orders || []).map(orderId => {
        return orders.find(o => o.id === orderId);
    }).filter(Boolean);

    const handleViewOrder = (order) => {
        setSelectedOrder(order);
        setIsDetailsOpen(true);
    };

    return (
        <>
            <AlertDialog open={open} onOpenChange={onOpenChange}>
                <AlertDialogContent className="max-w-4xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2"><FileText /> فاتورة تسوية #{invoice.invoice_number}</AlertDialogTitle>
                        <AlertDialogDescription>
                            تمت التسوية بتاريخ {format(parseISO(invoice.settlement_date), 'd MMMM yyyy', { locale: ar })} بواسطة {settledBy?.full_name || 'المدير'}.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="my-4">
                        <p className="text-2xl font-bold text-primary text-center">المبلغ الإجمالي: {invoice.total_amount.toLocaleString()} د.ع</p>
                    </div>
                    <h4 className="font-semibold mb-2">الطلبات المسددة ({settledOrdersDetails.length}):</h4>
                    <ScrollArea className="h-[45vh] pr-4">
                        <Accordion type="single" collapsible className="w-full">
                            {settledOrdersDetails.map((order) => (
                                <AccordionItem value={`order-${order.id}`} key={order.id}>
                                    <AccordionTrigger>
                                        <div className="flex justify-between w-full pr-4 items-center">
                                            <span>طلب #{order.trackingnumber} - {order.customerinfo.name}</span>
                                            <Button variant="ghost" size="icon" className="mr-2" onClick={(e) => { e.stopPropagation(); handleViewOrder(order); }}>
                                                <Eye className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="px-4 py-2 bg-muted/50 rounded-md">
                                            <p className="font-semibold mb-2">المنتجات:</p>
                                            <ul className="list-disc pl-5 space-y-1 text-sm">
                                                {(order.items || []).map(item => (
                                                    <li key={item.sku}>
                                                        {item.productName} ({item.color}, {item.size}) - الكمية: {item.quantity} - السعر: {item.total.toLocaleString()} د.ع
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