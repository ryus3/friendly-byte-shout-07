import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import { useCart } from '@/hooks/useCart.jsx';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { toast } from '@/components/ui/use-toast';
import { getCities, getRegionsByCity, createAlWaseetOrder, getPackageSizes } from '@/lib/alwaseet-api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SearchableSelectFixed from '@/components/ui/searchable-select-fixed';
import { Loader2, CheckCircle } from 'lucide-react';
import DeliveryPartnerDialog from '@/components/DeliveryPartnerDialog';
import { motion } from 'framer-motion';
import ProductSelectionDialog from '@/components/products/ProductSelectionDialog';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { iraqiProvinces } from '@/lib/iraq-provinces';
import DeliveryStatusCard from './DeliveryStatusCard';
import CustomerInfoForm from './CustomerInfoForm';
import OrderDetailsForm from './OrderDetailsForm';
import useLocalStorage from '@/hooks/useLocalStorage.jsx';
import { supabase } from '@/lib/customSupabaseClient';
import { normalizePhone, extractOrderPhone } from '@/utils/phoneUtils';
import EditOrderDataLoader from './EditOrderDataLoader';

export const QuickOrderContent = ({ isDialog = false, onOrderCreated, formRef, setIsSubmitting, isSubmittingState, aiOrderData = null }) => {
  const { createOrder, updateOrder, settings, cart, clearCart, addToCart, approveAiOrder, orders, allData } = useInventory();
  const { user } = useAuth();
  const { isLoggedIn: isWaseetLoggedIn, token: waseetToken, activePartner, setActivePartner, fetchToken, waseetUser, syncOrderByTracking } = useAlWaseet();
  const [deliveryPartnerDialogOpen, setDeliveryPartnerDialogOpen] = useState(false);
  const [productSelectOpen, setProductSelectOpen] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);
  
  // Local storage for default customer name and delivery partner
  const [defaultCustomerName, setDefaultCustomerName] = useLocalStorage('defaultCustomerName', user?.default_customer_name || '');
  const [defaultDeliveryPartner, setDefaultDeliveryPartner] = useLocalStorage('defaultDeliveryPartner', activePartner || '');

  const initialFormData = useMemo(() => ({
    name: defaultCustomerName || user?.default_customer_name || '', 
    phone: '', 
    second_phone: '', 
    city_id: '', 
    region_id: '', 
    city: 'بغداد', // القيمة الافتراضية للمدينة
    region: '', 
    address: '', 
    notes: '', 
    details: '', 
    quantity: 1, 
    price: 0, 
    size: 'عادي', // القيمة الافتراضية لحجم الطلب
    type: 'new', 
    promocode: '',
    defaultCustomerName: defaultCustomerName || user?.default_customer_name || ''
  }), [defaultCustomerName, user?.default_customer_name]);
  const [formData, setFormData] = useState(initialFormData);
  
  // حالة التعديل
  const isEditMode = aiOrderData?.editMode || false;
  const originalOrder = aiOrderData?.originalOrder || null;

  // ملء البيانات من الطلب الذكي أو وضع التعديل عند وجوده
  useEffect(() => {
    console.log('🚀 QuickOrderContent - بيانات الطلب الذكي/التعديل المُستقبلة:', aiOrderData, { isEditMode });
    if (aiOrderData) {
      // Parse city and address intelligently
      const parseLocationData = (address, city) => {
        let parsedCity = city || '';
        let parsedRegion = '';
        
        if (address) {
          // Try to extract city from address if not provided
          const addressLower = address.toLowerCase();
          const iraqiCities = ['بغداد', 'البصرة', 'أربيل', 'الموصل', 'كربلاء', 'النجف', 'بابل', 'ذي قار', 'ديالى', 'الأنبار'];
          
          if (!parsedCity) {
            for (const cityName of iraqiCities) {
              if (addressLower.includes(cityName.toLowerCase())) {
                parsedCity = cityName;
                break;
              }
            }
          }
          
          // Extract potential region/district from address
          const regionPatterns = [
            /منطقة\s+([^،\s]+)/,
            /حي\s+([^،\s]+)/,
            /شارع\s+([^،\s]+)/,
            /محلة\s+([^،\s]+)/,
            /قضاء\s+([^،\s]+)/
          ];
          
          for (const pattern of regionPatterns) {
            const match = address.match(pattern);
            if (match) {
              parsedRegion = match[1];
              break;
            }
          }
        }
        
        return { parsedCity, parsedRegion };
      };
      
      const { parsedCity, parsedRegion } = parseLocationData(aiOrderData.customer_address, aiOrderData.customer_city);
      
      // في وضع التعديل، استخدم البيانات الأصلية مباشرة
      if (isEditMode) {
        console.log('🔧 ضبط بيانات النموذج لوضع التعديل:', aiOrderData);
        setFormData(prev => ({
          ...prev,
          name: aiOrderData.customer_name || '',
          phone: aiOrderData.customer_phone || '',
          second_phone: aiOrderData.customer_phone2 || '',
          city: aiOrderData.customer_city || 'بغداد',
          region: aiOrderData.customer_province || '',
          address: aiOrderData.customer_address || '',
          notes: aiOrderData.notes || '',
          price: aiOrderData.total_amount || 0,
          delivery_fee: aiOrderData.delivery_fee || 0,
          discount: aiOrderData.discount || 0,
          size: aiOrderData.package_size || 'عادي',
          type: aiOrderData.order_type || 'new',
          promocode: aiOrderData.promocode || '',
          // ضمان عرض السعر الصحيح مع التوصيل
          total_with_delivery: (aiOrderData.total_amount || 0) + (aiOrderData.delivery_fee || 0)
        }));
        
        console.log('✅ تم ضبط بيانات النموذج لوضع التعديل');
        console.log('📍 بيانات العنوان:', {
          city: aiOrderData.customer_city,
          province: aiOrderData.customer_province, 
          address: aiOrderData.customer_address
        });
        
        // تحديد شريك التوصيل
        if (aiOrderData.delivery_partner && aiOrderData.delivery_partner !== 'محلي') {
          setActivePartner('alwaseet');
        } else {
          setActivePartner('local');
        }
        
        return; // انتهاء وضع التعديل - سيتم تحميل المنتجات بعد ذلك
      }
      
      setFormData(prev => ({
        ...prev,
        name: aiOrderData.customer_name || '',
        phone: aiOrderData.customer_phone || '',
        city: parsedCity || 'بغداد',
        region: parsedRegion || '',
        address: aiOrderData.customer_address || '',
        notes: aiOrderData.order_data?.delivery_type ? `نوع التوصيل: ${aiOrderData.order_data.delivery_type}` : '',
        details: Array.isArray(aiOrderData.items) ? 
          aiOrderData.items.map(item => {
            const colorSize = [item.color, item.size].filter(Boolean).join(' ');
            return `${item.product_name || item.name}${colorSize ? ` (${colorSize})` : ''} × ${item.quantity}`;
          }).join(' + ') : '',
        quantity: Array.isArray(aiOrderData.items) ? 
          aiOrderData.items.reduce((sum, item) => sum + (item.quantity || 1), 0) : 1,
        price: aiOrderData.total_amount || 0,
        deliveryPartner: aiOrderData.order_data?.delivery_type === 'توصيل' ? 'الوسيط' : 'محلي'
      }));
      
      // إضافة المنتجات للسلة مع التحقق من وجودها في قاعدة البيانات
      if (Array.isArray(aiOrderData.items)) {
        clearCart();
        
        const loadAiOrderItems = async () => {
          for (const item of aiOrderData.items) {
            // إذا كان لدينا product_id و variant_id، استخدمهما مباشرة
            if (item.product_id && item.variant_id) {
              // جلب بيانات المنتج من قاعدة البيانات
              try {
                const { data: productData } = await supabase
                  .from('products')
                  .select(`
                    id,
                    name,
                    images,
                    product_variants!inner (
                      id,
                      price,
                      cost_price,
                      colors (name),
                      sizes (name)
                    )
                  `)
                  .eq('id', item.product_id)
                  .eq('product_variants.id', item.variant_id)
                  .maybeSingle();

                if (productData && productData.product_variants && productData.product_variants[0]) {
                  console.log('Found product data for AI order:', productData);
                  const variant = productData.product_variants[0];
                  const product = {
                    id: productData.id,
                    name: productData.name,
                    images: productData.images || []
                  };
                  const variantData = {
                    id: variant.id,
                    sku: variant.id, // استخدام ID كـ SKU
                    price: variant.price,
                    cost_price: variant.cost_price,
                    color: variant.colors?.name || item.color || '',
                    size: variant.sizes?.name || item.size || '',
                    barcode: variant.barcode || '',
                    quantity: 100 // افتراضي للمخزون
                  };
                  addToCart(product, variantData, item.quantity || 1, false);
                  console.log('Added product to cart:', product, variantData);
                } else {
                  // fallback للطريقة القديمة
                  fallbackAddToCart(item);
                }
              } catch (error) {
                console.error('Error fetching product data:', error);
                fallbackAddToCart(item);
              }
            } else {
              console.log('Product data not found, using fallback for:', item);
              fallbackAddToCart(item);
            }
          }
        };
        
        loadAiOrderItems();
      }
    
      function fallbackAddToCart(item) {
        const product = { 
          id: item.product_id || `ai-${Date.now()}-${Math.random()}`, 
          name: item.name || item.product_name,
          images: item.images || []
        };
        const variant = { 
          sku: item.variant_id || `fallback-${Date.now()}`,
          price: item.price || 0, 
          cost_price: item.cost_price || 0,
          color: item.color || '', 
          size: item.size || '',
          barcode: item.barcode || '',
          quantity: 100 // افتراضي للمخزون
        };
        addToCart(product, variant, item.quantity || 1, false);
      }
    }
  }, [aiOrderData, clearCart, addToCart, isEditMode, allData, setActivePartner, setFormData]);
  
  const [errors, setErrors] = useState({});
  const [discount, setDiscount] = useState(0);
  const [customerData, setCustomerData] = useState(null);
  const [loyaltyDiscount, setLoyaltyDiscount] = useState(0);
  const [applyLoyaltyDiscount, setApplyLoyaltyDiscount] = useState(true);
  const [applyLoyaltyDelivery, setApplyLoyaltyDelivery] = useState(false);
  
  const [cities, setCities] = useState([]);
  const [regions, setRegions] = useState([]);
  const [selectedCity, setSelectedCity] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [packageSizes, setPackageSizes] = useState([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingRegions, setLoadingRegions] = useState(false);
  const [loadingPackageSizes, setLoadingPackageSizes] = useState(false);
  const [dataFetchError, setDataFetchError] = useState(null);

  // إدراة شريك التوصيل والتحقق من تسجيل الدخول
  const isDeliveryPartnerSelected = activePartner && activePartner !== '';

  useEffect(() => {
    if (activePartner === 'alwaseet' && !isWaseetLoggedIn) {
      if (waseetToken) {
        fetchToken();
      }
    }
  }, [activePartner, isWaseetLoggedIn, waseetToken, fetchToken]);

  // جلب المدن عند اختيار الوسيط
  useEffect(() => {
    if (activePartner === 'alwaseet' && isWaseetLoggedIn) {
      const fetchCities = async () => {
        setLoadingCities(true);
        setDataFetchError(null);
        try {
          const citiesData = await getCities();
          setCities(citiesData);
        } catch (error) {
          console.error('خطأ في جلب المدن:', error);
          setDataFetchError('فشل في تحميل المدن');
          toast({
            title: "خطأ في تحميل البيانات",
            description: "تعذر تحميل قائمة المدن",
            variant: "destructive"
          });
        } finally {
          setLoadingCities(false);
        }
      };

      fetchCities();
    }
  }, [activePartner, isWaseetLoggedIn]);

  // جلب أحجام الطلبات
  useEffect(() => {
    if (activePartner === 'alwaseet' && isWaseetLoggedIn) {
      const fetchPackageSizes = async () => {
        setLoadingPackageSizes(true);
        try {
          const sizes = await getPackageSizes();
          setPackageSizes(sizes);
        } catch (error) {
          console.error('خطأ في جلب أحجام الطلبات:', error);
          toast({
            title: "خطأ في تحميل البيانات",
            description: "تعذر تحميل أحجام الطلبات",
            variant: "destructive"
          });
        } finally {
          setLoadingPackageSizes(false);
        }
      };

      fetchPackageSizes();
    }
  }, [activePartner, isWaseetLoggedIn]);

  // جلب المناطق عند اختيار المدينة
  useEffect(() => {
    if (selectedCity && activePartner === 'alwaseet') {
      const fetchRegions = async () => {
        setLoadingRegions(true);
        try {
          const regionsData = await getRegionsByCity(selectedCity.id);
          setRegions(regionsData);
        } catch (error) {
          console.error('خطأ في جلب المناطق:', error);
          toast({
            title: "خطأ في تحميل البيانات",
            description: "تعذر تحميل قائمة المناطق",
            variant: "destructive"
          });
        } finally {
          setLoadingRegions(false);
        }
      };

      fetchRegions();
    }
  }, [selectedCity, activePartner]);

  // تحديث تفاصيل الطلب عند تغيير السلة أو الإعدادات
  useEffect(() => {
    if (!cart || cart.length === 0) return;

    const quantity = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const description = cart.map(item => {
      const colorSize = [item.color, item.size].filter(Boolean).join(' ');
      return `${item.name}${colorSize ? ` (${colorSize})` : ''} × ${item.quantity}`;
    }).join(' + ');

    const subtotal = cart.reduce((sum, item) => sum + (item.total || 0), 0);
    const deliveryFee = settings?.deliveryFee || 0;
    const total = subtotal + deliveryFee;

    setFormData(prev => ({
      ...prev,
      quantity,
      details: description,
      price: total
    }));
  }, [cart, settings]);

  const validateField = (name, value) => {
    let error = '';
    
    switch (name) {
      case 'name':
        if (!value?.trim()) error = 'اسم الزبون مطلوب';
        break;
      case 'phone':
        if (!value?.trim()) {
          error = 'رقم الهاتف مطلوب';
        } else if (!/^(07[3-9]\d{8}|7[3-9]\d{8})$/.test(value.replace(/\s/g, ''))) {
          error = 'رقم الهاتف يجب أن يبدأ بـ 073, 074, 075, 076, 077, 078, أو 079';
        }
        break;
      case 'address':
        if (!value?.trim()) error = 'العنوان مطلوب';
        break;
    }
    
    return error;
  };

  const validateForm = () => {
    const newErrors = {};
    
    newErrors.name = validateField('name', formData.name);
    newErrors.phone = validateField('phone', formData.phone);
    newErrors.address = validateField('address', formData.address);
    
    // Remove empty errors
    Object.keys(newErrors).forEach(key => {
      if (!newErrors[key]) delete newErrors[key];
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // إزالة الخطأ عند التعديل
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (name === 'city_id') {
      const city = cities.find(c => c.id === value);
      setSelectedCity(city);
      setFormData(prev => ({ ...prev, city: city?.name || '', region_id: '', region: '' }));
      setSelectedRegion(null);
      setRegions([]);
    }
    
    if (name === 'region_id') {
      const region = regions.find(r => r.id === value);
      setSelectedRegion(region);
      setFormData(prev => ({ ...prev, region: region?.name || '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast({
        title: "خطأ في البيانات",
        description: "الرجاء تصحيح الأخطاء أولاً",
        variant: "destructive"
      });
      return;
    }
    
    if (!cart || cart.length === 0) {
      toast({
        title: "السلة فارغة",
        description: "يرجى إضافة منتجات إلى السلة أولاً",
        variant: "destructive"
      });
      return;
    }

    if (isEditMode) {
      await handleUpdateOrder();
    } else {
      await handleCreateOrder();
    }
  };

  const handleCreateOrder = async () => {
    try {
      if (setIsSubmitting) setIsSubmitting(true);
      
      const subtotal = cart.reduce((sum, item) => sum + (item.total || 0), 0);
      const finalDiscount = applyLoyaltyDiscount ? loyaltyDiscount : 0;
      const discountedSubtotal = Math.max(0, subtotal - finalDiscount - discount);
      const deliveryFee = settings?.deliveryFee || 0;
      const finalTotal = discountedSubtotal + deliveryFee;

      const orderData = {
        customer_name: formData.name.trim(),
        customer_phone: formData.phone.trim(),
        customer_phone2: formData.second_phone?.trim() || null,
        customer_city: formData.city || 'بغداد',
        customer_province: formData.region || '',
        customer_address: formData.address.trim(),
        notes: formData.notes?.trim() || '',
        total_amount: discountedSubtotal,
        delivery_fee: deliveryFee,
        final_amount: finalTotal,
        discount: finalDiscount + discount,
        loyalty_discount: finalDiscount,
        manual_discount: discount,
        delivery_partner: activePartner === 'alwaseet' ? 'الوسيط' : 'محلي',
        status: 'pending',
        items: cart.map(item => ({
          product_id: item.id,
          variant_id: item.variant?.id || item.sku,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.total,
          productname: item.name,
          color: item.color || '',
          size: item.size || '',
          image: item.image || (item.images && item.images[0]) || '/placeholder.svg',
          barcode: item.barcode || '',
          sku: item.sku || ''
        }))
      };

      const result = await createOrder(orderData);
      
      if (result && result.success) {
        // إنشاء طلب الوسيط إذا لزم الأمر
        if (activePartner === 'alwaseet' && isWaseetLoggedIn && selectedCity && selectedRegion) {
          try {
            const alwaseetOrderData = {
              customer_name: formData.name.trim(),
              customer_phone: formData.phone.trim(),
              customer_address: formData.address.trim(),
              city_id: selectedCity.id,
              region_id: selectedRegion.id,
              package_size: formData.size || 'عادي',
              notes: formData.notes?.trim() || '',
              cod_amount: finalTotal
            };

            const alwaseetResult = await createAlWaseetOrder(alwaseetOrderData);
            
            if (alwaseetResult && alwaseetResult.tracking_number) {
              // تحديث الطلب برقم التتبع
              await updateOrder(result.order.id, {
                tracking_number: alwaseetResult.tracking_number,
                delivery_status: 'confirmed'
              });
            }
          } catch (alwaseetError) {
            console.error('خطأ في إنشاء طلب الوسيط:', alwaseetError);
            toast({
              title: "تم إنشاء الطلب بنجاح",
              description: "لكن حدث خطأ في إنشاء طلب الوسيط",
              variant: "default"
            });
          }
        }

        clearCart();
        setFormData(initialFormData);
        setDiscount(0);
        setLoyaltyDiscount(0);
        
        toast({
          title: "تم إنشاء الطلب بنجاح",
          description: `رقم الطلب: ${result.order.order_number}`,
        });

        if (onOrderCreated) {
          onOrderCreated(result.order);
        }
      }
    } catch (error) {
      console.error('خطأ في إنشاء الطلب:', error);
      toast({
        title: "خطأ في إنشاء الطلب",
        description: error.message || "حدث خطأ غير متوقع",
        variant: "destructive"
      });
    } finally {
      if (setIsSubmitting) setIsSubmitting(false);
    }
  };

  const handleUpdateOrder = async () => {
    try {
      if (setIsSubmitting) setIsSubmitting(true);
      
      const subtotal = cart.reduce((sum, item) => sum + (item.total || 0), 0);
      const finalDiscount = applyLoyaltyDiscount ? loyaltyDiscount : 0;
      const discountedSubtotal = Math.max(0, subtotal - finalDiscount - discount);
      const deliveryFee = settings?.deliveryFee || 0;
      const finalTotal = discountedSubtotal + deliveryFee;

      const updateData = {
        customer_name: formData.name.trim(),
        customer_phone: formData.phone.trim(),
        customer_phone2: formData.second_phone?.trim() || null,
        customer_city: formData.city || 'بغداد',
        customer_province: formData.region || '',
        customer_address: formData.address.trim(),
        notes: formData.notes?.trim() || '',
        total_amount: discountedSubtotal,
        delivery_fee: deliveryFee,
        final_amount: finalTotal,
        discount: finalDiscount + discount,
        loyalty_discount: finalDiscount,
        manual_discount: discount,
        items: cart.map(item => ({
          product_id: item.id,
          variant_id: item.variant?.id || item.sku,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.total,
          productname: item.name,
          color: item.color || '',
          size: item.size || '',
          image: item.image || (item.images && item.images[0]) || '/placeholder.svg',
          barcode: item.barcode || '',
          sku: item.sku || ''
        }))
      };

      console.log('🔄 Updating order:', originalOrder.id, updateData);
      
      const result = await updateOrder(originalOrder.id, updateData);
      
      if (result && result.success) {
        toast({
          title: "تم تحديث الطلب بنجاح",
          description: `رقم الطلب: ${originalOrder.order_number}`,
        });

        if (onOrderCreated) {
          onOrderCreated(result.order);
        }
      }
    } catch (error) {
      console.error('خطأ في تحديث الطلب:', error);
      toast({
        title: "خطأ في تحديث الطلب",
        description: error.message || "حدث خطأ غير متوقع",
        variant: "destructive"
      });
    } finally {
      if (setIsSubmitting) setIsSubmitting(false);
    }
  };

  // دالة للحقول الخاصة بشريك التوصيل
  const partnerSpecificFields = () => {
    if (activePartner === 'local') {
      return (
        <div className="space-y-2">
          <Label htmlFor="city">المدينة</Label>
          <Select name="city" value={formData.city} onValueChange={(value) => handleSelectChange('city', value)}>
            <SelectTrigger>
              <SelectValue placeholder="اختر المدينة" />
            </SelectTrigger>
            <SelectContent>
              {iraqiProvinces.map(province => (
                <SelectItem key={province} value={province}>{province}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (activePartner === 'alwaseet') {
      return (
        <>
          <div className="space-y-2">
            <Label htmlFor="city_id">المدينة</Label>
            <SearchableSelectFixed
              options={cities.map(city => ({ value: city.id, label: city.name }))}
              value={formData.city_id}
              onValueChange={(value) => handleSelectChange('city_id', value)}
              placeholder="اختر المدينة"
              disabled={loadingCities || !isWaseetLoggedIn}
              loading={loadingCities}
              error={dataFetchError}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="region_id">المنطقة</Label>
            <SearchableSelectFixed
              options={regions.map(region => ({ value: region.id, label: region.name }))}
              value={formData.region_id}
              onValueChange={(value) => handleSelectChange('region_id', value)}
              placeholder="اختر المنطقة"
              disabled={!selectedCity || loadingRegions || !isWaseetLoggedIn}
              loading={loadingRegions}
            />
          </div>
        </>
      );
    }

    return null;
  };

  return (
    <>
      {/* مساعد تحميل البيانات في وضع التعديل */}
      <EditOrderDataLoader 
        aiOrderData={aiOrderData} 
        isEditMode={isEditMode} 
        onDataLoaded={() => console.log('✅ تم تحميل بيانات التعديل')}
      />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-6xl mx-auto space-y-6"
        dir="rtl"
      >
        <CustomerInfoForm
          formData={formData}
          handleChange={handleChange}
          handleSelectChange={handleSelectChange}
          errors={errors}
          partnerSpecificFields={partnerSpecificFields}
          isSubmittingState={isSubmittingState}
          isDeliveryPartnerSelected={isDeliveryPartnerSelected}
          customerData={customerData}
          loyaltyDiscount={loyaltyDiscount}
        />
        
        <OrderDetailsForm
          formData={formData}
          setFormData={setFormData}
          handleChange={handleChange}
          handleSelectChange={handleSelectChange}
          errors={errors}
          removeFromCart={() => {}}
          cart={cart}
          calculateSubtotal={() => cart?.reduce((sum, item) => sum + (item.total || 0), 0) || 0}
          deliveryFee={settings?.deliveryFee || 0}
          discount={discount}
          setDiscount={setDiscount}
          applyLoyaltyDiscount={applyLoyaltyDiscount}
          setApplyLoyaltyDiscount={setApplyLoyaltyDiscount}
          loyaltyDiscount={loyaltyDiscount}
          setApplyLoyaltyDelivery={setApplyLoyaltyDelivery}
          applyLoyaltyDelivery={applyLoyaltyDelivery}
          customerData={customerData}
          isSubmittingState={isSubmittingState}
          activePartner={activePartner}
          packageSizes={packageSizes}
          settings={settings}
          isEditMode={isEditMode}
        />
        
        <motion.div 
          className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          dir="rtl"
        >
          {!isEditMode && (
            <>
              <Button 
                onClick={() => setDeliveryPartnerDialogOpen(true)}
                variant="outline" 
                size="lg"
                className="w-full sm:w-auto"
                disabled={isSubmittingState}
              >
                إدارة الشحن
              </Button>
              
              <Button 
                onClick={() => setProductSelectOpen(true)}
                variant="outline" 
                size="lg"
                className="w-full sm:w-auto"
                disabled={isSubmittingState}
              >
                اختيار المنتجات
              </Button>
            </>
          )}
          
          <Button
            ref={formRef}
            onClick={handleSubmit}
            disabled={
              !formData.name?.trim() || 
              !formData.phone?.trim() || 
              !cart?.length ||
              isSubmittingState ||
              (!isEditMode && !isDeliveryPartnerSelected)
            }
            size="lg"
            className="w-full sm:w-auto bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 shadow-lg"
          >
            {isSubmittingState && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            {isSubmittingState ? 'جاري الحفظ...' : isEditMode ? 'حفظ التعديلات' : 'تأكيد الطلب'}
          </Button>
        </motion.div>

        {!isEditMode && (
          <>
            <DeliveryPartnerDialog 
              open={deliveryPartnerDialogOpen}
              onOpenChange={setDeliveryPartnerDialogOpen}
            />
            
            <ProductSelectionDialog 
              open={productSelectOpen}
              onOpenChange={setProductSelectOpen}
            />
            
            {/* مكون تحميل البيانات للتعديل */}
            <EditOrderDataLoader 
              aiOrderData={aiOrderData}
              isEditMode={isEditMode}
              onDataLoaded={() => console.log('✅ تم تحميل بيانات التعديل')}
            />
            
            {activePartner === 'alwaseet' && isWaseetLoggedIn && (
              <DeliveryStatusCard 
                orderData={{
                  customer_name: formData.name,
                  customer_phone: formData.phone,
                  customer_city: selectedCity?.name || formData.city,
                  customer_address: formData.address,
                  customer_province: selectedRegion?.name || formData.region
                }}
                onCreateAlWaseetOrder={() => console.log('Creating Al Waseet order')}
                onSyncTracking={syncOrderByTracking}
              />
            )}
          </>
        )}
      </motion.div>
    </>
  );
};
