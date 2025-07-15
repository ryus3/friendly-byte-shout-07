import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { toast } from '@/components/ui/use-toast';
import { getCities, getRegionsByCity, createAlWaseetOrder, getPackageSizes } from '@/lib/alwaseet-api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SearchableSelectFixed from '@/components/ui/searchable-select-fixed';
import { Loader2 } from 'lucide-react';
import DeliveryPartnerDialog from '@/components/DeliveryPartnerDialog';
import { motion } from 'framer-motion';
import ProductSelectionDialog from '@/components/products/ProductSelectionDialog';
import { useAuth } from '@/contexts/AuthContext';
import { iraqiProvinces } from '@/lib/iraq-provinces';
import DeliveryStatusCard from './DeliveryStatusCard';
import CustomerInfoForm from './CustomerInfoForm';
import OrderDetailsForm from './OrderDetailsForm';
import useLocalStorage from '@/hooks/useLocalStorage';

export const QuickOrderContent = ({ isDialog = false, onOrderCreated, formRef, setIsSubmitting, isSubmittingState, aiOrderData = null }) => {
  const { createOrder, settings, cart, clearCart, addToCart } = useInventory();
  const { user } = useAuth();
  const { isLoggedIn: isWaseetLoggedIn, token: waseetToken, activePartner, setActivePartner, fetchToken } = useAlWaseet();
  const [deliveryPartnerDialogOpen, setDeliveryPartnerDialogOpen] = useState(false);
  const [productSelectOpen, setProductSelectOpen] = useState(false);
  
  // Local storage for default customer name and delivery partner
  const [defaultCustomerName, setDefaultCustomerName] = useLocalStorage('defaultCustomerName', user?.default_customer_name || '');
  const [defaultDeliveryPartner, setDefaultDeliveryPartner] = useLocalStorage('defaultDeliveryPartner', activePartner || '');

  const initialFormData = useMemo(() => ({
    name: defaultCustomerName || user?.default_customer_name || '', 
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
    size: '', 
    type: 'new', 
    promocode: '',
    defaultCustomerName: defaultCustomerName || user?.default_customer_name || ''
  }), [defaultCustomerName, user?.default_customer_name]);
  const [formData, setFormData] = useState(initialFormData);
  
  // ملء البيانات من الطلب الذكي عند وجوده
  useEffect(() => {
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
      
      setFormData(prev => ({
        ...prev,
        name: aiOrderData.customer_name || '',
        phone: aiOrderData.customer_phone || '',
        city: parsedCity || 'بغداد', // Default to Baghdad
        region: parsedRegion || '',
        address: aiOrderData.customer_address || '',
        notes: '',
        details: Array.isArray(aiOrderData.items) ? 
          aiOrderData.items.map(item => `${item.name} (${item.quantity})`).join(' + ') : '',
        quantity: Array.isArray(aiOrderData.items) ? 
          aiOrderData.items.reduce((sum, item) => sum + (item.quantity || 1), 0) : 1,
        price: aiOrderData.total_amount || 0
      }));
      
      // إضافة المنتجات للسلة مع التحقق من وجودها في قاعدة البيانات
      if (Array.isArray(aiOrderData.items)) {
        clearCart();
        aiOrderData.items.forEach(item => {
          const product = { 
            id: item.product_id || `ai-${Date.now()}-${Math.random()}`, 
            name: item.name,
            images: item.images || []
          };
          const variant = { 
            price: item.price || 0, 
            cost_price: item.cost_price || 0,
            color: item.color || '', 
            size: item.size || '',
            barcode: item.barcode || ''
          };
          addToCart(product, variant, item.quantity || 1, false);
        });
      }
    }
  }, [aiOrderData, clearCart, addToCart]);
  const [errors, setErrors] = useState({});
  const [discount, setDiscount] = useState(0);
  const [cities, setCities] = useState([]);
  const [regions, setRegions] = useState([]);
  const [packageSizes, setPackageSizes] = useState([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingRegions, setLoadingRegions] = useState(false);
  const [loadingPackageSizes, setLoadingPackageSizes] = useState(false);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  const [dataFetchError, setDataFetchError] = useState(false);

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.total, 0), [cart]);
  const deliveryFee = useMemo(() => settings?.deliveryFee || 0, [settings]);
  const total = useMemo(() => subtotal - discount, [subtotal, discount]);
  const priceWithDelivery = useMemo(() => total + deliveryFee, [total, deliveryFee]);
  
  const resetForm = useCallback(() => {
    setFormData(initialFormData);
    clearCart();
    setDiscount(0);
    setErrors({});
  }, [clearCart, initialFormData]);

  // تحديث الاسم الافتراضي عند تغيير بيانات المستخدم
  useEffect(() => {
    if (user?.default_customer_name && user?.default_customer_name !== defaultCustomerName) {
      setDefaultCustomerName(user.default_customer_name);
      setFormData(prev => ({ 
        ...prev, 
        name: user.default_customer_name,
        defaultCustomerName: user.default_customer_name
      }));
    }
  }, [user?.default_customer_name, defaultCustomerName, setDefaultCustomerName]);

  // تحديث شريك التوصيل الافتراضي
  useEffect(() => {
    if (activePartner && activePartner !== defaultDeliveryPartner) {
      setDefaultDeliveryPartner(activePartner);
    }
  }, [activePartner, defaultDeliveryPartner, setDefaultDeliveryPartner]);

  // تحديث الاسم في النموذج عند تغيير الافتراضي  
  useEffect(() => {
    if (defaultCustomerName && (!formData.name || formData.name !== defaultCustomerName)) {
      setFormData(prev => ({ 
        ...prev, 
        name: defaultCustomerName,
        defaultCustomerName: defaultCustomerName
      }));
    }
  }, [defaultCustomerName]);

  const orderCreationMode = useMemo(() => user?.order_creation_mode || 'choice', [user]);

  useEffect(() => {
    if (orderCreationMode === 'local_only') {
      setActivePartner('local');
    } else if (orderCreationMode === 'partner_only' && activePartner === 'local') {
      setActivePartner('alwaseet');
    }
  }, [orderCreationMode, setActivePartner, activePartner]);

  const isDeliveryPartnerSelected = useMemo(() => activePartner !== null, [activePartner]);

  useEffect(() => {
    if (orderCreationMode === 'choice' && !isDeliveryPartnerSelected) {
      setDeliveryPartnerDialogOpen(true);
    }
  }, [isDeliveryPartnerSelected, orderCreationMode]);

  useEffect(() => {
    const fetchInitialData = async () => {
      if (activePartner === 'alwaseet' && waseetToken) {
        setLoadingCities(true);
        setLoadingPackageSizes(true);
        setInitialDataLoaded(false);
        setDataFetchError(false);
        try {
          const [citiesData, packageSizesData] = await Promise.all([
            getCities(waseetToken),
            getPackageSizes(waseetToken)
          ]);
          
          const safeCities = Array.isArray(citiesData) ? citiesData : Object.values(citiesData || {});
          const safePackageSizes = Array.isArray(packageSizesData) ? packageSizesData : Object.values(packageSizesData || {});

          setCities(safeCities);
          setPackageSizes(safePackageSizes);

          const normalSize = safePackageSizes.find(s => s.size && (s.size.toLowerCase().includes('normal') || s.size.includes('عادي')));
          if (normalSize) {
             setFormData(prev => ({ ...prev, size: String(normalSize.id) }));
          } else if (safePackageSizes.length > 0) {
            setFormData(prev => ({ ...prev, size: String(safePackageSizes[0].id) }));
          }
        } catch (error) {
          setDataFetchError(true);
          toast({ title: "خطأ", description: "فشل تحميل بيانات شركة التوصيل. قد يكون التوكن غير صالح أو منتهي الصلاحية.", variant: "destructive" }); 
        } finally { 
          setLoadingCities(false); 
          setLoadingPackageSizes(false);
          setInitialDataLoaded(true);
        }
      } else if (activePartner === 'local') {
        setFormData(prev => ({...prev, size: 'normal' }));
        setInitialDataLoaded(true);
        setDataFetchError(false);
      }
    };
    
    if(isDeliveryPartnerSelected) {
        if(activePartner === 'alwaseet' && !isWaseetLoggedIn) {
            setInitialDataLoaded(false);
        } else {
            fetchInitialData();
        }
    }
  }, [activePartner, waseetToken, isWaseetLoggedIn, isDeliveryPartnerSelected]);

  useEffect(() => {
    if (formData.city_id && activePartner === 'alwaseet' && waseetToken) {
      const fetchRegionsData = async () => {
        setLoadingRegions(true);
        setRegions([]);
        setFormData(prev => ({ ...prev, region_id: '' }));
        try {
            const regionsData = await getRegionsByCity(waseetToken, formData.city_id);
            const safeRegions = Array.isArray(regionsData) ? regionsData : Object.values(regionsData || {});
            setRegions(safeRegions);
        } catch (error) { toast({ title: "خطأ", description: "فشل تحميل المناطق.", variant: "destructive" }); }
        finally { setLoadingRegions(false); }
      };
      fetchRegionsData();
    }
  }, [formData.city_id, activePartner, waseetToken]);
  
  useEffect(() => {
    const quantityCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const deliveryFeeAmount = settings?.deliveryFee || 5000;
    const totalWithDelivery = subtotal + (formData.type === 'توصيل' ? deliveryFeeAmount : 0);
    
    const detailsString = cart
      .map(item => 
        `${item.productName || ''} ${item.size || ''} . ${item.color || ''}${item.quantity > 1 ? ` (عدد ${item.quantity})` : ''}`.trim().replace(/ +/g, ' ')
      )
      .filter(detail => detail)
      .join(' + ');

    setFormData(prev => ({
      ...prev, 
      quantity: quantityCount > 0 ? quantityCount : 1,
      price: totalWithDelivery > 0 ? totalWithDelivery : '',
      details: detailsString,
    }));
  }, [cart, settings?.deliveryFee, formData.type]);

  const validateField = (name, value) => {
    let errorMsg = '';
    if (name === 'phone') {
        const phoneRegex = /^07[5789]\d{8}$/; // 10 digits total
        const phoneRegex11 = /^07[5789]\d{9}$/; // 11 digits total
        if (value && !phoneRegex.test(value) && !phoneRegex11.test(value)) {
            errorMsg = 'رقم الهاتف يجب أن يكون 10 أو 11 أرقام ويبدأ بـ 07.';
        }
    }
    setErrors(prev => ({ ...prev, [name]: errorMsg }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // حفظ اسم الزبون كافتراضي عند تغييره
    if (name === 'name' && value.trim() && value !== defaultCustomerName) {
      setDefaultCustomerName(value.trim());
    }
    
    validateField(name, value);
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const validateForm = () => {
    const newErrors = {};
    const phoneRegex = /^07[5789]\d{8}$/; // 10 digits total
    const phoneRegex11 = /^07[5789]\d{9}$/; // 11 digits total
    
    if (!formData.phone || (!phoneRegex.test(formData.phone) && !phoneRegex11.test(formData.phone))) newErrors.phone = 'رقم الهاتف يجب أن يكون 10 أو 11 أرقام ويبدأ بـ 07.';
    if (activePartner === 'local' && !formData.city) newErrors.city = 'الرجاء اختيار المحافظة.';
    else if (activePartner === 'alwaseet' && !formData.city_id) newErrors.city_id = 'الرجاء اختيار المدينة.';
    if (activePartner === 'local' && !formData.region) newErrors.region = 'الرجاء إدخال المنطقة.';
    else if (activePartner === 'alwaseet' && !formData.region_id) newErrors.region_id = 'الرجاء اختيار المنطقة.';
    if (cart.length === 0) {
        toast({ title: "السلة فارغة", description: "الرجاء إضافة منتجات أولاً.", variant: "destructive" });
        return false;
    }
    if (!formData.details) newErrors.details = 'الرجاء إدخال نوع البضاعة.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const formatPhoneNumber = (phone) => {
    if (phone && phone.startsWith('0')) {
      return `+964${phone.substring(1)}`;
    }
    return phone; // Already in international format or empty
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm() || !isDeliveryPartnerSelected || isSubmittingState) return;
    setIsSubmitting(true);
    try {
      let trackingNumber = null;
      let orderStatus = 'pending';
      let qrLink = null;
      let deliveryPartnerData = null;

      if (activePartner === 'alwaseet') {
          if (!isWaseetLoggedIn || !waseetToken) throw new Error("يجب تسجيل الدخول لشركة التوصيل أولاً.");
          
            const alWaseetPayload = {
              client_name: formData.name.trim() || defaultCustomerName || formData.defaultCustomerName || `زبون-${Date.now().toString().slice(-6)}`, 
              client_mobile: formatPhoneNumber(formData.phone), 
              client_mobile2: formData.second_phone ? formatPhoneNumber(formData.second_phone) : '',
              city_id: formData.city_id, 
              region_id: formData.region_id, 
              location: formData.address,
              type_name: formData.details, 
              items_number: formData.quantity,
              price: formData.price,
              package_size: formData.size,
              merchant_notes: formData.notes,
              replacement: formData.type === 'exchange' ? 1 : 0
           };
          const alWaseetResponse = await createAlWaseetOrder(alWaseetPayload, waseetToken);
          
          if (!alWaseetResponse || !alWaseetResponse.qr_id) {
            throw new Error("لم يتم استلام رقم التتبع من شركة التوصيل.");
          }

          trackingNumber = alWaseetResponse.qr_id;
          qrLink = alWaseetResponse.qr_link;
          deliveryPartnerData = alWaseetResponse;
      }
      const city = activePartner === 'local' ? formData.city : (Array.isArray(cities) ? cities.find(c => c.id == formData.city_id)?.name : '') || '';
      const region = activePartner === 'local' ? formData.region : (Array.isArray(regions) ? regions.find(r => r.id == formData.region_id)?.name : '') || '';
      const customerInfoPayload = {
        name: formData.name.trim() || defaultCustomerName || formData.defaultCustomerName || `زبون-${Date.now().toString().slice(-6)}`, 
        phone: formData.phone,
        address: `${formData.address}, ${region}, ${city}`,
        city: city, 
        notes: formData.notes,
      };
      
      const result = await createOrder(customerInfoPayload, cart, String(trackingNumber), discount, orderStatus, qrLink, deliveryPartnerData);
      if (result.success) {
        toast({ title: "نجاح", description: `تم إنشاء الطلب بنجاح. رقم الفاتورة: ${result.trackingNumber}`, variant: 'success' });
        resetForm();
        if(onOrderCreated) onOrderCreated();
      } else { throw new Error(result.error || "فشل إنشاء الطلب في النظام."); }
    } catch (error) {
      toast({ title: "خطأ", description: error.message || "فشل إنشاء الطلب.", variant: "destructive" });
    } finally { 
        setIsSubmitting(false);
    }
  };
  
  const handleConfirmProductSelection = (selectedItems) => {
    clearCart();
    selectedItems.forEach(item => {
        const product = { id: item.productId, name: item.productName, images: [item.image] };
        const variant = { sku: item.sku, color: item.color, size: item.size, price: item.price, cost_price: item.costPrice, quantity: item.stock, reserved: item.reserved, image: item.image };
        addToCart(product, variant, item.quantity, false);
    });
    setProductSelectOpen(false);
    toast({ title: "تم تحديث السلة", variant: "success" });
  };
  
  const partnerSpecificFields = () => {
      if (activePartner === 'local') {
          return (
            <>
              <div className="space-y-2">
                <Label htmlFor="city">المحافظة</Label>
                <SearchableSelectFixed
                  value={formData.city}
                  onValueChange={(v) => handleSelectChange('city', v)}
                  options={iraqiProvinces.map(p => ({ value: p.name, label: p.name }))}
                  placeholder="اختر محافظة"
                  searchPlaceholder="بحث في المحافظات..."
                  emptyText="لا توجد محافظة بهذا الاسم"
                  className={errors.city ? "border-red-500" : ""}
                />
                {errors.city && <p className="text-sm text-red-500">{errors.city}</p>}
              </div>
              <div className="space-y-2">
                  <Label htmlFor="region">المنطقة او القضاء</Label>
                  <Input id="region" name="region" value={formData.region} onChange={handleChange} required className={errors.region ? "border-red-500" : ""}/>
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
      )
  }

  const PageWrapper = isDialog ? 'form' : 'form';
  const pageProps = { ref: formRef, onSubmit: handleSubmit };
  const isSubmitDisabled = isSubmittingState || !isDeliveryPartnerSelected || (activePartner === 'alwaseet' && (!isWaseetLoggedIn || !initialDataLoaded || dataFetchError)) || Object.values(errors).some(e => e) || cart.length === 0;

  return (
    <>
      <PageWrapper {...pageProps} className={!isDialog ? "max-w-4xl mx-auto space-y-6" : "space-y-4"}>
        {!isDialog && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl font-bold gradient-text">طلب سريع</h1>
            <p className="text-muted-foreground mt-1">إنشاء طلب جديد وإرساله لشركة التوصيل مباشرة.</p>
          </motion.div>
        )}

        <DeliveryStatusCard
          mode={orderCreationMode}
          activePartner={activePartner}
          isLoggedIn={isWaseetLoggedIn}
          onManageClick={() => setDeliveryPartnerDialogOpen(true)}
        />

        <fieldset disabled={isSubmittingState} className="space-y-6">
          <CustomerInfoForm 
            formData={formData}
            handleChange={handleChange}
            handleSelectChange={handleSelectChange}
            errors={errors}
            partnerSpecificFields={partnerSpecificFields}
            isSubmittingState={isSubmittingState}
            isDeliveryPartnerSelected={isDeliveryPartnerSelected}
          />
          <OrderDetailsForm
            formData={formData}
            handleChange={handleChange}
            handleSelectChange={handleSelectChange}
            setProductSelectOpen={setProductSelectOpen}
            isSubmittingState={isSubmittingState}
            isDeliveryPartnerSelected={isDeliveryPartnerSelected}
            packageSizes={packageSizes}
            loadingPackageSizes={loadingPackageSizes}
            activePartner={activePartner}
            dataFetchError={dataFetchError}
          />
        </fieldset>

        {!isDialog && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Button type="submit" className="w-full text-lg py-6" disabled={isSubmitDisabled}>
                {isSubmittingState && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                تأكيد وإنشاء الطلب
              </Button>
          </motion.div>
        )}
      </PageWrapper>

      <DeliveryPartnerDialog open={deliveryPartnerDialogOpen} onOpenChange={setDeliveryPartnerDialogOpen} />
      <ProductSelectionDialog 
          open={productSelectOpen} 
          onOpenChange={setProductSelectOpen}
          onConfirm={handleConfirmProductSelection}
          initialCart={cart}
      />
    </>
  );
};