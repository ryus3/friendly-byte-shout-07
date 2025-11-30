import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import { QuickOrderContent } from '@/components/quick-order/QuickOrderContent';
import { useCitiesCache } from '@/hooks/useCitiesCache';

const EditOrderPage = () => {
  const { trackingNumber } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState(null);
  const [editData, setEditData] = useState(null);
  const { getCityById, getRegionById, preloadRegions, isCacheLoaded } = useCitiesCache();

  useEffect(() => {
    if (!trackingNumber) {
      navigate('/my-orders');
      return;
    }
    fetchOrderData();
  }, [trackingNumber]);

  useEffect(() => {
    if (order && isCacheLoaded) {
      convertOrderToEditData();
    }
  }, [order, isCacheLoaded]);

  const fetchOrderData = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            product_id,
            variant_id,
            quantity,
            unit_price,
            total_price,
            products (
              id,
              name,
              images
            ),
            product_variants (
              id,
              sku,
              colors (
                id,
                name,
                hex_code
              ),
              sizes (
                id,
                name
              )
            )
          )
        `)
        .eq('tracking_number', trackingNumber)
        .single();

      if (error) throw error;

      if (!data) {
        toast({
          title: "خطأ",
          description: "لم يتم العثور على الطلب",
          variant: "destructive"
        });
        navigate('/my-orders');
        return;
      }

      // التحقق من إمكانية التعديل
      if (data.status !== 'pending') {
        toast({
          title: "غير مسموح",
          description: "لا يمكن تعديل الطلب بعد تجهيزه",
          variant: "destructive"
        });
        navigate('/my-orders');
        return;
      }

      setOrder(data);
    } catch (error) {
      console.error('Error fetching order:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تحميل بيانات الطلب",
        variant: "destructive"
      });
      navigate('/my-orders');
    } finally {
      setLoading(false);
    }
  };

  const convertOrderToEditData = async () => {
    if (!order || !isCacheLoaded) return;

    try {
      // تحويل order_items إلى items
      const items = (order.order_items || []).map(item => ({
        productId: item.product_id,
        product_id: item.product_id,
        variantId: item.variant_id,
        variant_id: item.variant_id,
        productname: item.products?.name || 'منتج',
        product_name: item.products?.name || 'منتج',
        quantity: item.quantity,
        price: item.unit_price,
        unit_price: item.unit_price,
        total_price: item.total_price,
        color: item.product_variants?.colors?.name || '',
        size: item.product_variants?.sizes?.name || '',
        color_hex: item.product_variants?.colors?.hex_code || null,
        images: item.products?.images || []
      }));

      // الحصول على معلومات المدينة والمنطقة
      let cityData = null;
      let regionData = null;

      if (order.city_id) {
        cityData = getCityById(order.city_id);
      }

      if (order.region_id) {
        regionData = getRegionById(order.region_id);
      }

      // إذا كانت البيانات موجودة، قم بتحميل المناطق مسبقاً
      if (cityData) {
        await preloadRegions(cityData.alwaseet_id);
      }

      const data = {
        orderId: order.id,
        customerName: order.customer_name || '',
        phone: order.customer_phone || '',
        phone2: order.customer_phone2 || '',
        cityId: order.city_id || null,
        cityName: cityData?.name || order.customer_city || '',
        regionId: order.region_id || null,
        regionName: regionData?.name || order.customer_province || '',
        address: order.customer_address || '',
        items: items,
        totalAmount: order.total_amount || 0,
        deliveryFee: order.delivery_fee || 0,
        finalAmount: order.final_amount || 0,
        packageSize: order.package_size || 'medium',
        orderType: order.order_type || 'sale',
        discount: order.discount || 0,
        priceAdjustment: order.price_adjustment || 0,
        notes: order.notes || '',
        deliveryPartner: order.delivery_partner || 'alwaseet',
        trackingNumber: order.tracking_number
      };

      setEditData(data);
    } catch (error) {
      console.error('Error converting order data:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تحميل بيانات الطلب للتعديل",
        variant: "destructive"
      });
    }
  };

  const handleOrderUpdated = () => {
    toast({
      title: "تم التحديث بنجاح",
      description: "تم تحديث الطلب بنجاح",
      variant: "success"
    });
    navigate('/my-orders');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background/95 to-primary/5">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-lg text-muted-foreground">جاري تحميل بيانات الطلب...</p>
        </div>
      </div>
    );
  }

  if (!editData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">لا توجد بيانات</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <Card className="mb-6 border-2 border-primary/20 shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate('/my-orders')}
                  className="hover:bg-primary/10"
                >
                  <ArrowRight className="h-5 w-5" />
                </Button>
                <div>
                  <CardTitle className="text-2xl gradient-text">
                    تعديل الطلب
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    رقم التتبع: {trackingNumber}
                  </p>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Quick Order Content */}
        <QuickOrderContent
          aiOrderData={editData}
          isEditMode={true}
          onOrderCreated={handleOrderUpdated}
        />
      </div>
    </div>
  );
};

export default EditOrderPage;
