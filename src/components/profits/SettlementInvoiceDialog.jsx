import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { FileText, Eye, Receipt, Calendar, User, DollarSign, CheckCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { ar } from 'date-fns/locale';
import { useInventory } from '@/contexts/InventoryContext';
import OrderDetailsDialog from '@/components/orders/OrderDetailsDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

const SettlementInvoiceDialog = ({ invoice, open, onOpenChange, allUsers }) => {
    const IRAQ_TIMEZONE = 'Asia/Baghdad'; // المنطقة الزمنية العراقية
    const { orders } = useInventory();
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [realOrdersData, setRealOrdersData] = useState([]);
    const [loadingOrders, setLoadingOrders] = useState(false);
    const [realInvoiceData, setRealInvoiceData] = useState(null);

    // Add null check for invoice
    if (!invoice) {
        return null;
    }

    // جلب بيانات فاتورة التسوية الحقيقية
    const fetchRealInvoiceData = async () => {
        if (!invoice.id) {
            console.log('لا يوجد معرف للفاتورة');
            return;
        }

        try {
            const { supabase } = await import('@/lib/customSupabaseClient');
            
            const { data, error } = await supabase
                .from('settlement_invoices')
                .select('*')
                .eq('id', invoice.id)
                .single();

            if (error) {
                console.error('خطأ في جلب بيانات الفاتورة:', error);
                return;
            }

            console.log('🔥 البيانات الحقيقية للفاتورة:', data);
            console.log('📅 تاريخ التسوية الحقيقي:', data?.settlement_date);
            console.log('📅 تاريخ الإنشاء الحقيقي:', data?.created_at);
            setRealInvoiceData(data);
        } catch (error) {
            console.error('خطأ غير متوقع في جلب الفاتورة:', error);
        }
    };

    // جلب البيانات الحقيقية للطلبات من قاعدة البيانات
    const fetchRealOrdersData = async () => {
        if (!invoice.order_ids || invoice.order_ids.length === 0) {
            console.log('لا توجد order_ids في الفاتورة');
            return;
        }

        setLoadingOrders(true);
        try {
            const { supabase } = await import('@/lib/customSupabaseClient');
            
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .in('id', invoice.order_ids);

            if (error) {
                console.error('خطأ في جلب بيانات الطلبات:', error);
                return;
            }

            console.log('🔥 البيانات الحقيقية للطلبات:', data);
            setRealOrdersData(data || []);
        } catch (error) {
            console.error('خطأ غير متوقع:', error);
        } finally {
            setLoadingOrders(false);
        }
    };

    // جلب البيانات عند فتح النافذة
    React.useEffect(() => {
        if (open) {
            fetchRealInvoiceData();
            if (invoice.order_ids && invoice.order_ids.length > 0) {
                fetchRealOrdersData();
            }
        }
    }, [open, invoice.id, invoice.order_ids]);

    const settledBy = allUsers.find(u => u.id === invoice.settled_by_id || invoice.created_by);
    
    // استخدام البيانات الحقيقية من قاعدة البيانات أولاً، ثم الاحتياط من context
    const finalOrdersDetails = realOrdersData.length > 0 ? realOrdersData : 
        (invoice.order_ids || []).map(orderId => {
            return orders.find(o => o.id === orderId);
        }).filter(Boolean);

    console.log('🔍 SettlementInvoiceDialog Final Debug:', {
        invoiceId: invoice.id,
        orderIds: invoice.order_ids,
        realOrdersCount: realOrdersData.length,
        contextOrdersCount: orders?.length,
        finalOrdersCount: finalOrdersDetails.length,
        orderDetails: finalOrdersDetails.map(o => ({ 
            id: o?.id, 
            number: o?.order_number || o?.trackingnumber,
            real_created_at: o?.created_at,
            customer: o?.customer_name
        }))
    });

    const handleViewOrder = (order) => {
        setSelectedOrder(order);
        setIsDetailsOpen(true);
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-[95vw] sm:max-w-6xl max-h-[95vh] overflow-hidden mx-1 my-1 sm:mx-4 sm:my-4 md:mx-8 md:my-8">
                    <ScrollArea className="h-full max-h-[90vh] sm:max-h-[85vh]">
                        <div className="p-4 sm:p-6 md:p-8">
                            {/* Header */}
                            <div className="text-center mb-4 sm:mb-6 md:mb-8">
                                <div className="flex items-center justify-center gap-2 sm:gap-4 mb-4 sm:mb-6">
                                    <div className="p-2 sm:p-3 bg-gradient-to-r from-emerald-500 to-blue-600 rounded-full text-white shadow-lg">
                                        <Receipt className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10" />
                                    </div>
                                    <div>
                                        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-800 dark:text-slate-100">فاتورة تسوية</h1>
                                        <p className="text-sm sm:text-base md:text-lg text-slate-600 dark:text-slate-400">#{invoice.invoice_number}</p>
                                    </div>
                                </div>
                                
                                <div className="bg-white/80 dark:bg-slate-800/80 rounded-xl px-4 py-3 sm:px-6 sm:py-4 md:px-8 md:py-4 inline-block shadow-md border">
                                    <div className="flex items-center gap-2 sm:gap-3">
                                        <Calendar className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-blue-600" />
                                        <div className="text-right">
                                            <p className="text-sm text-slate-600 dark:text-slate-400">تاريخ التسوية</p>
                                             <p className="text-sm sm:text-base md:text-xl font-bold text-slate-800 dark:text-slate-100">
                                                 {(() => {
                                                   // استخدام البيانات الحقيقية للفاتورة أولاً
                                                   const realData = realInvoiceData || invoice;
                                                   let dateToShow;
                                                   
                                                   // أولوية التاريخ: settlement_date ثم created_at من البيانات الحقيقية
                                                   if (realData.settlement_date) {
                                                     dateToShow = new Date(realData.settlement_date);
                                                   } else if (realData.created_at) {
                                                     dateToShow = new Date(realData.created_at);
                                                   } else {
                                                     dateToShow = new Date();
                                                   }
                                                   
                                                   // التأكد من صحة التاريخ
                                                   if (isNaN(dateToShow.getTime())) {
                                                     dateToShow = new Date();
                                                   }
                                                   
                                                   try {
                                                      return formatInTimeZone(dateToShow, IRAQ_TIMEZONE, 'dd MMMM yyyy - HH:mm', { locale: ar });
                                                    } catch (error) {
                                                      console.error('خطأ في تنسيق التاريخ:', error, 'البيانات الحقيقية:', realData);
                                                      return formatInTimeZone(new Date(), IRAQ_TIMEZONE, 'dd MMMM yyyy - HH:mm', { locale: ar });
                                                   }
                                                 })()}
                                             </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* معلومات الفاتورة */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                                {/* معلومات التسوية */}
                                <Card>
                                    <CardContent className="p-6">
                                        <h3 className="font-bold text-xl mb-4 flex items-center gap-3">
                                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                                <User className="w-6 h-6 text-blue-600" />
                                            </div>
                                            معلومات التسوية
                                        </h3>
                                        <div className="space-y-3">
                                            <div>
                                                <p className="text-sm text-slate-600 dark:text-slate-400">تمت بواسطة</p>
                                                <p className="font-semibold text-slate-800 dark:text-slate-100">{settledBy?.full_name || 'المدير'}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-slate-600 dark:text-slate-400">عدد الطلبات</p>
                                                <p className="font-bold text-2xl text-blue-600">{finalOrdersDetails.length}</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* المبلغ الإجمالي */}
                                <Card className="bg-gradient-to-br from-emerald-500 to-blue-600 text-white shadow-xl">
                                    <CardContent className="p-6 text-center">
                                        <div className="flex items-center justify-center gap-3 mb-4">
                                            <DollarSign className="w-10 h-10" />
                                            <h3 className="text-xl font-bold">المبلغ الإجمالي</h3>
                                        </div>
                                        <p className="text-5xl font-black mb-2 drop-shadow-lg">
                                            {invoice.total_amount.toLocaleString()}
                                        </p>
                                        <p className="text-lg font-bold opacity-90">دينار عراقي</p>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* الطلبات المسددة */}
                            <Card className="mb-8 bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-900 border-slate-200 dark:border-slate-700 shadow-xl">
                                <CardContent className="p-8">
                                    <div className="flex items-center gap-3 mb-8">
                                        <div className="p-3 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl shadow-lg">
                                            <FileText className="w-8 h-8 text-white" />
                                        </div>
                                        <h3 className="font-black text-3xl bg-gradient-to-r from-purple-600 to-violet-600 bg-clip-text text-transparent">
                                            الطلبات المسددة ({finalOrdersDetails.length})
                                        </h3>
                                    </div>
                                    
                                    <div className="bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-700 dark:to-slate-600 rounded-2xl p-1 shadow-2xl">
                                        <div className="bg-white dark:bg-slate-800 rounded-xl overflow-hidden">
                                            {/* Header */}
                                            <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-8 py-6">
                                                <div className="grid grid-cols-4 gap-6 text-center font-bold text-lg">
                                                    <div className="text-blue-300">رقم الطلب</div>
                                                    <div className="text-green-300">العميل</div>
                                                    <div className="text-orange-300">المبلغ</div>
                                                    <div className="text-purple-300">الإجراءات</div>
                                                </div>
                                            </div>
                                            
                                             {/* Orders List */}
                                             <div className="divide-y divide-slate-200 dark:divide-slate-700">
                                                 {loadingOrders ? (
                                                     <div className="text-center py-8 text-slate-500">
                                                         <p className="text-lg">جاري تحميل بيانات الطلبات الحقيقية...</p>
                                                     </div>
                                                 ) : finalOrdersDetails.length === 0 ? (
                                                     <div className="text-center py-8 text-slate-500">
                                                         <p className="text-lg">لا توجد طلبات مسددة في هذه الفاتورة</p>
                                                     </div>
                                                ) : (
                                                    finalOrdersDetails.map((order, index) => (
                                                        <div 
                                                            key={order.id} 
                                                            className={`grid grid-cols-1 md:grid-cols-4 gap-3 md:gap-6 py-4 md:py-6 px-4 md:px-8 text-center transition-all duration-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:from-blue-900/20 dark:hover:to-purple-900/20 ${
                                                                index % 2 === 0 ? 'bg-slate-50/50 dark:bg-slate-900/30' : 'bg-white dark:bg-slate-800'
                                                            }`}
                                                        >
                                                             {/* رقم الطلب والتاريخ - متوافق مع الهاتف */}
                                                             <div className="flex flex-col items-center justify-center gap-2">
                                                                 <span className="text-xs md:hidden text-slate-500">رقم الطلب:</span>
                                                                 <span className="inline-flex items-center justify-center bg-gradient-to-r from-blue-500 to-blue-600 text-white font-mono font-bold px-3 py-2 md:px-4 md:py-3 rounded-xl shadow-lg text-sm md:text-lg hover:scale-105 transition-transform">
                                                                     #{order.order_number || order.trackingnumber || 'غير محدد'}
                                                                 </span>
                                                                 <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                                     {(() => {
                                                                         if (order.created_at) {
                                                                             try {
                                                                                  return formatInTimeZone(new Date(order.created_at), IRAQ_TIMEZONE, 'dd/MM/yyyy', { locale: ar });
                                                                              } catch (error) {
                                                                                 return 'تاريخ غير صحيح';
                                                                             }
                                                                         }
                                                                         return 'غير محدد';
                                                                     })()}
                                                                 </div>
                                                             </div>
                                                            
                                                            {/* العميل - متوافق مع الهاتف */}
                                                            <div className="flex flex-col items-center justify-center">
                                                                <span className="text-xs md:hidden text-slate-500 mb-1">العميل:</span>
                                                                <div className="text-sm md:text-lg font-bold text-slate-700 dark:text-slate-300">
                                                                    {order.customer_name || order.customerinfo?.name || 'غير محدد'}
                                                                </div>
                                                            </div>
                                                            
                                                            {/* المبلغ - متوافق مع الهاتف */}
                                                            <div className="flex flex-col items-center justify-center">
                                                                <span className="text-xs md:hidden text-slate-500 mb-1">المبلغ:</span>
                                                                <div className="text-xl md:text-3xl font-black text-green-600 dark:text-green-400 mb-1">
                                                                    {(order.total_amount || order.final_amount || order.total || 0).toLocaleString()}
                                                                </div>
                                                                <div className="text-xs md:text-sm text-green-500 font-semibold">د.ع</div>
                                                            </div>
                                                            
                                                            {/* الإجراءات - متوافق مع الهاتف */}
                                                            <div className="flex items-center justify-center mt-2 md:mt-0">
                                                                <Button 
                                                                    variant="outline" 
                                                                    size="sm"
                                                                    onClick={() => handleViewOrder(order)}
                                                                    className="gap-2 hover:bg-blue-50 hover:border-blue-300 text-xs md:text-sm"
                                                                >
                                                                    <Eye className="w-3 h-3 md:w-4 md:h-4" />
                                                                    عرض التفاصيل
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* حالة التسوية */}
                            <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
                                <CardContent className="p-6 text-center">
                                    <div className="flex items-center justify-center gap-3 mb-3">
                                        <CheckCircle className="w-10 h-10 text-green-600" />
                                        <h3 className="text-2xl font-bold text-green-700 dark:text-green-400">تسوية مكتملة</h3>
                                    </div>
                                    <p className="text-green-600 dark:text-green-400 text-lg">تم إتمام الدفع وتسجيل جميع البيانات بنجاح</p>
                                </CardContent>
                            </Card>
                        </div>
                    </ScrollArea>
                    
                    <DialogFooter className="px-8 pb-6">
                        <Button onClick={() => onOpenChange(false)} variant="outline" className="w-full">
                            إغلاق الفاتورة
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            
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