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

export const QuickOrderContent = ({ isDialog = false, onOrderCreated, formRef, setIsSubmitting, isSubmittingState, aiOrderData = null }) => {
  const { createOrder, settings, cart, clearCart, addToCart, approveAiOrder } = useInventory();
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
    console.log('AI Order Data received:', aiOrderData);
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
  }, [aiOrderData, clearCart, addToCart]);
  
  const [errors, setErrors] = useState({});
  const [discount, setDiscount] = useState(0);
  const [customerData, setCustomerData] = useState(null);
  const [loyaltyDiscount, setLoyaltyDiscount] = useState(0);
  
  // جلب بيانات العميل عند إدخال رقم الهاتف
  useEffect(() => {
    const fetchCustomerData = async () => {
      if (!formData.phone || formData.phone.length < 4) {
        setCustomerData(null);
        setLoyaltyDiscount(0);
        setDiscount(0);
        return;
      }
      
      console.log('🔍 البحث عن العميل برقم:', formData.phone);
      
      // تنظيف وتطبيع رقم الهاتف
      let cleanPhone = formData.phone.replace(/\D/g, ''); // إزالة جميع غير الأرقام
      
      console.log('📱 الرقم بعد التنظيف:', cleanPhone);
      
      // إنشاء جميع الأنماط المحتملة للبحث
      const searchPatterns = new Set([
        formData.phone.trim(),        // الرقم كما هو
        cleanPhone               // الرقم منظف
      ]);
      
      // إضافة الأنماط العراقية المختلفة
      if (cleanPhone.startsWith('964')) {
        // إذا بدأ بـ 964، أزل الرمز واجعله بدون صفر
        const withoutCountryCode = cleanPhone.substring(3);
        searchPatterns.add(withoutCountryCode);
        searchPatterns.add(`0${withoutCountryCode}`);
      } else if (cleanPhone.startsWith('0')) {
        // إذا بدأ بصفر، أضف بدون صفر ومع رمز البلد
        const withoutZero = cleanPhone.substring(1);
        searchPatterns.add(withoutZero);
        searchPatterns.add(`964${withoutZero}`);
        searchPatterns.add(`+964${withoutZero}`);
        searchPatterns.add(`00964${withoutZero}`);
      } else {
        // إذا لم يبدأ بصفر أو 964، أضف جميع الصيغ
        searchPatterns.add(
          `0${cleanPhone}`,             // 07728020024
          `964${cleanPhone}`,           // 9647728020024
          `+964${cleanPhone}`,          // +9647728020024
          `00964${cleanPhone}`          // 009647728020024
        );
      }
      
      console.log('🔍 جميع أنماط البحث:', Array.from(searchPatterns));
      
      let customer = null;
      
      // البحث بجميع الأنماط
      for (const pattern of searchPatterns) {
        console.log(`🔎 البحث برقم: ${pattern}`);
        
        try {
          const { data, error } = await supabase
            .from('customers')
            .select(`
              *,
              customer_loyalty (
                total_points,
                total_spent,
                current_tier_id,
                loyalty_tiers (
                  name,
                  discount_percentage
                )
              )
            `)
            .eq('phone', pattern)
            .maybeSingle();
            
          if (data && !error) {
            customer = data;
            console.log(`✅ تم العثور على العميل برقم: ${pattern}`);
            break;
          }
        } catch (err) {
          console.error(`خطأ في البحث برقم ${pattern}:`, err);
        }
      }

      if (!customer) {
        console.log('❌ لم يتم العثور على العميل');
        setCustomerData(null);
        setLoyaltyDiscount(0);
        setDiscount(0);
        return;
      }

      console.log('✅ تم العثور على العميل:', customer);
      setCustomerData(customer);
      
      // ملء البيانات تلقائياً مع حماية من null
      setFormData(prev => ({
        ...prev,
        name: customer.name || prev.name,
        city: customer.city || prev.city,
        address: customer.address || prev.address
      }));

      // حساب وتطبيق خصم الولاء فوراً مع التقريب المطلوب
      const loyaltyData = customer.customer_loyalty;
      if (loyaltyData && loyaltyData.loyalty_tiers) {
        const discountPercentage = loyaltyData.loyalty_tiers.discount_percentage || 0;
        
        // إعادة حساب الخصم مع السلة الحالية
        const currentSubtotal = Array.isArray(cart) ? cart.reduce((sum, item) => sum + (item.total || 0), 0) : 0;
        const baseDiscountAmount = (currentSubtotal * discountPercentage) / 100;
        
        // تقريب الخصم إلى أقرب 500 دينار
        const roundedDiscountAmount = Math.round(baseDiscountAmount / 500) * 500;
        
        console.log(`🛒 مجموع السلة: ${currentSubtotal} د.ع`);
        console.log(`🎁 خصم الولاء الأساسي: ${discountPercentage}% = ${baseDiscountAmount} د.ع`);
        console.log(`🎁 خصم الولاء المقرب: ${roundedDiscountAmount} د.ع`);
        
        setLoyaltyDiscount(roundedDiscountAmount);
        setDiscount(roundedDiscountAmount); // تطبيق الخصم مباشرة
        
        // عدم إظهار رسالة الولاء للموظفين لتجنب الخلط
        // لأن كل موظف يرى عملاءه فقط
        console.log(`✅ تم العثور على العميل: ${customer.name} - نقاط: ${loyaltyData.total_points}`);
        if (roundedDiscountAmount > 0) {
          console.log(`🎁 خصم الولاء المقرب: ${roundedDiscountAmount} د.ع`);
        }
      }

    };

    fetchCustomerData();
  }, [formData.phone]);

  
  // تحديث الخصم عند تغيير السلة مع التقريب المطلوب
  useEffect(() => {
    if (customerData?.customer_loyalty?.loyalty_tiers?.discount_percentage && cart.length > 0) {
      const discountPercentage = customerData.customer_loyalty.loyalty_tiers.discount_percentage;
      const currentSubtotal = Array.isArray(cart) ? cart.reduce((sum, item) => sum + (item.total || 0), 0) : 0;
      const baseDiscountAmount = (currentSubtotal * discountPercentage) / 100;
      
      // تقريب الخصم إلى أقرب 500 دينار
      const roundedDiscountAmount = Math.round(baseDiscountAmount / 500) * 500;
      
      setLoyaltyDiscount(roundedDiscountAmount);
      setDiscount(roundedDiscountAmount);
      
      console.log(`🔄 تحديث الخصم: ${baseDiscountAmount} → ${roundedDiscountAmount} د.ع`);
    }
  }, [cart, customerData]);
  
  
  const [cities, setCities] = useState([]);
  const [regions, setRegions] = useState([]);
  const [packageSizes, setPackageSizes] = useState([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingRegions, setLoadingRegions] = useState(false);
  const [loadingPackageSizes, setLoadingPackageSizes] = useState(false);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  const [dataFetchError, setDataFetchError] = useState(false);

  // حساب المجاميع
  const subtotal = useMemo(() => Array.isArray(cart) ? cart.reduce((sum, item) => sum + item.total, 0) : 0, [cart]);
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
  
  // تحديث تفاصيل الطلب والسعر تلقائياً عند تغيير السلة أو الشريك أو الخصم
  useEffect(() => {
    const safeCart = Array.isArray(cart) ? cart : [];
    const quantityCount = safeCart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const cartSubtotal = safeCart.reduce((sum, item) => sum + (item.total || (item.price * item.quantity) || 0), 0);
    
    // حساب رسوم التوصيل بناءً على نوع الشريك
    let currentDeliveryFee = 0;
    if (activePartner === 'local') {
      // للتوصيل المحلي، أضف رسوم التوصيل
      currentDeliveryFee = settings?.deliveryFee || 0;
    }
    // للوسيط أو الشركات الأخرى، لا توجد رسوم إضافية
    
    // حساب السعر النهائي: (مجموع المنتجات - الخصم) + رسوم التوصيل
    const totalAfterDiscount = cartSubtotal - (discount || 0);
    const finalPriceWithDelivery = totalAfterDiscount + currentDeliveryFee;
    
    const detailsString = safeCart
      .map(item => 
        `${item.productName || ''} ${item.size || ''} . ${item.color || ''}${item.quantity > 1 ? ` (عدد ${item.quantity})` : ''}`.trim().replace(/ +/g, ' ')
      )
      .filter(detail => detail)
      .join(' + ');

    setFormData(prev => ({
      ...prev, 
      quantity: quantityCount > 0 ? quantityCount : 1,
      price: finalPriceWithDelivery > 0 ? finalPriceWithDelivery : '',
      details: detailsString,
    }));
  }, [cart, settings?.deliveryFee, activePartner, discount]);

  const validateField = (name, value) => {
    let errorMsg = '';
    if (name === 'phone') {
        // قبول أي رقم 10-11 رقم بدون قيود على البداية
        const normalizedPhone = normalizePhoneNumber(value);
        if (value && (!normalizedPhone || normalizedPhone.length < 10 || normalizedPhone.length > 11)) {
            errorMsg = 'رقم الهاتف يجب أن يكون 10 أو 11 أرقام.';
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
    
    // قبول أي رقم 10-11 رقم بدون شرط البداية
    const normalizedPhone = normalizePhoneNumber(formData.phone);
    if (!normalizedPhone || normalizedPhone.length < 10 || normalizedPhone.length > 11) {
      newErrors.phone = 'رقم الهاتف يجب أن يكون 10 أو 11 أرقام.';
    }
    
    if (activePartner === 'local' && !formData.city) newErrors.city = 'الرجاء اختيار المحافظة.';
    else if (activePartner === 'alwaseet' && !formData.city_id) newErrors.city_id = 'الرجاء اختيار المدينة.';
    if (activePartner === 'local' && !formData.region) newErrors.region = 'الرجاء إدخال المنطقة.';
    else if (activePartner === 'alwaseet' && !formData.region_id) newErrors.region_id = 'الرجاء اختيار المنطقة.';
    const safeCartForValidation = Array.isArray(cart) ? cart : [];
    if (safeCartForValidation.length === 0) {
        toast({ title: "السلة فارغة", description: "الرجاء إضافة منتجات أولاً.", variant: "destructive" });
        return false;
    }
    if (!formData.details) newErrors.details = 'الرجاء إدخال نوع البضاعة.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // تطبيع رقم الهاتف - قبول أي رقم 10-11 رقم
  const normalizePhoneNumber = (phone) => {
    if (!phone) return '';
    
    // إزالة المسافات والشرطات والأقواس
    const cleaned = phone.replace(/[\s\-\(\)]/g, '');
    
    // إزالة +964 إذا كان موجوداً
    if (cleaned.startsWith('+964')) {
      return cleaned.substring(4);
    }
    
    // إزالة 964 إذا كان موجوداً (بدون +)
    if (cleaned.startsWith('964')) {
      return cleaned.substring(3);
    }
    
    // استخراج الأرقام فقط
    const digits = cleaned.replace(/\D/g, '');
    
    return digits;
  };

  const formatPhoneNumber = (phone) => {
    const normalized = normalizePhoneNumber(phone);
    if (normalized && normalized.length >= 10) {
      return `+964${normalized}`;
    }
    return phone;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm() || !isDeliveryPartnerSelected || isSubmittingState) return;
    if (setIsSubmitting) setIsSubmitting(true);
    
    try {
      const deliveryFeeAmount = settings?.deliveryFee || 5000;
      const finalTotal = subtotal - discount + (formData.type === 'توصيل' ? deliveryFeeAmount : 0);
      
      const orderData = {
        ...formData,
        items: cart.map(item => ({
          product_id: item.id,
          variant_id: item.variantId,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.price * item.quantity
        })),
        total_amount: Math.round(finalTotal),
        discount,
        delivery_fee: formData.type === 'توصيل' ? deliveryFeeAmount : 0,
        final_amount: Math.round(finalTotal),
        customer_name: formData.name,
        customer_phone: formData.phone,
        customer_address: formData.address,
        customer_city: formData.city,
        customer_province: formData.province,
        notes: formData.notes,
        payment_status: 'pending',
        delivery_status: 'pending',
        status: 'pending'
      };

      // إذا كان هذا تعديل على طلب ذكي، قم بالموافقة عليه وإنشاء طلب عادي
      if (isDialog && aiOrderData) {
        try {
          const result = await createOrder(orderData);
          if (result.success) {
            // حذف الطلب الذكي بعد الموافقة عليه
            await approveAiOrder(aiOrderData.id);
            
            toast({
              title: "تم بنجاح!",
              description: "تم إنشاء الطلب بنجاح من الطلب الذكي",
              variant: "success",
            });
            
            if (onOrderCreated) {
              onOrderCreated();
            }
          } else {
            throw new Error(result.message || 'فشل في إنشاء الطلب');
          }
        } catch (error) {
          console.error('Error creating order from AI order:', error);
          toast({
            title: "خطأ",
            description: error.message || "حدث خطأ أثناء إنشاء الطلب",
            variant: "destructive",
          });
        }
        return;
      }

      // إنشاء طلب عادي - الكود الأصلي
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
      } else if (activePartner === 'local') {
          // الطلبات المحلية - سيتم إنشاء رقم التتبع تلقائياً في useOrders
          trackingNumber = null;
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
      
      // معلومات شريك التوصيل
      const deliveryData = {
        delivery_partner: activePartner === 'local' ? 'محلي' : 'Al-Waseet',
        delivery_fee: activePartner === 'local' ? 0 : (deliveryPartnerData?.delivery_fee || 0)
      };
      
      const result = await createOrder(customerInfoPayload, cart, trackingNumber, discount, orderStatus, qrLink, { ...deliveryPartnerData, ...deliveryData });
      if (result.success) {
        // إشعار محسن مع QR ID
        toast({ 
          title: (
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              تم إنشاء الطلب بنجاح
            </div>
          ),
          description: (
            <div className="space-y-1">
              <p><strong>QR ID:</strong> {result.qr_id || result.trackingNumber}</p>
              <p><strong>العميل:</strong> {formData.name}</p>
              <p><strong>المبلغ:</strong> {Math.round(finalTotal).toLocaleString()} د.ع</p>
            </div>
          ),
          variant: 'success',
          duration: 5000
        });
        resetForm();
        if(onOrderCreated) onOrderCreated();
      } else { throw new Error(result.error || "فشل إنشاء الطلب في النظام."); }
    } catch (error) {
      toast({ title: "خطأ", description: error.message || "فشل إنشاء الطلب.", variant: "destructive" });
    } finally { 
        if (setIsSubmitting) setIsSubmitting(false);
    }
  };
  
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
  const pageProps = { 
    ref: formRef, 
    onSubmit: (e) => {
      console.log('Form submit intercepted');
      handleSubmit(e);
    } 
  };
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
            customerData={customerData}
            loyaltyDiscount={loyaltyDiscount}
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
            settings={settings}
            discount={discount}
            setDiscount={setDiscount}
            subtotal={subtotal}
            total={total}
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
        
        {isDialog && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Button type="submit" className="w-full text-lg py-6" disabled={isSubmitDisabled}>
                {isSubmittingState && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                حفظ التعديلات وإنشاء الطلب
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