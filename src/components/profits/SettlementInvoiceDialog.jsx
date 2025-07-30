import React, { useState } from 'react';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { FileText, Eye, User, DollarSign, CheckCircle, Calendar } from 'lucide-react';
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
                <AlertDialogContent className="max-w-md bg-gradient-to-br from-slate-900 via-blue-900/90 to-indigo-900/80 border-0 text-white">
                    {/* Header */}
                    <div className="text-center mb-6">
                        <div className="flex items-center justify-center mb-3">
                            <div className="p-3 bg-teal-500 rounded-full">
                                <FileText className="w-8 h-8 text-white" />
                            </div>
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">فاتورة تسوية</h2>
                        <p className="text-gray-300 text-sm">#{invoice.invoice_number}</p>
                    </div>

                    <ScrollArea className="max-h-[60vh] px-2">
                        <div className="space-y-4">
                            {/* Employee Info Card */}
                            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-600/50">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="p-2 bg-blue-500 rounded-lg">
                                        <FileText className="w-5 h-5 text-white" />
                                    </div>
                                    <span className="text-blue-400 font-mono text-sm">رقم الفاتورة</span>
                                </div>
                                <p className="text-white font-bold text-lg">{invoice.invoice_number}</p>
                            </div>

                            {/* Employee Name */}
                            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-600/50">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="p-2 bg-teal-500 rounded-lg">
                                        <User className="w-5 h-5 text-white" />
                                    </div>
                                    <span className="text-white font-semibold">الموظف</span>
                                </div>
                                <p className="text-white font-bold text-lg">{settledBy?.full_name || 'المدير'}</p>
                            </div>

                            {/* Amount */}
                            <div className="bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-xl p-4 border border-emerald-500/30">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="p-2 bg-emerald-500 rounded-lg">
                                        <DollarSign className="w-5 h-5 text-white" />
                                    </div>
                                    <span className="text-white font-semibold">المبلغ</span>
                                </div>
                                <p className="text-emerald-400 text-2xl font-bold">
                                    {invoice.total_amount?.toLocaleString()} د.ع
                                </p>
                            </div>

                            {/* Settlement Status */}
                            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-600/50">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="p-2 bg-emerald-500 rounded-lg">
                                        <CheckCircle className="w-5 h-5 text-white" />
                                    </div>
                                    <span className="text-white font-semibold">حالة التسوية</span>
                                </div>
                                <p className="text-emerald-400 font-bold">مكتملة</p>
                            </div>

                            {/* Settlement Date */}
                            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-600/50">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="p-2 bg-purple-500 rounded-lg">
                                        <Calendar className="w-5 h-5 text-white" />
                                    </div>
                                    <span className="text-white font-semibold">تاريخ الإصدار</span>
                                </div>
                                <p className="text-gray-300">
                                    {format(parseISO(invoice.settlement_date), 'dd/MM/yyyy', { locale: ar })}
                                </p>
                            </div>

                            {/* Orders List */}
                            {settledOrdersDetails.length > 0 && (
                                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-600/50">
                                    <h4 className="text-white font-semibold mb-3">الطلبات المسددة ({settledOrdersDetails.length})</h4>
                                    <div className="space-y-2">
                                        {settledOrdersDetails.map((order) => (
                                            <div key={order.id} className="bg-slate-700/50 rounded-lg p-3">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-gray-300 text-sm">
                                                        طلب #{order.trackingnumber} - {order.customerinfo.name}
                                                    </span>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        className="text-blue-400 hover:text-blue-300 p-1"
                                                        onClick={() => handleViewOrder(order)}
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollArea>

                    <AlertDialogFooter className="mt-6">
                        <AlertDialogCancel className="w-full bg-slate-800 border-slate-600 text-white hover:bg-slate-700">
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