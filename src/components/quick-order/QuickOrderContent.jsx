import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import { useCart } from '@/hooks/useCart.jsx';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { toast } from '@/components/ui/use-toast';
import { createAlWaseetOrder, editAlWaseetOrder } from '@/lib/alwaseet-api';
import { useCitiesCache } from '@/hooks/useCitiesCache';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SearchableSelectFixed from '@/components/ui/searchable-select-fixed';
import { Loader2, CheckCircle, RotateCcw } from 'lucide-react';
import DeliveryPartnerDialog from '@/components/DeliveryPartnerDialog';
import { motion } from 'framer-motion';
import ProductSelectionDialog from '@/components/products/ProductSelectionDialog';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { iraqiProvinces } from '@/lib/iraq-provinces';
import DeliveryStatusCard from './DeliveryStatusCard';
import CustomerInfoForm from './CustomerInfoForm';
import OrderDetailsForm from './OrderDetailsForm';
import { ExchangeProductsForm } from './ExchangeProductsForm';
import { ReturnProductForm } from './ReturnProductForm';
import useLocalStorage from '@/hooks/useLocalStorage.jsx';
import { processReplacementInventory } from '@/utils/replacement-inventory-handler';
import { handleReplacementFinancials } from '@/utils/replacement-financial-handler';
import { supabase } from '@/lib/customSupabaseClient';
import { normalizePhone, extractOrderPhone } from '@/utils/phoneUtils';
import { useAiOrdersCleanup } from '@/hooks/useAiOrdersCleanup';
import { linkReturnToOriginalOrder } from '@/utils/return-order-linker';
import devLog from '@/lib/devLogger';


