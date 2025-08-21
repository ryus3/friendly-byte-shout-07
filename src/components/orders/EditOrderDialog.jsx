import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Loader2, Save, X } from 'lucide-react';
import { useInventory } from '@/contexts/InventoryContext';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { editAlWaseetOrder } from '@/lib/alwaseet-api';
import { normalizePhone, extractOrderPhone } from '@/utils/phoneUtils';
import CustomerInfoForm from '@/components/quick-order/CustomerInfoForm';
import OrderDetailsForm from '@/components/quick-order/OrderDetailsForm';
import ProductSelectionDialog from '@/components/products/ProductSelectionDialog';

const EditOrderDialog = ({ open, onOpenChange, order, onOrderUpdated }) => {
  const { products, updateOrder, settings, cart, clearCart, addToCart, orders } = useInventory();
  const { user } = useAuth();
  const { isLoggedIn: isWaseetLoggedIn, token: waseetToken, activePartner, setActivePartner } = useAlWaseet();
  
  const [isLoading, setIsLoading] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [productSelectOpen, setProductSelectOpen] = useState(false);
  const [originalOrderData, setOriginalOrderData] = useState(null);
  
  // نفس state management كما في QuickOrderContent
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
    type: 'edit',
    promocode: '',
    defaultCustomerName: ''
  }), []);
  
  const [formData, setFormData] = useState(initialFormData);
  const [errors, setErrors] = useState({});
  const [discount, setDiscount] = useState(0);
  const [customerData, setCustomerData] = useState(null);
  const [loyaltyDiscount, setLoyaltyDiscount] = useState(0);
  const [applyLoyaltyDiscount, setApplyLoyaltyDiscount] = useState(false);
  const [applyLoyaltyDelivery, setApplyLoyaltyDelivery] = useState(false);

  // حساب المجاميع - نفس منطق QuickOrderContent
  const subtotal = useMemo(() => {
    return Array.isArray(cart) ? cart.reduce((sum, item) => sum + (item.total || 0), 0) : 0;
  }, [cart]);

  const deliveryFee = useMemo(() => {
    if (applyLoyaltyDelivery && customerData?.currentTier?.free_delivery) {
      return 0;
    }
    return settings?.deliveryFee || 0;
  }, [applyLoyaltyDelivery, customerData, settings]);

  const finalTotal = useMemo(() => {
    return Math.max(0, subtotal + deliveryFee - discount);
  }, [subtotal, deliveryFee, discount]);

  // تحديث حقل السعر النهائي في النموذج
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      price: finalTotal,
      quantity: cart.length > 0 ? cart.reduce((sum, item) => sum + item.quantity, 0) : 1,
      details: cart.length > 0 ? cart.map(item => 
        `${item.productName} (${item.size}, ${item.color}) × ${item.quantity}`
      ).join(' + ') : ''
    }));
  }, [cart, finalTotal]);

  // جلب بيانات العميل عند إدخال رقم الهاتف - نفس منطق QuickOrderContent
  useEffect(() => {
    const fetchCustomerData = async () => {
      if (!formData.phone || formData.phone.length < 4) {
        setCustomerData(null);
        setLoyaltyDiscount(0);
        return;
      }
      
      const normalizedPhone = normalizePhone(formData.phone);
      if (!normalizedPhone) {
        setCustomerData(null);
        setLoyaltyDiscount(0);
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
        const totalSpent = completedOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
        
        // تحديد المستوى
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
          total_spent: totalSpent,
          total_spent_excl_delivery: totalSpentExclDelivery,
          total_orders: completedOrders.length,
          currentTier,
          first_order_date: completedOrders[0]?.created_at,
          last_order_date: completedOrders[completedOrders.length - 1]?.created_at
        };
        
        setCustomerData(customerInfo);
        
        // حساب خصم الولاء
        const discountPercentage = currentTier.discount_percentage || 0;
        if (discountPercentage > 0) {
          const rawDiscount = (subtotal * discountPercentage) / 100;
          const roundedDiscount = Math.round(rawDiscount / 500) * 500;
          setLoyaltyDiscount(roundedDiscount);
        } else {
          setLoyaltyDiscount(0);
        }
        
        if (currentTier.free_delivery) {
          setApplyLoyaltyDelivery(true);
        }
        
      } catch (error) {
        console.error('خطأ في حساب بيانات العميل:', error);
        setCustomerData(null);
        setLoyaltyDiscount(0);
      }
    };

    fetchCustomerData();
  }, [formData.phone, orders, user?.id, subtotal]);

  // تحديث الخصم عند تغيير السلة
  useEffect(() => {
    if (customerData?.currentTier?.discount_percentage && cart.length > 0) {
      const discountPercentage = customerData.currentTier.discount_percentage;
      const baseDiscountAmount = (subtotal * discountPercentage) / 100;
      const roundedDiscountAmount = Math.round(baseDiscountAmount / 500) * 500;
      
      setLoyaltyDiscount(roundedDiscountAmount);
      
      if (applyLoyaltyDiscount) {
        const manualDiscount = Math.max(0, discount - loyaltyDiscount);
        setDiscount(roundedDiscountAmount + manualDiscount);
      }
    } else if (cart.length === 0) {
      setLoyaltyDiscount(0);
      setDiscount(0);
      setApplyLoyaltyDiscount(false);
      setApplyLoyaltyDelivery(false);
    }
  }, [cart, customerData, applyLoyaltyDiscount, loyaltyDiscount, discount, subtotal]);

  // تهيئة النموذج عند فتح النافذة
  const initializeForm = useCallback(async () => {
    if (!order || !open) return;
    
    console.log('🔄 تهيئة نموذج تعديل الطلب:', order);
    
    // تحديد قابلية التعديل
    const editable = order.status === 'pending' || order.status === 'في انتظار التأكيد';
    setCanEdit(editable);
    
    // مسح السلة أولاً
    clearCart();
    
    // حفظ البيانات الأصلية
    setOriginalOrderData(order);
    
    // ملء النموذج
    setFormData({
      name: order.customer_name || '',
      phone: order.customer_phone || '',
      second_phone: order.customer_phone2 || '',
      city_id: order.city_id || '',
      region_id: order.region_id || '',
      city: order.customer_city || order.customer_address?.includes('بغداد') ? 'بغداد' : '',
      region: order.customer_province || '',
      address: order.customer_address || '',
      notes: order.notes || '',
      details: '',
      quantity: 1,
      price: order.total_amount || 0,
      size: order.package_size || 'عادي',
      type: 'edit',
      promocode: order.promocode || '',
      defaultCustomerName: order.customer_name || ''
    });

    // تحويل منتجات الطلب إلى عناصر السلة
    if (order.items && Array.isArray(order.items)) {
      for (const item of order.items) {
        // البحث عن المنتج في قاعدة البيانات
        const product = products?.find(p => p.id === item.product_id);
        if (product) {
          const variant = product.variants?.find(v => v.id === item.variant_id);
          if (variant) {
            addToCart(product, variant, item.quantity || 1, false);
          } else {
            // إنشاء variant وهمي للعنصر المفقود
            const fallbackVariant = {
              id: item.variant_id || `fallback-${Date.now()}`,
              sku: item.variant_id || `fallback-${Date.now()}`,
              price: item.unit_price || item.price || 0,
              cost_price: item.cost_price || 0,
              color: item.color || '',
              size: item.size || '',
              quantity: 100,
              reserved: 0
            };
            addToCart(product, fallbackVariant, item.quantity || 1, false);
          }
        } else {
          // إنشاء منتج وهمي للعنصر المفقود
          const fallbackProduct = {
            id: item.product_id || `fallback-product-${Date.now()}`,
            name: item.product_name || item.productname || 'منتج محذوف',
            images: []
          };
          const fallbackVariant = {
            id: item.variant_id || `fallback-variant-${Date.now()}`,
            sku: item.variant_id || `fallback-variant-${Date.now()}`,
            price: item.unit_price || item.price || 0,
            cost_price: item.cost_price || 0,
            color: item.color || '',
            size: item.size || '',
            quantity: 100,
            reserved: 0
          };
          addToCart(fallbackProduct, fallbackVariant, item.quantity || 1, false);
        }
      }
    }

    // تعيين شريك التوصيل
    if (order.delivery_partner === 'الوسيط') {
      setActivePartner('alwaseet');
    } else {
      setActivePartner('local');
    }

    // تعيين الخصومات إذا كانت موجودة
    if (order.discount) {
      setDiscount(order.discount);
    }

  }, [order, open, clearCart, addToCart, products, setActivePartner]);

  useEffect(() => {
    if (open && order) {
      initializeForm();
    }
  }, [open, order, initializeForm]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // مسح الأخطاء عند تعديل الحقول
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  }, [errors]);

  const handleSelectChange = useCallback((name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  }, [errors]);

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) newErrors.name = 'اسم العميل مطلوب';
    if (!formData.phone.trim()) newErrors.phone = 'رقم الهاتف مطلوب';
    if (!formData.address.trim()) newErrors.address = 'العنوان مطلوب';
    
    if (activePartner === 'alwaseet') {
      if (!formData.city_id) newErrors.city_id = 'المدينة مطلوبة';
      if (!formData.region_id) newErrors.region_id = 'المنطقة مطلوبة';
      if (!formData.size) newErrors.size = 'حجم الطلب مطلوب';
    } else {
      if (!formData.city.trim()) newErrors.city = 'المدينة مطلوبة';
      if (!formData.region.trim()) newErrors.region = 'المنطقة مطلوبة';
    }
    
    if (cart.length === 0) {
      newErrors.cart = 'يجب إضافة منتج واحد على الأقل';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!canEdit) {
      toast({
        title: "غير مسموح",
        description: "لا يمكن تعديل هذا الطلب",
        variant: "destructive"
      });
      return;
    }

    if (!validateForm()) {
      toast({
        title: "يرجى تصحيح الأخطاء",
        description: "تحقق من البيانات المطلوبة",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      // تحضير بيانات الطلب المحدث
      const updatedOrderData = {
        customer_name: formData.name.trim(),
        customer_phone: formData.phone.trim(),
        customer_phone2: formData.second_phone?.trim() || '',
        customer_city: activePartner === 'alwaseet' ? '' : formData.city.trim(),
        customer_province: activePartner === 'alwaseet' ? '' : formData.region.trim(),
        customer_address: formData.address.trim(),
        notes: formData.notes?.trim() || '',
        total_amount: finalTotal,
        delivery_fee: deliveryFee,
        discount: discount,
        promocode: formData.promocode?.trim() || '',
        delivery_partner: activePartner === 'alwaseet' ? 'الوسيط' : 'محلي',
        city_id: activePartner === 'alwaseet' ? formData.city_id : null,
        region_id: activePartner === 'alwaseet' ? formData.region_id : null,
        package_size: activePartner === 'alwaseet' ? formData.size : null,
        items: cart.map(item => ({
          product_id: item.productId,
          variant_id: item.variantId,
          quantity: item.quantity,
          unit_price: item.price,
          product_name: item.productName,
          color: item.color,
          size: item.size
        }))
      };

      // تحديث الطلب في قاعدة البيانات
      await updateOrder(order.id, updatedOrderData);

      // إذا كان طلب الوسيط، تحديثه في API الوسيط أيضاً
      if (order.delivery_partner === 'الوسيط' && order.tracking_number && waseetToken) {
        try {
          await editAlWaseetOrder(order.tracking_number, {
            customerName: formData.name.trim(),
            customerPhone: formData.phone.trim(),
            cityId: formData.city_id,
            regionId: formData.region_id,
            address: formData.address.trim(),
            notes: formData.notes?.trim() || '',
            packageSize: formData.size,
            quantity: cart.reduce((sum, item) => sum + item.quantity, 0),
            price: finalTotal - deliveryFee
          }, waseetToken);
        } catch (waseetError) {
          console.error('فشل تحديث طلب الوسيط:', waseetError);
          // لا نوقف العملية، فقط نسجل الخطأ
        }
      }

      toast({
        title: "تم التحديث بنجاح",
        description: "تم تحديث بيانات الطلب بنجاح",
        variant: "success"
      });

      // مسح السلة وإغلاق النافذة
      clearCart();
      onOpenChange(false);
      
      if (onOrderUpdated) {
        onOrderUpdated();
      }

    } catch (error) {
      console.error('خطأ في تحديث الطلب:', error);
      toast({
        title: "خطأ في التحديث",
        description: error.message || "حدث خطأ أثناء تحديث الطلب",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleLoyaltyDiscount = useCallback((enabled) => {
    setApplyLoyaltyDiscount(enabled);
    if (enabled) {
      setDiscount(prev => prev + loyaltyDiscount);
    } else {
      setDiscount(prev => Math.max(0, prev - loyaltyDiscount));
    }
  }, [loyaltyDiscount]);

  const handleToggleLoyaltyDelivery = useCallback((enabled) => {
    setApplyLoyaltyDelivery(enabled);
  }, []);

  const handleDiscountChange = useCallback((newDiscount) => {
    setDiscount(newDiscount);
  }, []);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="relative">
            <DialogTitle className="text-xl font-bold">
              تعديل الطلب #{order?.id}
            </DialogTitle>
            <Button
              onClick={() => onOpenChange(false)}
              variant="ghost"
              size="sm"
              className="absolute left-0 top-0 h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>

          {!canEdit && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
              <p className="text-amber-800 dark:text-amber-200 text-sm">
                ⚠️ لا يمكن تعديل هذا الطلب لأن حالته: {order?.status}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* معلومات العميل */}
              <CustomerInfoForm
                formData={formData}
                handleChange={handleChange}
                handleSelectChange={handleSelectChange}
                errors={errors}
                customerData={customerData}
                loyaltyDiscount={loyaltyDiscount}
                applyLoyaltyDiscount={applyLoyaltyDiscount}
                applyLoyaltyDelivery={applyLoyaltyDelivery}
                onToggleLoyaltyDiscount={handleToggleLoyaltyDiscount}
                onToggleLoyaltyDelivery={handleToggleLoyaltyDelivery}
                isDeliveryPartnerSelected={true}
                isSubmittingState={isLoading}
                partnerSpecificFields={null}
              />

              {/* تفاصيل الطلب */}
              <OrderDetailsForm
                formData={formData}
                handleChange={handleChange}
                handleSelectChange={handleSelectChange}
                errors={errors}
                subtotal={subtotal}
                total={finalTotal}
                discount={discount}
                onDiscountChange={handleDiscountChange}
                loyaltyDiscount={loyaltyDiscount}
                applyLoyaltyDiscount={applyLoyaltyDiscount}
                applyLoyaltyDelivery={applyLoyaltyDelivery}
                onToggleLoyaltyDiscount={handleToggleLoyaltyDiscount}
                onToggleLoyaltyDelivery={handleToggleLoyaltyDelivery}
                isDeliveryPartnerSelected={true}
                isSubmittingState={isLoading}
                packageSizes={[]}
                activePartner={activePartner}
              />
            </div>

            {/* أزرار الإجراءات */}
            <div className="flex justify-between items-center pt-4 border-t">
              <Button
                type="button"
                onClick={() => setProductSelectOpen(true)}
                variant="outline"
                disabled={!canEdit || isLoading}
              >
                إضافة منتجات
              </Button>

              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  variant="outline"
                  disabled={isLoading}
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  disabled={!canEdit || isLoading || cart.length === 0}
                  className="min-w-[120px]"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      جاري الحفظ...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      حفظ التغييرات
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* نافذة اختيار المنتجات */}
      <ProductSelectionDialog
        open={productSelectOpen}
        onOpenChange={setProductSelectOpen}
        onSelectProducts={() => {
          setProductSelectOpen(false);
          toast({
            title: "تم إضافة المنتجات",
            description: "تم إضافة المنتجات المحددة للطلب",
            variant: "success"
          });
        }}
      />
    </>
  );
};

export default EditOrderDialog;