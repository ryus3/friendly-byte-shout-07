import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import { useCart } from '@/hooks/useCart.jsx';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { toast } from '@/components/ui/use-toast';
import { getCities, getRegionsByCity, createAlWaseetOrder, editAlWaseetOrder, getPackageSizes } from '@/lib/alwaseet-api';
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
  const { createOrder, updateOrder, settings, cart, clearCart, addToCart, approveAiOrder, orders } = useInventory();
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
    console.log('🚀 QuickOrderContent - AI/Edit Order Data received:', aiOrderData, { isEditMode });
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
        console.log('🔧 Setting form data for edit mode:', aiOrderData);
        setFormData(prev => ({
          ...prev,
          name: aiOrderData.customer_name || '',
          phone: aiOrderData.customer_phone || '',
          second_phone: aiOrderData.customer_phone2 || '',
          city: aiOrderData.customer_city || 'بغداد',
          city_id: aiOrderData.city_id || '',  // معرف المدينة للوسيط
          region: aiOrderData.customer_province || '',
          region_id: aiOrderData.region_id || '',  // معرف المنطقة للوسيط
          address: aiOrderData.customer_address || '',
          notes: aiOrderData.notes || '',
          price: aiOrderData.final_total || aiOrderData.total_amount || 0,
          delivery_fee: aiOrderData.delivery_fee || 0,
          // ضمان عرض السعر الصحيح مع التوصيل
          total_with_delivery: (aiOrderData.total_amount || 0) + (aiOrderData.delivery_fee || 0)
        }));
        
        console.log('✅ Form data set for edit mode');
        console.log('📍 Address data:', {
          city: aiOrderData.customer_city,
          city_id: aiOrderData.city_id,
          province: aiOrderData.customer_province,
          region_id: aiOrderData.region_id,
          address: aiOrderData.customer_address
        });
        
        // تحديد شريك التوصيل وتحميل البيانات اللازمة
        if (aiOrderData.delivery_partner && aiOrderData.delivery_partner !== 'محلي') {
          setActivePartner('alwaseet');
          // سيتم تحميل المدن والمناطق تلقائياً عبر useEffect
        } else {
          setActivePartner('local');
        }
        
        // تحميل المنتجات الحقيقية من النظام الموحد في وضع التعديل
        if (aiOrderData.items && Array.isArray(aiOrderData.items)) {
          console.log('🛒 QuickOrderContent - Loading real products for edit mode:', aiOrderData.items);
          clearCart();
          
          aiOrderData.items.forEach(item => {
            if (item && item.product_id && item.variant_id) {
              console.log('🔍 Loading real product for:', item);
              
              // استخدام البيانات الأصلية مع المعرفات الصحيحة
              const tempProduct = {
                id: item.product_id,
                name: item.productName || item.product_name || 'منتج',
                images: [item.image || '/placeholder.svg'],
                price: item.unit_price || item.price || 0,
                cost_price: item.costPrice || item.cost_price || 0
              };
              
              const tempVariant = {
                id: item.variant_id,
                sku: item.sku || '',
                color: item.color || '',
                size: item.size || '',
                quantity: item.stock || 999,
                reserved: 0,
                price: item.unit_price || item.price || 0,
                cost_price: item.costPrice || item.cost_price || 0,
                image: item.image || '/placeholder.svg',
                barcode: item.barcode || ''
              };
              
              addToCart(tempProduct, tempVariant, item.quantity || 1, false);
              console.log('✅ Added product to cart for edit mode:', { tempProduct, tempVariant, quantity: item.quantity });
            }
          });
          console.log('✅ Cart loaded successfully for edit mode');
        } else {
          console.log('⚠️ No items found in aiOrderData for edit mode');
        }
        
        return; // انتهاء وضع التعديل
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
  }, [aiOrderData, clearCart, addToCart, isEditMode]);
  
  const [errors, setErrors] = useState({});
  const [discount, setDiscount] = useState(0);
  const [customerData, setCustomerData] = useState(null);
  const [loyaltyDiscount, setLoyaltyDiscount] = useState(0);
  const [applyLoyaltyDiscount, setApplyLoyaltyDiscount] = useState(true);
  const [applyLoyaltyDelivery, setApplyLoyaltyDelivery] = useState(false);
  
  // جلب بيانات العميل عند إدخال رقم الهاتف - نظام موحد
  useEffect(() => {
    const fetchCustomerData = async () => {
      if (!formData.phone || formData.phone.length < 4) {
        setCustomerData(null);
        setLoyaltyDiscount(0);
        setDiscount(0);
        return;
      }
      
      console.log('🔍 البحث عن العميل برقم:', formData.phone);
      
      // استخدام دالة تطبيع الهاتف الموحدة
      const normalizedPhone = normalizePhone(formData.phone);
      
      if (!normalizedPhone) {
        console.log('❌ رقم هاتف غير صالح');
        setCustomerData(null);
        setLoyaltyDiscount(0);
        setDiscount(0);
        return;
      }
      
      console.log('📱 الرقم المطبع:', normalizedPhone);
      
      try {
        // حساب النقاط مباشرة من الطلبات المكتملة للحساب الحالي
        const completedOrders = orders?.filter(order => {
          const orderPhone = normalizePhone(extractOrderPhone(order));
          return orderPhone === normalizedPhone && 
                 order.status === 'completed' && 
                 order.receipt_received === true &&
                 order.created_by === user?.id; // طلبات هذا المستخدم فقط
        }) || [];
        
        const totalPoints = completedOrders.length * 250; // 250 نقطة لكل طلب مكتمل
        
        // حساب إجمالي الشراء بدون أجور التوصيل
        const totalSpentExclDelivery = completedOrders.reduce((sum, order) => {
          const totalAmount = order.total_amount || 0;
          const deliveryFee = order.delivery_fee || 0;
          return sum + (totalAmount - deliveryFee);
        }, 0);
        
        const totalSpent = completedOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
        
        // تحديد المستوى حسب النقاط الحالية - مطابق لقاعدة البيانات
        let currentTier = { name_ar: 'برونزي', name_en: 'BRNZ', discount_percentage: 0, free_delivery: false };
        if (totalPoints >= 3000) {
          currentTier = { name_ar: 'ماسي', name_en: 'DIAM', discount_percentage: 15, free_delivery: true };
        } else if (totalPoints >= 1500) {
          currentTier = { name_ar: 'ذهبي', name_en: 'GOLD', discount_percentage: 10, free_delivery: true };
        } else if (totalPoints >= 750) {
          currentTier = { name_ar: 'فضي', name_en: 'SILV', discount_percentage: 5, free_delivery: false };
        }
        
        // تحديد المستوى التالي بعد إضافة 250 نقطة للطلب الجديد
        const pointsAfterOrder = totalPoints + 250;
        let nextTierAfterOrder = null;
        if (totalPoints < 750 && pointsAfterOrder >= 750) {
          nextTierAfterOrder = { name_ar: 'فضي', name_en: 'SILV' };
        } else if (totalPoints < 1500 && pointsAfterOrder >= 1500) {
          nextTierAfterOrder = { name_ar: 'ذهبي', name_en: 'GOLD' };
        } else if (totalPoints < 3000 && pointsAfterOrder >= 3000) {
          nextTierAfterOrder = { name_ar: 'ماسي', name_en: 'DIAM' };
        }
        
        const customerInfo = {
          phone: normalizedPhone,
          total_points: totalPoints,
          total_spent: totalSpent,
          total_spent_excl_delivery: totalSpentExclDelivery,
          total_orders: completedOrders.length,
          currentTier,
          nextTierAfterOrder,
          first_order_date: completedOrders[0]?.created_at,
          last_order_date: completedOrders[completedOrders.length - 1]?.created_at
        };
        
        console.log('✅ تم حساب بيانات العميل من الطلبات:', customerInfo);
        setCustomerData(customerInfo);
        
        // حساب خصم الولاء المقرب لأقرب 500
        const discountPercentage = currentTier.discount_percentage || 0;
        if (discountPercentage > 0) {
          const subtotal = Array.isArray(cart) ? cart.reduce((sum, item) => sum + (item.total || 0), 0) : 0;
          const rawDiscount = (subtotal * discountPercentage) / 100;
          const roundedDiscount = Math.round(rawDiscount / 500) * 500;
          setLoyaltyDiscount(roundedDiscount);
          setApplyLoyaltyDiscount(true); // تفعيل تلقائياً
          setDiscount(roundedDiscount); // تطبيق الخصم تلقائياً
          console.log(`💰 خصم الولاء: ${discountPercentage}% = ${rawDiscount} -> ${roundedDiscount}`);
        } else {
          setLoyaltyDiscount(0);
          setApplyLoyaltyDiscount(false);
          setDiscount(0);
        }
        
        // تفعيل التوصيل المجاني تلقائياً للمستوى الذهبي
        if (currentTier.free_delivery) {
          setApplyLoyaltyDelivery(true);
        } else {
          setApplyLoyaltyDelivery(false);
        }
        
        // لا نقوم بإعداد البروموكود تلقائياً - يُترك للمستخدم
        // const promoCode = `RY${normalizedPhone.slice(-4)}${currentTier.name_en.slice(0,2)}`;
        // setFormData(prev => ({ ...prev, promocode: promoCode }));
        
      } catch (error) {
        console.error('خطأ في حساب بيانات العميل:', error);
        setCustomerData(null);
        setLoyaltyDiscount(0);
        setDiscount(0);
      }
    };

    fetchCustomerData();
  }, [formData.phone, orders, user?.id, cart]);

  
  // تحديث الخصم عند تغيير السلة مع التقريب المطلوب
  useEffect(() => {
    if (customerData?.currentTier?.discount_percentage && cart.length > 0) {
      const discountPercentage = customerData.currentTier.discount_percentage;
      const currentSubtotal = Array.isArray(cart) ? cart.reduce((sum, item) => sum + (item.total || 0), 0) : 0;
      const baseDiscountAmount = (currentSubtotal * discountPercentage) / 100;
      
      // تقريب الخصم إلى أقرب 500 دينار
      const roundedDiscountAmount = Math.round(baseDiscountAmount / 500) * 500;
      
      setLoyaltyDiscount(roundedDiscountAmount);
      
      // تحديث الخصم الإجمالي حسب حالة التطبيق
      if (applyLoyaltyDiscount) {
        const manualDiscount = Math.max(0, discount - loyaltyDiscount);
        setDiscount(roundedDiscountAmount + manualDiscount);
      }
      
      console.log(`🔄 تحديث الخصم: ${baseDiscountAmount} → ${roundedDiscountAmount} د.ع`);
    } else if (cart.length === 0) {
      setLoyaltyDiscount(0);
      setDiscount(0);
      setApplyLoyaltyDiscount(false);
      setApplyLoyaltyDelivery(false);
    }
  }, [cart, customerData, applyLoyaltyDiscount, loyaltyDiscount, discount]);
  
  // مراقبة تغييرات المدينة والمنطقة لمسح الأخطاء
  useEffect(() => {
    setErrors(prev => {
      const newErrors = { ...prev };
      if (formData.city && activePartner === 'local') {
        delete newErrors.city;
      }
      if (formData.city_id && activePartner === 'alwaseet') {
        delete newErrors.city_id;
      }
      if (formData.region && activePartner === 'local') {
        delete newErrors.region;
      }
      if (formData.region_id && activePartner === 'alwaseet') {
        delete newErrors.region_id;
      }
      return newErrors;
    });
  }, [formData.city, formData.city_id, formData.region, formData.region_id, activePartner]);
  
  const [cities, setCities] = useState([]);
  const [regions, setRegions] = useState([]);
  const [packageSizes, setPackageSizes] = useState([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingRegions, setLoadingRegions] = useState(false);
  const [loadingPackageSizes, setLoadingPackageSizes] = useState(false);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  const [dataFetchError, setDataFetchError] = useState(false);

  // تم دمج جلب البيانات مع الاستدعاء الأول في السطر 24

  // إضافة useEffect لضمان تعيين القيمة الافتراضية لحجم الطلب
  useEffect(() => {
    if (!formData.size) {
      setFormData(prev => ({
        ...prev,
        size: 'عادي'
      }));
    }
  }, [activePartner, formData.size]);

  // إضافة logging للتشخيص
  console.log('🔍 QuickOrderContent - حالة النموذج:', {
    formDataSize: formData.size,
    activePartner: activePartner,
    settings: settings,
    deliveryFee: settings?.deliveryFee
  });

  // حساب المجاميع
  const subtotal = useMemo(() => Array.isArray(cart) ? cart.reduce((sum, item) => sum + item.total, 0) : 0, [cart]);
  const currentDeliveryFee = useMemo(() => settings?.deliveryFee || 0, [settings]);
  const total = useMemo(() => subtotal - discount, [subtotal, discount]);
  const priceWithDelivery = useMemo(() => total + currentDeliveryFee, [total, currentDeliveryFee]);
  
  const resetForm = useCallback(() => {
    // إنشاء نموذج فارغ تماماً بدلاً من استخدام initialFormData
    const emptyFormData = {
      name: '', 
      phone: '', 
      second_phone: '', 
      city_id: null, 
      region_id: null,
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
    };
    
    console.log('🔄 مسح النموذج - بدء العملية');
    
    // مسح البيانات بشكل فوري ومنظم
    clearCart();
    setDiscount(0);
    setLoyaltyDiscount(0);
    setApplyLoyaltyDiscount(false);
    setApplyLoyaltyDelivery(false);
    setCustomerData(null);
    setErrors({});
    
    // مسح النموذج فوراً بدون setTimeout لتجنب التجمد
    setFormData(emptyFormData);
    setNameTouched(false);
    
    console.log('✅ مسح النموذج - تم بنجاح');
  }, [clearCart, activePartner]);

  // إصلاح جذري: إعادة تعيين المدينة الافتراضية بعد resetForm
  useEffect(() => {
    // فقط لشركة الوسيط عندما يكون city_id فارغ أو null والمدن متوفرة
    if (activePartner === 'alwaseet' && (!formData.city_id || formData.city_id === '') && cities.length > 0) {
      const baghdadCity = cities.find(city => 
        city.name?.toLowerCase().includes('بغداد') || 
        city.name?.toLowerCase().includes('baghdad')
      );
      const defaultCity = baghdadCity || cities[0];
      
      console.log('🔄 إعادة تعيين المدينة الافتراضية بعد مسح النموذج:', defaultCity.name);
      setFormData(prev => ({
        ...prev,
        city_id: String(defaultCity.id)
      }));
    }
  }, [formData.city_id, cities, activePartner]);

  // تحديث الاسم الافتراضي عند تغيير بيانات المستخدم
  useEffect(() => {
    if (user?.default_customer_name && user?.default_customer_name !== defaultCustomerName && !nameTouched) {
      setDefaultCustomerName(user.default_customer_name);
      setFormData(prev => ({ 
        ...prev, 
        name: prev.name || user.default_customer_name,
        defaultCustomerName: user.default_customer_name
      }));
    }
  }, [user?.default_customer_name, defaultCustomerName, setDefaultCustomerName, nameTouched]);

  // تحديث شريك التوصيل الافتراضي
  useEffect(() => {
    if (activePartner && activePartner !== defaultDeliveryPartner) {
      setDefaultDeliveryPartner(activePartner);
    }
  }, [activePartner, defaultDeliveryPartner, setDefaultDeliveryPartner]);

  // تحديث الاسم في النموذج عند تغيير الافتراضي (دون إزعاج المستخدم)
  useEffect(() => {
    if (!nameTouched && defaultCustomerName && (!formData.name || formData.name.trim() === '')) {
      setFormData(prev => ({ 
        ...prev, 
        name: defaultCustomerName,
        defaultCustomerName: defaultCustomerName
      }));
    }
  }, [defaultCustomerName, nameTouched, formData.name]);

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

  // تعيين بغداد كمدينة افتراضية للوسيط إذا لم تكن محددة
          if ((!formData.city_id || formData.city_id === '') && safeCities.length > 0) {
            const baghdadCity = safeCities.find(city => 
              city.name?.toLowerCase().includes('بغداد') || 
              city.name?.toLowerCase().includes('baghdad')
            );
            const defaultCity = baghdadCity || safeCities[0];
            setFormData(prev => ({
              ...prev,
              city_id: String(defaultCity.id)
            }));
          }

          // تعيين حجم "عادي" افتراضياً
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
        setFormData(prev => ({...prev, size: 'عادي' }));
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
    if (name === 'name') {
      setNameTouched(true);
    }
    validateField(name, value);
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // مسح الأخطاء المقابلة عند اختيار القيم
    if (name === 'city' || name === 'city_id') {
      setErrors(prev => ({ ...prev, city: '', city_id: '' }));
    }
    if (name === 'region' || name === 'region_id') {
      setErrors(prev => ({ ...prev, region: '', region_id: '' }));
    }
  };
  
  const validateForm = () => {
    const newErrors = {};
    
    // قبول أي رقم 10-11 رقم بدون شرط البداية
    const normalizedPhone = normalizePhoneNumber(formData.phone);
    if (!normalizedPhone || normalizedPhone.length < 10 || normalizedPhone.length > 11) {
      newErrors.phone = 'رقم الهاتف يجب أن يكون 10 أو 11 أرقام.';
    }
    
    // التحقق من المدينة والمنطقة حسب نوع الشريك
    if (activePartner === 'local') {
      if (!formData.city) newErrors.city = 'الرجاء اختيار المحافظة.';
      if (!formData.region) newErrors.region = 'الرجاء إدخال المنطقة.';
    } else if (activePartner === 'alwaseet') {
      if (!formData.city_id) newErrors.city_id = 'الرجاء اختيار المدينة.';
      if (!formData.region_id) newErrors.region_id = 'الرجاء اختيار المنطقة.';
    }
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

  // معالجة الإرسال (تحديث أو إنشاء)
  const handleSubmit = async (e) => {
    e?.preventDefault();
    
    console.log('🚀 QuickOrderContent - بدء معالجة الطلب', { isEditMode });
    
    const isFormValid = validateForm();
    if (!isFormValid) {
      console.log('❌ QuickOrderContent - فشل التحقق من صحة النموذج');
      return;
    }

    if (cart.length === 0) {
      toast({
        title: "خطأ",
        description: "يجب اختيار منتج واحد على الأقل",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting?.(true);
    
    try {
      if (isEditMode && originalOrder) {
        // وضع التعديل - استخدام updateOrder
        await handleUpdateOrder();
      } else {
        // وضع الإنشاء العادي
        await handleCreateOrder();
      }
    } catch (error) {
      console.error('❌ QuickOrderContent - خطأ في معالجة الطلب:', error);
      toast({
        title: "خطأ",
        description: error.message || "حدث خطأ أثناء معالجة الطلب",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting?.(false);
    }
  };

  // معالجة تحديث الطلب
  const handleUpdateOrder = async () => {
    try {
      console.log('🔧 Updating existing order:', originalOrder.id);
      
      const orderData = {
        customer_name: formData.name,
        customer_phone: formData.phone,
        customer_phone2: formData.second_phone || '',
        customer_address: formData.address,
        customer_city: formData.city,
        customer_province: formData.region,
        notes: formData.notes,
        delivery_partner: activePartner === 'alwaseet' ? 'alwaseet' : 'محلي',
        items: cart.map(item => ({
          product_id: item.productId,
          variant_id: item.variantId,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.total
        })),
        total_amount: subtotal,
        delivery_fee: deliveryFee,
        final_amount: finalTotal,
        discount: discount,
        custom_discount: discount,
        promo_code: formData.promocode
      };

      let updateResult;
      
      // إذا كان الطلب مع الوسيط، قم بتحديث الطلب في الوسيط أولاً
      if (activePartner === 'alwaseet' && isWaseetLoggedIn && originalOrder?.tracking_number) {
        const alwaseetData = {
          qr_id: originalOrder.tracking_number, // مطلوب للتعديل
          name: formData.name,
          phone: formData.phone,
          phone2: formData.second_phone || undefined,
          city_id: formData.city_id,
          region_id: formData.region_id,
          address: formData.address,
          details: formData.details,
          quantity: formData.quantity,
          price: formData.price,
          size: formData.size,
          notes: formData.notes,
          replacement: formData.type === 'exchange' ? 1 : 0
        };

        console.log('🔧 Updating Al-Waseet order with data:', alwaseetData);
        const waseetResponse = await editAlWaseetOrder(alwaseetData, waseetToken);
        console.log('✅ Al-Waseet order updated:', waseetResponse);
      }

      // تحديث الطلب محلياً
      updateResult = await updateOrder(originalOrder.id, orderData);
      console.log('✅ Local order updated:', updateResult);

      toast({
        title: "تم تحديث الطلب بنجاح",
        description: `رقم الطلب: ${updateResult.order_number}${updateResult.tracking_number ? ` - رقم التتبع: ${updateResult.tracking_number}` : ''}`,
        variant: "default",
      });

      // استدعاء onOrderCreated (يعمل أيضاً للتحديث)
      if (onOrderCreated) onOrderCreated(updateResult);

    } catch (error) {
      console.error('❌ Order update error:', error);
      throw error;
    }
  };

  // معالجة إنشاء الطلب
  const handleCreateOrder = async () => {
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
    if (isDialog && aiOrderData && !isEditMode) {
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
          
            // تطبيع رقم الهاتف للتأكد من التوافق مع API
            const normalizedPhone = normalizePhone(formData.phone);
            if (!normalizedPhone) {
              throw new Error('رقم الهاتف غير صحيح. يرجى إدخال رقم هاتف عراقي صحيح.');
            }
            
            const alWaseetPayload = {
              client_name: formData.name.trim() || defaultCustomerName || formData.defaultCustomerName || `زبون-${Date.now().toString().slice(-6)}`, 
              client_mobile: normalizedPhone, // استخدام الرقم المطبع
              client_mobile2: formData.second_phone ? normalizePhone(formData.second_phone) : '',
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
      // تطبيع رقم الهاتف للتأكد من التوافق مع API
      const normalizedPhone = normalizePhone(formData.phone);
      if (!normalizedPhone) {
        throw new Error('رقم الهاتف غير صحيح. يرجى إدخال رقم هاتف عراقي صحيح.');
      }
      
      const customerInfoPayload = {
        name: formData.name.trim() || defaultCustomerName || formData.defaultCustomerName || `زبون-${Date.now().toString().slice(-6)}`, 
        phone: normalizedPhone, // استخدام الرقم المطبع
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
        // إزالة المزامنة الإضافية لمنع التجمد - ستتم المزامنة تلقائياً عبر النظام الموحد
        
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
              {activePartner === 'alwaseet' && <p className="text-xs text-muted-foreground">سيتم تحديث حالة الطلب تلقائياً خلال دقائق...</p>}
            </div>
          ),
          variant: 'success',
          duration: 5000
        });
        // تأخير resetForm لمنع التجمد أثناء العمليات الأخرى
        setTimeout(() => {
          resetForm();
          if(onOrderCreated) onOrderCreated();
        }, 100);
      } else { 
        throw new Error(result.error || "فشل إنشاء الطلب في النظام."); 
      }
    } catch (error) {
      console.error('Error creating order:', error);
      
      // معالجة أخطاء محددة
      let errorMessage = "فشل إنشاء الطلب.";
      if (error.message?.includes('phone') || error.message?.includes('رقم الهاتف')) {
        errorMessage = "خطأ في رقم الهاتف. يرجى التحقق من الرقم وإعادة المحاولة.";
      } else if (error.message?.includes('network') || error.message?.includes('شبكة')) {
        errorMessage = "مشكلة في الاتصال. يرجى التحقق من الإنترنت وإعادة المحاولة.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({ 
        title: "خطأ في إنشاء الطلب", 
        description: errorMessage, 
        variant: "destructive",
        duration: 6000
      });
      
      // إعادة تمكين الواجهة بعد الخطأ
      setErrors({});
    } finally { 
        if (setIsSubmitting) {
          setIsSubmitting(false);
        }
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
      {/* مساعد تحميل البيانات في وضع التعديل */}
      <EditOrderDataLoader 
        aiOrderData={aiOrderData} 
        isEditMode={isEditMode} 
        onDataLoaded={() => console.log('✅ تم تحميل بيانات التعديل')}
      />
      
      <PageWrapper {...pageProps} className={!isDialog ? "max-w-4xl mx-auto space-y-6" : "space-y-4 font-arabic"}>
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
          waseetUser={waseetUser}
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
            customerData={customerData}
            loyaltyDiscount={loyaltyDiscount}
            applyLoyaltyDiscount={applyLoyaltyDiscount}
            onToggleLoyaltyDiscount={() => {
              const newApply = !applyLoyaltyDiscount;
              setApplyLoyaltyDiscount(newApply);
              if (newApply) {
                setDiscount(prev => prev + loyaltyDiscount);
              } else {
                setDiscount(prev => Math.max(0, prev - loyaltyDiscount));
              }
            }}
            applyLoyaltyDelivery={applyLoyaltyDelivery}
            onToggleLoyaltyDelivery={() => setApplyLoyaltyDelivery(!applyLoyaltyDelivery)}
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
              <Button
                type="submit"
                disabled={isSubmittingState || cart.length === 0 || !isDeliveryPartnerSelected}
                className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]"
              >
                {isSubmittingState ? (
                  <>
                    <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                    {isEditMode ? 'جاري الحفظ...' : 'جاري الإرسال...'}
                  </>
                ) : (
                  <>
                    <CheckCircle className="ml-2 h-5 w-5" />
                    {isEditMode ? 'حفظ التعديلات' : 'إرسال الطلب'}
                  </>
                )}
              </Button>
          </motion.div>
        )}
      </PageWrapper>

      {/* تحميل البيانات للتعديل */}
      <EditOrderDataLoader 
        aiOrderData={aiOrderData}
        isEditMode={isEditMode}
        onDataLoaded={() => console.log('✅ Edit data loaded successfully')}
      />

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