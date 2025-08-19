import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useInventory } from '@/contexts/InventoryContext';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { getCities, getRegionsByCity, editAlWaseetOrder, getPackageSizes } from '@/lib/alwaseet-api';
import { normalizePhone, extractOrderPhone } from '@/utils/phoneUtils';
import CustomerInfoForm from '../quick-order/CustomerInfoForm';
import OrderDetailsForm from '../quick-order/OrderDetailsForm';
import ProductSelectionDialog from '../products/ProductSelectionDialog';
import { iraqiProvinces } from '@/lib/iraq-provinces';
import { supabase } from '@/lib/customSupabaseClient';

const UnifiedEditOrderDialog = ({ open, onOpenChange, order, onOrderUpdated }) => {
  const { updateOrder, cart, clearCart, addToCart, settings, orders } = useInventory();
  const { user } = useAuth();
  const { isLoggedIn: isWaseetLoggedIn, token: waseetToken, activePartner } = useAlWaseet();
  
  const [formData, setFormData] = useState({});
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditable, setIsEditable] = useState(true);
  const [productSelectOpen, setProductSelectOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const [originalData, setOriginalData] = useState(null);

  // States for Al-Waseet data
  const [cities, setCities] = useState([]);
  const [regions, setRegions] = useState([]);
  const [packageSizes, setPackageSizes] = useState([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingRegions, setLoadingRegions] = useState(false);
  const [loadingPackageSizes, setLoadingPackageSizes] = useState(false);

  // Customer data and loyalty states
  const [customerData, setCustomerData] = useState(null);
  const [discount, setDiscount] = useState(0);
  const [loyaltyDiscount, setLoyaltyDiscount] = useState(0);
  const [applyLoyaltyDiscount, setApplyLoyaltyDiscount] = useState(true);
  const [applyLoyaltyDelivery, setApplyLoyaltyDelivery] = useState(false);

  // Calculate totals
  const subtotal = Array.isArray(cart) ? cart.reduce((sum, item) => sum + (item.total || 0), 0) : 0;
  const baseDeliveryFee = settings?.deliveryFee || 0;
  const deliveryFee = (applyLoyaltyDelivery && customerData?.currentTier?.free_delivery) ? 0 : baseDeliveryFee;
  const total = Math.max(0, subtotal - discount);

  // Fetch initial data when dialog opens
  useEffect(() => {
    if (open && isWaseetLoggedIn && waseetToken) {
      fetchInitialData();
    }
  }, [open, isWaseetLoggedIn, waseetToken]);

  const fetchInitialData = async () => {
    if (!isWaseetLoggedIn || !waseetToken) return;

    try {
      setLoadingCities(true);
      setLoadingPackageSizes(true);

      const [citiesData, packageSizesData] = await Promise.all([
        getCities(waseetToken),
        getPackageSizes(waseetToken)
      ]);

      setCities(citiesData || []);
      setPackageSizes(packageSizesData || []);
    } catch (error) {
      console.error('Error fetching initial data:', error);
      toast({
        title: "خطأ في جلب البيانات",
        description: "تعذر جلب قوائم المدن وأحجام الطلبات",
        variant: "destructive"
      });
    } finally {
      setLoadingCities(false);
      setLoadingPackageSizes(false);
    }
  };

  // Initialize form when order changes
  useEffect(() => {
    if (order && open) {
      initializeForm(order);
    }
  }, [order, open]);

  const initializeForm = useCallback((orderData) => {
    console.log('🔄 تهيئة نموذج التعديل:', orderData);

    // Extract data from customer_address
    const parseAddressData = (address) => {
      if (!address) return { city: '', region: '', cityId: '', regionId: '' };

      // Extract city and region from address string
      const addressParts = address.split(',').map(part => part.trim());
      let extractedCity = '';
      let extractedRegion = '';

      // Common Iraqi cities
      const iraqiCities = ['بغداد', 'البصرة', 'أربيل', 'الموصل', 'كربلاء', 'النجف', 'بابل', 'ذي قار', 'ديالى', 'الأنبار'];
      
      for (const part of addressParts) {
        for (const cityName of iraqiCities) {
          if (part.includes(cityName)) {
            extractedCity = cityName;
            break;
          }
        }
        if (extractedCity) break;
      }

      // Extract region if available
      if (addressParts.length > 1) {
        extractedRegion = addressParts.find(part => 
          !iraqiCities.some(city => part.includes(city)) && 
          part.length > 2
        ) || '';
      }

      return { 
        city: extractedCity || 'بغداد',
        region: extractedRegion,
        cityId: '',
        regionId: ''
      };
    };

    const addressData = parseAddressData(orderData.customer_address);

    // Check if order is editable
    const editableStatuses = ['pending', 'confirmed', 'processing'];
    const editable = editableStatuses.includes(orderData.status);
    setIsEditable(editable);

    // Extract phone numbers
    const primaryPhone = extractOrderPhone(orderData) || '';
    const secondaryPhone = orderData.customer_phone2 || '';

    // Initialize form data
    const initialData = {
      name: orderData.customer_name || '',
      phone: primaryPhone,
      second_phone: secondaryPhone,
      city: addressData.city,
      region: addressData.region,
      city_id: addressData.cityId,
      region_id: addressData.regionId,
      address: orderData.customer_address || '',
      notes: orderData.notes || '',
      details: orderData.details || '',
      quantity: orderData.quantity || 1,
      price: orderData.total_amount || 0,
      size: '', // Will be set based on package size
      type: orderData.type || 'new',
      promocode: orderData.promocode || ''
    };

    setFormData(initialData);
    setOriginalData(orderData);

    // Clear cart and add order products
    clearCart();
    if (orderData.order_items && Array.isArray(orderData.order_items)) {
      orderData.order_items.forEach(item => {
        if (item.product && item.variant) {
          const product = {
            id: item.product.id,
            name: item.product.name,
            images: item.product.images || []
          };
          const variant = {
            id: item.variant.id,
            sku: item.variant.sku || item.variant.id,
            price: item.variant.price,
            cost_price: item.variant.cost_price,
            color: item.variant.colors?.name || '',
            size: item.variant.sizes?.name || '',
            barcode: item.variant.barcode || '',
            quantity: 100
          };
          addToCart(product, variant, item.quantity, false);
        }
      });
    }

    // Set package size if Al-Waseet order
    if (orderData.delivery_partner === 'alwaseet') {
      // Wait for package sizes to load if they're not available yet
      if (packageSizes.length > 0) {
        const normalSize = packageSizes.find(size => 
          (typeof size.size === 'string' && (size.size.includes('عادي') || size.size.includes('normal'))) ||
          (typeof size.name === 'string' && (size.name.includes('عادي') || size.name.includes('normal')))
        );
        const defaultSizeId = normalSize?.id || packageSizes[0]?.id;
        if (defaultSizeId) {
          setFormData(prev => ({ ...prev, size: String(defaultSizeId) }));
        }
      }
    } else {
      setFormData(prev => ({ ...prev, size: 'normal' }));
    }

    console.log('✅ تم تهيئة النموذج:', initialData);
  }, [clearCart, addToCart, packageSizes]);

  // Fetch customer data when phone changes
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

        // Calculate loyalty discount
        const discountPercentage = currentTier.discount_percentage || 0;
        if (discountPercentage > 0) {
          const rawDiscount = (subtotal * discountPercentage) / 100;
          const roundedDiscount = Math.round(rawDiscount / 500) * 500;
          setLoyaltyDiscount(roundedDiscount);
          setApplyLoyaltyDiscount(true);
          setDiscount(roundedDiscount);
        }

        if (currentTier.free_delivery) {
          setApplyLoyaltyDelivery(true);
        }

      } catch (error) {
        console.error('Error fetching customer data:', error);
        setCustomerData(null);
      }
    };

    fetchCustomerData();
  }, [formData.phone, orders, user?.id, subtotal]);

  // Handle form changes
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear related errors
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  }, [errors]);

  const handleSelectChange = useCallback((name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Handle city change - fetch regions
    if (name === 'city_id' && value && isWaseetLoggedIn && waseetToken) {
      setLoadingRegions(true);
      getRegionsByCity(waseetToken, value)
        .then(regionsData => {
          setRegions(regionsData || []);
          setFormData(prev => ({ ...prev, region_id: '' }));
        })
        .catch(error => {
          console.error('Error fetching regions:', error);
          setRegions([]);
        })
        .finally(() => setLoadingRegions(false));
    }
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  }, [errors, isWaseetLoggedIn, waseetToken]);

  // Handle loyalty discount toggle
  const handleToggleLoyaltyDiscount = useCallback(() => {
    setApplyLoyaltyDiscount(prev => {
      const newState = !prev;
      if (newState) {
        setDiscount(loyaltyDiscount);
      } else {
        setDiscount(0);
      }
      return newState;
    });
  }, [loyaltyDiscount]);

  const handleToggleLoyaltyDelivery = useCallback(() => {
    setApplyLoyaltyDelivery(prev => !prev);
  }, []);

  // Handle product selection
  const handleProductSelect = useCallback((product, variant, quantity) => {
    addToCart(product, variant, quantity, false);
  }, [addToCart]);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!isEditable) {
      toast({
        title: "لا يمكن التعديل",
        description: "لا يمكن تعديل هذا الطلب في حالته الحالية",
        variant: "destructive"
      });
      return;
    }

    if (cart.length === 0) {
      toast({
        title: "خطأ في البيانات",
        description: "يجب اختيار منتج واحد على الأقل",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      const finalTotal = total + deliveryFee;
      
      const updateData = {
        customer_name: formData.name || '',
        customer_phone: formData.phone,
        customer_phone2: formData.second_phone || null,
        customer_address: formData.address,
        notes: formData.notes,
        details: formData.details,
        quantity: cart.reduce((sum, item) => sum + item.quantity, 0),
        total_amount: finalTotal,
        delivery_fee: deliveryFee,
        discount: discount,
        type: formData.type,
        promocode: formData.promocode,
        order_items: cart.map(item => ({
          product_id: item.productId,
          variant_id: item.variantId,
          quantity: item.quantity,
          price: item.price,
          total: item.total
        }))
      };

      // Update order in database
      await updateOrder(order.id, updateData);

      // Update external delivery service if needed
      if (order.delivery_partner === 'alwaseet' && order.tracking_number) {
        const waseetData = {
          qr_id: order.tracking_number,
          client_name: formData.name || '',
          client_mobile: formData.phone,
          client_mobile2: formData.second_phone || '',
          city_id: parseInt(formData.city_id) || 0,
          region_id: parseInt(formData.region_id) || 0,
          address: formData.address,
          items_number: updateData.quantity,
          price: finalTotal,
          package_size: parseInt(formData.size) || 1,
          replacement: formData.type === 'exchange' ? 1 : 0,
          notes: formData.notes || ''
        };

        await editAlWaseetOrder(waseetData, waseetToken);
      }

      toast({
        title: "تم تحديث الطلب بنجاح",
        description: "تم حفظ جميع التغييرات"
      });

      onOrderUpdated?.();
      onOpenChange(false);

    } catch (error) {
      console.error('Error updating order:', error);
      toast({
        title: "خطأ في التحديث",
        description: error.message || "حدث خطأ أثناء تحديث الطلب",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Render partner-specific fields
  const renderPartnerSpecificFields = () => {
    if (order?.delivery_partner === 'alwaseet') {
      return (
        <>
          <div className="space-y-2">
            <label className="text-sm font-medium">المدينة</label>
            <select
              value={formData.city_id || ''}
              onChange={(e) => handleSelectChange('city_id', e.target.value)}
              className="w-full p-2 border rounded-md"
              disabled={isLoading || loadingCities}
            >
              <option value="">اختر المدينة</option>
              {cities.map(city => (
                <option key={city.id} value={city.id}>
                  {typeof city.city === 'string' ? city.city : city.name || `مدينة ${city.id}`}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">المنطقة</label>
            <select
              value={formData.region_id || ''}
              onChange={(e) => handleSelectChange('region_id', e.target.value)}
              className="w-full p-2 border rounded-md"
              disabled={isLoading || loadingRegions || !formData.city_id}
            >
              <option value="">اختر المنطقة</option>
              {regions.map(region => (
                <option key={region.id} value={region.id}>
                  {typeof region.region === 'string' ? region.region : region.name || `منطقة ${region.id}`}
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
            <label className="text-sm font-medium">المحافظة</label>
            <select
              value={formData.city || ''}
              onChange={(e) => handleSelectChange('city', e.target.value)}
              className="w-full p-2 border rounded-md"
              disabled={isLoading}
            >
              <option value="">اختر المحافظة</option>
              {iraqiProvinces.map(province => (
                <option key={province} value={province}>{province}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">المنطقة</label>
            <input
              type="text"
              value={formData.region || ''}
              onChange={(e) => handleChange(e)}
              name="region"
              className="w-full p-2 border rounded-md"
              disabled={isLoading}
            />
          </div>
        </>
      );
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تعديل الطلب #{order?.id}</DialogTitle>
            {!isEditable && (
              <div className="flex items-center gap-2 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-700">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                <span className="text-sm text-orange-800 dark:text-orange-200">
                  هذا الطلب غير قابل للتعديل في حالته الحالية
                </span>
              </div>
            )}
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <CustomerInfoForm
              formData={formData}
              handleChange={handleChange}
              handleSelectChange={handleSelectChange}
              errors={errors}
              partnerSpecificFields={renderPartnerSpecificFields}
              isSubmittingState={isLoading}
              isDeliveryPartnerSelected={true}
              customerData={customerData}
              loyaltyDiscount={loyaltyDiscount}
            />

            <OrderDetailsForm
              formData={formData}
              handleChange={handleChange}
              handleSelectChange={handleSelectChange}
              setProductSelectOpen={setProductSelectOpen}
              isSubmittingState={isLoading}
              isDeliveryPartnerSelected={true}
              packageSizes={packageSizes}
              loadingPackageSizes={loadingPackageSizes}
              activePartner={order?.delivery_partner || 'local'}
              dataFetchError={false}
              settings={settings}
              discount={discount}
              setDiscount={setDiscount}
              subtotal={subtotal}
              total={total}
              customerData={customerData}
              loyaltyDiscount={loyaltyDiscount}
              applyLoyaltyDiscount={applyLoyaltyDiscount}
              onToggleLoyaltyDiscount={handleToggleLoyaltyDiscount}
              applyLoyaltyDelivery={applyLoyaltyDelivery}
              onToggleLoyaltyDelivery={handleToggleLoyaltyDelivery}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                إلغاء
              </Button>
              <Button 
                type="submit" 
                disabled={isLoading || !isEditable || cart.length === 0}
                className="min-w-[120px]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin ml-2" />
                    جاري الحفظ...
                  </>
                ) : (
                  'حفظ التغييرات'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ProductSelectionDialog
        open={productSelectOpen}
        onOpenChange={setProductSelectOpen}
        onProductSelect={handleProductSelect}
      />
    </>
  );
};

export default UnifiedEditOrderDialog;