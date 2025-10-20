import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertTriangle, PackageMinus } from 'lucide-react';
import SearchableSelectFixed from '@/components/ui/searchable-select-fixed';
import { supabase } from '@/lib/customSupabaseClient';
import { normalizePhone } from '@/utils/phoneUtils';

export const ReturnProductForm = ({
  cart,
  customerPhone,
  onSelectReturn,
  returnProduct,
  refundAmount,
  onRefundAmountChange,
  onOriginalOrderFound  // ✅ callback لإرسال الطلب الأصلي للـ parent
}) => {
  const [originalOrder, setOriginalOrder] = useState(null);
  const [searching, setSearching] = useState(false);
  
  // البحث التلقائي عن الطلب الأصلي
  useEffect(() => {
    const searchOriginalOrder = async () => {
      if (!customerPhone || customerPhone.length < 10) {
        setOriginalOrder(null);
        return;
      }
      
      setSearching(true);
      const normalizedPhone = normalizePhone(customerPhone);
      
      try {
        const { data: orders, error } = await supabase
          .from('orders')
          .select('*')
          .ilike('customer_phone', `%${normalizedPhone}%`)
          .in('status', ['delivered', 'completed'])
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (error) throw error;
        
        if (orders && orders.length > 0) {
          setOriginalOrder(orders[0]);
          if (onOriginalOrderFound) onOriginalOrderFound(orders[0]); // ✅ إرسال الطلب الأصلي للـ parent
          // اقتراح مبلغ الإرجاع
          const suggestedRefund = orders[0].final_amount - (orders[0].delivery_fee || 0);
          onRefundAmountChange(Math.max(0, suggestedRefund));
        } else {
          setOriginalOrder(null);
          if (onOriginalOrderFound) onOriginalOrderFound(null); // ✅ إرسال null للـ parent
        }
      } catch (err) {
        console.error('خطأ في البحث عن الطلب:', err);
      } finally {
        setSearching(false);
      }
    };
    
    searchOriginalOrder();
  }, [customerPhone, onRefundAmountChange]);
  
  return (
    <div className="space-y-4 mt-6">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <PackageMinus className="w-5 h-5" />
        تفاصيل الإرجاع
      </h3>
      
      {/* المنتج المُرجع */}
      <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-900/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">المنتج المُرجع</CardTitle>
        </CardHeader>
        <CardContent>
          <SearchableSelectFixed
            value={returnProduct?.id || ''}
            onValueChange={onSelectReturn}
            options={cart.map(item => ({
              value: item.id,
              label: `${item.productName} - ${item.color} - ${item.size}`
            }))}
            placeholder="اختر المنتج المراد إرجاعه"
            emptyText="السلة فارغة"
            className="w-full"
          />
        </CardContent>
      </Card>
      
      {/* معلومات الطلب الأصلي */}
      {searching ? (
        <Alert>
          <AlertDescription>جاري البحث عن الطلب الأصلي...</AlertDescription>
        </Alert>
      ) : originalOrder ? (
        <Card className="border-green-300 bg-green-50 dark:bg-green-900/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="font-semibold text-green-800 dark:text-green-200">
                تم العثور على الطلب الأصلي
              </span>
            </div>
            <div className="space-y-1 text-sm">
              <p>
                <strong>رقم التتبع:</strong> {originalOrder.tracking_number || originalOrder.order_number || 'غير متوفر'}
              </p>
              <p>
                <strong>التاريخ:</strong>{' '}
                {new Date(originalOrder.created_at).toLocaleDateString('ar')}
              </p>
              <p>
                <strong>المبلغ:</strong>{' '}
                {originalOrder.final_amount.toLocaleString()} د.ع
              </p>
              <Badge variant="success" className="mt-2">
                مُسلّم ✅
              </Badge>
            </div>
          </CardContent>
        </Card>
      ) : customerPhone?.length >= 10 ? (
        <Alert className="border-yellow-300 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            ⚠️ لم يتم العثور على طلب أصلي مُسلّم لهذا الزبون
          </AlertDescription>
        </Alert>
      ) : null}
      
      {/* مبلغ الاسترجاع */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">💰 مبلغ الاسترجاع</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            type="number"
            value={refundAmount}
            onChange={(e) => onRefundAmountChange(Number(e.target.value))}
            placeholder="أدخل المبلغ المسترجع"
            className="text-lg h-12"
          />
          {originalOrder && (
            <p className="text-xs text-muted-foreground mt-2">
              💡 المبلغ المقترح:{' '}
              {(originalOrder.final_amount - (originalOrder.delivery_fee || 0)).toLocaleString()} د.ع
            </p>
          )}
        </CardContent>
      </Card>

      {/* ملخص مالي تفصيلي */}
      {returnProduct && refundAmount > 0 && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/10">
          <CardContent className="p-4">
            <h3 className="font-bold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
              <span>💰</span>
              <span>الحسابات المالية</span>
            </h3>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>مبلغ الإرجاع:</span>
                <span className="font-bold">{refundAmount.toLocaleString()} د.ع</span>
              </div>
              
              <div className="flex justify-between">
                <span>رسوم التوصيل:</span>
                <span>5,000 د.ع</span>
              </div>
              
              <div className="border-t border-blue-200 dark:border-blue-700 my-2"></div>
              
              <div className="flex justify-between text-base font-bold text-red-600 dark:text-red-400">
                <span>المبلغ الكلي (سالب):</span>
                <span>-{(refundAmount + 5000).toLocaleString()} د.ع</span>
              </div>
            </div>

            <Alert className="mt-3 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700">
              <AlertDescription className="text-xs space-y-1">
                <p className="font-bold">⚠️ ملاحظات مهمة:</p>
                <ul className="space-y-1 mr-4">
                  <li>• المندوب سيدفع {refundAmount.toLocaleString()} د.ع للزبون عند استلام المنتج</li>
                  <li>• سيتم خصم {(refundAmount + 5000).toLocaleString()} د.ع من فاتورة الوسيط</li>
                  <li>• عند حالة "17": سيتم تسجيل حركة نقد تلقائياً</li>
                </ul>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
