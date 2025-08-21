import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Package, Save, X, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { useInventory } from '@/contexts/InventoryContext';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import CustomerInfoForm from '@/components/quick-order/CustomerInfoForm';
import OrderDetailsForm from '@/components/quick-order/OrderDetailsForm';
import ProductSelectionDialog from '@/components/products/ProductSelectionDialog';
import SearchableSelectFixed from '@/components/ui/searchable-select-fixed';
import { getCities, getRegionsByCity, getPackageSizes, editAlWaseetOrder } from '@/lib/alwaseet-api';
import { normalizePhone, extractOrderPhone } from '@/utils/phoneUtils';
import { iraqiProvinces } from '@/lib/iraq-provinces';

const EditOrderDialog = ({ open, onOpenChange, order, onOrderUpdated }) => {
  const { 
    updateOrder, 
    settings, 
    cart, 
    clearCart, 
    addToCart, 
    removeFromCart,
    orders
  } = useInventory();
  
  const { user } = useAuth();
  const { 
    isLoggedIn: isWaseetLoggedIn, 
    token: waseetToken, 
    activePartner, 
    setActivePartner
  } = useAlWaseet();

  const [productSelectOpen, setProductSelectOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [canEdit, setCanEdit] = useState(false);

  // Form data state - identical to QuickOrderContent
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
    defaultCustomerName: ''
  }), []);

  const [formData, setFormData] = useState(initialFormData);
  const [errors, setErrors] = useState({});
  const [discount, setDiscount] = useState(0);
  const [customerData, setCustomerData] = useState(null);
  const [loyaltyDiscount, setLoyaltyDiscount] = useState(0);
  const [applyLoyaltyDiscount, setApplyLoyaltyDiscount] = useState(true);
  const [applyLoyaltyDelivery, setApplyLoyaltyDelivery] = useState(false);

  // Computed values - copied from QuickOrderContent
  const subtotal = useMemo(() => Array.isArray(cart) ? cart.reduce((sum, item) => sum + item.total, 0) : 0, [cart]);
  const currentDeliveryFee = useMemo(() => {
    if (applyLoyaltyDelivery && customerData?.currentTier?.free_delivery) return 0;
    return settings?.deliveryFee || 0;
  }, [settings, customerData, applyLoyaltyDelivery]);
  const total = useMemo(() => subtotal - discount, [subtotal, discount]);
  const finalTotal = useMemo(() => total + currentDeliveryFee, [total, currentDeliveryFee]);

  const isDeliveryPartnerSelected = useMemo(() => activePartner !== null, [activePartner]);

  // Al-Waseet data states - copied from QuickOrderContent
  const [cities, setCities] = useState([]);
  const [regions, setRegions] = useState([]);
  const [packageSizes, setPackageSizes] = useState([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingRegions, setLoadingRegions] = useState(false);
  const [loadingPackageSizes, setLoadingPackageSizes] = useState(false);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  const [dataFetchError, setDataFetchError] = useState(false);

  // Initialize form when order is loaded
  const initializeFormData = useCallback(async () => {
    if (!order || !open) return;
    
    console.log('🔄 Initializing edit form for order:', order);
    
    // Check if order can be edited
    const editable = order.status === 'pending' || order.status === 'في انتظار التأكيد';
    setCanEdit(editable);
    
    // Clear cart first
    clearCart();
    
    // Set delivery partner based on order
    if (order.delivery_partner === 'الوسيط') {
      setActivePartner('alwaseet');
      // Fetch Al-Waseet data if needed
      if (cities.length === 0) {
        setLoadingCities(true);
        try {
          const citiesData = await getCities(waseetToken);
          setCities(citiesData || []);
        } catch (error) {
          console.error('Error fetching cities:', error);
          setDataFetchError(true);
        } finally {
          setLoadingCities(false);
        }
      }
      if (packageSizes.length === 0) {
        setLoadingPackageSizes(true);
        try {
          const sizesData = await getPackageSizes(waseetToken);
          setPackageSizes(sizesData || []);
        } catch (error) {
          console.error('Error fetching package sizes:', error);
        } finally {
          setLoadingPackageSizes(false);
        }
      }
    } else {
      setActivePartner('local');
    }
    
    // Find city and region IDs for Al-Waseet orders
    let cityId = '';
    let regionId = '';
    
    if (order.delivery_partner === 'الوسيط' && order.customer_city && cities.length > 0) {
      const cityMatch = cities.find(c => {
        const cityName = c.name || c.name_ar || c.city_name || '';
        return cityName.toLowerCase().trim() === order.customer_city.toLowerCase().trim();
      });
      
      if (cityMatch) {
        cityId = String(cityMatch.id);
        
        // Fetch regions for this city
        setLoadingRegions(true);
        try {
          const regionsData = await getRegionsByCity(cityId, waseetToken);
          setRegions(regionsData || []);
          
          // Find region match
          if (order.customer_province && regionsData?.length > 0) {
            const regionMatch = regionsData.find(r => {
              const regionName = r.name || r.name_ar || r.region_name || '';
              return regionName.toLowerCase().trim() === order.customer_province.toLowerCase().trim();
            });
            
            if (regionMatch) {
              regionId = String(regionMatch.id);
            }
          }
        } catch (error) {
          console.error('Error fetching regions:', error);
          setDataFetchError(true);
        } finally {
          setLoadingRegions(false);
        }
      }
    }
    
    // Determine package size
    let packageSize = 'عادي';
    if (order.delivery_partner === 'الوسيط' && packageSizes.length > 0) {
      const sizeMatch = packageSizes.find(size => 
        String(size.id) === String(order.package_size) ||
        size.name === order.package_size
      );
      packageSize = sizeMatch ? String(sizeMatch.id) : packageSize;
    }
    
    // Set form data
    const orderFormData = {
      name: order.customer_name || '',
      phone: order.customer_phone || '',
      second_phone: order.customer_phone2 || '',
      city_id: cityId,
      region_id: regionId,
      city: order.customer_city || '',
      region: order.customer_province || '',
      address: order.customer_address || '',
      notes: order.notes || '',
      details: order.order_items?.map(item => 
        `${item.products?.name || item.product_name || item.productname || 'منتج'} × ${item.quantity || 1}`
      ).join(', ') || '',
      quantity: order.order_items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 1,
      price: order.total_amount || 0,
      size: packageSize,
      type: 'edit',
      promocode: order.promocode || '',
      defaultCustomerName: order.customer_name || ''
    };
    
    setFormData(orderFormData);
    
    // Add order items to cart
    if (order.order_items && Array.isArray(order.order_items)) {
      for (const item of order.order_items) {
        const product = {
          id: item.products?.id || item.product_id || `edit-${Date.now()}-${Math.random()}`,
          name: item.products?.name || item.product_name || item.productname || 'منتج',
          images: item.products?.images || item.images || []
        };
        
        const variant = {
          id: item.product_variants?.id || item.variant_id || `variant-${Date.now()}`,
          sku: item.product_variants?.sku || item.variant_id || item.sku || `sku-${Date.now()}`,
          price: item.product_variants?.price || item.unit_price || item.price || 0,
          cost_price: item.product_variants?.cost_price || item.cost_price || 0,
          color: item.product_variants?.colors?.name || item.color || '',
          size: item.product_variants?.sizes?.name || item.size || '',
          barcode: item.product_variants?.barcode || item.barcode || '',
          quantity: 1000 // High stock for editing
        };
        
        addToCart(product, variant, item.quantity || 1, false);
      }
    }
    
    console.log('✅ Form initialized successfully');
  }, [order, open, clearCart, addToCart, setActivePartner]);

  // Initialize when dialog opens
  useEffect(() => {
    if (open && order) {
      initializeFormData();
    }
  }, [open, order, initializeFormData]);

  // Fetch customer data when phone changes - identical to QuickOrderContent
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
        
        const totalSpent = completedOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
        
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
        console.error('Error fetching customer data:', error);
        setCustomerData(null);
        setLoyaltyDiscount(0);
        setDiscount(0);
      }
    };

    fetchCustomerData();
  }, [formData.phone, orders, user?.id, cart]);

  // Update discount when cart changes
  useEffect(() => {
    if (customerData?.currentTier?.discount_percentage && cart.length > 0) {
      const discountPercentage = customerData.currentTier.discount_percentage;
      const currentSubtotal = Array.isArray(cart) ? cart.reduce((sum, item) => sum + (item.total || 0), 0) : 0;
      const baseDiscountAmount = (currentSubtotal * discountPercentage) / 100;
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
  }, [cart, customerData, applyLoyaltyDiscount, loyaltyDiscount, discount]);

  // Form handlers - identical to QuickOrderContent
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleSelectChange = async (field, value) => {
    console.log(`🔄 تغيير ${field} إلى:`, value);
    
    setFormData(prev => ({ ...prev, [field]: value }));
    
    if (field === 'city_id' && value && activePartner === 'alwaseet') {
      setLoadingRegions(true);
      setFormData(prev => ({ ...prev, region_id: '' }));
      
      try {
        const regionsData = await getRegionsByCity(value, waseetToken);
        setRegions(regionsData || []);
        console.log('✅ تم جلب المناطق للمدينة:', value);
      } catch (error) {
        console.error('❌ خطأ في جلب المناطق:', error);
        setDataFetchError(true);
        toast({
          title: "خطأ",
          description: "فشل في جلب المناطق",
          variant: "destructive"
        });
      } finally {
        setLoadingRegions(false);
      }
    }
    
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  // Additional calculate totals - moved to avoid conflicts
  
  const deliveryFee = (() => {
    if (applyLoyaltyDelivery && customerData?.currentTier?.free_delivery) {
      return 0;
    }
    
    // Safe fallback for settings
    const defaultSettings = { deliveryFee: 2000, alwaseetDeliveryFee: 4000 };
    const safeSettings = settings || defaultSettings;
    
    switch (activePartner) {
      case 'alwaseet':
        return safeSettings.alwaseetDeliveryFee || 4000;
      case 'local':
        return safeSettings.deliveryFee || 2000;
      default:
        return safeSettings.deliveryFee || 2000;
    }
  })();

  const finalTotal = Math.max(0, subtotal + deliveryFee - discount);

  // Update price field when total changes
  useEffect(() => {
    setFormData(prev => ({ ...prev, price: finalTotal }));
  }, [finalTotal]);

  // Submit handler
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

    if (cart.length === 0) {
      toast({
        title: "خطأ في البيانات",
        description: "يجب إضافة منتج واحد على الأقل",
        variant: "destructive"
      });
      return;
    }

    if (!formData.name.trim() || !formData.phone.trim()) {
      toast({
        title: "خطأ في البيانات",
        description: "يرجى ملء جميع الحقول المطلوبة",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare order data identical to QuickOrderContent
      const orderData = {
        id: order.id,
        customer_name: formData.name.trim(),
        customer_phone: formData.phone.trim(),
        customer_phone2: formData.second_phone?.trim() || '',
        customer_city: activePartner === 'alwaseet' && formData.city_id ? 
          cities.find(c => String(c.id) === String(formData.city_id))?.name || formData.city :
          formData.city || 'بغداد',
        customer_province: activePartner === 'alwaseet' && formData.region_id ?
          regions.find(r => String(r.id) === String(formData.region_id))?.name || formData.region :
          formData.region || '',
        customer_address: formData.address.trim(),
        delivery_partner: activePartner === 'alwaseet' ? 'الوسيط' : 'محلي',
        package_size: activePartner === 'alwaseet' ? formData.size : 'عادي',
        delivery_fee: deliveryFee,
        total_amount: finalTotal,
        discount_amount: discount,
        notes: formData.notes.trim(),
        promocode: formData.promocode?.trim() || '',
        items: cart.map(item => ({
          product_id: item.productId,
          variant_id: item.variantId,
          product_name: item.productName,
          color: item.color,
          size: item.size,
          quantity: item.quantity,
          unit_price: item.price,
          cost_price: item.costPrice
        }))
      };

      console.log('💾 Updating order:', orderData);

      // Update order in database
      await updateOrder(orderData);

      // Update Al-Waseet order if needed
      if (order.delivery_partner === 'الوسيط' && waseetToken) {
        try {
          const waseetOrderData = {
            order_id: order.tracking_number,
            customer_name: formData.name.trim(),
            customer_phone: formData.phone.trim(),
            city_id: formData.city_id,
            region_id: formData.region_id,
            address: formData.address.trim(),
            package_size_id: formData.size,
            notes: formData.notes.trim()
          };

          await editAlWaseetOrder(waseetOrderData, waseetToken);
          console.log('✅ تم تحديث الطلب في الوسيط');
        } catch (waseetError) {
          console.error('❌ خطأ في تحديث الطلب في الوسيط:', waseetError);
          toast({
            title: "تحذير",
            description: "تم تحديث الطلب محلياً لكن فشل التحديث في الوسيط",
            variant: "default"
          });
        }
      }

      toast({
        title: "تم التحديث بنجاح",
        description: "تم تحديث الطلب بنجاح",
        variant: "success"
      });

      // Clear cart and close dialog
      clearCart();
      onOpenChange(false);
      
      if (onOrderUpdated) {
        onOrderUpdated();
      }

    } catch (error) {
      console.error('خطأ في تحديث الطلب:', error);
      toast({
        title: "خطأ",
        description: error.message || "حدث خطأ أثناء تحديث الطلب",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle dialog close
  const handleClose = () => {
    clearCart();
    setFormData(initialFormData);
    setErrors({});
    setDiscount(0);
    setCustomerData(null);
    setLoyaltyDiscount(0);
    setApplyLoyaltyDiscount(false);
    setApplyLoyaltyDelivery(false);
    onOpenChange(false);
  };

  // Loyalty toggle handlers
  const handleToggleLoyaltyDiscount = (enabled) => {
    setApplyLoyaltyDiscount(enabled);
    if (enabled) {
      setDiscount(loyaltyDiscount + Math.max(0, discount - loyaltyDiscount));
    } else {
      const manualDiscount = Math.max(0, discount - loyaltyDiscount);
      setDiscount(manualDiscount);
    }
  };

  const handleToggleLoyaltyDelivery = (enabled) => {
    setApplyLoyaltyDelivery(enabled);
  };

  // Product selection handler - exactly like QuickOrderContent
  const handleConfirmProductSelection = (selectedItems) => {
    clearCart();
    selectedItems.forEach(item => {
      const product = { id: item.productId, name: item.productName, images: [item.image] };
      const variant = { id: item.variantId, sku: item.sku, color: item.color, size: item.size, price: item.price, cost_price: item.costPrice, quantity: item.stock, reserved: item.reserved, image: item.image };
      addToCart(product, variant, item.quantity, false);
    });
    setProductSelectOpen(false);
    toast({ title: "تم تحديث السلة", description: `تم إضافة ${selectedItems.length} منتج.`, variant: "success" });
  };

  // Partner specific fields function - exactly like QuickOrderContent
  const partnerSpecificFields = () => {
    if (activePartner === 'local') {
      return (
        <>
          <div className="space-y-2">
            <Label htmlFor="city">المحافظة</Label>
            <SearchableSelectFixed
              value={formData.city}
              onValueChange={(v) => handleSelectChange('city', v)}
              options={iraqiProvinces.map(p => ({ value: p, label: p }))}
              placeholder="اختر محافظة"
              searchPlaceholder="بحث في المحافظات..."
              emptyText="لا توجد محافظة بهذا الاسم"
              className={errors.city ? "border-red-500" : ""}
            />
            {errors.city && <p className="text-sm text-red-500">{errors.city}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="region">المنطقة او القضاء</Label>
            <Input 
              id="region" 
              name="region" 
              value={formData.region} 
              onChange={(e) => handleChange('region', e.target.value)} 
              required 
              className={errors.region ? "border-red-500" : ""}
            />
            {errors.region && <p className="text-sm text-red-500">{errors.region}</p>}
          </div>
        </>
      );
    }
    return (
      <>
        <div className="space-y-2">
          <Label>المدينة</Label>
          <SearchableSelectFixed
            value={formData.city_id}
            onValueChange={(v) => handleSelectChange('city_id', v)}
            options={(Array.isArray(cities) ? cities : []).map(c => ({ value: String(c.id), label: c.name }))}
            placeholder={loadingCities ? 'تحميل...' : 'اختر مدينة'}
            searchPlaceholder="بحث في المدن..."
            emptyText="لا توجد مدينة بهذا الاسم"
            className={errors.city_id ? "border-red-500" : ""}
            disabled={loadingCities || dataFetchError}
          />
          {errors.city_id && <p className="text-sm text-red-500">{errors.city_id}</p>}
        </div>
        <div className="space-y-2">
          <Label>المنطقة او القضاء</Label>
          <SearchableSelectFixed
            value={formData.region_id}
            onValueChange={(v) => handleSelectChange('region_id', v)}
            options={(Array.isArray(regions) ? regions : []).map(r => ({ value: String(r.id), label: r.name }))}
            placeholder={loadingRegions ? 'تحميل...' : 'اختر منطقة'}
            searchPlaceholder="بحث في المناطق..."
            emptyText="لا توجد منطقة بهذا الاسم"
            className={errors.region_id ? "border-red-500" : ""}
            disabled={!formData.city_id || loadingRegions || dataFetchError}
          />
          {errors.region_id && <p className="text-sm text-red-500">{errors.region_id}</p>}
        </div>
      </>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-sm sm:max-w-4xl lg:max-w-6xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-4 sm:px-6 py-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Package className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="truncate">تعديل الطلب #{order?.tracking_number}</span>
            {!canEdit && (
              <span className="text-xs sm:text-sm bg-muted px-2 py-1 rounded text-muted-foreground whitespace-nowrap">
                للمشاهدة فقط
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        
        {/* Original Order Info */}
        {order && (
          <div className="mx-4 sm:mx-6 mt-4">
            <Card className="border-l-4 border-l-primary">
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-muted-foreground">رقم الطلب:</span>
                    <p className="font-mono">{order.tracking_number}</p>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">التاريخ:</span>
                    <p>{new Date(order.created_at).toLocaleDateString('ar')}</p>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">الحالة:</span>
                    <p className="inline-flex items-center gap-1">
                      {order.status === 'pending' ? (
                        <><AlertCircle className="h-3 w-3 text-yellow-500" /> قيد الانتظار</>
                      ) : (
                        <><CheckCircle className="h-3 w-3 text-green-500" /> {order.status}</>
                      )}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">شريك التوصيل:</span>
                    <p>{order.delivery_partner || 'محلي'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Customer Information */}
              <CustomerInfoForm
                formData={formData}
                handleChange={(e) => handleChange(e.target.name, e.target.value)}
                handleSelectChange={handleSelectChange}
                errors={errors}
                partnerSpecificFields={partnerSpecificFields}
                isSubmittingState={isSubmitting}
                isDeliveryPartnerSelected={!!activePartner}
                customerData={customerData}
                loyaltyDiscount={loyaltyDiscount}
              />

              {/* Order Details */}
              <OrderDetailsForm
                formData={formData}
                handleChange={(e) => handleChange(e.target.name, e.target.value)}
                handleSelectChange={handleSelectChange}
                setProductSelectOpen={setProductSelectOpen}
                isSubmittingState={isSubmitting}
                isDeliveryPartnerSelected={!!activePartner}
                packageSizes={packageSizes}
                loadingPackageSizes={loadingPackageSizes}
                activePartner={activePartner}
                dataFetchError={dataFetchError}
                settings={settings}
                discount={discount}
                setDiscount={setDiscount}
                subtotal={subtotal}
                total={finalTotal}
                customerData={customerData}
                loyaltyDiscount={loyaltyDiscount}
                applyLoyaltyDiscount={applyLoyaltyDiscount}
                applyLoyaltyDelivery={applyLoyaltyDelivery}
                onToggleLoyaltyDiscount={handleToggleLoyaltyDiscount}
                onToggleLoyaltyDelivery={handleToggleLoyaltyDelivery}
              />
            </div>

          </form>
        </div>

        {/* Submit Buttons - Fixed at bottom for mobile */}
        <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4 sm:p-6 shrink-0">
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 max-w-sm sm:max-w-none mx-auto sm:mx-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              <X className="h-4 w-4 mr-2" />
              إلغاء
            </Button>
            
            {canEdit && (
              <Button
                type="submit"
                onClick={handleSubmit}
                disabled={isSubmitting || cart.length === 0}
                className="w-full sm:w-auto sm:min-w-[120px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    جاري الحفظ...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    حفظ التغييرات
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Product Selection Dialog */}
        <ProductSelectionDialog
          open={productSelectOpen}
          onOpenChange={setProductSelectOpen}
          onConfirm={handleConfirmProductSelection}
          initialCart={cart}
        />
      </DialogContent>
    </Dialog>
  );
};

export default EditOrderDialog;