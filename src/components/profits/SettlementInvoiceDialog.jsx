import React, { useState } from 'react';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { FileText, Eye, DollarSign, Receipt } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useInventory } from '@/contexts/InventoryContext';
import OrderDetailsDialog from '@/components/orders/OrderDetailsDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

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
                <AlertDialogContent className="max-w-4xl max-h-[95vh] overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900/30 to-slate-800 border-0">
                    <AlertDialogHeader className="text-center border-b border-slate-700/50 pb-6">
                        <div className="flex items-center justify-center gap-3 mb-3">
                            <div className="p-3 bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full text-white shadow-lg">
                                <FileText className="w-8 h-8" />
                            </div>
                        </div>
                        <AlertDialogTitle className="text-3xl font-bold text-white mb-2">
                            فاتورة تسوية #{invoice.invoice_number}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-300">
                            تمت التسوية بتاريخ {format(parseISO(invoice.settlement_date), 'd MMMM yyyy', { locale: ar })} بواسطة {settledBy?.full_name || 'المدير'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    {/* كارت المبلغ الإجمالي */}
                    <div className="my-6">
                        <Card className="bg-gradient-to-r from-teal-500 to-emerald-500 text-white border-0 shadow-2xl">
                            <CardContent className="p-6 text-center">
                                <div className="flex items-center justify-center gap-3 mb-4">
                                    <div className="p-2 bg-white/20 rounded-full">
                                        <DollarSign className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-xl font-bold">المبلغ الإجمالي</h3>
                                </div>
                                <p className="text-4xl font-black mb-2">{invoice.total_amount.toLocaleString()}</p>
                                <p className="text-white/90">دينار عراقي</p>
                            </CardContent>
                        </Card>
                    </div>
                    <div className="mb-4">
                        <h4 className="font-semibold mb-4 text-white flex items-center gap-2">
                            <Receipt className="w-5 h-5 text-teal-400" />
                            الطلبات المسددة ({settledOrdersDetails.length})
                        </h4>
                    </div>
                    <ScrollArea className="h-[45vh] pr-4">
                        <div className="space-y-4">
                            {settledOrdersDetails.map((order) => (
                                <Card key={order.id} className="bg-slate-800/50 border border-slate-700/50 backdrop-blur-sm">
                                    <CardContent className="p-4">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-blue-500/20 rounded-lg">
                                                    <FileText className="w-4 h-4 text-blue-400" />
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-white">طلب #{order.trackingnumber}</p>
                                                    <p className="text-slate-400 text-sm">{order.customerinfo.name}</p>
                                                </div>
                                            </div>
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white border-0"
                                                onClick={() => handleViewOrder(order)}
                                            >
                                                <Eye className="w-4 h-4 mr-2" />
                                                معاينة
                                            </Button>
                                        </div>
                                        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                                            <p className="font-semibold mb-2 text-slate-300 text-sm">المنتجات:</p>
                                            <div className="space-y-1">
                                                {(order.items || []).map(item => (
                                                    <div key={item.sku} className="flex justify-between text-sm">
                                                        <span className="text-slate-300">
                                                            {item.productName} ({item.color}, {item.size}) × {item.quantity}
                                                        </span>
                                                        <span className="text-emerald-400 font-semibold">
                                                            {item.total.toLocaleString()} د.ع
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </ScrollArea>
                    <AlertDialogFooter className="border-t border-slate-700/50 pt-6">
                        <AlertDialogCancel className="bg-slate-700 hover:bg-slate-600 text-white border-0">
                            إغلاق
                        </AlertDialogCancel>
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