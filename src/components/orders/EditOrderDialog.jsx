import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useInventory } from '@/contexts/InventoryContext';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { editAlWaseetOrder } from '@/lib/alwaseet-api';
import { iraqiProvinces } from '@/lib/iraq-provinces';
import { normalizePhone, extractOrderPhone } from '@/utils/phoneUtils';
import ProductSelectionDialog from '@/components/products/ProductSelectionDialog';
import CustomerInfoForm from '@/components/quick-order/CustomerInfoForm';
import OrderDetailsForm from '@/components/quick-order/OrderDetailsForm';

const EditOrderDialog = ({ open, onOpenChange, order, onOrderUpdated }) => {
  const { updateOrder, settings, cart, clearCart, addToCart, removeFromCart, setCart, orders } = useInventory();
  const { user } = useAuth();
  const { 
    cities, 
    regions, 
    packageSizes, 
    fetchCities, 
    fetchRegions, 
    fetchPackageSizes, 
    waseetToken, 
    activePartner,
    setActivePartner 
  } = useAlWaseet();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [productSelectOpen, setProductSelectOpen] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [originalData, setOriginalData] = useState(null);
  const [loadingRegions, setLoadingRegions] = useState(false);
  
  // إدارة بيانات العميل والخصومات
  const [customerData, setCustomerData] = useState(null);
  const [discount, setDiscount] = useState(0);
  const [loyaltyDiscount, setLoyaltyDiscount] = useState(0);
  const [applyLoyaltyDiscount, setApplyLoyaltyDiscount] = useState(true);
  const [applyLoyaltyDelivery, setApplyLoyaltyDelivery] = useState(false);
  const [errors, setErrors] = useState({});

  const initialFormData = useMemo(() => ({
    name: '',
    phone: '',
    second_phone: '',
    city_id: '',
    region_id: '',
    city: '',
    region: '',
    address: '',
    notes: '',
    details: '',
    quantity: 1,
    price: 0,
    size: 'عادي',
    type: 'new',
    promocode: '',
    defaultCustomerName: user?.default_customer_name || ''
  }), [user?.default_customer_name]);
  
  const [formData, setFormData] = useState(initialFormData);

  // تحميل بيانات الطلب وتحويلها لسلة عند الفتح
  const initializeOrderEdit = useCallback(async () => {
    if (!order || !open) return;
    
    console.log('🔄 تهيئة تعديل الطلب:', order);
    
    // تحديد إمكانية التعديل
    const editable = order.status === 'pending' || order.status === 'في انتظار التأكيد';
    setCanEdit(editable);
    
    // تحديد شريك التوصيل
    const deliveryPartner = order.delivery_partner === 'الوسيط' ? 'alwaseet' : 'local';
    setActivePartner(deliveryPartner);
    
    // مسح السلة أولاً
    clearCart();
    
    // تحويل عناصر الطلب إلى سلة
    if (order.items && Array.isArray(order.items)) {
      console.log('📦 تحويل عناصر الطلب إلى سلة:', order.items);
      
      for (const item of order.items) {
        const product = {
          id: item.product_id,
          name: item.product_name || item.productname || 'منتج',
          images: item.images || []
        };
        
        const variant = {
          id: item.variant_id,
          sku: item.variant_id,
          price: item.unit_price || item.price || 0,
          cost_price: item.cost_price || 0,
          color: item.color || '',
          size: item.size || '',
          quantity: 1000, // مخزون افتراضي للتعديل
          reserved: 0
        };
        
        addToCart(product, variant, item.quantity || 1, false);
      }
    }
    
    // تعبئة بيانات النموذج
    const orderFormData = {
      name: order.customer_name || '',
      phone: order.customer_phone || '',
      second_phone: order.customer_phone2 || '',
      city: order.customer_city || '',
      region: order.customer_province || '',
      address: order.customer_address || '',
      notes: order.notes || '',
      details: order.items?.map(item => 
        `${item.productname || item.product_name || 'منتج'} × ${item.quantity || 1}`
      ).join(', ') || '',
      quantity: order.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 1,
      price: order.total_amount || 0,
      size: order.package_size || 'عادي',
      type: 'new',
      promocode: '',
      defaultCustomerName: user?.default_customer_name || ''
    };
    
    // إذا كان الطلب من الوسيط، جلب البيانات اللازمة
    if (deliveryPartner === 'alwaseet') {
      if (cities.length === 0) await fetchCities();
      if (packageSizes.length === 0) await fetchPackageSizes();
      
      // العثور على city_id و region_id
      const cityMatch = cities.find(c => 
        (c.name || c.name_ar || c.city_name || '').toLowerCase().includes(order.customer_city?.toLowerCase() || '')
      );
      
      if (cityMatch) {
        orderFormData.city_id = String(cityMatch.id);
        
        // جلب المناطق للمدينة
        setLoadingRegions(true);
        try {
          await fetchRegions(cityMatch.id);
          const regionMatch = regions.find(r => 
            (r.name || r.name_ar || r.region_name || '').toLowerCase().includes(order.customer_province?.toLowerCase() || '')
          );
          if (regionMatch) {
            orderFormData.region_id = String(regionMatch.id);
          }
        } catch (error) {
          console.error('خطأ في جلب المناطق:', error);
        } finally {
          setLoadingRegions(false);
        }
      }
      
      // العثور على package size
      const sizeMatch = packageSizes.find(size => 
        String(size.id) === String(order.package_size) || 
        size.name === order.package_size
      );
      if (sizeMatch) {
        orderFormData.size = String(sizeMatch.id);
      }
    }
    
    setFormData(orderFormData);
    setOriginalData(order);
    
    console.log('✅ تم تهيئة تعديل الطلب بنجاح');
  }, [order, open, clearCart, addToCart, cities, packageSizes, regions, fetchCities, fetchRegions, fetchPackageSizes, setActivePartner, user?.default_customer_name]);

  // جلب بيانات العميل للولاء عند إدخال رقم الهاتف
  useEffect(() => {
    const fetchCustomerData = async () => {
      if (!formData.phone || formData.phone.length < 4) {
        setCustomerData(null);
        setLoyaltyDiscount(0);
        setDiscount(0);
        return;
      }
      
      const normalizedPhone = normalizePhone(formData.phone);
      if (!normalizedPhone) {
        setCustomerData(null);
        setLoyaltyDiscount(0);
        setDiscount(0);
        return;
      }
      
      try {
        const completedOrders = orders?.filter(order => {
          const orderPhone = normalizePhone(extractOrderPhone(order));
          return orderPhone === normalizedPhone && 
                 order.status === 'completed' && 
                 order.receipt_received === true &&
                 order.created_by === user?.id;
        }) || [];
        
        const totalPoints = completedOrders.length * 250;
        const totalSpentExclDelivery = completedOrders.reduce((sum, order) => {
          const totalAmount = order.total_amount || 0;
          const deliveryFee = order.delivery_fee || 0;
          return sum + (totalAmount - deliveryFee);
        }, 0);
        
        let currentTier = { name_ar: 'برونزي', name_en: 'BRNZ', discount_percentage: 0, free_delivery: false };
        if (totalPoints >= 3000) {
          currentTier = { name_ar: 'ماسي', name_en: 'DIAM', discount_percentage: 15, free_delivery: true };
        } else if (totalPoints >= 1500) {
          currentTier = { name_ar: 'ذهبي', name_en: 'GOLD', discount_percentage: 10, free_delivery: true };
        } else if (totalPoints >= 750) {
          currentTier = { name_ar: 'فضي', name_en: 'SILV', discount_percentage: 5, free_delivery: false };
        }
        
        const customerInfo = {
          phone: normalizedPhone,
          total_points: totalPoints,
          total_spent_excl_delivery: totalSpentExclDelivery,
          total_orders: completedOrders.length,
          currentTier
        };
        
        setCustomerData(customerInfo);
        
        // حساب خصم الولاء
        const discountPercentage = currentTier.discount_percentage || 0;
        if (discountPercentage > 0) {
          const subtotal = Array.isArray(cart) ? cart.reduce((sum, item) => sum + (item.total || 0), 0) : 0;
          const rawDiscount = (subtotal * discountPercentage) / 100;
          const roundedDiscount = Math.round(rawDiscount / 500) * 500;
          setLoyaltyDiscount(roundedDiscount);
          setDiscount(roundedDiscount);
          setApplyLoyaltyDiscount(true);
        }
        
        if (currentTier.free_delivery) {
          setApplyLoyaltyDelivery(true);
        }
        
      } catch (error) {
        console.error('خطأ في جلب بيانات العميل:', error);
        setCustomerData(null);
        setLoyaltyDiscount(0);
        setDiscount(0);
      }
    };

    fetchCustomerData();
  }, [formData.phone, orders, user?.id, cart]);

  // تحديث بيانات النموذج عند تغيير السلة
  useEffect(() => {
    if (cart.length > 0) {
      const quantity = cart.reduce((sum, item) => sum + item.quantity, 0);
      const details = cart.map(item => `${item.productName} (${item.size}, ${item.color}) × ${item.quantity}`).join(', ');
      
      setFormData(prev => ({
        ...prev,
        quantity,
        details
      }));
    }
  }, [cart]);

  // تشغيل التهيئة عند فتح النافذة
  useEffect(() => {
    if (open && order) {
      initializeOrderEdit();
    }
  }, [open, order, initializeOrderEdit]);

  // حساب المجاميع
  const subtotal = cart.reduce((sum, item) => sum + (item.total || 0), 0);
  const deliveryFee = (applyLoyaltyDelivery && customerData?.currentTier?.free_delivery) ? 0 : (settings?.deliveryFee || 0);
  const total = Math.max(0, subtotal - discount);
  const finalTotal = total + deliveryFee;

  // معالجة تغيير الحقول
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleSelectChange = useCallback((name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // جلب المناطق عند تغيير المدينة في الوسيط
    if (name === 'city_id' && activePartner === 'alwaseet' && value) {
      setLoadingRegions(true);
      fetchRegions(value).finally(() => setLoadingRegions(false));
      setFormData(prev => ({ ...prev, region_id: '' }));
    }
  }, [activePartner, fetchRegions]);

  // معالجة الحفظ
  const handleSubmit = async () => {
    if (!canEdit) {
      toast({
        title: "غير مسموح",
        description: "لا يمكن تعديل هذا الطلب في حالته الحالية",
        variant: "destructive"
      });
      return;
    }

    if (cart.length === 0) {
      toast({
        title: "خطأ",
        description: "يجب إضافة منتج واحد على الأقل",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // تحضير بيانات الطلب المحدث
      const updatedOrderData = {
        ...order,
        customer_name: formData.name,
        customer_phone: formData.phone,
        customer_phone2: formData.second_phone,
        customer_city: activePartner === 'alwaseet' ? 
          (cities.find(c => String(c.id) === formData.city_id)?.name || formData.city) : 
          formData.city,
        customer_province: activePartner === 'alwaseet' ? 
          (regions.find(r => String(r.id) === formData.region_id)?.name || formData.region) : 
          formData.region,
        customer_address: formData.address,
        notes: formData.notes,
        total_amount: finalTotal,
        delivery_fee: deliveryFee,
        package_size: formData.size,
        items: cart.map(item => ({
          product_id: item.productId,
          variant_id: item.variantId,
          product_name: item.productName,
          quantity: item.quantity,
          unit_price: item.price,
          color: item.color,
          size: item.size
        }))
      };

      // تحديث في قاعدة البيانات المحلية
      await updateOrder(order.id, updatedOrderData);

      // تحديث في Al-Waseet إذا كان من الوسيط
      if (order.delivery_partner === 'الوسيط' && waseetToken) {
        try {
          const waseetData = {
            id: order.tracking_number,
            customer_name: formData.name,
            customer_phone: formData.phone,
            customer_phone2: formData.second_phone || '',
            city_id: formData.city_id,
            region_id: formData.region_id,
            address: formData.address,
            notes: formData.notes,
            size: formData.size,
            details: formData.details,
            quantity: formData.quantity,
            price: finalTotal
          };
          
          await editAlWaseetOrder(waseetData, waseetToken);
        } catch (waseetError) {
          console.error('خطأ في تحديث الطلب في الوسيط:', waseetError);
          toast({
            title: "تنبيه",
            description: "تم تحديث الطلب محلياً لكن فشل التحديث في الوسيط",
            variant: "destructive"
          });
        }
      }

      toast({
        title: "تم بنجاح",
        description: "تم تحديث الطلب بنجاح",
        variant: "success"
      });

      if (onOrderUpdated) {
        onOrderUpdated(updatedOrderData);
      }

      onOpenChange(false);
    } catch (error) {
      console.error('خطأ في تحديث الطلب:', error);
      toast({
        title: "خطأ",
        description: "فشل في تحديث الطلب",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // معالجة إغلاق النافذة
  const handleClose = () => {
    clearCart();
    setFormData(initialFormData);
    setCustomerData(null);
    setDiscount(0);
    setLoyaltyDiscount(0);
    setErrors({});
    onOpenChange(false);
  };

  // حقول خاصة بشريك التوصيل
  const partnerSpecificFields = () => {
    if (activePartner === 'alwaseet') {
      return (
        <>
          <div className="space-y-2">
            <label htmlFor="city_id">المدينة</label>
            <select
              id="city_id"
              name="city_id"
              value={formData.city_id}
              onChange={(e) => handleSelectChange('city_id', e.target.value)}
              className="w-full p-2 border rounded"
              required
            >
              <option value="">اختر المدينة</option>
              {cities.map(city => (
                <option key={city.id} value={city.id}>
                  {city.name || city.name_ar || city.city_name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="space-y-2">
            <label htmlFor="region_id">المنطقة</label>
            <select
              id="region_id"
              name="region_id"
              value={formData.region_id}
              onChange={(e) => handleSelectChange('region_id', e.target.value)}
              className="w-full p-2 border rounded"
              disabled={!formData.city_id || loadingRegions}
              required
            >
              <option value="">اختر المنطقة</option>
              {regions.map(region => (
                <option key={region.id} value={region.id}>
                  {region.name || region.name_ar || region.region_name}
                </option>
              ))}
            </select>
          </div>
        </>
      );
    } else {
      return (
        <>
          <div className="space-y-2">
            <label htmlFor="city">المحافظة</label>
            <select
              id="city"
              name="city"
              value={formData.city}
              onChange={(e) => handleSelectChange('city', e.target.value)}
              className="w-full p-2 border rounded"
              required
            >
              <option value="">اختر المحافظة</option>
              {iraqiProvinces.map(province => (
                <option key={province} value={province}>{province}</option>
              ))}
            </select>
          </div>
          
          <div className="space-y-2">
            <label htmlFor="region">المنطقة</label>
            <input
              id="region"
              name="region"
              value={formData.region}
              onChange={handleChange}
              className="w-full p-2 border rounded"
              placeholder="اسم المنطقة"
              required
            />
          </div>
        </>
      );
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تعديل الطلب {order?.order_number}</DialogTitle>
            <DialogDescription>
              {canEdit ? 
                "يمكنك تعديل تفاصيل الطلب والمنتجات. التغييرات ستطبق على النظام المحلي وشريك التوصيل." :
                "هذا الطلب في حالة لا تسمح بالتعديل. يمكنك فقط عرض التفاصيل."
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <CustomerInfoForm
              formData={formData}
              handleChange={handleChange}
              handleSelectChange={handleSelectChange}
              errors={errors}
              partnerSpecificFields={partnerSpecificFields}
              isSubmittingState={isSubmitting || !canEdit}
              isDeliveryPartnerSelected={true}
              customerData={customerData}
              loyaltyDiscount={loyaltyDiscount}
            />

            <OrderDetailsForm
              formData={formData}
              handleChange={handleChange}
              handleSelectChange={handleSelectChange}
              setProductSelectOpen={setProductSelectOpen}
              isSubmittingState={isSubmitting || !canEdit}
              isDeliveryPartnerSelected={true}
              packageSizes={packageSizes}
              loadingPackageSizes={false}
              activePartner={activePartner}
              dataFetchError={false}
              settings={settings}
              discount={discount}
              setDiscount={setDiscount}
              subtotal={subtotal}
              total={total}
              customerData={customerData}
              loyaltyDiscount={loyaltyDiscount}
              applyLoyaltyDiscount={applyLoyaltyDiscount}
              onToggleLoyaltyDiscount={() => {
                const newValue = !applyLoyaltyDiscount;
                setApplyLoyaltyDiscount(newValue);
                if (newValue) {
                  setDiscount(loyaltyDiscount + Math.max(0, discount - loyaltyDiscount));
                } else {
                  setDiscount(Math.max(0, discount - loyaltyDiscount));
                }
              }}
              applyLoyaltyDelivery={applyLoyaltyDelivery}
              onToggleLoyaltyDelivery={() => setApplyLoyaltyDelivery(!applyLoyaltyDelivery)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              إلغاء
            </Button>
            {canEdit && (
              <Button 
                type="button" 
                onClick={handleSubmit} 
                disabled={isSubmitting || cart.length === 0}
              >
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                حفظ التغييرات
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProductSelectionDialog
        open={productSelectOpen}
        onOpenChange={setProductSelectOpen}
        onProductsSelected={() => setProductSelectOpen(false)}
      />
    </>
  );
};

export default EditOrderDialog;