export const QuickOrderContent = ({ isDialog = false, onOrderCreated, formRef, setIsSubmitting, isSubmittingState, aiOrderData = null }) => {
  // حالة التعديل
  const isEditMode = aiOrderData?.editMode || false;
  
  const { createOrder, updateOrder, settings, approveAiOrder, orders } = useInventory();
  const { cart, setCart, clearCart, addToCart, removeFromCart } = useCart(isEditMode); // استخدام useCart مع وضع التعديل
  const { deleteAiOrderWithLink } = useAiOrdersCleanup();
  
  // ✅ استخدام الـ Cache للمدن والمناطق بدلاً من API
  const { 
    cities: cachedCities,
    allRegions: globalRegionsCache, // ✅ جميع المناطق دفعة واحدة - اسم فريد
    getRegionsByCity, // ✅ فلترة من الـ cache
    isLoaded: isCacheLoaded,
    isLoading: isCacheLoading
  } = useCitiesCache();
  
  // ✅ ref للتحقق من mount status
  const isMountedRef = useRef(true);
  
  // ✅ refs لإصلاح المناطق والسعر في وضع التعديل
  const preloadedRegionsApplied = useRef(false);
  const originalPriceRef = useRef(null);
  
  // ✅ النهائي: Cleanup آمن بدون clearCart
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, [isDialog]);
  
  // ذاكرة تخزينية للمناطق لتقليل استدعاءات API
  const regionCache = useRef(new Map());
  
  // ✅ ref لحفظ region_id المعلق (لحل سباق البيانات)
  const pendingRegionIdRef = useRef(null);
  
  // حالة التعديل
  
  const { user } = useAuth();
  const { isLoggedIn: isWaseetLoggedIn, token: waseetToken, activePartner, setActivePartner, fetchToken, waseetUser, syncOrderByTracking } = useAlWaseet();
  const [deliveryPartnerDialogOpen, setDeliveryPartnerDialogOpen] = useState(false);
  const [productSelectOpen, setProductSelectOpen] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);
  
  // حالات الاستبدال والإرجاع
  const [refundAmount, setRefundAmount] = useState(0);
  const [manualExchangePriceDiff, setManualExchangePriceDiff] = useState(0);
  const [foundOriginalOrder, setFoundOriginalOrder] = useState(null); // ✅ حالة جديدة للطلب الأصلي
  
  // Local storage for default customer name and delivery partner
  const [defaultCustomerName, setDefaultCustomerName] = useLocalStorage('defaultCustomerName', user?.default_customer_name || '');
  const [defaultDeliveryPartner, setDefaultDeliveryPartner] = useLocalStorage('defaultDeliveryPartner', activePartner || '');

  const initialFormData = useMemo(() => ({
    name: defaultCustomerName || user?.default_customer_name || '', 
    phone: '', 
    second_phone: '', 
    city_id: '', 
    region_id: '', 
    city: 'بغداد',
    region: '', 
    address: '', 
    notes: '', 
    details: '', 
    quantity: 1, 
    price: 0, 
    priceType: 'positive',
    size: 'عادي',
    type: 'new', 
    promocode: '',
    defaultCustomerName: defaultCustomerName || user?.default_customer_name || ''
  }), [defaultCustomerName, user?.default_customer_name]);
  const [formData, setFormData] = useState(initialFormData);
  
  const originalOrder = aiOrderData?.originalOrder || null;

  // ملء البيانات من الطلب الذكي أو وضع التعديل عند وجوده
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
      
      // في وضع التعديل، استخدم البيانات الأصلية مباشرة
      if (isEditMode) {
        // ✅ حفظ السعر الأصلي (شامل التوصيل) في ref لمنع إعادة الحساب
        const originalPrice = aiOrderData.final_amount || aiOrderData.price_with_delivery || 
          aiOrderData.final_total || aiOrderData.total_amount || 0;
        originalPriceRef.current = originalPrice;
        
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
          price: originalPrice,  // ✅ استخدام السعر الكامل شامل التوصيل
          delivery_fee: aiOrderData.delivery_fee || 0,
          // ضمان عرض السعر الصحيح مع التوصيل
          total_with_delivery: originalPrice,
          
          // إضافة البيانات الأصلية للعرض
          originalCity: aiOrderData.customer_city || '',
          originalRegion: aiOrderData.customer_province || '',
          
          // إصلاح نوع الطلب الافتراضي - ضمان تطبيقه
          type: 'new'
        }));
        
        // إضافة useEffect منفصل لضمان تطبيق نوع الطلب الافتراضي
        setTimeout(() => {
          setFormData(prev => ({
            ...prev,
            type: 'new'
          }));
        }, 100);
        
        // تحديد شريك التوصيل وتحميل البيانات اللازمة
        if (aiOrderData.delivery_partner && aiOrderData.delivery_partner !== 'محلي') {
          setActivePartner('alwaseet');
          
          // في وضع التعديل، تحديد المدينة والمنطقة من المعرفات الأصلية
          if (aiOrderData.city_id) {
            setSelectedCityId(aiOrderData.city_id);
            // تحديث formData مباشرة لضمان ظهور القيمة في dropdown
            setFormData(prev => ({ ...prev, city_id: aiOrderData.city_id }));
          }
          if (aiOrderData.region_id) {
            // ✅ تخزين region_id للتطبيق بعد تحميل المناطق
            pendingRegionIdRef.current = aiOrderData.region_id;
            // ✅ تحديد فوري أيضاً (لا تأخير)
            setSelectedRegionId(aiOrderData.region_id);
            setFormData(prev => ({ ...prev, region_id: aiOrderData.region_id }));
            
            // ✅ استخدام المناطق المحملة مسبقاً إذا كانت متوفرة
            if (aiOrderData.preloadedRegions && aiOrderData.preloadedRegions.length > 0) {
              setRegions(aiOrderData.preloadedRegions.map(r => ({
                id: r.alwaseet_id || r.id,
                name: r.name,
                city_id: r.city_id
              })));
            devLog.log('✅ تم تحميل المناطق مسبقاً:', aiOrderData.preloadedRegions.length);
          }
        }
      } else {
          setActivePartner('local');
        }
        
         // ✅ تم نقل تحميل المنتجات إلى مكان واحد فقط (أسفل في useEffect منفصل)
        
        return; // انتهاء وضع التعديل
      }
      
      setFormData(prev => ({
        ...prev,
        name: aiOrderData.customer_name || '',
        phone: aiOrderData.customer_phone || '',
        city: parsedCity || 'بغداد',
        region: parsedRegion || '',
        address: aiOrderData.source === 'telegram' ? '' : (aiOrderData.customer_address || ''),
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
      
      // ✅ تم حذف الكود المكرر - يتم التحميل في مكان واحد فقط أسفل
    }
  }, [aiOrderData, clearCart, addToCart, isEditMode]);

  // ===== 📦 تحميل المنتجات في وضع التعديل (نسخة موحدة موثوقة) =====
  useEffect(() => {
    // ✅ التحقق من الشروط الأساسية
    if (!isEditMode || !aiOrderData?.items || !Array.isArray(aiOrderData.items)) {
      return;
    }
    
    // ✅ التحقق من وجود منتجات فعلية
    if (aiOrderData.items.length === 0) {
      return;
    }
    
    // ✅ إنشاء cart items مباشرة (بدون clearCart + addToCart منفصلة)
    const newCartItems = aiOrderData.items.map((item, index) => {
      return {
        id: `${item.product_id || 'temp'}-${item.variant_id || 'no-variant'}`,
        productId: item.product_id,
        product_id: item.product_id,  // للتوافق مع كلا التنسيقين
        variantId: item.variant_id,
        variant_id: item.variant_id,  // للتوافق مع كلا التنسيقين
        sku: item.sku || item.variant_id || 'temp-sku',
        productName: item.productName || item.product_name || 'منتج',
        product_name: item.productName || item.product_name || 'منتج',
        name: item.productName || item.product_name || 'منتج',
        image: item.image || '/placeholder.svg',
        color: item.color || '',
        size: item.size || '',
        quantity: item.quantity || 1,
        price: item.unit_price || item.price || 0,
        costPrice: item.costPrice || item.cost_price || 0,
        stock: 999,  // مخزون عالي للتعديل
        reserved: 0,
        total: (item.unit_price || item.price || 0) * (item.quantity || 1)
      };
    }).filter(item => item.productId || item.product_id);  // فلترة العناصر بدون ID
    
    // ✅ تعيين السلة مباشرة (لا clearCart ولا addToCart)
    setCart(newCartItems);
    
  }, [isEditMode, aiOrderData?.orderId, aiOrderData?.items, setCart]);

  // useEffect منفصل لضمان تطبيق نوع الطلب الافتراضي في وضع التعديل
  useEffect(() => {
    if (aiOrderData?.editMode && formData.type !== 'new') {
      setFormData(prev => ({
        ...prev,
        type: 'new'
      }));
    }
  }, [aiOrderData?.editMode, formData.type]);
  
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
      
      const normalizedPhone = normalizePhone(formData.phone);
      
      if (!normalizedPhone) {
        setCustomerData(null);
        setLoyaltyDiscount(0);
        setDiscount(0);
        return;
      }
      
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
  
  // متغيرات لتتبع المعرفات المحددة للمدن والمناطق والحزم
  const [selectedCityId, setSelectedCityId] = useState('');
  const [selectedRegionId, setSelectedRegionId] = useState('');
  const [selectedPackageSize, setSelectedPackageSize] = useState('عادي');
  
  // حالات إضافية لإصلاح المشاكل
  const [isResetting, setIsResetting] = useState(false);
  const [preservedRegionId, setPreservedRegionId] = useState('');

  const dedupeById = useCallback((items = []) => {
    const seen = new Set();
    return (Array.isArray(items) ? items : []).filter((item) => {
      const key = String(item?.name ?? item?.size ?? item?.id ?? '').trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, []);

  // استخدام قيم فعالة للمدينة والمنطقة - إصلاح شامل للتحكم في القيم
  const effectiveCityId = useMemo(() => {
    if (activePartner === 'alwaseet' || activePartner === 'modon') {
      // في وضع التعديل، أولوية مطلقة للقيم المحفوظة
      if (isEditMode) {
        const editCityId = selectedCityId || formData.city_id;
        return editCityId;
      }
      return formData.city_id;
    }
    return null;
  }, [selectedCityId, formData.city_id, activePartner, isEditMode]);

  const effectiveRegionId = useMemo(() => {
    if (activePartner === 'alwaseet' || activePartner === 'modon') {
      // في وضع التعديل، أولوية مطلقة للقيم المحفوظة
      if (isEditMode) {
        const editRegionId = selectedRegionId || formData.region_id;
        return editRegionId;
      }
      return formData.region_id;
    }
    return null;
  }, [selectedRegionId, formData.region_id, activePartner, isEditMode]);

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

  // حساب المجاميع
   const subtotal = useMemo(() => {
     const safeCart = Array.isArray(cart) ? cart.filter(item => item && typeof item.total === 'number') : [];
     const result = safeCart.reduce((sum, item) => sum + (item.total || 0), 0);
     return result;
   }, [cart]);
  const deliveryFee = useMemo(() => {
    // رسوم التوصيل دائماً تُحسب في إجمالي السعر المرسل لشركات التوصيل
    return applyLoyaltyDelivery ? 0 : (settings?.deliveryFee || 0);
  }, [applyLoyaltyDelivery, settings]);
  const total = useMemo(() => subtotal - discount, [subtotal, discount]);
  const finalTotal = useMemo(() => total + deliveryFee, [total, deliveryFee]);
  
  const resetForm = useCallback(() => {
    // تفعيل حالة المسح
    setIsResetting(true);
    
    // مسح البيانات بشكل فوري ومنظم
    clearCart();
    setDiscount(0);
    setLoyaltyDiscount(0);
    setApplyLoyaltyDiscount(false);
    setApplyLoyaltyDelivery(false);
    setCustomerData(null);
    setErrors({});
    setSelectedCityId('');
    setSelectedRegionId('');
    setPreservedRegionId('');
    
    // استعادة الإعدادات الافتراضية فوراً
    const defaultName = defaultCustomerName || user?.default_customer_name || '';
    const defaultCity = cities.length > 0 ? (cities.find(c => c.name?.toLowerCase().includes('بغداد')) || cities[0]) : null;
    
    setFormData({
      name: defaultName,
      phone: '', 
      second_phone: '', 
      city_id: defaultCity ? String(defaultCity.id) : '', 
      region_id: '',
      city: defaultCity?.name || 'بغداد', 
      region: '', 
      address: '', 
      notes: '', 
      details: '', 
      quantity: 1, 
      price: 0, 
      size: 'عادي', 
      type: 'new', 
      promocode: '',
      defaultCustomerName: defaultName
    });
    
    if (defaultCity) {
      setSelectedCityId(String(defaultCity.id));
    }
    
    setNameTouched(false);
    
    // إنهاء حالة المسح فوراً
    setIsResetting(false);
  }, [clearCart, defaultCustomerName, user?.default_customer_name, cities]);

  // إصلاح جذري: إعادة تعيين المدينة الافتراضية بعد resetForm
  useEffect(() => {
    // منع التدخل إذا كان في وضع التعديل أو أثناء عملية المسح
    if (isEditMode || isResetting) return;
    
    // فقط لشركة الوسيط عندما يكون city_id فارغ أو null والمدن متوفرة
    if (activePartner === 'alwaseet' && (!formData.city_id || formData.city_id === '') && cities.length > 0) {
      const baghdadCity = cities.find(city => 
        city.name?.toLowerCase().includes('بغداد') || 
        city.name?.toLowerCase().includes('baghdad')
      );
      const defaultCity = baghdadCity || cities[0];
      
      // تأخير قصير لضمان اكتمال عملية resetForm
      setTimeout(() => {
        setFormData(prev => ({
          ...prev,
          city_id: String(defaultCity.id)
        }));
        setSelectedCityId(String(defaultCity.id));
      }, 100);
    }
  }, [formData.city_id, cities, activePartner, isEditMode, isResetting]);

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

  // تحميل بيانات التعديل من AI أو البيانات المرسلة
  useEffect(() => {
    if (aiOrderData && aiOrderData.editMode) {
      // التحقق من صحة city_id - الأولوية للـ city_id الصحيح
      const correctCityId = aiOrderData.city_id ? String(aiOrderData.city_id) : null;
      
      // تحديث النموذج ببيانات الطلب الأصلي
      setFormData(prev => ({
        ...prev,
        name: aiOrderData.customer_name || '',
        phone: aiOrderData.customer_phone || '',
        second_phone: aiOrderData.customer_phone2 || '',
        city: aiOrderData.customer_city || '',
        region: aiOrderData.customer_province || '',
        city_id: correctCityId,
        region_id: aiOrderData.region_id ? String(aiOrderData.region_id) : null,
        address: aiOrderData.customer_address || '',
        notes: aiOrderData.notes || '',
        details: aiOrderData.notes || '',
        price: aiOrderData.final_total || 0,
        size: aiOrderData.package_size || 'عادي',
        type: 'update'
      }));

      // تحديد المدينة والمنطقة إذا كانت متوفرة - مع تأكيد إضافي للمناطق
      if (correctCityId) {
        setSelectedCityId(correctCityId);
        
        // ✅ حفظ region_id في ref بدلاً من setTimeout (إصلاح سباق البيانات)
        if (aiOrderData.region_id) {
          const correctRegionId = String(aiOrderData.region_id);
          pendingRegionIdRef.current = correctRegionId;
          setPreservedRegionId(correctRegionId);
        }
      }

      // ✅ تم حذف الكود المكرر - يتم التحميل في مكان واحد فقط
    }
  }, [aiOrderData, clearCart, addToCart]);

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
      if ((activePartner === 'alwaseet' || activePartner === 'modon') && waseetToken) {
        // ✅ ننتظر تحميل الـ cache لكلا الشريكين (الكاش يخدم الوسيط ومدن من نفس الجداول الموحّدة)
        if (!isCacheLoaded) {
          devLog.log('⏳ انتظار تحميل الـ Cache...');
          return;
        }

        setLoadingCities(true);
        setLoadingPackageSizes(true);
        setInitialDataLoaded(false);
        setDataFetchError(false);
        try {
          let citiesData = [];
          let packageSizesData = [];

          if (activePartner === 'modon') {
            // ✅ مدن: cache-first من city_delivery_mappings (external_id = MODON id)
            const { data: modonCityMaps } = await supabase
              .from('city_delivery_mappings')
              .select('external_id, external_name, city_id, cities_master:city_id(name)')
              .eq('delivery_partner', 'modon')
              .eq('is_active', true);

            if (modonCityMaps && modonCityMaps.length > 0) {
              citiesData = modonCityMaps.map(m => ({
                id: m.external_id,
                name: m.cities_master?.name || m.external_name
              }));
              devLog.log(`✅ مدن: تم جلب ${citiesData.length} مدينة من الكاش`);
            } else {
              // fallback إلى API فقط إن كان الكاش فارغاً
              const ModonAPI = await import('@/lib/modon-api');
              const modonCitiesData = await ModonAPI.getCities(waseetToken);
              citiesData = (modonCitiesData || []).map(city => ({ id: city.id, name: city.city_name }));
            }

            // أحجام الطرود من الكاش (مع ترجمة عربية للأحجام الإنجليزية)
            const MODON_SIZE_AR = { normal:'عادي', regular:'عادي', standard:'عادي', small:'صغير', medium:'وسط', middle:'وسط', large:'كبير', xlarge:'كبير جداً', xl:'كبير جداً', 'x-large':'كبير جداً', 'x large':'كبير جداً', 'extra large':'كبير جداً', 'extra-large':'كبير جداً' };
            const trSize = (n) => {
              if (!n) return n;
              const k = String(n).trim().toLowerCase();
              return MODON_SIZE_AR[k] || n;
            };
            const { data: modonSizes } = await supabase
              .from('package_sizes_cache')
              .select('external_id, size_name')
              .eq('partner_name', 'modon')
              .eq('is_active', true);
            if (modonSizes && modonSizes.length > 0) {
              packageSizesData = modonSizes.map(s => ({ id: s.external_id, size: trSize(s.size_name) }));
            } else {
              const ModonAPI = await import('@/lib/modon-api');
              packageSizesData = await ModonAPI.getPackageSizes(waseetToken);
              packageSizesData = (packageSizesData || []).map(size => ({ id: size.id, size: trSize(size.size) }));
            }
          } else {
            // ✅ الوسيط: cache من cachedCities (موجود)
            if (cachedCities.length > 0) {
              citiesData = cachedCities.map(city => ({
                id: city.alwaseet_id || city.id,
                name: city.name
              }));
            } else {
              citiesData = [];
            }

            // ✅ ترجمة أحجام الطرود للعربية (موحّدة مع map MODON أعلاه)
            const SIZE_AR = { normal:'عادي', regular:'عادي', standard:'عادي', small:'صغير', medium:'متوسط', middle:'متوسط', large:'كبير', xlarge:'كبير جداً', xl:'كبير جداً', 'x-large':'كبير جداً', 'x large':'كبير جداً', 'extra large':'كبير جداً', 'extra-large':'كبير جداً' };
            const trAlwSize = (n) => {
              if (!n) return n;
              const k = String(n).trim().toLowerCase();
              return SIZE_AR[k] || n;
            };

            const { data: cachedSizes } = await supabase
              .from('package_sizes_cache')
              .select('external_id, size_name')
              .eq('partner_name', 'alwaseet')
              .eq('is_active', true);

            if (cachedSizes && cachedSizes.length > 0) {
              packageSizesData = cachedSizes.map(s => ({ id: s.external_id, size: trAlwSize(s.size_name) }));
            } else {
              packageSizesData = [{ id: '1', size: 'عادي' }, { id: '2', size: 'متوسط' }, { id: '3', size: 'كبير' }, { id: '4', size: 'كبير جداً' }];
            }
          }
          
          // ✅ تم إزالة الكود المكرر أسفل
          
          const safeCities = Array.isArray(citiesData) ? citiesData : Object.values(citiesData || {});
          const safePackageSizes = Array.isArray(packageSizesData) ? packageSizesData : Object.values(packageSizesData || {});

          setCities(dedupeById(safeCities));
          setPackageSizes(dedupeById(safePackageSizes));

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
            setSelectedCityId(String(defaultCity.id));
          }

          const normalSize = safePackageSizes.find(s => s.size && (s.size.toLowerCase().includes('normal') || s.size.includes('عادي')));
          if (normalSize) {
             setFormData(prev => ({ ...prev, size: String(normalSize.id) }));
             setSelectedPackageSize(String(normalSize.id));
          } else if (safePackageSizes.length > 0) {
            setFormData(prev => ({ ...prev, size: String(safePackageSizes[0].id) }));
            setSelectedPackageSize(String(safePackageSizes[0].id));
          }
        } catch (error) {
          setDataFetchError(true);
          toast({ 
            title: "خطأ", 
            description: `فشل تحميل بيانات ${activePartner === 'modon' ? 'مدن' : 'الوسيط'}. ${error.message}`, 
            variant: "destructive" 
          }); 
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
        const isPartnerLoggedIn = (activePartner === 'alwaseet' || activePartner === 'modon') && isWaseetLoggedIn;
        
        if ((activePartner === 'alwaseet' || activePartner === 'modon') && !isPartnerLoggedIn) {
            setInitialDataLoaded(false);
        } else {
            fetchInitialData();
        }
    }
  }, [activePartner, waseetToken, isWaseetLoggedIn, isDeliveryPartnerSelected, isCacheLoaded, cachedCities]);

  // مرجع لتتبع آخر مدينة محددة
  const prevCityIdRef = useRef(formData.city_id);

  // ✅ إصلاح شامل لجلب المناطق - استخدام Cache + إصلاح سباق البيانات
  useEffect(() => {
    // ✅ تجاهل إذا كانت المناطق محملة مسبقاً في وضع التعديل
    if (isEditMode && preloadedRegionsApplied.current && regions.length > 0) {
      devLog.log('⏭️ تجاهل جلب المناطق - محملة مسبقاً');
      return;
    }
    
    const cityIdForRegions = isEditMode ? selectedCityId : formData.city_id;
    
    if (cityIdForRegions && (activePartner === 'alwaseet' || activePartner === 'modon') && waseetToken) {
      const fetchRegionsData = async () => {
        setLoadingRegions(true);
        
        const preservedRegionId = isEditMode ? (selectedRegionId || formData.region_id || '') : '';
        
         if (!isEditMode && prevCityIdRef.current !== formData.city_id) {
           setFormData(prev => ({ ...prev, region_id: '' }));
           setSelectedRegionId('');
           prevCityIdRef.current = formData.city_id;
         }
         
         try {
             if (!cityIdForRegions || cityIdForRegions === '') {
               return;
             }
             
             const cacheKey = `regions_${activePartner}_${cityIdForRegions}`;
              const localRegionsCache = regionCache.current.get(cacheKey); // ✅ اسم محلي واضح
              
              if (localRegionsCache) {
                setRegions(localRegionsCache);
                
                // ✅ تطبيق pendingRegionId بعد تحميل المناطق
                if (pendingRegionIdRef.current && localRegionsCache.find(r => String(r.id) === String(pendingRegionIdRef.current))) {
                 setSelectedRegionId(pendingRegionIdRef.current);
                 setFormData(prev => ({ ...prev, region_id: pendingRegionIdRef.current }));
                 pendingRegionIdRef.current = null;
               }
               
                setLoadingRegions(false);
                return;
              }
               
              // ✅ جلب المناطق من الـ Cache بدلاً من API
              let regionsData;
              
              if (activePartner === 'modon') {
                // ✅ مدن: cache-first من region_delivery_mappings
                //    cityIdForRegions = MODON external_id (مثلاً "1" لبغداد)
                //    نحوّله أولاً إلى city_id الداخلي عبر city_delivery_mappings
                //    ثم نفلتر region_delivery_mappings الخاصة بمدن.
                devLog.log(`🔍 [مدن] جلب المناطق للمدينة ${cityIdForRegions} من الكاش...`);
                
                const { data: cityMap } = await supabase
                  .from('city_delivery_mappings')
                  .select('city_id')
                  .eq('delivery_partner', 'modon')
                  .eq('external_id', String(cityIdForRegions))
                  .eq('is_active', true)
                  .maybeSingle();
                
                const internalCityId = cityMap?.city_id;
                
                if (internalCityId) {
                  const { data: modonRegions, error: modonRegErr } = await supabase
                    .from('region_delivery_mappings')
                    .select('external_id, external_name, regions_master:region_id!inner(city_id)')
                    .eq('delivery_partner', 'modon')
                    .eq('is_active', true)
                    .eq('regions_master.city_id', internalCityId);

                  if (!modonRegErr && modonRegions && modonRegions.length > 0) {
                    regionsData = modonRegions.map(r => ({
                      id: r.external_id,
                      name: r.external_name,
                      city_id: cityIdForRegions
                    }));
                    devLog.log(`✅ [مدن] تم جلب ${regionsData.length} منطقة من الكاش (فوري)`);
                  }
                }
                
                if (!regionsData || regionsData.length === 0) {
                  // fallback إلى API فقط إن كان الكاش فارغاً للمدينة
                  devLog.warn('⚠️ [مدن] الكاش فارغ للمدينة، جلب من API...');
                  const ModonAPI = await import('@/lib/modon-api');
                  regionsData = await ModonAPI.getRegionsByCity(waseetToken, cityIdForRegions);
                  regionsData = (regionsData || []).map(region => ({
                    id: region.id,
                    name: region.region_name,
                    city_id: region.city_id
                  }));
                }
              } else {
                // ✅ الوسيط: فلترة المناطق من الـ Cache فوراً
                devLog.log(`🔍 فلترة المناطق للمدينة ${cityIdForRegions} (cache: ${globalRegionsCache.length} منطقة)...`);
                
                if (isCacheLoaded && globalRegionsCache.length > 0) {
                  const filteredRegions = getRegionsByCity(cityIdForRegions);
                  devLog.log(`✅ تم فلترة ${filteredRegions.length} منطقة من الـ Cache`);
                  
                  regionsData = filteredRegions.map(region => ({
                    id: region.alwaseet_id || region.id,
                    name: region.name,
                    city_id: cityIdForRegions
                  }));
                } else {
                  devLog.log('⏳ انتظار تحميل الـ Cache...');
                  regionsData = [];
                }
              }
              
              const safeRegions = Array.isArray(regionsData) ? regionsData : Object.values(regionsData || {});
              
              if (Array.isArray(safeRegions) && safeRegions.length > 0 && safeRegions[0].city_id) {
                if (String(safeRegions[0].city_id) !== String(cityIdForRegions)) {
                  console.error('❌ خطأ: المناطق المُستلمة تنتمي لمدينة مختلفة!');
                  toast({
                    title: "خطأ في البيانات",
                    description: "تم استلام مناطق لمدينة خاطئة من الخادم",
                    variant: "destructive"
                  });
                  return;
                }
              }
              
              const dedupedRegions = dedupeById(safeRegions);
              regionCache.current.set(cacheKey, dedupedRegions);
              setRegions(dedupedRegions);
              
               // ✅ تطبيق pendingRegionId بعد تحميل المناطق من API
                if (pendingRegionIdRef.current && dedupedRegions.find(r => String(r.id) === String(pendingRegionIdRef.current))) {
                 setSelectedRegionId(pendingRegionIdRef.current);
                 setFormData(prev => ({ ...prev, region_id: pendingRegionIdRef.current }));
                 pendingRegionIdRef.current = null;
               } else if (isEditMode && preservedRegionId) {
                 setTimeout(() => {
                   setSelectedRegionId(preservedRegionId);
                   setFormData(prev => ({ ...prev, region_id: preservedRegionId }));
                 }, 300);
               }
         } catch (error) {
          console.error('❌ خطأ في جلب المناطق:', error);
          toast({ 
            title: "خطأ", 
            description: `فشل تحميل المناطق من ${activePartner === 'modon' ? 'مدن' : 'الوسيط'}`, 
            variant: "destructive" 
          }); 
        }
        finally { setLoadingRegions(false); }
      };
      fetchRegionsData();
    }
  }, [selectedCityId, formData.city_id, activePartner, waseetToken, isEditMode, globalRegionsCache, isCacheLoaded, getRegionsByCity]);
  
  // تحديث تفاصيل الطلب والسعر تلقائياً عند تغيير السلة أو الشريك أو الخصم
  useEffect(() => {
    // ✅ في وضع التعديل: لا تُعد حساب السعر تلقائياً - احتفظ بالسعر الأصلي
    if (isEditMode && originalPriceRef.current !== null) {
      devLog.log('⏭️ تجاهل إعادة حساب السعر - وضع التعديل (السعر الأصلي:', originalPriceRef.current, ')');
      
      // فقط تحديث التفاصيل والكمية بدون تغيير السعر
      const safeCart = Array.isArray(cart) ? cart.filter(item => item != null) : [];
      const quantityCount = safeCart.reduce((sum, item) => sum + (item?.quantity || 1), 0);
      const detailsString = safeCart.map(item => 
        `${item.productName || ''} ${item.size || ''} . ${item.color || ''}${item.quantity > 1 ? ` (عدد ${item.quantity})` : ''}`.trim()
      ).filter(detail => detail).join(' + ');
      
      setFormData(prev => ({
        ...prev, 
        quantity: quantityCount > 0 ? quantityCount : 1,
        details: detailsString,
        // ✅ الحفاظ على السعر الأصلي شامل التوصيل
      }));
      return;
    }
    
    // الحالة العادية (ليس وضع تعديل): احسب السعر تلقائياً
    const safeCart = Array.isArray(cart) ? cart.filter(item => item != null) : [];
    const quantityCount = safeCart.reduce((sum, item) => sum + (item?.quantity || 1), 0);
    const cartSubtotal = safeCart.reduce((sum, item) => sum + (item?.total || ((item?.price || 0) * (item?.quantity || 1)) || 0), 0);
    
    // حساب رسوم التوصيل بناءً على نوع الشريك
    let calculatedDeliveryFee = 0;
    if (activePartner === 'local') {
      // للتوصيل المحلي، أضف رسوم التوصيل (إلا إذا كان التوصيل مجانياً)
      calculatedDeliveryFee = applyLoyaltyDelivery ? 0 : (settings?.deliveryFee || 0);
    }
    // للوسيط أو الشركات الأخرى، لا توجد رسوم إضافية
    
    // حساب السعر النهائي: (مجموع المنتجات - الخصم) + رسوم التوصيل
    const totalAfterDiscount = cartSubtotal - (discount || 0);
    const finalPriceWithDelivery = totalAfterDiscount + calculatedDeliveryFee;
    
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
      delivery_fee: calculatedDeliveryFee,
      details: detailsString,
    }));
  }, [cart, settings?.deliveryFee, activePartner, discount, applyLoyaltyDelivery, isEditMode]);

  // ✅ تحديث formData.details تلقائياً للاستبدال
  useEffect(() => {
    if (formData.type === 'exchange' && cart.length > 0) {
      const outgoingItems = cart.filter(item => item.item_direction === 'outgoing');
      
      if (outgoingItems.length > 0) {
        const outgoingDetails = outgoingItems.map(item => 
          `${item.productName || ''} ${item.size || ''} . ${item.color || ''}${item.quantity > 1 ? ` (عدد ${item.quantity})` : ''}`
            .trim()
            .replace(/ +/g, ' ')
        ).join(' + ');
        
        setFormData(prev => ({
          ...prev,
          details: outgoingDetails
        }));
      }
    }
  }, [cart, formData.type]);

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
      if (!effectiveCityId) newErrors.city_id = 'الرجاء اختيار المدينة.';
      if (!effectiveRegionId) newErrors.region_id = 'الرجاء اختيار المنطقة.';
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
    
    // التحقق من متطلبات الاستبدال
    if (formData.type === 'exchange') {
      // ✅ استخدام cart مع item_direction
      const outgoingItems = cart.filter(item => item.item_direction === 'outgoing');
      const incomingItems = cart.filter(item => item.item_direction === 'incoming');
      
      if (outgoingItems.length === 0 || incomingItems.length === 0) {
        toast({
          title: "خطأ",
          description: "يجب اختيار منتجات صادرة وواردة للاستبدال",
          variant: "destructive"
        });
        return;
      }
      
      // ✅ حساب فرق السعر من cart
      const outgoingTotal = outgoingItems.reduce((sum, item) => 
        sum + (item.price * (item.quantity || 1)), 0
      );
      const incomingTotal = incomingItems.reduce((sum, item) => 
        sum + (item.price * (item.quantity || 1)), 0
      );
      const priceDiff = incomingTotal - outgoingTotal;
      const calculatedDeliveryFee = settings?.deliveryFee || 5000;
      const finalPrice = priceDiff + calculatedDeliveryFee;
      
      // ✅ تحديث formData.details تلقائياً (المنتجات الصادرة فقط)
      const outgoingDetails = outgoingItems.map(item => 
        `${item.productName} ${item.size || ''} . ${item.color || ''}${item.quantity > 1 ? ` (عدد ${item.quantity})` : ''}`
          .trim()
          .replace(/ +/g, ' ')
      ).join(' + ');
      
      setFormData(prev => ({
        ...prev,
        price: finalPrice,
        details: outgoingDetails,  // ✅ ملء تلقائي لنوع البضاعة
        priceType: finalPrice >= 0 ? 'positive' : 'negative'
      }));
    }
    
    // التحقق من متطلبات الإرجاع
    if (formData.type === 'return') {
      const incomingItems = cart.filter(item => item.item_direction === 'incoming');
      
      if (incomingItems.length === 0 || !refundAmount) {
        toast({
          title: "خطأ",
          description: "يجب اختيار المنتج المُرجع ومبلغ الإرجاع",
          variant: "destructive"
        });
        return;
      }
      
      // تحديث السعر في النموذج (سالب)
      setFormData(prev => ({
        ...prev,
        price: -refundAmount,
        priceType: 'negative'
      }));
    }
    
    const isFormValid = validateForm();
    if (!isFormValid) {
      return;
    }

    if (cart.length === 0 && formData.type !== 'exchange' && formData.type !== 'return') {
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
      const orderData = {
        customer_name: formData.name,
        customer_phone: formData.phone,
        customer_phone2: formData.second_phone || '',
        customer_address: formData.address,
        customer_city: formData.city,
        customer_province: formData.region,
        // حفظ معرفات الوسيط محلياً
        alwaseet_city_id: parseInt((selectedCityId || formData.city_id || 0), 10) || null,
        alwaseet_region_id: parseInt((selectedRegionId || formData.region_id || 0), 10) || null,
        notes: formData.notes,
        delivery_partner: activePartner === 'alwaseet' ? 'alwaseet' : 'محلي',
         items: cart.filter(item => item && item.quantity).map(item => ({
           product_id: item.productId,
           variant_id: item.variantId,
           quantity: item.quantity || 0,
           unit_price: item.price || 0,
           total_price: item.total || 0
         })),
        total_amount: subtotal,
        delivery_fee: deliveryFee,
        final_amount: finalTotal,
        discount: discount,
        custom_discount: discount,
        promo_code: formData.promocode
      };

      let updateResult;
      
      // ✅ إذا كان الطلب مع الوسيط أو مدن، قم بتحديث الطلب في شركة التوصيل أولاً
      if ((activePartner === 'alwaseet' || activePartner === 'modon') && isWaseetLoggedIn && originalOrder?.tracking_number) {
        // تحضير المنتجات بالتنسيق الصحيح
         const cartItems = cart.filter(item => item && item.quantity).map(item => ({
           product_name: item.productName || item.name || 'منتج غير محدد',
           color: item.color || '',
           size: item.size || '',
           quantity: item.quantity || 0,
           price: item.price || 0,
           note: ''
         }));

        // التأكد من صحة معرفات المدينة والمنطقة قبل الإرسال
        const validCityId = parseInt(effectiveCityId || selectedCityId || formData.city_id || 0);
        const validRegionId = parseInt(effectiveRegionId || selectedRegionId || formData.region_id || 0);
        
        if (!validCityId || !validRegionId) {
          throw new Error('معرفات المدينة والمنطقة مطلوبة لتحديث الطلب');
        }

        // تكوين اسم نوع البضاعة بالتفصيل: اسم المنتج + الحجم + اللون (بدون العدد أو السعر)
        const typeName = cartItems.map(item => {
          const name = item.product_name || 'منتج';
          const sizePart = item.size ? ` ${item.size}` : '';
          const colorPart = item.color ? ` . ${item.color}` : '';
          return `${name}${sizePart}${colorPart}`.trim();
        }).join(' + ');

        const deliveryOrderData = {
          qr_id: originalOrder.tracking_number, // مطلوب للتعديل
          client_name: formData.name,
          client_mobile: formData.phone,
          client_mobile2: formData.second_phone || undefined,
          city_id: validCityId,
          region_id: validRegionId,
          location: formData.address,
          type_name: typeName,
          items_number: (cart || []).filter(item => item != null).reduce((sum, item) => sum + (item?.quantity || 1), 0),
          price: parseInt(formData.price) || originalPriceRef.current || finalTotal,
          package_size: parseInt(selectedPackageSize) || 1,
          merchant_notes: formData.notes,
          replacement: 0
        };

        try {
          if (activePartner === 'modon') {
            // ✅ دعم تعديل طلبات مدن
            const ModonAPI = await import('@/lib/modon-api');
            await ModonAPI.editModonOrder(deliveryOrderData, waseetToken);
          } else {
            // الوسيط
            await editAlWaseetOrder(deliveryOrderData, waseetToken);
          }
          
          // ✅ بعد نجاح التحديث في شركة التوصيل، تحديث قاعدة البيانات المحلية مع حساب الخصم/الزيادة
          const userEnteredPrice = parseInt(formData.price) || originalPriceRef.current || finalTotal;
          
          // ✅ حساب مجموع المنتجات الحالية من السلة (بعد التعديل)
          const cartProductsTotal = cart.reduce((sum, item) => 
            sum + ((item.quantity || 1) * (item.unit_price || item.price || 0)), 0);

          devLog.log('📊 مجموع المنتجات في السلة:', cartProductsTotal.toLocaleString(), 'د.ع');

          // ✅ حساب السعر المتوقع (منتجات + توصيل)
          const deliveryFee = originalOrder.delivery_fee || 0;
          const expectedTotalPrice = cartProductsTotal + deliveryFee;

          devLog.log('💰 السعر المتوقع:', expectedTotalPrice.toLocaleString(), 'د.ع', `(${cartProductsTotal.toLocaleString()} + ${deliveryFee.toLocaleString()} توصيل)`);
          devLog.log('💵 السعر المدخل:', userEnteredPrice.toLocaleString(), 'د.ع');

          // ✅ حساب الفرق بين ما أدخله المستخدم والسعر المتوقع
          const priceDiff = userEnteredPrice - expectedTotalPrice;
          const newProductsPrice = cartProductsTotal;

          // ✅ تحديد الخصم أو الزيادة بشكل صحيح
          let discountAmount = 0;
          let priceIncreaseAmount = 0;
          let priceChangeType = null;

          if (priceDiff < 0) {
            // خصم - المستخدم أدخل سعر أقل من سعر المنتجات + التوصيل
            discountAmount = Math.abs(priceDiff);
            priceChangeType = 'discount';
            devLog.log(`🔻 خصم: ${discountAmount.toLocaleString()} د.ع (المدخل ${userEnteredPrice.toLocaleString()} < المتوقع ${expectedTotalPrice.toLocaleString()})`);
          } else if (priceDiff > 0) {
            // زيادة - المستخدم أدخل سعر أكبر من سعر المنتجات + التوصيل
            priceIncreaseAmount = priceDiff;
            priceChangeType = 'increase';
            devLog.log(`🔺 زيادة: ${priceIncreaseAmount.toLocaleString()} د.ع (المدخل ${userEnteredPrice.toLocaleString()} > المتوقع ${expectedTotalPrice.toLocaleString()})`);
          } else {
            // ✅ السعر مطابق تماماً - لا خصم ولا زيادة
            devLog.log(`✅ السعر صحيح: ${userEnteredPrice.toLocaleString()} = ${cartProductsTotal.toLocaleString()} + ${deliveryFee.toLocaleString()} (توصيل)`);
          }
          
          devLog.log('📝 بيانات العميل للحفظ:', {
            name: formData.name,
            phone: formData.phone,
            phone2: formData.second_phone,
            orderId: originalOrder.id
          });
          
          // ✅ تحديث قاعدة البيانات المحلية مع التحقق الفعلي من النجاح
          const { data: updatedData, error: localDbUpdateError } = await supabase
            .from('orders')
            .update({
              customer_name: formData.name,
              customer_phone: formData.phone,
              customer_phone2: formData.second_phone || null,
              customer_city: formData.city,
              customer_province: formData.region,
              customer_address: formData.address,
              notes: formData.notes,
              total_amount: newProductsPrice,  // سعر المنتجات فقط (بدون التوصيل)
              sales_amount: newProductsPrice,
              final_amount: userEnteredPrice,  // السعر الكلي شامل التوصيل
              discount: discountAmount,
              price_increase: priceIncreaseAmount,
              price_change_type: priceChangeType,
              alwaseet_city_id: validCityId,
              alwaseet_region_id: validRegionId
            })
            .eq('id', originalOrder.id)  // ✅ استخدام id بدلاً من tracking_number لضمان التحديث
            .select('customer_name, customer_phone')  // ✅ جلب البيانات للتحقق الفعلي
            .single();
          
          if (localDbUpdateError) {
            console.error('❌ خطأ في تحديث قاعدة البيانات المحلية:', localDbUpdateError);
            throw new Error(`فشل حفظ بيانات العميل محلياً: ${localDbUpdateError.message}`);
          } else if (!updatedData) {
            console.error('❌ لم يتم تحديث أي صف - قد تكون مشكلة صلاحيات RLS');
            throw new Error('فشل تحديث الطلب - تحقق من الصلاحيات');
          } else {
            devLog.log('✅ تم تحديث قاعدة البيانات المحلية بنجاح:', {
              customer_name: updatedData.customer_name,
              customer_phone: updatedData.customer_phone
            });
          }
          
        } catch (deliveryError) {
          console.error(`❌ خطأ في تحديث طلب ${activePartner}:`, deliveryError);
          
          // إظهار رسالة خطأ واضحة للمستخدم
          toast({
            title: "خطأ في تحديث الطلب",
            description: `فشل تحديث الطلب في شركة التوصيل: ${deliveryError.message}`,
            variant: "destructive"
          });
          
          // توقف العملية - لا نحدث محلياً إذا فشل التحديث في شركة التوصيل
          return;
        }
      }

      // تحديث الطلب محلياً - تمرير جميع البيانات المحدثة
      const { items, ...orderDataWithoutItems } = orderData;
      // إضافة البيانات المحدثة من النموذج
      const userEnteredPrice = parseInt(formData.price) || originalPriceRef.current || finalTotal;
      const completeOrderData = {
        ...orderDataWithoutItems,
        customer_name: formData.name,
        customer_phone: formData.phone,
        customer_phone2: formData.second_phone,
        customer_city: formData.city,
        customer_province: formData.region,
        customer_address: formData.address,
        notes: formData.notes,
        details: formData.details,
        total_amount: userEnteredPrice,
        sales_amount: userEnteredPrice,
        final_amount: userEnteredPrice,
        package_size: parseInt(selectedPackageSize) || 1
      };
      // ✅ لا نحتاج تحديث قاعدة البيانات مرة أخرى - تم بالفعل في السطور 1346-1366
      // نحدث الـ state المحلي فقط لتجنب التحديث المزدوج
      updateResult = { 
        success: true, 
        order: { 
          ...originalOrder, 
          customer_name: formData.name,
          customer_phone: formData.phone,
          customer_phone2: formData.second_phone,
          ...completeOrderData 
        } 
      };

      // ✅ تحديث order_items في قاعدة البيانات - حماية من حذف المنتجات
      const validCartItems = cart?.filter(item => 
        item && (item.productId || item.product_id) && item.quantity > 0
      ) || [];
      
      if (validCartItems.length === 0 && originalOrder.items?.length > 0) {
        devLog.warn('⚠️ السلة فارغة - الحفاظ على المنتجات الأصلية');
      } else if (validCartItems.length > 0) {
        // حذف العناصر القديمة فقط إذا كانت هناك عناصر صالحة جديدة
        const { error: deleteError } = await supabase
          .from('order_items')
          .delete()
          .eq('order_id', originalOrder.id);
        
        if (deleteError) {
          console.error('❌ خطأ في حذف المنتجات القديمة:', deleteError);
          throw new Error(`فشل حذف المنتجات القديمة: ${deleteError.message}`);
        }
        
        // إضافة العناصر الجديدة - الأعمدة الصحيحة فقط
        const newOrderItems = validCartItems.map(item => ({
          order_id: originalOrder.id,
          product_id: item.productId || item.product_id,
          variant_id: item.variantId || item.variant_id,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.quantity * item.price
        }));
        
        devLog.log('✅ حفظ المنتجات:', newOrderItems.length, 'منتجات', newOrderItems);
        
        const { error: insertError } = await supabase
          .from('order_items')
          .insert(newOrderItems);
        
        if (insertError) {
          console.error('❌ خطأ في إدخال المنتجات الجديدة:', insertError);
          throw new Error(`فشل إدخال المنتجات الجديدة: ${insertError.message}`);
        }
        
        devLog.log('✅ تم حفظ المنتجات بنجاح في قاعدة البيانات');
      }

      // تحديث SuperProvider أيضاً لضمان انعكاس التغييرات في صفحة الطلبات
      if (window.superProviderUpdate) {
        window.superProviderUpdate(originalOrder.id, completeOrderData);
      }

      // إرسال أحداث متعددة لضمان تحديث كل المكونات
      setTimeout(() => {
        // حدث للطلب المحدث
        window.dispatchEvent(new CustomEvent('orderUpdated', { 
          detail: { 
            id: originalOrder.id, 
            updates: completeOrderData,
            order: updateResult.order,
            timestamp: new Date().toISOString()
          } 
        }));
        
        // حدث لإعادة تحميل البيانات
        window.dispatchEvent(new CustomEvent('refreshOrdersData', {
          detail: { source: 'quickOrderUpdate', timestamp: new Date().toISOString() }
        }));
        
        // حدث لتحديث الحالة العامة
        window.dispatchEvent(new CustomEvent('dataStateChanged', {
          detail: { type: 'orderUpdate', orderId: originalOrder.id }
        }));
      }, 200);

      // عرض رسالة نجاح مع رقم التتبع الصحيح
      devLog.log('📢 عرض تنبيه نجاح التحديث:', updateResult);
      const trackingNumber = updateResult.order?.tracking_number || originalOrder.tracking_number || updateResult.order?.order_number || originalOrder.order_number || 'غير محدد';
      toast({
        title: "تم تحديث الطلب بنجاح",
        description: `رقم التتبع: ${trackingNumber}`,
        variant: "default",
      });

      // إعادة تعيين النموذج للمدينة الافتراضية بعد التحديث الناجح
      if (!isDialog) {
        setTimeout(() => {
          // إعادة تعيين معرفات المدينة والمنطقة للقيم الافتراضية
          const baghdadCity = cities.find(city => 
            city.name?.toLowerCase().includes('بغداد') || 
            city.name?.toLowerCase().includes('baghdad')
          );
          if (baghdadCity) {
            setSelectedCityId(String(baghdadCity.id));
            setSelectedRegionId('');
            setFormData(prev => ({
              ...prev,
              city_id: String(baghdadCity.id),
              region_id: '',
              city: '',
              region: ''
            }));
            devLog.log('🔄 تم إعادة تعيين النموذج للمدينة الافتراضية بعد التحديث');
          }
        }, 1000);
      }

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
      // ✅ إضافة رسوم التوصيل لكل شركاء التوصيل (الوسيط ومدن)، وليس للطلبات المحلية فقط
      let finalTotal = subtotal - discount + (activePartner === 'local' ? 0 : deliveryFeeAmount);
      let orderNotes = formData.notes || '';
      let actualOrderType = formData.type === 'exchange' ? 'replacement' : 
                           formData.type === 'return' ? 'return' : 'regular';
      let orderItems = cart;
      let actualRefundAmount = 0;
      
      // ✅ معالجة الإرجاع - حساب المبلغ السالب وتحضير المنتجات
      if (formData.type === 'return' && refundAmount > 0) {
        const incomingItems = cart.filter(item => item.item_direction === 'incoming');
        
        if (incomingItems.length === 0) {
          throw new Error('يجب اختيار المنتج المُرجع');
        }
        
        // ✅ المبلغ النهائي = -refundAmount (يشمل التوصيل بالفعل)
        finalTotal = -refundAmount;
        actualRefundAmount = refundAmount;
        
        // ✅ ملاحظات مختصرة بالعربية - دعم عدة منتجات
        const productsDesc = incomingItems.map(item => 
          `${item.productName} (${item.color}, ${item.size}) × ${item.quantity}`
        ).join(' + ');
        
        const totalQuantity = incomingItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
        const amountToCustomer = refundAmount - deliveryFeeAmount;
        
        orderNotes = `إرجاع: ${productsDesc} | إجمالي العدد: ${totalQuantity} | المبلغ المُرجع للزبون: ${amountToCustomer.toLocaleString()} د.ع${formData.notes ? ' | ' + formData.notes : ''}`;

        // ✅ إنشاء order_items من cart (المنتجات الواردة)
        orderItems = incomingItems.map(item => ({
          productId: item.productId || item.id,
          variantId: item.variantId || item.sku || null,
          product_id: item.productId || item.id,
          variant_id: item.variantId || item.sku || null,
          quantity: item.quantity,
          unit_price: item.price || 0,
          price: item.price || 0,
          total_price: (item.price || 0) * item.quantity,
          productName: item.productName,
          cost_price: item.costPrice || 0,
          item_direction: 'incoming',
        }));
      }
      
      // ✅ تعريف merchantNotes خارج الشرط لتجنب الخطأ
      let merchantNotes = orderNotes;
      
      // ✅ معالجة الاستبدال
      let priceDiff = 0;
      let calculatedDeliveryFee = 0;

      if (formData.type === 'exchange') {
        // ✅ استخراج المنتجات من cart
        const outgoingItems = cart.filter(item => item.item_direction === 'outgoing');
        const incomingItems = cart.filter(item => item.item_direction === 'incoming');
        
        // ✅ حساب فرق السعر
        const outgoingTotal = outgoingItems.reduce((sum, item) => 
          sum + (item.price * (item.quantity || 1)), 0
        );
        const incomingTotal = incomingItems.reduce((sum, item) => 
          sum + (item.price * (item.quantity || 1)), 0
        );
        const autoPriceDiff = incomingTotal - outgoingTotal;
        
        priceDiff = autoPriceDiff + manualExchangePriceDiff;
        calculatedDeliveryFee = settings?.deliveryFee || 5000;
        finalTotal = priceDiff + calculatedDeliveryFee;
        
        // ✅ ملاحظات مبسطة للوسيط (بدون رموز) - المنتجات الصادرة والواردة
        const outgoingDesc = outgoingItems.map(item => 
          `${item.productName} قياس ${item.size || 'عادي'} عدد ${item.quantity || 1}`
        ).join(' و ');
        
        const incomingDesc = incomingItems.map(item => 
          `${item.productName} قياس ${item.size || 'عادي'} عدد ${item.quantity || 1}`
        ).join(' و ');
        
        merchantNotes = `استبدال منتج ${outgoingDesc} واستلام من الزبون ${incomingDesc}`;
        
        // ✅ ملاحظات تفصيلية للنظام الداخلي
        const outgoingList = outgoingItems.map(item => 
          `${item.productName} (${item.color || 'افتراضي'}, ${item.size || 'افتراضي'}) × ${item.quantity || 1} = ${(item.price * (item.quantity || 1)).toLocaleString()} د.ع`
        ).join('\n   ');
        
        const incomingList = incomingItems.map(item => 
          `${item.productName} (${item.color || 'افتراضي'}, ${item.size || 'افتراضي'}) × ${item.quantity || 1} = ${(item.price * (item.quantity || 1)).toLocaleString()} د.ع`
        ).join('\n   ');
        
        orderNotes = `استبدال
━━━━━━━━━━━━━━━
منتجات صادرة:
   ${outgoingList}
   المجموع: ${outgoingTotal.toLocaleString()} د.ع

منتجات واردة:
   ${incomingList}
   المجموع: ${incomingTotal.toLocaleString()} د.ع

فرق السعر التلقائي: ${autoPriceDiff >= 0 ? '+' : ''}${autoPriceDiff.toLocaleString()} د.ع${manualExchangePriceDiff !== 0 ? '\nفرق السعر اليدوي: ' + (manualExchangePriceDiff >= 0 ? '+' : '') + manualExchangePriceDiff.toLocaleString() + ' د.ع' : ''}
فرق السعر الإجمالي: ${priceDiff >= 0 ? '+' : ''}${priceDiff.toLocaleString()} د.ع
رسوم التوصيل: ${calculatedDeliveryFee.toLocaleString()} د.ع
━━━━━━━━━━━━━━━
المبلغ الإجمالي: ${finalTotal.toLocaleString()} د.ع`;
      }
    
    const orderData = {
      ...formData,
      order_type: actualOrderType, // ✅ ضبط النوع الصحيح
      items: (() => {
        // ✅ للاستبدال: validation ثم تمرير cart
        if (formData.type === 'exchange') {
          // ✅ VALIDATION: التأكد من أن جميع المنتجات لها item_direction
          const invalidItems = cart.filter(item => !item.item_direction);
          if (invalidItems.length > 0) {
            console.error('❌ منتجات بدون item_direction:', invalidItems);
            toast({
              title: "خطأ في البيانات",
              description: "جميع المنتجات يجب أن تحتوي على اتجاه (صادر/وارد)",
              variant: "destructive"
            });
            throw new Error('جميع المنتجات يجب أن تحتوي على اتجاه (outgoing/incoming)');
          }
          
          devLog.log('📦 [QuickOrderContent] تمرير cart للاستبدال:', cart);
          return cart.map(item => ({
            product_id: item.productId,
            variant_id: item.variantId,
            quantity: item.quantity || 1,
            unit_price: item.price,
            total_price: item.price * (item.quantity || 1),
            item_direction: item.item_direction // ✅ حفظ الاتجاه
          }));
        }
        
        // ✅ للإرجاع: استخدم orderItems (تم تحضيره مسبقاً)
        if (formData.type === 'return') {
          return orderItems;
        }
        
        // ✅ للطلبات العادية: استخدم cart
        return orderItems.map(item => ({
          product_id: item.id,
          variant_id: item.variantId,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.price * item.quantity
        }));
      })(),
      total_amount: formData.type === 'exchange' 
        ? (() => {
            // ✅ حساب فرق السعر: outgoing - incoming (موجب أو صفر)
            const outgoingTotal = cart
              .filter(item => item.item_direction === 'outgoing')
              .reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
            const incomingTotal = cart
              .filter(item => item.item_direction === 'incoming')
              .reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
            const priceDiff = outgoingTotal - incomingTotal;
            return Math.max(0, Math.round(priceDiff)); // ✅ فقط فرق السعر الموجب أو صفر
          })()
        : formData.type === 'return'
          ? -Math.abs(refundAmount)  // ✅ للإرجاع: سالب دائماً
          : Math.round(finalTotal),  // للطلبات العادية
      final_amount: formData.type === 'exchange'
        ? (() => {
            // ✅ حساب المبلغ النهائي (فرق السعر + توصيل)
            const outgoingTotal = cart
              .filter(item => item.item_direction === 'outgoing')
              .reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
            const incomingTotal = cart
              .filter(item => item.item_direction === 'incoming')
              .reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
            const priceDifference = incomingTotal - outgoingTotal;
            return Math.round(priceDifference + calculatedDeliveryFee);
          })()
        : formData.type === 'return'
          ? -Math.abs(refundAmount)  // ✅ للإرجاع: سالب (بدون توصيل لأن التوصيل منفصل)
          : Math.round(finalTotal),
      refund_amount: actualRefundAmount, // ✅ مبلغ الإرجاع
      original_order_id: originalOrder?.id || null, // ✅ ربط بالطلب الأصلي
      discount: formData.type === 'exchange' || formData.type === 'return' ? 0 : discount, // ✅ صفر للاستبدال والإرجاع
      delivery_fee: formData.type === 'exchange' || formData.type === 'return'
        ? (settings?.deliveryFee || 5000)  // ✅ للاستبدال والإرجاع: التوصيل منفصل
        : formData.type === 'توصيل' 
          ? deliveryFeeAmount 
          : 0,
      customer_name: formData.name,
      customer_phone: formData.phone,
      customer_address: formData.address,
      customer_city: formData.city,
      customer_province: formData.province,
      notes: orderNotes, // ✅ الملاحظات التفصيلية
      payment_status: 'pending',
      delivery_status: 'pending',
      status: 'pending',
      // ✅ حفظ بيانات الاستبدال في exchange_metadata
      exchange_metadata: formData.type === 'exchange' ? (() => {
        // ✅ حساب المنتجات الصادرة والواردة من cart
        const outgoingItems = cart
          .filter(item => item.item_direction === 'outgoing')
          .map(item => ({
            variant_id: item.variantId,
            product_id: item.productId,
            quantity: item.quantity || 1,
            product_name: item.productName,
            color: item.color,
            size: item.size,
            color_name: item.color,      // ✅ إضافة للـ useOrders
            size_name: item.size,         // ✅ إضافة للـ useOrders
            price: item.price,
            unit_price: item.price,       // ✅ إضافة للـ useOrders
            total_price: item.price * (item.quantity || 1) // ✅ إضافة للـ useOrders
          }));
        
        const incomingItems = cart
          .filter(item => item.item_direction === 'incoming')
          .map(item => ({
            variant_id: item.variantId,
            product_id: item.productId,
            quantity: item.quantity || 1,
            product_name: item.productName,
            color: item.color,
            size: item.size,
            color_name: item.color,      // ✅ إضافة للـ useOrders
            size_name: item.size,         // ✅ إضافة للـ useOrders
            price: item.price,
            unit_price: item.price,       // ✅ إضافة للـ useOrders
            total_price: item.price * (item.quantity || 1) // ✅ إضافة للـ useOrders
          }));
        
        // ✅ حساب فرق السعر من جميع المنتجات
        const totalOutgoingPrice = outgoingItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const totalIncomingPrice = incomingItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const calculatedPriceDiff = totalIncomingPrice - totalOutgoingPrice;
        
        return {
          price_difference: calculatedPriceDiff,
          delivery_fee: calculatedDeliveryFee,
          outgoing_items: outgoingItems,
          incoming_items: incomingItems
        };
      })() : null
    };

    // إذا كان هذا تعديل على طلب ذكي، قم بالموافقة عليه وإنشاء طلب عادي
    if (isDialog && aiOrderData && !isEditMode) {
      try {
        const result = await createOrder(orderData);
        if (result.success) {
          // حذف الطلب الذكي بأمان مع الربط
          await deleteAiOrderWithLink(aiOrderData.id, result.orderId);
          
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

      if (activePartner === 'alwaseet' || activePartner === 'modon') {
          const partnerNameAr = activePartner === 'modon' ? 'مدن' : 'الوسيط';
          if (!isWaseetLoggedIn || !waseetToken) throw new Error(`يجب تسجيل الدخول لـ${partnerNameAr} أولاً.`);
          
            // تطبيع رقم الهاتف للتأكد من التوافق مع API
            const normalizedPhone = normalizePhone(formData.phone);
            if (!normalizedPhone) {
              throw new Error('رقم الهاتف غير صحيح. يرجى إدخال رقم هاتف عراقي صحيح.');
            }
            
            // ✅ بناء payload موحد للوسيط ومدن
            const deliveryPayload = {
              // للوسيط
              client_name: formData.name.trim() || defaultCustomerName || formData.defaultCustomerName || `زبون-${Date.now().toString().slice(-6)}`, 
              client_mobile: normalizedPhone,
              client_mobile2: formData.second_phone ? normalizePhone(formData.second_phone) : '',
              // لمدن
              name: formData.name.trim() || defaultCustomerName || formData.defaultCustomerName || `زبون-${Date.now().toString().slice(-6)}`,
              phone: normalizedPhone,
              customer_phone2: formData.second_phone ? normalizePhone(formData.second_phone) : '',
              // مشتركة
              city_id: effectiveCityId, 
              region_id: effectiveRegionId,
              location: formData.address,
              address: formData.address,
              type_name: formData.type === 'return'
                ? (() => {
                    // ✅ للإرجاع: "طلب ترجيع + أسماء المنتجات" - استخدام orderItems
                    if (orderItems.length === 0) return 'طلب ترجيع';
                    
                    const productNames = orderItems.map(item => {
                      const name = item.productName || 'منتج';
                      const sizePart = item.size ? ` ${item.size}` : '';
                      const colorPart = item.color ? ` . ${item.color}` : '';
                      return `${name}${sizePart}${colorPart}`.trim();
                    }).join(' + ');
                    
                    return `طلب ترجيع: ${productNames}`;
                  })()
                : formData.type === 'exchange' 
                  ? (() => {
                      // ✅ للاستبدال: المنتجات الصادرة فقط
                      const outgoingItems = cart.filter(item => item.item_direction === 'outgoing');
                      return outgoingItems.map(item => {
                        const name = item.productName || 'منتج';
                        const sizePart = item.size ? ` ${item.size}` : '';
                        const colorPart = item.color ? ` . ${item.color}` : '';
                        return `${name}${sizePart}${colorPart}`.trim();
                      }).join(' + ');
                    })()
                  : formData.details,  // ✅ للطلبات العادية: استخدام details العادي
              details: formData.details,
              items_number: formData.type === 'return' 
                ? (() => {
                    // ✅ مجموع كمية المنتجات الواردة
                    const incomingItems = cart.filter(item => item.item_direction === 'incoming');
                    return incomingItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
                  })()
                : formData.type === 'exchange'
                  ? (() => {
                      // ✅ للاستبدال: مجموع كمية المنتجات الصادرة فقط
                      const outgoingItems = cart.filter(item => item.item_direction === 'outgoing');
                      return outgoingItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
                    })()
                  : (orderItems.length > 0 ? orderItems.length : 1),  // ✅ للطلبات العادية: عدد العناصر
              quantity: orderItems.length > 0 ? orderItems.length : 1,
              // ✅ إرسال السعر كما هو (سالب للإرجاع، موجب للطلبات العادية)
              price: Math.round(finalTotal),
              // ✅ حقول صريحة لمدن لضمان السعر الكلي شامل التوصيل
              total_amount: Math.round(subtotal - discount),
              delivery_fee: deliveryFeeAmount,
              final_amount: Math.round(finalTotal),
              package_size: formData.size,
              size: formData.size,
              // ✅ استخدام merchantNotes المبسطة للوسيط في حالة الاستبدال
              merchant_notes: formData.type === 'exchange' ? merchantNotes : orderNotes,
              notes: formData.type === 'exchange' ? merchantNotes : orderNotes,
              // ✅ تمييز الإرجاع والاستبدال
              replacement: (formData.type === 'return' || formData.type === 'exchange') ? 1 : 0,
              type: formData.type === 'return' || formData.type === 'exchange' ? 'replacement' : 'new'
           };
           devLog.log('🔍 Diagnostic check before delivery order creation:', {
             activePartner,
             city_id: effectiveCityId,
             region_id: effectiveRegionId,
             formData_city_id: formData.city_id,
             formData_region_id: formData.region_id,
             selectedCityId,
             selectedRegionId
           });
           
           // ✅ استدعاء API المناسب
           let deliveryResponse;
           if (activePartner === 'modon') {
             const ModonAPI = await import('@/lib/modon-api');
             deliveryResponse = await ModonAPI.createModonOrder(deliveryPayload, waseetToken);
           } else {
             deliveryResponse = await createAlWaseetOrder(deliveryPayload, waseetToken);
           }
          
          if (!deliveryResponse || !deliveryResponse.qr_id) {
            throw new Error(`لم يتم استلام رقم التتبع من ${partnerNameAr}.`);
          }

          trackingNumber = deliveryResponse.qr_id;
          qrLink = deliveryResponse.qr_link;
          deliveryPartnerData = deliveryResponse;
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
        phone: normalizedPhone,
        address: `${formData.address}, ${region}, ${city}`,
        city: city, 
        province: region,
        notes: orderNotes, // ✅ استخدام orderNotes المحدثة
        
        // ✅ الحقول المطلوبة لـ createOrder
        customer_name: formData.name.trim() || defaultCustomerName || formData.defaultCustomerName || `زبون-${Date.now().toString().slice(-6)}`,
        customer_phone: normalizedPhone,
        customer_phone2: formData.second_phone || null,
        customer_city: city,
        customer_province: region,
        customer_address: `${formData.address}, ${region}, ${city}`,
        alwaseet_city_id: effectiveCityId || null,
        alwaseet_region_id: effectiveRegionId || null,
        
        // ✅ بيانات نوع الطلب
        orderType: actualOrderType,
        refundAmount: actualRefundAmount,
        originalOrderId: originalOrder?.id || null,
        deliveryFee: activePartner === 'local' ? 0 : deliveryFeeAmount
      };
      
      // ✅ تحديد اسم الشريك بشكل صحيح
      const partnerName = activePartner === 'modon' ? 'modon' : 
                          activePartner === 'alwaseet' ? 'alwaseet' : 
                          'محلي';
      
      // ✅ تجميع معلومات شريك التوصيل بشكل صحيح
      deliveryPartnerData = {
        ...(deliveryPartnerData || {}), // ✅ الاحتفاظ ببيانات الشريك إن وجدت (qr_id, qr_link, etc.)
        delivery_partner: partnerName, // ✅ 'modon' أو 'alwaseet' أو 'محلي'
        delivery_fee: activePartner === 'local' ? 0 : deliveryFeeAmount,
        alwaseet_city_id: effectiveCityId || null,
        alwaseet_region_id: effectiveRegionId || null,
        order_type: actualOrderType,
        refund_amount: actualRefundAmount,
        original_order_id: foundOriginalOrder?.id || originalOrder?.id || null, // ✅ استخدام foundOriginalOrder أولاً
      };
      
      // ✅ إنشاء الطلب: للاستبدال استخدام payload mode مع exchange_metadata
      let result;
      if (formData.type === 'exchange') {
        // ✅ للاستبدال: استخدام payload mode مع بيانات التوصيل من Al-Waseet
        result = await createOrder({
          ...orderData,
          // ✅ إضافة بيانات التوصيل من الشريك
          tracking_number: trackingNumber,
          qr_link: qrLink,
          delivery_partner: partnerName, // ✅ استخدام partnerName بدلاً من hardcoded
          delivery_status: trackingNumber ? 'pending' : 'pending',
        });
      } else {
        result = await createOrder(
          customerInfoPayload, 
          orderItems,
          trackingNumber, 
          formData.type === 'return' ? 0 : discount, 
          orderStatus, 
          qrLink, 
          deliveryPartnerData
        );
      }
      if (result.success) {
        // معالجة ما بعد إنشاء الطلب
        const createdOrderId = result.orderId || result.id;
        
        // معالجة ما بعد إنشاء الطلب للاستبدال/الإرجاع
        if (formData.type === 'exchange' && orderData.exchange_metadata) {
          const exchangeMetadata = orderData.exchange_metadata;
          
          const outgoingTotal = exchangeMetadata.outgoing_items.reduce((sum, item) => 
            sum + (item.price * item.quantity), 0
          );
          const incomingTotal = exchangeMetadata.incoming_items.reduce((sum, item) => 
            sum + (item.price * item.quantity), 0
          );
          const priceDiff = incomingTotal - outgoingTotal;
          
          // ✅ 1. ربط بالطلب الأصلي تلقائياً
          let linkedOriginalOrderId = null;
          const linkResult = await linkReturnToOriginalOrder(createdOrderId, customerInfoPayload.phone);
          
          if (linkResult.success && linkResult.originalOrderId) {
            linkedOriginalOrderId = linkResult.originalOrderId;
            devLog.log('✅ تم ربط طلب الاستبدال تلقائياً بالطلب الأصلي:', linkResult.originalOrderNumber);
            
            // ✅ الخطوة 4: تحديث ai_orders و orders معاً
            await supabase
              .from('ai_orders')
              .update({
                original_order_id: linkedOriginalOrderId,
                order_type: 'replacement'
              })
              .eq('id', createdOrderId);
            
            // ✅ مزامنة في orders أيضاً
            await supabase
              .from('orders')
              .update({
                original_order_id: linkedOriginalOrderId,
                related_order_id: linkedOriginalOrderId
              })
              .eq('id', createdOrderId);
          }
          
          // ✅ الخطوة 1 و 5: حذف الخصم اليدوي - نظام الحجز الموحد سيتولى المهمة
          // المنتج الخارج مُضاف لـ order_items بنوع 'outgoing'
          // سيُحجز تلقائياً عند إنشاء الطلب وسيُخصم عند Status 21
          devLog.log('✅ المنتج الخارج سيُحجز تلقائياً عبر نظام الحجز الموحد');
          
          // معالجة المحاسبة الكاملة
          const { error: accountingError } = await supabase.rpc('handle_exchange_price_difference', {
            p_exchange_order_id: createdOrderId,
            p_original_order_id: linkResult.originalOrderId || null,
            p_price_difference: priceDiff,
            p_delivery_fee: deliveryFeeAmount,
            p_delivery_partner: activePartner === 'alwaseet' ? 'الوسيط' : 'محلي',
            p_employee_id: user.id
          });
          
          if (accountingError) {
            console.error('خطأ في معالجة المحاسبة:', accountingError);
          }
          
          // Toast مع تعليمات واضحة للموظف
          const actionMessage = priceDiff + deliveryFeeAmount >= 0
            ? `✅ اجمع ${(priceDiff + deliveryFeeAmount).toLocaleString()} د.ع من الزبون`
            : `💰 ادفع ${Math.abs(priceDiff + deliveryFeeAmount).toLocaleString()} د.ع للزبون`;
          
          toast({
            title: "✅ تم إنشاء طلب استبدال",
            description: (
              <div className="space-y-1">
                <p>{actionMessage}</p>
                {linkResult.success && <p className="text-xs">🔗 تم ربطه بالطلب #{linkResult.originalOrderNumber}</p>}
              </div>
            ),
            duration: 5000,
          });
        }
        
        // ✅ ربط طلبات الإرجاع بالطلب الأصلي تلقائياً
        if (formData.type === 'return' && createdOrderId) {
          const linkResult = await linkReturnToOriginalOrder(createdOrderId, normalizedPhone);
          
          if (linkResult.success) {
            // ✅ تحديث في ai_orders
            await supabase
              .from('ai_orders')
              .upsert({
                id: createdOrderId,
                original_order_id: linkResult.originalOrderId,
                order_type: 'return',
                refund_amount: actualRefundAmount,
              });
            
            // ✅ تحديث في orders أيضاً
            await supabase
              .from('orders')
              .update({
                original_order_id: linkResult.originalOrderId,
                related_order_id: linkResult.originalOrderId,
              })
              .eq('id', createdOrderId);
              
            // ✅ إنشاء سجل أولي في return_history
            await supabase
              .from('return_history')
              .insert({
                return_order_id: createdOrderId,
                original_order_id: linkResult.originalOrderId,
                refund_amount: actualRefundAmount,
                delivery_fee: deliveryFeeAmount,
                employee_profit_deducted: 0,
                system_profit_deducted: 0,
                financial_handler_success: null,
                created_by: user.id,
              });
          }
        }
        
        // ✅ استخدام الطلب الأصلي الموجود أو المُمرَّر
        const effectiveOriginalOrder = foundOriginalOrder || originalOrder;
        
        if (formData.type === 'return' && refundAmount > 0 && effectiveOriginalOrder) {
          // ✅ المعالجة المالية للإرجاع - دعم عدة منتجات
          const incomingItems = cart.filter(item => item.item_direction === 'incoming');
          
          // حساب إجمالي ربح المنتجات المُرجعة
          const totalProductProfit = incomingItems.reduce((sum, item) => {
            const productCost = item.costPrice || 0;
            const productPrice = item.price || 0;
            const quantity = item.quantity || 1;
            return sum + ((productPrice - productCost) * quantity);
          }, 0);
          
          devLog.log('💰 تفاصيل الإرجاع:', {
            عدد_المنتجات: incomingItems.length,
            إجمالي_الربح: totalProductProfit,
            مبلغ_الإرجاع: refundAmount,
            من_الربح: totalProductProfit,
            من_الإيراد: refundAmount - totalProductProfit
          });
          
          // ربط الطلب وتعيين الحالة
          await supabase
            .from('orders')
            .update({ 
              related_order_id: effectiveOriginalOrder.id,
              original_order_id: effectiveOriginalOrder.id,
              status: 'return_pending',
              delivery_status: '21',
              notes: `إرجاع من طلب #${effectiveOriginalOrder.order_number}\nعدد المنتجات: ${incomingItems.length}\nإجمالي الربح: ${totalProductProfit.toLocaleString()} د.ع\nمن الإيراد: ${(refundAmount - totalProductProfit).toLocaleString()} د.ع`
            })
            .eq('id', createdOrderId);
          
          // معالجة الأرباح (RPC v2)
          const { data: adjustResult, error: adjustError } = await supabase.rpc('adjust_profit_for_return_v2', {
            p_original_order_id: effectiveOriginalOrder.id,
            p_refund_amount: refundAmount,
            p_product_profit: totalProductProfit,
            p_return_order_id: createdOrderId
          });
          
          if (adjustError) {
            console.error('❌ خطأ في معالجة الأرباح:', adjustError);
          } else {
            devLog.log('✅ نتيجة معالجة الأرباح:', adjustResult);
          }
          
          // ✅ لا نسجل حركة نقد الآن - سيتم تسجيلها عند تغيير الحالة إلى 21 (دفع للزبون)
          devLog.log('⏳ حركة النقد ستُسجل تلقائياً عند تغيير حالة التوصيل إلى 21 (تم الدفع للزبون)');
          
          // 5. Toast محسّن مع تفاصيل دقيقة
          toast({
            title: "✅ تم إنشاء طلب إرجاع",
            description: (
              <div className="space-y-2 text-sm">
                <p className="font-bold text-base">💰 ادفع {refundAmount.toLocaleString()} د.ع للزبون عند الاستلام</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  ⚠️ يشمل أجور التوصيل ({formData.deliveryFee?.toLocaleString() || '5,000'} د.ع)
                </p>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded mt-2">
                  <p className="text-xs">📊 تفاصيل المبلغ:</p>
                  <ul className="text-xs space-y-1 mt-1">
                    <li>• من الربح: {totalProductProfit.toLocaleString()} د.ع</li>
                    <li>• من الإيراد: {(refundAmount - totalProductProfit).toLocaleString()} د.ع</li>
                    {adjustResult?.employee_share > 0 && (
                      <li>• خصم من ربح الموظف: {adjustResult.employee_share.toLocaleString()} د.ع</li>
                    )}
                  </ul>
                </div>
                <p className="text-xs text-orange-600">⏳ الحالة: بانتظار استلام الراجع (21)</p>
              </div>
            ),
            duration: 8000,
          });
        }
        
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
              {formData.type === 'exchange' && <p className="text-xs text-green-600">✅ تم معالجة الاستبدال</p>}
              {formData.type === 'return' && <p className="text-xs text-orange-600">✅ تم معالجة الإرجاع</p>}
              {activePartner === 'alwaseet' && <p className="text-xs text-muted-foreground">سيتم تحديث حالة الطلب تلقائياً خلال دقائق...</p>}
            </div>
          ),
          variant: 'success',
          duration: 5000
        });
        // ✅ إصلاح التجمد: إعادة تعيين فورية
        if (isMountedRef.current) {
          resetForm();
          // استدعاء onOrderCreated فوراً
          if (onOrderCreated) {
            onOrderCreated();
          }
        }
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

  // إضافة دالة للتعامل مع تحديث الطلبات
  const handleOrderUpdate = async () => {
    try {
      devLog.log('🔄 بدء تحديث الطلب - وضع التعديل');
      
       // حساب الإجمالي الجديد مع حماية من الأخطاء
       const safeCart = Array.isArray(cart) ? cart.filter(item => item && typeof item.total === 'number') : [];
       const newSubtotal = safeCart.reduce((sum, item) => sum + (item.total || 0), 0);
      const newTotal = newSubtotal - discount;
      const newFinalTotal = newTotal + deliveryFee;
      
      // تطبيع رقم الهاتف
      const normalizedPhone = normalizePhone(formData.phone);
      if (!normalizedPhone) {
        throw new Error('رقم الهاتف غير صحيح. يرجى إدخال رقم هاتف عراقي صحيح.');
      }
      
      // بناء بيانات التحديث
      const city = activePartner === 'local' ? formData.city : (Array.isArray(cities) ? cities.find(c => c.id == formData.city_id)?.name : '') || '';
      const region = activePartner === 'local' ? formData.region : (Array.isArray(regions) ? regions.find(r => r.id == formData.region_id)?.name : '') || '';
      
      const userPrice = parseInt(formData.price) || newFinalTotal;
      const updateData = {
        customer_name: formData.name.trim() || defaultCustomerName || formData.defaultCustomerName || `زبون-${Date.now().toString().slice(-6)}`,
        customer_phone: normalizedPhone,
        customer_phone2: formData.second_phone || '',
        customer_city: city,
        customer_province: region,
        customer_address: formData.address || '',
        city_id: formData.city_id || null,
        region_id: formData.region_id || null,
        notes: formData.notes || '',
        discount: discount,
        total_amount: userPrice,
        final_total: userPrice,
        delivery_fee: deliveryFee,
        updated_at: new Date().toISOString()
      };

      // تحديث الطلب في النظام المحلي
      devLog.log('🔄 تحديث الطلب في النظام المحلي...', updateData);
      await updateOrder(aiOrderData.orderId, updateData);

      // إذا كان شريك الوسيط متصل وهناك معرف طلب خارجي، قم بتحديث الطلب
      const trackingNumber = aiOrderData.tracking_number || aiOrderData.delivery_partner_order_id || aiOrderData.originalOrder?.tracking_number;
      
      devLog.log('🔍 Checking AlWaseet update conditions:', {
        isWaseetLoggedIn,
        activePartner,
        trackingNumber,
        delivery_partner: aiOrderData.originalOrder?.delivery_partner
      });
      
      if (isWaseetLoggedIn && activePartner === 'alwaseet' && trackingNumber) {
        const userPrice = parseInt(formData.price) || newFinalTotal;
        const editData = {
          tracking_number: trackingNumber,
          qr_id: trackingNumber, // نفس القيمة للتأكد
          delivery_partner_order_id: trackingNumber,
          customer_name: updateData.customer_name,
          customer_phone: updateData.customer_phone,
          customer_phone2: updateData.customer_phone2 || '',
          customer_city_id: formData.city_id,
          customer_region_id: formData.region_id,
          customer_address: updateData.customer_address,
          package_size_id: formData.size || 1,
          notes: updateData.notes,
          price: userPrice,
          final_total: userPrice,
          total_amount: userPrice,
          delivery_fee: deliveryFee,
          items_number: cart.length,
          details: `طلب محدث - ${cart.length} عنصر`
        };
        
        devLog.log('📤 AlWaseet edit data prepared:', editData);

        devLog.log('🔄 محاولة تحديث الطلب في الوسيط...');
        
        try {
          // التحقق من البيانات المطلوبة قبل الإرسال
          if (!editData.qr_id || !editData.customer_name || !editData.customer_phone) {
            throw new Error('بيانات مفقودة: يجب توفر رقم التتبع واسم العميل ورقم الهاتف');
          }
          
          devLog.log('📤 إرسال بيانات التحديث إلى الوسيط:', editData);
          const editResponse = await editAlWaseetOrder(editData, waseetToken);
          
          devLog.log('📥 استجابة الوسيط:', editResponse);
          
          if (editResponse?.success) {
            devLog.log('✅ تم تحديث الطلب في الوسيط بنجاح');
            toast({
              title: "✅ تم التحديث بنجاح",
              description: `تم تحديث الطلب ${trackingNumber} في شركة التوصيل بنجاح`,
              className: "bg-green-50 border-green-200 text-green-800",
              duration: 4000
            });
          } else {
            const errorMsg = editResponse?.error || editResponse?.message || 'فشل غير محدد';
            console.error('❌ فشل تحديث الطلب في الوسيط:', errorMsg);
            toast({
              title: "⚠️ تحذير",
              description: `تم تحديث الطلب محلياً لكن فشل في الوسيط: ${errorMsg}`,
              variant: "destructive",
              duration: 6000
            });
          }
        } catch (error) {
          console.error('❌ خطأ في تحديث الطلب في الوسيط:', error);
          toast({
            title: "⚠️ تحذير", 
            description: `تم تحديث الطلب محلياً لكن حدث خطأ: ${error.message}`,
            variant: "destructive",
            duration: 6000
          });
        }
      } else {
        devLog.log('ℹ️ تخطي تحديث الوسيط:', {
          reason: !isWaseetLoggedIn ? 'غير متصل بالوسيط' : 
                  activePartner !== 'alwaseet' ? 'الشريك ليس الوسيط' : 
                  !trackingNumber ? 'لا يوجد رقم تتبع' : 'سبب غير معروف'
        });
      }

      // إشعار بنجاح التحديث
      toast({
        title: "✅ تم تحديث الطلب بنجاح",
        description: `العميل: ${updateData.customer_name} • المبلغ: ${Math.round(newFinalTotal).toLocaleString()} د.ع`,
        className: "bg-green-50 border-green-200 text-green-800",
        duration: 4000
      });

      // ✅ إصلاح التجمد: إعادة تعيين فورية
      if (isMountedRef.current) {
        resetForm();
      }
      if (onOrderCreated) {
        setTimeout(() => onOrderCreated(), 100);
      }

    } catch (error) {
      console.error('❌ خطأ في تحديث الطلب:', error);
      toast({
        title: "خطأ في تحديث الطلب",
        description: error.message || "حدث خطأ غير متوقع أثناء التحديث",
        variant: "destructive",
        duration: 6000
      });
    }
  };
  
  const handleConfirmProductSelection = (selectedItems) => {
    clearCart();
    (selectedItems || []).filter(item => item != null && typeof item === 'object').forEach(item => {
        const product = { id: item.productId, name: item.productName, images: [item.image] };
        const variant = { id: item.variantId, sku: item.sku, color: item.color, size: item.size, price: item.price, cost_price: item.costPrice, quantity: item.stock, reserved: item.reserved, image: item.image };
        addToCart(product, variant, Number(item?.quantity) || 1, false);
    });
    setProductSelectOpen(false);
    toast({ title: "تم تحديث السلة", description: `تم إضافة ${selectedItems.length} منتج.`, variant: "success" });
  };

  const handleConfirmOutgoingProducts = (selectedItems) => {
    devLog.log('🔵 تأكيد المنتجات الصادرة:', selectedItems);
    
    setCart(prev => {
      // مسح المنتجات الصادرة القديمة فقط
      const nonOutgoing = prev.filter(item => item.item_direction !== 'outgoing');
      
      // إضافة المنتجات الجديدة مع item_direction مباشرة
      const newOutgoing = (selectedItems || []).map(item => ({
        id: crypto.randomUUID(),
        productId: item.productId,
        variantId: item.variantId,
        productName: item.productName,
        color: item.color,
        size: item.size,
        price: item.price,
        costPrice: item.costPrice,
        quantity: item.quantity,
        total: item.total,
        image: item.image,
        sku: item.sku,
        stock: item.stock,
        reserved: item.reserved,
        item_direction: 'outgoing'
      }));
      
      return [...nonOutgoing, ...newOutgoing];
    });
    
    toast({ 
      title: "تم تحديث المنتجات الصادرة", 
      description: `تم إضافة ${selectedItems.length} منتج.`, 
      variant: "success" 
    });
  };

  const handleConfirmIncomingProducts = (selectedItems) => {
    devLog.log('🟢 تأكيد المنتجات الواردة:', selectedItems);
    
    setCart(prev => {
      // مسح المنتجات الواردة القديمة فقط
      const nonIncoming = prev.filter(item => item.item_direction !== 'incoming');
      
      // إضافة المنتجات الجديدة مع item_direction مباشرة
      const newIncoming = (selectedItems || []).map(item => ({
        id: crypto.randomUUID(),
        productId: item.productId,
        variantId: item.variantId,
        productName: item.productName,
        color: item.color,
        size: item.size,
        price: item.price,
        costPrice: item.costPrice,
        quantity: item.quantity,
        total: item.total,
        image: item.image,
        sku: item.sku,
        stock: item.stock,
        reserved: item.reserved,
        item_direction: 'incoming'
      }));
      
      return [...nonIncoming, ...newIncoming];
    });
    
    toast({ 
      title: "تم تحديث المنتجات الواردة", 
      description: `تم إضافة ${selectedItems.length} منتج.`, 
      variant: "success" 
    });
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
      
      // للوسيط - استخدام القيم الأصلية في حالة التعديل
      const effectiveCityId = selectedCityId || formData.city_id || '';
      const effectiveRegionId = selectedRegionId || formData.region_id || '';
      
      // عرض النص الأصلي للمدينة والمنطقة في حالة التعديل
      const originalCityText = formData.originalCity || formData.customer_city || '';
      const originalRegionText = formData.originalRegion || formData.customer_province || '';
      
      devLog.log('🏙️ Partner fields - Values for display:', {
        effectiveCityId,
        effectiveRegionId,
        originalCityText,
        originalRegionText,
        selectedCityId,
        selectedRegionId,
        formDataCityId: formData.city_id,
        formDataRegionId: formData.region_id,
        editMode: aiOrderData?.editMode
      });
      
      return (
        <>
            <div className="space-y-2">
              <Label>المدينة</Label>
              {originalCityText && aiOrderData?.editMode && (
                <div className="text-sm text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded border mb-2">
                  المدينة الأصلية: <span className="font-semibold">{originalCityText}</span>
                </div>
              )}
                <SearchableSelectFixed
                  value={formData.city_id}
                  onValueChange={(v) => {
                   devLog.log('🏙️ City selection changed:', v);
                   setSelectedCityId(v);
                   handleSelectChange('city_id', v);
                   // مسح المنطقة عند تغيير المدينة
                   setSelectedRegionId('');
                   handleSelectChange('region_id', '');
                   // ✅ إعادة تفعيل جلب المناطق الجديدة في وضع التعديل
                   preloadedRegionsApplied.current = false;
                 }}
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
              {originalRegionText && aiOrderData?.editMode && (
                <div className="text-sm text-green-600 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded border mb-2">
                  المنطقة الأصلية: <span className="font-semibold">{originalRegionText}</span>
                </div>
              )}
                 <SearchableSelectFixed
                   value={formData.region_id}
                   onValueChange={(v) => {
                    devLog.log('🌍 الحل الجذري - تغيير المنطقة:', v);
                    devLog.log('🔍 Region dropdown debug:', {
                      effectiveRegionId,
                      regionsLength: regions.length,
                      selectedOption: regions.find(r => String(r.id) === String(effectiveRegionId)),
                      formDataRegionId: formData.region_id,
                      newValue: v
                    });
                    setSelectedRegionId(v); // ✅ إضافة هذا السطر مثل المدينة تماماً
                    handleSelectChange('region_id', v);
                  }}
                 options={(Array.isArray(regions) ? regions : []).map(r => ({ value: String(r.id), label: r.name }))}
                 placeholder={loadingRegions ? 'تحميل المناطق...' : 
                   (regions.length === 0 && formData.region_id ? `المنطقة: ${formData.region_id}` : 
                   (effectiveCityId ? 'اختر منطقة' : 'اختر المدينة أولاً'))}
                 searchPlaceholder="بحث في المناطق..."
                 emptyText="لا توجد منطقة بهذا الاسم"
                 className={errors.region_id ? "border-red-500" : ""}
                 disabled={!effectiveCityId || loadingRegions || dataFetchError}
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
      devLog.log('Form submit intercepted');
      handleSubmit(e);
    } 
  };
  const isSubmitDisabled = isSubmittingState || !isDeliveryPartnerSelected || (activePartner === 'alwaseet' && (!isWaseetLoggedIn || !initialDataLoaded || dataFetchError)) || Object.values(errors).some(e => e) || cart.length === 0;

  return (
    <>
      
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
            selectedCityId={selectedCityId}
            selectedRegionId={selectedRegionId}
            cities={cities}
            regions={regions}
          />
          {/* ✅ إظهار OrderDetailsForm دائماً، إخفاء قسم المنتجات فقط في الاستبدال */}
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
            cart={cart}
            removeFromCart={removeFromCart}
            showProductSelection={formData.type !== 'exchange' && formData.type !== 'return'}
            isEditMode={isEditMode} // ✅ تمرير وضع التعديل
          />
          
          {/* نماذج الاستبدال والإرجاع */}
          {formData.type === 'exchange' && (
            <ExchangeProductsForm
              cart={cart}
              onAddOutgoing={handleConfirmOutgoingProducts}
              onAddIncoming={handleConfirmIncomingProducts}
              onRemoveItem={(itemId) => {
                removeFromCart(itemId);
              }}
              deliveryFee={deliveryFee}
              onManualPriceDiffChange={setManualExchangePriceDiff}
            />
          )}
          
          {formData.type === 'return' && (
            <ReturnProductForm
              customerPhone={formData.phone}
              cart={cart}
              onAddIncoming={handleConfirmIncomingProducts}
              refundAmount={refundAmount}
              onRefundAmountChange={setRefundAmount}
              onOriginalOrderFound={setFoundOriginalOrder}
              deliveryFee={deliveryFee}
            />
          )}
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