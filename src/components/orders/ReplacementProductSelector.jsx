import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowRight, ArrowLeft, Info, CheckCircle2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { processReplacementInventory } from '@/utils/replacement-inventory-handler';

const ReplacementProductSelector = ({ order, open, onOpenChange, onComplete }) => {
  const [orderItems, setOrderItems] = useState([]);
  const [outgoingItems, setOutgoingItems] = useState([]); // للزبون
  const [incomingItems, setIncomingItems] = useState([]); // من الزبون
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const fetchOrderItems = async () => {
      if (!order?.id || !open) return;

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('order_items')
          .select(`
            id,
            product_id,
            variant_id,
            quantity,
            unit_price,
            products (name, images),
            product_variants (
              colors (name),
              sizes (name)
            )
          `)
          .eq('order_id', order.id);

        if (error) throw error;

        const items = data.map(item => ({
          id: item.id,
          product_id: item.product_id,
          variant_id: item.variant_id,
          quantity: item.quantity,
          price: item.unit_price,
          name: item.products?.name || 'منتج',
          image: item.products?.images?.[0] || '/placeholder.svg',
          color: item.product_variants?.colors?.name || '',
          size: item.product_variants?.sizes?.name || ''
        }));

        setOrderItems(items);
      } catch (error) {
        console.error('Error fetching order items:', error);
        toast({
          title: 'خطأ',
          description: 'فشل في تحميل منتجات الطلب',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchOrderItems();
  }, [order?.id, open]);

  const handleOutgoingToggle = (itemId) => {
    setOutgoingItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleIncomingToggle = (itemId) => {
    setIncomingItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSubmit = async () => {
    if (outgoingItems.length === 0 && incomingItems.length === 0) {
      toast({
        title: 'تنبيه',
        description: 'يجب تحديد منتج واحد على الأقل',
        variant: 'destructive'
      });
      return;
    }

    setProcessing(true);
    try {
      // معالجة المخزون
      const result = await processReplacementInventory(order.id, outgoingItems, incomingItems);

      if (result.success) {
        // تحديث الطلب بعلامة المعالجة
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            replacement_processed_at: new Date().toISOString(),
            notes: `${order.notes || ''}\n\n🔄 معالجة الاستبدال:\n- منتجات صادرة: ${outgoingItems.length}\n- منتجات واردة: ${incomingItems.length}`
          })
          .eq('id', order.id);

        if (updateError) throw updateError;

        toast({
          title: '✅ تمت المعالجة بنجاح',
          description: `تم تحديث المخزون: ${result.outgoingProcessed} صادر، ${result.incomingProcessed} وارد`
        });

        onComplete?.();
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Error processing replacement:', error);
      toast({
        title: 'خطأ',
        description: 'فشل في معالجة الاستبدال',
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            تحديد المنتجات - حالة الاستبدال
          </DialogTitle>
          <DialogDescription>
            حدد المنتجات التي تم إرسالها للزبون والمنتجات التي تم استلامها منه
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <Info className="w-4 h-4" />
          <AlertDescription className="text-sm">
            هذا الطلب بحالة "تم الإرجاع للتاجر" (17). يجب تحديد المنتجات لتحديث المخزون بشكل صحيح.
          </AlertDescription>
        </Alert>

        {loading ? (
          <div className="py-8 text-center">جاري التحميل...</div>
        ) : (
          <div className="space-y-4">
            {orderItems.map((item) => (
              <div key={item.id} className="p-4 border rounded-lg bg-secondary/20">
                <div className="flex items-start gap-3 mb-3">
                  <img 
                    src={item.image} 
                    alt={item.name} 
                    className="w-16 h-16 object-cover rounded-md"
                  />
                  <div className="flex-1">
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.color} - {item.size} | {item.quantity}× | {item.price.toLocaleString()} د.ع
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 p-2 border rounded-md bg-background">
                    <Checkbox
                      id={`outgoing-${item.id}`}
                      checked={outgoingItems.includes(item.id)}
                      onCheckedChange={() => handleOutgoingToggle(item.id)}
                    />
                    <Label 
                      htmlFor={`outgoing-${item.id}`}
                      className="flex items-center gap-1 cursor-pointer text-sm"
                    >
                      <ArrowRight className="w-4 h-4 text-blue-600" />
                      <span>صادر للزبون</span>
                    </Label>
                  </div>

                  <div className="flex items-center gap-2 p-2 border rounded-md bg-background">
                    <Checkbox
                      id={`incoming-${item.id}`}
                      checked={incomingItems.includes(item.id)}
                      onCheckedChange={() => handleIncomingToggle(item.id)}
                    />
                    <Label 
                      htmlFor={`incoming-${item.id}`}
                      className="flex items-center gap-1 cursor-pointer text-sm"
                    >
                      <ArrowLeft className="w-4 h-4 text-green-600" />
                      <span>وارد من الزبون</span>
                    </Label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>
            إلغاء
          </Button>
          <Button onClick={handleSubmit} disabled={loading || processing}>
            {processing ? 'جاري المعالجة...' : 'تأكيد وتحديث المخزون'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReplacementProductSelector;
