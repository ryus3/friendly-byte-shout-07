import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { Search, RotateCcw, Trash2, Calendar, User, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

export const AutoDeleteLogDialog = ({ open, onOpenChange }) => {
  const [deletedOrders, setDeletedOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [selectedLogs, setSelectedLogs] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchDeletedOrders();
    }
  }, [open]);

  const fetchDeletedOrders = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('auto_delete_log')
        .select('*')
        .order('deleted_at', { ascending: false })
        .limit(100);

      if (sourceFilter !== 'all') {
        query = query.eq('delete_source', sourceFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      setDeletedOrders(data || []);
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في جلب سجل الحذف التلقائي",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (log) => {
    if (!log.order_data) {
      toast({
        title: "خطأ",
        description: "لا توجد بيانات كافية لاستعادة الطلب",
        variant: "destructive"
      });
      return;
    }

    try {
      // 1️⃣ استعادة الطلب الرئيسي مع بيانات شركة التوصيل
      let orderData = {
        ...log.order_data,
        // ✅ استعادة بيانات شركة التوصيل الأصلية
        delivery_partner: log.order_data.delivery_partner || 'local',
        delivery_partner_order_id: log.order_data.delivery_partner_order_id || null,
        delivery_account_code: log.order_data.delivery_account_code || null,
        tracking_number: log.order_data.tracking_number || null,
        qr_id: log.order_data.qr_id || null,
        // ✅ إعادة الحالة إلى الحالة الأصلية قبل الحذف
        status: log.order_status || 'pending',
        delivery_status: log.delivery_status || null,
        updated_at: new Date().toISOString()
      };

      // ✅ المرحلة 5: إذا كانت بيانات العميل ناقصة، محاولة جلبها من API الوسيط
      const isMissingCustomerData = !orderData.customer_phone || !orderData.customer_city || !orderData.customer_province;
      const hasDeliveryPartnerId = orderData.delivery_partner_order_id && 
                                    (orderData.delivery_partner === 'alwaseet' || orderData.delivery_partner === 'modon');
      
      if (isMissingCustomerData && hasDeliveryPartnerId) {
        try {
          // جلب التوكن النشط لشركة التوصيل
          const { data: token, error: tokenError } = await supabase
            .from('delivery_partner_tokens')
            .select('token, partner_name')
            .eq('partner_name', orderData.delivery_partner)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (token?.token) {
            // استدعاء API المناسب لجلب بيانات الطلب
            let orderDetails = null;
            
            if (orderData.delivery_partner === 'modon') {
              const ModonAPI = await import('@/lib/modon-api');
              orderDetails = await ModonAPI.getOrderByQR(token.token, orderData.qr_id || orderData.delivery_partner_order_id);
            } else {
              const AlWaseetAPI = await import('@/lib/alwaseet-api');
              orderDetails = await AlWaseetAPI.getOrderByQR(token.token, orderData.qr_id || orderData.delivery_partner_order_id);
            }

            if (orderDetails) {
              orderData = {
                ...orderData,
                // رقم الهاتف - جميع الاحتمالات
                customer_phone: orderData.customer_phone || 
                                orderDetails.client_mobile || 
                                orderDetails.phone || 
                                orderDetails.customer_phone ||
                                orderDetails.mobile ||
                                orderDetails.client_phone,
                // المدينة - جميع الاحتمالات
                customer_city: orderData.customer_city || 
                               orderDetails.city_name || 
                               orderDetails.city ||
                               orderDetails.customer_city ||
                               orderDetails.client_city,
                // المنطقة/الحي - جميع الاحتمالات
                customer_province: orderData.customer_province || 
                                   orderDetails.state || 
                                   orderDetails.province || 
                                   orderDetails.region || 
                                   orderDetails.region_name ||
                                   orderDetails.state_name ||
                                   orderDetails.customer_province,
                // الاسم
                customer_name: orderData.customer_name || 
                               orderDetails.client_name || 
                               orderDetails.customer_name || 
                               orderDetails.name,
                // العنوان
                customer_address: orderData.customer_address || 
                                  orderDetails.address || 
                                  orderDetails.full_address ||
                                  orderDetails.location,
                // الملاحظات
                notes: orderData.notes || 
                       orderDetails.note || 
                       orderDetails.notes ||
                       orderDetails.merchant_notes
              };
              
              toast({
                title: "✅ تم استكمال البيانات",
                description: "تم جلب بيانات العميل من شركة التوصيل",
                variant: "default"
              });
            }
          } else {
            console.warn('⚠️ لا يوجد توكن نشط لشركة التوصيل');
          }
        } catch (apiError) {
          console.error('❌ فشل في جلب البيانات من API:', apiError);
          // نواصل الاستعادة بالبيانات المتاحة
        }
      }
      
      const savedItems = orderData.order_items || [];
      delete orderData.id;
      delete orderData.created_at;
      delete orderData.order_items;
      delete orderData.order_number; // ✅ حذف order_number لتوليد رقم جديد تلقائياً (tracking_number يبقى كما هو)
      
      console.log('📝 البيانات قبل الإدراج:', {
        tracking_number: orderData.tracking_number, // يبقى كما هو من شركة التوصيل
        customer_phone: orderData.customer_phone,
        customer_city: orderData.customer_city,
        customer_province: orderData.customer_province
      });

      const { data: restoredOrder, error: orderError } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (orderError) throw orderError;

      // 2️⃣ استعادة order_items إذا وُجدت مع إصلاح Schema
      if (savedItems.length > 0) {
        const items = savedItems.map(item => ({
          order_id: restoredOrder.id,
          product_id: item.product_id,
          variant_id: item.variant_id,
          quantity: item.quantity,
          unit_price: item.unit_price || 0,
          total_price: item.total_price || 0,
          item_status: 'pending',
          item_direction: item.item_direction || null
        }));
        
        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(items);
          
        if (itemsError) throw itemsError;
        
        // 3️⃣ إعادة حجز المخزون
        for (const item of savedItems) {
          await supabase.rpc('reserve_stock_item', {
            p_product_id: item.product_id,
            p_variant_id: item.variant_id,
            p_quantity: item.quantity
          });
        }
      }

      // 4️⃣ حذف السجل من auto_delete_log
      await supabase
        .from('auto_delete_log')
        .delete()
        .eq('id', log.id);

      toast({
        title: "✅ تمت الاستعادة الكاملة",
        description: `تم استعادة الطلب ${log.order_number || log.tracking_number} مع جميع العناصر والمخزون`,
        variant: "default"
      });

      fetchDeletedOrders();
    } catch (error) {
      toast({
        title: "خطأ",
        description: error.message || "فشل في استعادة الطلب",
        variant: "destructive"
      });
    }
  };

  const filteredOrders = deletedOrders.filter(order => {
    if (!searchTerm) return true;
    
    const search = searchTerm.toLowerCase();
    return (
      order.order_number?.toLowerCase().includes(search) ||
      order.tracking_number?.toLowerCase().includes(search) ||
      order.qr_id?.toLowerCase().includes(search) ||
      order.delivery_partner_order_id?.toLowerCase().includes(search)
    );
  });

  const handlePermanentDelete = async () => {
    if (selectedLogs.length === 0) return;

    const confirmed = window.confirm(
      `هل أنت متأكد من حذف ${selectedLogs.length} سجل نهائياً؟ لا يمكن التراجع عن هذا الإجراء!`
    );

    if (!confirmed) return;

    try {
      const { data, error } = await supabase
        .from('auto_delete_log')
        .delete()
        .in('id', selectedLogs)
        .select();

      if (error) throw error;

      toast({
        title: "تم الحذف",
        description: `تم حذف ${selectedLogs.length} سجل نهائياً`,
        variant: "default"
      });

      setSelectedLogs([]);
      setSelectAll(false);
      fetchDeletedOrders();
    } catch (error) {
      toast({
        title: "خطأ",
        description: error.message || "فشل في حذف السجلات",
        variant: "destructive"
      });
    }
  };

  const getSourceLabel = (source) => {
    switch (source) {
      case 'syncAndApplyOrders':
        return 'مزامنة ذكية';
      case 'fastSync':
        return 'مزامنة سريعة';
      case 'syncOrderByQR':
        return 'مزامنة QR';
      case 'manual':
        return 'يدوي';
      default:
        return source || 'غير محدد';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Trash2 className="h-6 w-6 text-red-500" />
            سجل الحذف التلقائي
          </DialogTitle>
        </DialogHeader>

        {/* شريط البحث والفلترة */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث برقم الطلب أو التتبع أو QR..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10"
            />
          </div>
          
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-4 py-2 border rounded-md bg-background"
          >
            <option value="all">جميع المصادر</option>
            <option value="syncAndApplyOrders">مزامنة ذكية</option>
            <option value="fastSync">مزامنة سريعة</option>
            <option value="syncOrderByQR">مزامنة QR</option>
            <option value="manual">يدوي</option>
          </select>

          <Button onClick={fetchDeletedOrders} variant="outline" size="icon">
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        {/* شريط التحديد والحذف */}
        <div className="flex items-center gap-3 mb-4 p-3 bg-muted/50 rounded-lg">
          <Checkbox
            checked={selectAll}
            onCheckedChange={(checked) => {
              setSelectAll(checked);
              setSelectedLogs(checked ? filteredOrders.map(o => o.id) : []);
            }}
          />
          <span className="text-sm font-medium">
            تحديد الكل ({filteredOrders.length})
          </span>
          
          {selectedLogs.length > 0 && (
            <Button
              onClick={handlePermanentDelete}
              variant="destructive"
              size="sm"
              className="mr-auto"
            >
              <Trash2 className="h-4 w-4 ml-2" />
              حذف نهائياً ({selectedLogs.length})
            </Button>
          )}
        </div>

        {/* قائمة الطلبات المحذوفة */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              جاري التحميل...
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-20" />
              {searchTerm ? 'لا توجد نتائج للبحث' : 'لا توجد طلبات محذوفة'}
            </div>
          ) : (
            filteredOrders.map((log) => (
                <div
                  key={log.id}
                  className="p-4 border rounded-lg hover:shadow-md transition-all bg-card"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedLogs.includes(log.id)}
                          onCheckedChange={(checked) => {
                            setSelectedLogs(prev =>
                              checked
                                ? [...prev, log.id]
                                : prev.filter(id => id !== log.id)
                            );
                          }}
                        />
                        <span className="font-bold text-lg">
                          {log.order_number || log.tracking_number || 'غير محدد'}
                        </span>
                      <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                        {getSourceLabel(log.delete_source)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-muted-foreground">
                      {log.tracking_number && (
                        <div>رقم التتبع: {log.tracking_number}</div>
                      )}
                      {log.delivery_partner_order_id && (
                        <div>معرف الوسيط: {log.delivery_partner_order_id}</div>
                      )}
                      {log.qr_id && (
                        <div>QR: {log.qr_id}</div>
                      )}
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(log.deleted_at), 'PPp', { locale: ar })}
                      </div>
                      <div>الحالة: {log.order_status}</div>
                      <div>حالة التوصيل: {log.delivery_status || 'غير محدد'}</div>
                      <div>عمر الطلب: {log.order_age_minutes || 0} دقيقة</div>
                    </div>

                    {log.reason?.message && (
                      <div className="text-sm bg-muted p-2 rounded">
                        السبب: {log.reason.message}
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={() => handleRestore(log)}
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                  >
                    <RotateCcw className="h-4 w-4 ml-2" />
                    استعادة
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* إحصائيات */}
        {filteredOrders.length > 0 && (
          <div className="mt-4 p-3 bg-muted rounded-lg text-sm">
            <div className="flex justify-between">
              <span>إجمالي الطلبات المحذوفة: {filteredOrders.length}</span>
              <span className="text-muted-foreground">
                آخر تحديث: {format(new Date(), 'PPp', { locale: ar })}
              </span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
