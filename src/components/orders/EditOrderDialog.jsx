import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Package, Save, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { getCities, getRegionsByCity, getPackageSizes } from '@/lib/alwaseet-api';
import { iraqiProvinces } from '@/lib/iraq-provinces';
import ProductSelectionDialog from '@/components/products/ProductSelectionDialog';
import OrderDetailsForm from '@/components/quick-order/OrderDetailsForm';
import CustomerInfoForm from '@/components/quick-order/CustomerInfoForm';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import SearchableSelectFixed from '@/components/ui/searchable-select-fixed';
import { normalizePhone, extractOrderPhone } from '@/utils/phoneUtils';

const EditOrderDialog = ({ open, onOpenChange, order, onOrderUpdated }) => {
  const { isLoggedIn: isWaseetLoggedIn, token: waseetToken, activePartner, setActivePartner, fetchToken, waseetUser } = useAlWaseet();
  const { products, updateOrder, settings, cart, clearCart, addToCart, removeFromCart, orders } = useInventory();
  const { user, hasPermission } = useAuth();
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    second_phone: '',
    city_id: '',
    region_id: '',
    city: '',
    region: '',
    address: '',
    notes: '',
    size: 'عادي',
    quantity: 1,
    price: 0,
    details: '',
    type: 'new',
    promocode: '',
    delivery_fee: 0
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [customerData, setCustomerData] = useState(null);
  const [loyaltyDiscount, setLoyaltyDiscount] = useState(0);
  const [applyLoyaltyDiscount, setApplyLoyaltyDiscount] = useState(true);
  const [applyLoyaltyDelivery, setApplyLoyaltyDelivery] = useState(false);
  const [errors, setErrors] = useState({});
  
  // States for cities and regions - نفس QuickOrderContent
  const [cities, setCities] = useState([]);
  const [regions, setRegions] = useState([]);
  const [packageSizes, setPackageSizes] = useState([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingRegions, setLoadingRegions] = useState(false);
  const [loadingPackageSizes, setLoadingPackageSizes] = useState(false);
  const [dataFetchError, setDataFetchError] = useState(false);

  // جلب البيانات عند تغيير شريك التوصيل - نفس QuickOrderContent
  useEffect(() => {
    const loadInitialData = async () => {
      console.log('📡 EditOrderDialog - بدء جلب البيانات الأساسية:', {
        activePartner,
        hasToken: !!waseetToken,
        open
      });
      
      if (activePartner === 'alwaseet' && waseetToken) {
        // جلب المدن وأحجام الطلب
        try {
          setLoadingCities(true);
          setLoadingPackageSizes(true);
          
          console.log('🌐 EditOrderDialog - جلب مدن ووأحجام Al-Waseet...');
          const citiesResponse = await getCities(waseetToken);
          const packageSizesResponse = await getPackageSizes(waseetToken);
          
          if (citiesResponse.success) {
            setCities(citiesResponse.data || []);
            console.log('🏙️ EditOrderDialog - تم جلب المدن:', citiesResponse.data?.length || 0);
          }
          
          if (packageSizesResponse.success) {
            setPackageSizes(packageSizesResponse.data || []);
            console.log('📦 EditOrderDialog - تم جلب الأحجام:', packageSizesResponse.data?.length || 0);
          }
          
        } catch (error) {
          console.error('❌ EditOrderDialog - خطأ في جلب البيانات الأولية:', error);
          setDataFetchError(true);
        } finally {
          setLoadingCities(false);
          setLoadingPackageSizes(false);
        }
      } else if (activePartner === 'local') {
        // للشريك المحلي: استخدم محافظات العراق وأحجام افتراضية
        console.log('🇮🇶 EditOrderDialog - استخدام البيانات المحلية...');
        setCities(iraqiProvinces.map(p => ({ id: p.id, name: p.name })));
        setPackageSizes([
          { id: 'small', name: 'صغير' },
          { id: 'medium', name: 'عادي' },
          { id: 'large', name: 'كبير' }
        ]);
        console.log('✅ EditOrderDialog - تم تحميل البيانات المحلية');
      }
    };

    if (open) {
      loadInitialData();
    }
  }, [activePartner, waseetToken, open]);

  // جلب بيانات العميل عند إدخال رقم الهاتف - نظام موحد من QuickOrderContent
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
        // حساب النقاط من الطلبات المكتملة
        const completedOrders = orders?.filter(order => {
          const orderPhone = normalizePhone(extractOrderPhone(order));
          return orderPhone === normalizedPhone && 
                 order.status === 'completed' && 
                 order.receipt_received === true &&
                 order.created_by === user?.id;
        }) || [];
        
        const totalPoints = completedOrders.length * 250;
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
          setApplyLoyaltyDiscount(true);
          setDiscount(roundedDiscount);
        } else {
          setLoyaltyDiscount(0);
          setApplyLoyaltyDiscount(false);
          setDiscount(0);
        }
        
        if (currentTier.free_delivery) {
          setApplyLoyaltyDelivery(true);
        } else {
          setApplyLoyaltyDelivery(false);
        }
        
      } catch (error) {
        console.error('خطأ في حساب بيانات العميل:', error);
        setCustomerData(null);
        setLoyaltyDiscount(0);
        setDiscount(0);
      }
    };

    fetchCustomerData();
  }, [formData.phone, orders, user?.id, cart]);

  // تهيئة النموذج عند فتح النافذة - إصلاح شامل مع تطبيق منطق QuickOrderContent
  const initializeForm = useCallback(async () => {
    if (!order || !open) return;
    
    console.log('🔄 EditOrderDialog - بدء تهيئة نموذج تعديل الطلب:', {
      orderId: order.id,
      orderNumber: order.order_number,
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      itemsCount: order.items?.length || 0,
      totalAmount: order.total_amount
    });
    
    // تحديد ما إذا كان يمكن تعديل الطلب
    const editable = order.status === 'pending' || order.status === 'في انتظار التأكيد';
    setCanEdit(editable);
    
    // تحضير المنتجات المحددة من عناصر الطلب وإضافتها للسلة
    if (order.items && Array.isArray(order.items)) {
      clearCart(); // مسح السلة أولاً
      
      // إضافة المنتجات للسلة
      order.items.forEach(item => {
        const cartItem = {
          id: `${item.product_id}-${item.variant_id}`,
          productId: item.product_id,
          variantId: item.variant_id,
          productName: item.product_name || item.productname || 'منتج',
          size: item.size || '',
          color: item.color || '',
          price: item.unit_price || item.price || 0,
          quantity: item.quantity || 1,
          total: (item.unit_price || item.price || 0) * (item.quantity || 1),
          image: item.image || '/placeholder.svg',
          barcode: item.barcode || '',
          sku: item.sku || ''
        };
        addToCart(null, cartItem, cartItem.quantity, false);
      });
      console.log('📦 EditOrderDialog - المنتجات المحملة للسلة:', {
        originalItems: order.items,
        cartAfterLoad: cart
      });
    } else {
      console.log('❌ EditOrderDialog - لا توجد منتجات في الطلب');
    }
    
    // ملء النموذج بالبيانات
    const initialFormData = {
      name: order.customer_name || '',
      phone: order.customer_phone || '',
      second_phone: order.customer_phone2 || '',
      city_id: '',
      region_id: '',
      city: order.customer_city || '',
      region: order.customer_province || '',
      address: order.customer_address || '',
      notes: order.notes || '',
      size: 'عادي',
      quantity: order.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 1,
      price: order.total_amount || 0,
      details: order.items?.map(item => 
        `${item.productname || item.product_name || 'منتج'} - ${item.color || ''} - ${item.size || ''} × ${item.quantity || 1}`
      ).join(', ') || '',
      type: 'new',
      promocode: '',
      delivery_fee: order.delivery_fee || settings?.deliveryFee || 0
    };
    
    setFormData(initialFormData);
    console.log('📝 EditOrderDialog - تم تعبئة النموذج بالبيانات:', {
      formData: initialFormData,
      canEdit: editable,
      cartLength: cart?.length || 0
    });
    
  }, [order, open, clearCart, addToCart, settings]);

  // تهيئة النموذج عند تغيير الطلب أو فتح النافذة
  useEffect(() => {
    initializeForm();
  }, [initializeForm]);

  // إضافة useEffect لتحديث البيانات المحسوبة تلقائياً
  useEffect(() => {
    if (cart.length > 0) {
      const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
      const detailsText = cart.map(item => 
        `${item.productName} - ${item.color} - ${item.size} × ${item.quantity}`
      ).join(', ');
      
      setFormData(prev => ({
        ...prev,
        quantity: totalQuantity,
        details: detailsText
      }));
    }
  }, [cart]);

  // حساب المجاميع
  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const total = subtotal - discount;

  // معالجة تغيير القيم
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // معالجة تغيير القوائم المنسدلة - نفس QuickOrderContent
  const handleSelectChange = async (value, name) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // جلب المناطق عند تغيير المدينة
    if (name === 'city_id' && value && activePartner === 'alwaseet') {
      setLoadingRegions(true);
      try {
        const response = await getRegionsByCity(waseetToken, value);
        if (response.success) {
          setRegions(response.data || []);
          // مسح المنطقة المحددة
          setFormData(prev => ({ ...prev, region_id: '', region: '' }));
        }
      } catch (error) {
        console.error('خطأ في جلب المناطق:', error);
        toast({
          title: "خطأ",
          description: "فشل في جلب المناطق",
          variant: "destructive"
        });
      } finally {
        setLoadingRegions(false);
      }
    }
  };

  // دالة partnerSpecificFields من QuickOrderContent
  const partnerSpecificFields = () => {
    if (activePartner === 'alwaseet') {
      return (
        <>
          <div>
            <Label htmlFor="city_id">المدينة *</Label>
            <SearchableSelectFixed
              value={formData.city_id}
              onValueChange={(value) => handleSelectChange(value, 'city_id')}
              options={cities.map(city => ({ value: city.id, label: city.name }))}
              placeholder={loadingCities ? "جاري التحميل..." : "اختر المدينة"}
              searchPlaceholder="البحث في المدن..."
              emptyText="لا توجد مدن"
              disabled={!canEdit || isLoading || loadingCities}
              className="w-full"
            />
            {errors.city_id && <p className="text-sm text-red-500 mt-1">{errors.city_id}</p>}
          </div>
          <div>
            <Label htmlFor="region_id">المنطقة *</Label>
            <SearchableSelectFixed
              value={formData.region_id}
              onValueChange={(value) => handleSelectChange(value, 'region_id')}
              options={regions.map(region => ({ value: region.id, label: region.name }))}
              placeholder={loadingRegions ? "جاري التحميل..." : formData.city_id ? "اختر المنطقة" : "اختر المدينة أولاً"}
              searchPlaceholder="البحث في المناطق..."
              emptyText="لا توجد مناطق"
              disabled={!canEdit || isLoading || loadingRegions || !formData.city_id}
              className="w-full"
            />
            {errors.region_id && <p className="text-sm text-red-500 mt-1">{errors.region_id}</p>}
          </div>
        </>
      );
    } else {
      return (
        <>
          <div>
            <Label htmlFor="city">المحافظة *</Label>
            <SearchableSelectFixed
              value={formData.city}
              onValueChange={(value) => handleSelectChange(value, 'city')}
              options={iraqiProvinces.map(province => ({ value: province.name, label: province.name }))}
              placeholder="اختر المحافظة"
              searchPlaceholder="البحث في المحافظات..."
              emptyText="لا توجد محافظات"
              disabled={!canEdit || isLoading}
              className="w-full"
            />
            {errors.city && <p className="text-sm text-red-500 mt-1">{errors.city}</p>}
          </div>
          <div>
            <Label htmlFor="region">المنطقة *</Label>
            <SearchableSelectFixed
              value={formData.region}
              onValueChange={(value) => handleSelectChange(value, 'region')}
              options={formData.city ? 
                iraqiProvinces.find(p => p.name === formData.city)?.regions?.map(region => ({ 
                  value: region, 
                  label: region 
                })) || [] : []
              }
              placeholder={formData.city ? "اختر المنطقة" : "اختر المحافظة أولاً"}
              searchPlaceholder="البحث في المناطق..."
              emptyText="لا توجد مناطق"
              disabled={!canEdit || isLoading || !formData.city}
              className="w-full"
            />
            {errors.region && <p className="text-sm text-red-500 mt-1">{errors.region}</p>}
          </div>
        </>
      );
    }
  };

  // معالجة الإرسال
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    console.log('📤 EditOrderDialog - بدء إرسال التحديث:', {
      canEdit,
      cartLength: cart.length,
      formData,
      subtotal,
      discount
    });
    
    if (!canEdit) {
      console.log('❌ EditOrderDialog - لا يمكن التعديل');
      toast({
        title: "تنبيه",
        description: "لا يمكن تعديل هذا الطلب",
        variant: "destructive"
      });
      return;
    }

    if (cart.length === 0) {
      console.log('❌ EditOrderDialog - السلة فارغة');
      toast({
        title: "تنبيه",
        description: "يجب اختيار منتج واحد على الأقل",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      // حساب المجموع الجديد من السلة
      const newTotal = subtotal + (formData.delivery_fee || 0);
      const updatedFormData = {
        ...formData,
        price: newTotal,
        quantity: cart.reduce((sum, item) => sum + item.quantity, 0),
        details: cart.map(item => `${item.productName} - ${item.color} - ${item.size} × ${item.quantity}`).join(', ')
      };

      // تحضير بيانات المنتجات للحفظ من السلة
      const orderItems = cart.map(item => ({
        product_id: item.productId,
        variant_id: item.variantId,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.total
      }));

      // إعداد البيانات للتحديث
      const updateData = {
        customer_name: updatedFormData.name,
        customer_phone: updatedFormData.phone,
        customer_phone2: updatedFormData.phone2,
        customer_city: updatedFormData.city,
        customer_province: updatedFormData.region,
        customer_address: updatedFormData.address,
        notes: updatedFormData.notes,
        total_amount: newTotal,
        delivery_fee: updatedFormData.delivery_fee,
        final_amount: newTotal
      };

      // استخدام updateOrder من useInventory
      const result = await updateOrder(order.id, updateData, orderItems, order.items);

      if (!result.success) {
        throw new Error(result.error);
      }

      toast({
        title: "تم التحديث",
        description: "تم تحديث الطلب بنجاح",
        variant: "success"
      });

      // إذا نجح التحديث، إعلام المكون الأب ومسح السلة
      clearCart();
      onOrderUpdated?.();
      onOpenChange(false);
      
    } catch (error) {
      console.error('خطأ في تحديث الطلب:', error);
      toast({
        title: "خطأ",
        description: error.message || "فشل في تحديث الطلب",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!open || !order) return null;

  console.log('🚀 EditOrderDialog NEW VERSION - تم فتح نافذة التعديل المحدثة!', {
    orderId: order.id,
    canEdit,
    hasCustomerInfoForm: !!CustomerInfoForm,
    hasOrderDetailsForm: !!OrderDetailsForm,
    cartLength: cart.length,
    timestamp: new Date().toLocaleTimeString()
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              <div className="bg-green-100 px-2 py-1 rounded text-green-800 text-sm">🔥 NEW</div>
              تعديل الطلب المحدث - {order?.order_number}
              {order?.delivery_partner && (
                <Badge variant="outline" className="mr-2">
                  {order.delivery_partner}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {!canEdit && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                <p className="text-yellow-800 font-medium">
                  هذا الطلب لا يمكن تعديله لأن حالته "{order?.status}"
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* استخدام CustomerInfoForm بدلاً من النموذج المخصص */}
            <CustomerInfoForm
              formData={formData}
              handleChange={handleChange}
              errors={errors}
              isDeliveryPartnerSelected={true}
              isSubmittingState={isLoading}
              customerData={customerData}
              loyaltyDiscount={loyaltyDiscount}
              applyLoyaltyDiscount={applyLoyaltyDiscount}
              partnerSpecificFields={partnerSpecificFields}
            />

            {/* استخدام OrderDetailsForm مع جميع المعاملات */}
            <OrderDetailsForm
              formData={formData}
              handleChange={handleChange}
              handleSelectChange={handleSelectChange}
              setProductSelectOpen={setShowProductDialog}
              isSubmittingState={isLoading}
              isDeliveryPartnerSelected={true}
              packageSizes={packageSizes}
              loadingPackageSizes={loadingPackageSizes}
              activePartner={activePartner || 'local'}
              dataFetchError={dataFetchError}
              settings={settings}
              discount={discount}
              setDiscount={setDiscount}
              subtotal={subtotal}
              total={total}
              customerData={customerData}
              loyaltyDiscount={loyaltyDiscount}
              applyLoyaltyDiscount={applyLoyaltyDiscount}
              onToggleLoyaltyDiscount={() => setApplyLoyaltyDiscount(!applyLoyaltyDiscount)}
              applyLoyaltyDelivery={applyLoyaltyDelivery}
              onToggleLoyaltyDelivery={() => setApplyLoyaltyDelivery(!applyLoyaltyDelivery)}
            />

            {/* الأزرار */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
                className="flex-1"
              >
                إلغاء
              </Button>
              {canEdit && (
                <Button
                  type="submit"
                  disabled={isLoading || cart.length === 0}
                  className="flex-1"
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
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ProductSelectionDialog مع الربط الصحيح */}
      <ProductSelectionDialog
        open={showProductDialog}
        onOpenChange={setShowProductDialog}
        products={products}
        onSelectProduct={(selectedProducts) => {
          selectedProducts.forEach(productItem => {
            addToCart(
              { 
                id: productItem.productId, 
                name: productItem.productName,
                images: productItem.image ? [productItem.image] : []
              },
              { 
                id: productItem.variantId,
                sku: productItem.variantId, 
                price: productItem.price, 
                color: productItem.color, 
                size: productItem.size,
                barcode: productItem.barcode || '',
                quantity: 100 // مخزون افتراضي
              },
              productItem.quantity,
              false
            );
          });
          setShowProductDialog(false);
        }}
      />
    </>
  );
};

export default EditOrderDialog;