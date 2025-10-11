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
  onRefundAmountChange
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
          // اقتراح مبلغ الإرجاع
          const suggestedRefund = orders[0].final_amount - (orders[0].delivery_fee || 0);
          onRefundAmountChange(Math.max(0, suggestedRefund));
        } else {
          setOriginalOrder(null);
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
                <strong>رقم الطلب:</strong> #{originalOrder.order_number}
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
    </div>
  );
};
