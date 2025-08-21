import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Trash2, Plus, AlertTriangle, Package, User, MapPin, Calendar, DollarSign, Save, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { editAlWaseetOrder } from '@/lib/alwaseet-api';
// Removed SearchableSelectFixed import - using standard Select instead
import { iraqiProvinces } from '@/lib/iraq-provinces';
import ProductSelectionDialog from '@/components/products/ProductSelectionDialog';
import { useInventory } from '@/contexts/InventoryContext';

const EditOrderDialog = ({ open, onOpenChange, order, onOrderUpdated }) => {
  const { cities, regions, packageSizes, fetchCities, fetchRegions, fetchPackageSizes, waseetToken } = useAlWaseet();
  const { products, updateOrder, settings } = useInventory();
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    phone2: '',
    city_id: '',
    region_id: '',
    city: '',
    region: '',
    address: '',
    notes: '',
    size: '',
    quantity: 1,
    price: 0,
    details: '',
    delivery_fee: 0
  });
  const [orderItems, setOrderItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingRegions, setIsLoadingRegions] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [originalData, setOriginalData] = useState(null);

  // تحميل البيانات الأساسية عند فتح النافذة
  useEffect(() => {
    if (open) {
      if (cities.length === 0) fetchCities();
      if (packageSizes.length === 0) fetchPackageSizes();
    }
  }, [open, cities.length, packageSizes.length, fetchCities, fetchPackageSizes]);

  // معالجة العثور على المنطقة بعد جلب المناطق
  useEffect(() => {
    if (regions.length > 0 && originalData?.customerProvince && formData.city_id && !formData.region_id) {
      const regionMatch = regions.find(r => {
        const regionName = r.name || r.name_ar || r.region_name || '';
        return regionName.toLowerCase().trim() === originalData.customerProvince.toLowerCase().trim() ||
               originalData.customerProvince.toLowerCase().includes(regionName.toLowerCase()) ||
               regionName.toLowerCase().includes(originalData.customerProvince.toLowerCase());
      });
      
      if (regionMatch) {
        console.log('✅ تم العثور على المنطقة تلقائياً:', regionMatch);
        setFormData(prev => ({ 
          ...prev, 
          region_id: regionMatch.id,
          region: regionMatch.name || regionMatch.name_ar || regionMatch.region_name
        }));
      }
    }
  }, [regions, originalData, formData.city_id, formData.region_id]);

  // تهيئة النموذج عند فتح النافذة - إصلاح شامل مع تطبيق منطق QuickOrderContent
  const initializeForm = useCallback(async () => {
    if (!order || !open) return;
    
    console.log('🔄 بدء تهيئة نموذج تعديل الطلب:', order);
    
    // تحديد ما إذا كان يمكن تعديل الطلب
    const editable = order.status === 'pending' || order.status === 'في انتظار التأكيد';
    setCanEdit(editable);
    
    console.log('✏️ حالة التحرير:', { status: order.status, canEdit: editable });
    
    // استخراج البيانات من الطلب - تحسين الاستخراج من customer_address
    let customerCity = order.customer_city || '';
    let customerProvince = order.customer_province || '';
    
    // إذا لم تكن المنطقة موجودة، حاول استخراجها من العنوان
    if (!customerProvince && order.customer_address) {
      const addressParts = order.customer_address.split(',').map(part => part.trim());
      // البحث عن المنطقة في أجزاء العنوان
      for (const part of addressParts) {
        // تحقق من المحافظات العراقية
        const provinceMatch = iraqiProvinces.find(p => 
          part.includes(p.name) || p.name.includes(part)
        );
        if (provinceMatch && !customerProvince) {
          customerProvince = part;
          break;
        }
      }
    }
    
    // حفظ البيانات الأصلية للمقارنة
    const originalDataObj = {
      customerName: order.customer_name || '',
      customerPhone: order.customer_phone || '',
      customerPhone2: order.customer_phone2 || '',
      customerCity: customerCity,
      customerProvince: customerProvince,
      customerAddress: order.customer_address || '',
      totalAmount: order.total_amount || 0,
      deliveryFee: order.delivery_fee || 0,
      trackingNumber: order.tracking_number || '',
      deliveryPartner: order.delivery_partner || ''
    };
    setOriginalData(originalDataObj);
    
    console.log('📍 البيانات المستخرجة:', {
      customerCity,
      customerProvince,
      address: order.customer_address,
      delivery_partner: order.delivery_partner,
      tracking_number: order.tracking_number
    });
    
    // جلب البيانات المطلوبة أولاً مع retry logic محسن
    console.log('📡 بدء جلب البيانات الأساسية...');
    
    let currentCities = cities;
    let currentPackageSizes = packageSizes;
    
    // جلب المدن مع retry
    if (currentCities.length === 0) {
      console.log('📡 جلب المدن...');
      try {
        await fetchCities();
        // انتظار قصير للتحديث
        await new Promise(resolve => setTimeout(resolve, 300));
        currentCities = cities;
        console.log('✅ تم جلب المدن:', currentCities.length);
      } catch (error) {
        console.error('❌ فشل جلب المدن:', error);
        toast({
          title: "خطأ",
          description: "فشل في جلب قائمة المدن",
          variant: "destructive"
        });
        return;
      }
    }
    
    // جلب أحجام الطلب مع retry
    if (currentPackageSizes.length === 0) {
      console.log('📡 جلب أحجام الطلب...');
      try {
        await fetchPackageSizes();
        // انتظار قصير للتحديث
        await new Promise(resolve => setTimeout(resolve, 300));
        currentPackageSizes = packageSizes;
        console.log('✅ تم جلب أحجام الطلب:', currentPackageSizes.length);
      } catch (error) {
        console.error('❌ فشل جلب أحجام الطلب:', error);
        toast({
          title: "خطأ",
          description: "فشل في جلب أحجام الطلب",
          variant: "destructive"
        });
        return;
      }
    }
    
    // البحث عن city_id و region_id من البيانات
    let cityId = '';
    let regionId = '';
    let packageSize = 'عادي'; // القيمة الافتراضية
    
    // البحث الدقيق عن المدينة - استخدام نفس منطق QuickOrderContent
    console.log('🔍 البحث عن المدينة:', { customerCity, citiesCount: currentCities.length });
    
    if (customerCity && currentCities.length > 0) {
      // البحث بالتطابق الدقيق أولاً
      let cityMatch = currentCities.find(c => {
        const cityName = c.name || c.name_ar || c.city_name || '';
        return cityName.toLowerCase().trim() === customerCity.toLowerCase().trim();
      });
      
      // إذا لم نجد تطابق دقيق، ابحث بالتضمين
      if (!cityMatch) {
        cityMatch = currentCities.find(c => {
          const cityName = c.name || c.name_ar || c.city_name || '';
          return customerCity.toLowerCase().includes(cityName.toLowerCase()) ||
                 cityName.toLowerCase().includes(customerCity.toLowerCase());
        });
      }
      
      console.log('🔍 نتيجة البحث عن المدينة:', { cityMatch, customerCity });
      
      if (cityMatch) {
        cityId = String(cityMatch.id); // تحويل ID إلى string لضمان التطابق
        console.log('✅ تم العثور على المدينة:', { city: cityMatch, cityId });
        
        // جلب المناطق لهذه المدينة مع تحسين الأداء
        console.log('📡 بدء جلب المناطق للمدينة:', cityId);
        setIsLoadingRegions(true);
        
        try {
          // جلب المناطق واستخدام البيانات المُرجعة مباشرة
          const fetchedRegions = await fetchRegions(cityId);
          console.log('✅ تم جلب المناطق للمدينة:', { cityId, fetchedRegionsCount: fetchedRegions?.length || 0 });
          
          // استخدام البيانات المُرجعة من fetchRegions مباشرة
          const regionsToSearch = fetchedRegions && fetchedRegions.length > 0 ? fetchedRegions : regions;
          
          // انتظار إضافي لضمان تحديث السياق
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // البحث عن المنطقة مع retry logic
          if (customerProvince) {
            console.log('🔍 البحث عن المنطقة في:', { 
              customerProvince, 
              regionsCount: regionsToSearch.length,
              firstFewRegions: regionsToSearch.slice(0, 3).map(r => r.name || r.name_ar || r.region_name)
            });
            
            let regionMatch = null;
            
            // المحاولة الأولى: البحث بالتطابق الدقيق
            regionMatch = regionsToSearch.find(r => {
              const regionName = r.name || r.name_ar || r.region_name || '';
              return regionName.toLowerCase().trim() === customerProvince.toLowerCase().trim();
            });
            
            // المحاولة الثانية: البحث بالتضمين
            if (!regionMatch) {
              regionMatch = regionsToSearch.find(r => {
                const regionName = r.name || r.name_ar || r.region_name || '';
                return customerProvince.toLowerCase().includes(regionName.toLowerCase()) ||
                       regionName.toLowerCase().includes(customerProvince.toLowerCase());
              });
            }
            
            // المحاولة الثالثة: إعادة المحاولة مع البيانات المحدثة من السياق
            if (!regionMatch && regions.length > 0) {
              console.log('🔄 إعادة المحاولة مع بيانات السياق المحدثة');
              regionMatch = regions.find(r => {
                const regionName = r.name || r.name_ar || r.region_name || '';
                return regionName.toLowerCase().trim() === customerProvince.toLowerCase().trim();
              });
            }
            
            if (regionMatch) {
              regionId = String(regionMatch.id);
              console.log('✅ تم العثور على المنطقة بنجاح:', { 
                region: regionMatch, 
                regionId,
                regionName: regionMatch.name || regionMatch.name_ar || regionMatch.region_name 
              });
            } else {
              console.log('⚠️ لم يتم العثور على المنطقة رغم المحاولات المتعددة:', { 
                customerProvince, 
                searchedInRegionsCount: regionsToSearch.length,
                availableRegions: regionsToSearch.slice(0, 5).map(r => r.name || r.name_ar || r.region_name)
              });
            }
          } else {
            console.log('⚠️ لا توجد منطقة للبحث عنها');
          }
        } catch (error) {
          console.error('❌ خطأ في جلب المناطق:', error);
          toast({
            title: "خطأ",
            description: "فشل في جلب المناطق للمدينة المحددة",
            variant: "destructive"
          });
        } finally {
          setIsLoadingRegions(false);
        }
      } else {
        console.log('❌ لم يتم العثور على المدينة في القائمة:', { customerCity, availableCities: currentCities.slice(0, 3) });
      }
    }
    
    // تحديد حجم الطلب الصحيح مع تحسين التطابق
    console.log('📦 تحديد حجم الطلب:', { 
      deliveryPartner: order.delivery_partner, 
      packageSize: order.package_size, 
      availableSizes: currentPackageSizes.length 
    });
    
    if (order.delivery_partner === 'الوسيط' && currentPackageSizes.length > 0) {
      // البحث الدقيق بالـ ID أولاً
      let sizeMatch = currentPackageSizes.find(size => 
        String(size.id) === String(order.package_size)
      );
      
      // إذا لم نجد بالـ ID، ابحث بالاسم
      if (!sizeMatch && order.package_size) {
        sizeMatch = currentPackageSizes.find(size => 
          size.name === order.package_size ||
          (size.name && size.name.includes(order.package_size)) ||
          (order.package_size && order.package_size.includes(size.name))
        );
      }
      
      if (sizeMatch) {
        packageSize = String(sizeMatch.id); // تحويل إلى string
        console.log('✅ تم العثور على حجم الطلب:', { match: sizeMatch, packageSize });
      } else {
        // البحث عن حجم افتراضي مناسب
        const defaultSize = currentPackageSizes.find(size => 
          (size.name && (size.name.includes('صغير') || size.name.includes('عادي'))) ||
          (size.name && (size.name.toLowerCase().includes('small') || size.name.toLowerCase().includes('normal')))
        );
        packageSize = defaultSize ? String(defaultSize.id) : String(currentPackageSizes[0]?.id || '1');
        console.log('⚠️ لم يتم العثور على حجم الطلب، استخدام القيمة الافتراضية:', { 
          defaultSize, 
          packageSize,
          originalSize: order.package_size 
        });
      }
    } else {
        // للطلبات المحلية و Al-Waseet، استخدم القيم الصحيحة كما في QuickOrderContent
      packageSize = 'عادي'; // Use Arabic text like QuickOrderContent
      console.log('📦 طلب محلي أو Al-Waseet - استخدام الحجم الافتراضي:', packageSize);
    }
    
    // تحضير المنتجات المحددة من عناصر الطلب
    if (order.items && Array.isArray(order.items)) {
      const productsFromOrder = order.items.map(item => ({
        productId: item.product_id,
        variantId: item.variant_id,
        quantity: item.quantity || 1,
        price: item.unit_price || item.price || 0,
        productName: item.product_name || item.productname || 'منتج',
        color: item.color || '',
        size: item.size || ''
      }));
      setSelectedProducts(productsFromOrder);
      console.log('📦 المنتجات المحملة:', productsFromOrder);
    }
    
    // ملء النموذج بالبيانات المطابقة مع تحسين شامل
    const initialFormData = {
      name: order.customer_name || '',
      phone: order.customer_phone || '',
      phone2: order.customer_phone2 || '',
      city_id: cityId, // سيكون string أو فارغ
      region_id: regionId, // سيكون string أو فارغ
      city: customerCity,
      region: customerProvince,
      address: order.customer_address || '',
      notes: order.notes || '',
      size: packageSize, // سيكون string
      quantity: order.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 1,
      price: order.total_amount || 0,
      details: order.items?.map(item => 
        `${item.productname || item.product_name || 'منتج'} × ${item.quantity || 1}`
      ).join(', ') || '',
      delivery_fee: order.delivery_fee || settings?.deliveryFee || 0
    };
    
    setFormData(initialFormData);
    console.log('📝 تم تعبئة النموذج بالبيانات المحسنة:', {
      formData: initialFormData,
      cityMatch: cityId ? 'Found' : 'Not Found',
      regionMatch: regionId ? 'Found' : 'Not Found',
      sizeMatch: packageSize !== 'normal' ? 'Found' : 'Default'
    });
    
    // ملء عناصر الطلب
    if (order.items && Array.isArray(order.items)) {
      const orderItemsData = order.items.map(item => ({
        id: item.id || Math.random().toString(),
        product_name: item.productname || item.product_name || 'منتج',
        quantity: item.quantity || 1,
        unit_price: item.price || item.unit_price || 0,
        total_price: (item.quantity || 1) * (item.price || item.unit_price || 0),
        product_id: item.product_id,
        variant_id: item.variant_id
      }));
      setOrderItems(orderItemsData);
    }
    
  }, [order, open, cities, fetchRegions, packageSizes, settings]);

  // تهيئة النموذج عند تغيير الطلب أو فتح النافذة
  useEffect(() => {
    initializeForm();
  }, [initializeForm]);

  // معالجة تغيير القيم
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // معالجة تغيير القوائم المنسدلة مع إصلاح شامل وتطبيق منطق QuickOrderContent
  const handleSelectChange = async (value, name) => {
    console.log(`🔄 تغيير ${name} إلى:`, { value, type: typeof value });
    
    // تحديث الحالة فوراً مع تحسين المقارنات
    setFormData(prev => {
      const newData = { ...prev };
      
      // تحديث القيمة المحددة - تحويل إلى string للاتساق
      newData[name] = String(value);
      
      // إذا تغيرت المدينة
      if (name === 'city_id' && value) {
        const selectedCity = cities.find(c => String(c.id) === String(value));
        if (selectedCity) {
          newData.city = selectedCity.name || selectedCity.name_ar || selectedCity.city_name || '';
          console.log('🏙️ تم اختيار المدينة:', { selectedCity, newCityName: newData.city });
        }
        // إعادة تعيين المنطقة عند تغيير المدينة
        newData.region_id = '';
        newData.region = '';
        console.log('🔄 تم إعادة تعيين المنطقة بسبب تغيير المدينة');
      }
      
      // إذا تغيرت المنطقة
      if (name === 'region_id' && value) {
        const selectedRegion = regions.find(r => String(r.id) === String(value));
        if (selectedRegion) {
          newData.region = selectedRegion.name || selectedRegion.name_ar || selectedRegion.region_name || '';
          console.log('📍 تم اختيار المنطقة:', { selectedRegion, newRegionName: newData.region });
        }
      }
      
      // إذا تغير حجم الطلب
      if (name === 'size' && value) {
        const selectedSize = packageSizes.find(s => String(s.id) === String(value));
        if (selectedSize) {
          console.log('📦 تم اختيار حجم الطلب:', { selectedSize, newSize: value });
        }
      }
      
      return newData;
    });
    
    // جلب المناطق عند تغيير المدينة مع تحسين الأداء
    if (name === 'city_id' && value) {
      setIsLoadingRegions(true);
      try {
        console.log('📡 جاري جلب المناطق للمدينة:', value);
        await fetchRegions(String(value)); // تأكد من تمرير string
        console.log('✅ تم جلب المناطق بنجاح، عدد المناطق:', regions.length);
      } catch (error) {
        console.error('❌ خطأ في جلب المناطق:', error);
        toast({
          title: "خطأ",
          description: "فشل في جلب المناطق للمدينة المحددة",
          variant: "destructive"
        });
      } finally {
        setIsLoadingRegions(false);
      }
    }
  };

  // حساب الإجمالي تلقائياً
  const calculateTotal = useCallback(() => {
    const subtotal = selectedProducts.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    const deliveryFee = formData.delivery_fee || 0;
    return subtotal + deliveryFee;
  }, [selectedProducts, formData.delivery_fee]);

  // تحديث الإجمالي عند تغيير المنتجات
  useEffect(() => {
    const total = calculateTotal();
    setFormData(prev => ({ ...prev, price: total }));
  }, [calculateTotal]);

  // إضافة منتج من النافذة
  const handleProductSelect = (product, variant, quantity) => {
    const newProduct = {
      productId: product.id,
      variantId: variant.id,
      quantity: quantity,
      price: variant.price,
      productName: product.name,
      color: variant.color || '',
      size: variant.size || ''
    };
    
    setSelectedProducts(prev => [...prev, newProduct]);
  };

  // حذف منتج
  const removeProduct = (index) => {
    setSelectedProducts(prev => prev.filter((_, i) => i !== index));
  };

  // تحديث كمية منتج
  const updateProductQuantity = (index, newQuantity) => {
    if (newQuantity < 1) return;
    setSelectedProducts(prev => 
      prev.map((item, i) => 
        i === index ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  // معالجة الإرسال
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!canEdit) {
      toast({
        title: "تنبيه",
        description: "لا يمكن تعديل هذا الطلب",
        variant: "destructive"
      });
      return;
    }

    if (selectedProducts.length === 0) {
      toast({
        title: "تنبيه",
        description: "يجب اختيار منتج واحد على الأقل",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      // حساب الإجمالي
      const subtotal = selectedProducts.reduce((sum, item) => sum + (item.quantity * item.price), 0);
      const deliveryFee = formData.delivery_fee || 0;
      const total = subtotal + deliveryFee;
      
      // إعداد البيانات للتحديث
      const updateData = {
        customer_name: formData.name,
        customer_phone: formData.phone,
        customer_phone2: formData.phone2,
        customer_city: formData.city || (formData.city_id ? 
          cities.find(c => c.id === formData.city_id)?.name : ''),
        customer_province: formData.region || (formData.region_id ? 
          regions.find(r => r.id === formData.region_id)?.name : ''),
        customer_address: formData.address,
        notes: formData.notes,
        total_amount: total,
        delivery_fee: deliveryFee,
        final_amount: total
      };
      
      // استخدام updateOrder من useOrders مع إدارة المخزون
      const result = await updateOrder(order.id, updateData, selectedProducts, order.items);
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      // إرسال للوسيط إذا كان الطلب مرسل إليه أصلاً
      if (order.delivery_partner && order.delivery_partner !== 'محلي' && waseetToken && order.tracking_number) {
        console.log('📤 إرسال التحديث للوسيط...');
        
        const alwaseetData = {
          tracking_number: order.tracking_number, // Will be mapped to qr_id
          name: formData.name, // Will be mapped to client_name
          phone: formData.phone, // Will be mapped to client_mobile
          phone2: formData.phone2 || '', // Will be mapped to client_mobile2
          city_id: parseInt(formData.city_id) || 0,
          region_id: parseInt(formData.region_id) || 0,
          address: formData.address, // Will be mapped to location
          notes: formData.notes || '', // Will be mapped to merchant_notes
          details: selectedProducts.map(item => 
            `${item.productName}${item.color ? ` (${item.color})` : ''}${item.size ? ` - ${item.size}` : ''} × ${item.quantity}`
          ).join(', '), // Will be mapped to type_name
          quantity: selectedProducts.reduce((sum, item) => sum + item.quantity, 0), // Will be mapped to items_number
          price: Math.round(total),
          size: parseInt(formData.size) || parseInt(packageSizes[0]?.id) || 1, // Will be mapped to package_size
          replacement: 0
        };
        
        console.log('📋 بيانات الوسيط:', alwaseetData);
        
        try {
          const waseetResult = await editAlWaseetOrder(alwaseetData, waseetToken);
          console.log('✅ تم تحديث الطلب في الوسيط بنجاح:', waseetResult);
          
          toast({
            title: "تم التحديث",
            description: "تم تحديث الطلب محلياً وفي شركة التوصيل بنجاح",
            variant: "success"
          });
        } catch (alwaseetError) {
          console.error('❌ خطأ في تحديث الوسيط:', alwaseetError);
          // لا نريد أن يفشل التحديث بالكامل إذا فشل الوسيط
          toast({
            title: "تم التحديث جزئياً",
            description: "تم تحديث الطلب محلياً لكن فشل في تحديث شركة التوصيل: " + (alwaseetError.message || 'غير معروف'),
            variant: "warning"
          });
        }
      }
      
      toast({
        title: "تم التحديث",
        description: "تم تحديث الطلب بنجاح",
        variant: "success"
      });
      
      onOrderUpdated?.(result.data);
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              تعديل الطلب {order?.order_number}
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
            {/* معلومات العميل */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <User className="w-4 h-4" />
                  <h3 className="font-semibold">معلومات العميل</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">اسم العميل *</Label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      disabled={!canEdit || isLoading}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">رقم الهاتف *</Label>
                    <Input
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      disabled={!canEdit || isLoading}
                      required
                    />
                  </div>
                  {/* Always show secondary phone field for Al-Waseet orders */}
                  <div>
                    <Label htmlFor="phone2">رقم الهاتف الثاني {order?.delivery_partner === 'الوسيط' && '(اختياري)'}</Label>
                    <Input
                      id="phone2"
                      name="phone2"
                      value={formData.phone2}
                      onChange={handleChange}
                      disabled={!canEdit || isLoading}
                      placeholder="رقم الهاتف الثاني (اختياري)"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* معلومات التوصيل */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="w-4 h-4" />
                  <h3 className="font-semibold">معلومات التوصيل</h3>
                  {order?.delivery_partner && (
                    <Badge variant="outline" className="mr-auto">
                      {order.delivery_partner}
                    </Badge>
                  )}
                  {order?.tracking_number && (
                    <Badge variant="secondary">
                      رقم التتبع: {order.tracking_number}
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {order?.delivery_partner && order.delivery_partner !== 'محلي' && (
                    <>
                       <div>
                         <Label htmlFor="city_id">المدينة *</Label>
                         <Select
                           value={formData.city_id}
                           onValueChange={(value) => handleSelectChange(value, 'city_id')}
                           disabled={!canEdit || isLoading || cities.length === 0}
                         >
                           <SelectTrigger>
                             <SelectValue placeholder={cities.length === 0 ? "جاري تحميل المدن..." : "اختر المدينة"} />
                           </SelectTrigger>
                           <SelectContent>
                             {cities.map(city => (
                               <SelectItem key={city.id} value={String(city.id)}>
                                 {city.name || city.name_ar || city.city_name || `مدينة ${city.id}`}
                               </SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                       </div>
                       <div>
                         <Label htmlFor="region_id">المنطقة *</Label>
                         <Select
                           value={formData.region_id}
                           onValueChange={(value) => handleSelectChange(value, 'region_id')}
                           disabled={!canEdit || isLoading || !formData.city_id || isLoadingRegions}
                         >
                           <SelectTrigger>
                             <SelectValue placeholder={
                               isLoadingRegions ? "جاري تحميل المناطق..." : 
                               !formData.city_id ? "اختر المدينة أولاً..." :
                               regions.length === 0 ? "لا توجد مناطق متاحة" :
                               "اختر المنطقة..."
                             } />
                           </SelectTrigger>
                           <SelectContent>
                             {regions.map(region => (
                               <SelectItem key={region.id} value={String(region.id)}>
                          {region.name || region.name_ar || region.region_name || `منطقة ${region.id}`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}
                    
                    {/* Show unified package size selection for local orders and Al-Waseet */}
                    {(!order?.delivery_partner || order.delivery_partner === 'محلي' || order.delivery_partner === 'Al-Waseet') && (
                     <div>
                       <Label htmlFor="size">حجم الطلب</Label>
                       <Select
                         value={formData.size}
                         onValueChange={(value) => handleSelectChange(value, 'size')}
                         disabled={!canEdit || isLoading}
                       >
                         <SelectTrigger className="text-right">
                           <SelectValue placeholder="اختر حجم الطلب..." />
                         </SelectTrigger>
                         <SelectContent>
                            <SelectItem value="عادي">عادي</SelectItem>
                            <SelectItem value="متوسط">متوسط</SelectItem>
                            <SelectItem value="كبير">كبير</SelectItem>
                            <SelectItem value="كبير جدا">كبير جدا</SelectItem>
                         </SelectContent>
                       </Select>
                     </div>
                   )}
                   
                     <div className={order?.delivery_partner && order.delivery_partner !== 'محلي' ? "md:col-span-1" : "md:col-span-2"}>
                      <Label htmlFor="address">العنوان التفصيلي (اختياري)</Label>
                     <Textarea
                       id="address"
                       name="address"
                       value={formData.address}
                       onChange={handleChange}
                       disabled={!canEdit || isLoading}
                       placeholder="العنوان التفصيلي للعميل..."
                       rows={3}
                     />
                   </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="notes">ملاحظات إضافية</Label>
                    <Textarea
                      id="notes"
                      name="notes"
                      value={formData.notes}
                      onChange={handleChange}
                      disabled={!canEdit || isLoading}
                      placeholder="ملاحظات أو تعليمات خاصة..."
                      rows={2}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* المنتجات */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    <h3 className="font-semibold">المنتجات</h3>
                    <Badge variant="secondary">
                      {selectedProducts.length} منتج
                    </Badge>
                  </div>
                  {canEdit && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowProductDialog(true)}
                      disabled={isLoading}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      إضافة منتج
                    </Button>
                  )}
                </div>

                <div className="space-y-3">
                  {selectedProducts.map((product, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 border rounded-lg bg-gray-50">
                      <div className="flex-1">
                        <p className="font-medium">{product.productName}</p>
                        {(product.color || product.size) && (
                          <p className="text-sm text-gray-600">
                            {product.color && `اللون: ${product.color}`}
                            {product.color && product.size && ' | '}
                            {product.size && `المقاس: ${product.size}`}
                          </p>
                        )}
                        <p className="text-sm text-gray-600">
                          {product.price.toLocaleString()} د.ع × {product.quantity} = {(product.price * product.quantity).toLocaleString()} د.ع
                        </p>
                      </div>
                      
                      {canEdit && (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="1"
                            value={product.quantity}
                            onChange={(e) => updateProductQuantity(index, parseInt(e.target.value))}
                            className="w-16 text-center"
                            disabled={isLoading}
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => removeProduct(index)}
                            disabled={isLoading}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {selectedProducts.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>لم يتم اختيار أي منتجات</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* الإجمالي */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <DollarSign className="w-4 h-4" />
                  <h3 className="font-semibold">الإجمالي</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="delivery_fee">رسوم التوصيل</Label>
                    <Input
                      id="delivery_fee"
                      name="delivery_fee"
                      type="number"
                      value={formData.delivery_fee}
                      onChange={handleChange}
                      disabled={!canEdit || isLoading}
                      min="0"
                    />
                  </div>
                  <div>
                    <Label>المجموع الفرعي</Label>
                    <div className="p-2 bg-gray-50 rounded border text-right">
                      {selectedProducts.reduce((sum, item) => sum + (item.quantity * item.price), 0).toLocaleString()} د.ع
                    </div>
                  </div>
                  <div>
                    <Label>إجمالي الطلب</Label>
                    <div className="p-2 bg-blue-50 border-2 border-blue-200 rounded font-bold text-blue-700 text-right">
                      {calculateTotal().toLocaleString()} د.ع
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

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
                  disabled={isLoading || selectedProducts.length === 0}
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

      <ProductSelectionDialog
        open={showProductDialog}
        onOpenChange={setShowProductDialog}
        onSelectProduct={handleProductSelect}
        selectedProductIds={selectedProducts.map(p => ({ productId: p.productId, variantId: p.variantId }))}
      />
    </>
  );
};

export default EditOrderDialog;