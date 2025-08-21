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
import SearchableSelectFixed from '@/components/ui/searchable-select-fixed';
import { iraqiProvinces } from '@/lib/iraq-provinces';
import ProductSelectionDialog from '@/components/products/ProductSelectionDialog';
import { useInventory } from '@/contexts/InventoryContext';

const EditOrderDialog = ({ open, onOpenChange, order, onOrderUpdated }) => {
  const { cities, regions, packageSizes, fetchCities, fetchRegions, fetchPackageSizes, waseetToken } = useAlWaseet();
  const { products, updateOrder, settings } = useInventory();
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
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

  // تهيئة النموذج عند فتح النافذة
  const initializeForm = useCallback(async () => {
    if (!order || !open) return;
    
    console.log('🔄 تهيئة نموذج تعديل الطلب:', order);
    
    // تحديد ما إذا كان يمكن تعديل الطلب
    const editable = order.status === 'pending';
    setCanEdit(editable);
    
    // حفظ البيانات الأصلية للمقارنة
    setOriginalData({
      customer_name: order.customer_name || '',
      customer_phone: order.customer_phone || '',
      customer_city: order.customer_city || '',
      customer_province: order.customer_province || '',
      customer_address: order.customer_address || '',
      total_amount: order.total_amount || 0,
      delivery_fee: order.delivery_fee || 0
    });
    
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
    
    console.log('📍 البيانات المستخرجة:', {
      customerCity,
      customerProvince,
      address: order.customer_address,
      delivery_partner: order.delivery_partner
    });
    
    // البحث عن city_id و region_id من البيانات
    let cityId = '';
    let regionId = '';
    let packageSize = 'normal'; // القيمة الافتراضية
    
    // إذا كان الطلب مرسل للوسيط، حاول مطابقة البيانات
    if (order.delivery_partner && order.delivery_partner !== 'محلي' && cities.length > 0) {
      // البحث عن المدينة بطرق متعددة
      const cityMatch = cities.find(c => {
        const cityName = c.name || c.name_ar || c.city_name || '';
        return cityName.toLowerCase().trim() === customerCity.toLowerCase().trim() ||
               customerCity.toLowerCase().includes(cityName.toLowerCase()) ||
               cityName.toLowerCase().includes(customerCity.toLowerCase());
      });
      
      if (cityMatch) {
        cityId = cityMatch.id;
        console.log('✅ تم العثور على المدينة:', cityMatch);
        
        // جلب المناطق لهذه المدينة
        setIsLoadingRegions(true);
        try {
          await fetchRegions(cityId);
          console.log('✅ تم جلب المناطق للمدينة:', cityId);
          
          // محاولة العثور على المنطقة المطابقة
          setTimeout(() => {
            if (customerProvince && regions.length > 0) {
              const regionMatch = regions.find(r => {
                const regionName = r.name || r.name_ar || r.region_name || '';
                return regionName.toLowerCase().trim() === customerProvince.toLowerCase().trim() ||
                       customerProvince.toLowerCase().includes(regionName.toLowerCase()) ||
                       regionName.toLowerCase().includes(customerProvince.toLowerCase());
              });
              
              if (regionMatch) {
                regionId = regionMatch.id;
                console.log('✅ تم العثور على المنطقة:', regionMatch);
                setFormData(prev => ({ ...prev, region_id: regionId }));
              }
            }
          }, 500);
          
        } catch (error) {
          console.error('❌ خطأ في جلب المناطق:', error);
        } finally {
          setIsLoadingRegions(false);
        }
      } else {
        console.log('❌ لم يتم العثور على المدينة في القائمة:', customerCity);
      }
      
      // محاولة استخراج حجم الطلب من البيانات المحفوظة
      if (order.delivery_partner_data?.package_size) {
        packageSize = order.delivery_partner_data.package_size;
      } else if (packageSizes.length > 0) {
        // البحث عن "عادي" في قائمة الأحجام
        const normalSize = packageSizes.find(size => 
          (size.name && size.name.includes('عادي')) ||
          (size.name && size.name.toLowerCase().includes('normal')) ||
          size.id === 1
        );
        packageSize = normalSize ? normalSize.id : packageSizes[0]?.id || 'normal';
      }
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
    
    // ملء النموذج بالبيانات المطابقة
    const initialFormData = {
      name: order.customer_name || '',
      phone: order.customer_phone || '',
      city_id: cityId,
      region_id: regionId,
      city: customerCity,
      region: customerProvince,
      address: order.customer_address || '',
      notes: order.notes || '',
      size: packageSize,
      quantity: order.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 1,
      price: order.total_amount || 0,
      details: order.items?.map(item => 
        `${item.productname || item.product_name || 'منتج'} × ${item.quantity || 1}`
      ).join(', ') || '',
      delivery_fee: order.delivery_fee || 0
    };
    
    setFormData(initialFormData);
    console.log('📝 تم تعبئة النموذج:', initialFormData);
    
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
    
  }, [order, open, cities, regions, fetchRegions]);

  // تهيئة النموذج عند تغيير الطلب أو فتح النافذة
  useEffect(() => {
    initializeForm();
  }, [initializeForm]);

  // معالجة تغيير القيم
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // معالجة تغيير القوائم المنسدلة مع إصلاح شامل
  const handleSelectChange = async (value, name) => {
    console.log(`🔄 تغيير ${name} إلى:`, value);
    
    // تحديث الحالة فوراً لتجنب التأخير
    setFormData(prev => {
      const newData = { ...prev };
      
      // تحديث القيمة المحددة
      newData[name] = value;
      
      // إذا تغيرت المدينة
      if (name === 'city_id' && value) {
        const selectedCity = cities.find(c => c.id === value);
        if (selectedCity) {
          newData.city = selectedCity.name || selectedCity.name_ar || selectedCity.city_name || '';
          console.log('🏙️ تم اختيار المدينة:', selectedCity);
        }
        // إعادة تعيين المنطقة عند تغيير المدينة
        newData.region_id = '';
        newData.region = '';
      }
      
      // إذا تغيرت المنطقة
      if (name === 'region_id' && value) {
        const selectedRegion = regions.find(r => r.id === value);
        if (selectedRegion) {
          newData.region = selectedRegion.name || selectedRegion.name_ar || selectedRegion.region_name || '';
          console.log('📍 تم اختيار المنطقة:', selectedRegion);
        }
      }
      
      // إذا تغير حجم الطلب
      if (name === 'size' && value) {
        const selectedSize = packageSizes.find(s => s.id == value);
        if (selectedSize) {
          console.log('📦 تم اختيار حجم الطلب:', selectedSize);
        }
      }
      
      return newData;
    });
    
    // جلب المناطق عند تغيير المدينة (بدون تأثير على UI)
    if (name === 'city_id' && value) {
      setIsLoadingRegions(true);
      try {
        console.log('📡 جاري جلب المناطق للمدينة:', value);
        await fetchRegions(value);
        console.log('✅ تم جلب المناطق بنجاح');
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
          await editAlWaseetOrder(alwaseetData, waseetToken);
          console.log('✅ تم تحديث الطلب في الوسيط بنجاح');
        } catch (alwaseetError) {
          console.error('❌ خطأ في تحديث الوسيط:', alwaseetError);
          // لا نريد أن يفشل التحديث بالكامل إذا فشل الوسيط
          toast({
            title: "تحذير",
            description: "تم تحديث الطلب محلياً لكن فشل في تحديث شركة التوصيل",
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[95vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              تعديل الطلب {order?.tracking_number || order?.order_number}
            </DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto max-h-[calc(95vh-120px)]">
            {!canEdit && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 text-yellow-800">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="font-medium">لا يمكن تعديل هذا الطلب</span>
                </div>
                <p className="text-sm text-yellow-700 mt-1">
                  يمكن تعديل الطلبات في مرحلة "قيد التجهيز" فقط
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* معلومات العميل */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <User className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">معلومات العميل</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">اسم العميل</Label>
                      <Input
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        disabled={!canEdit}
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="phone">رقم الهاتف</Label>
                      <Input
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        disabled={!canEdit}
                        required
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* معلومات التوصيل */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <MapPin className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">معلومات التوصيل</h3>
                  </div>
                  
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div>
                       <Label htmlFor="city">المدينة * (الأصلية: {originalData?.customer_city || 'غير محدد'})</Label>
                       {order?.delivery_partner === 'محلي' ? (
                         <Select value={formData.city} onValueChange={(value) => handleSelectChange(value, 'city')} disabled={!canEdit}>
                           <SelectTrigger>
                             <SelectValue placeholder="اختر المدينة" />
                           </SelectTrigger>
                           <SelectContent>
                             {iraqiProvinces.map((province) => (
                               <SelectItem key={province.id} value={province.name}>
                                 {province.name}
                               </SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                       ) : (
                         <>
                           {cities.length > 0 ? (
                             <SearchableSelectFixed
                               value={formData.city_id}
                               onValueChange={(value) => handleSelectChange(value, 'city_id')}
                               disabled={!canEdit}
                               options={cities.map(city => ({
                                 value: city.id,
                                 label: city.name || city.name_ar || city.city_name || `مدينة ${city.id}`
                               }))}
                               placeholder="اختر المدينة"
                               emptyText="لا توجد مدن متاحة"
                               searchPlaceholder="البحث في المدن..."
                               className="w-full"
                             />
                           ) : (
                             <div className="flex items-center gap-2 p-3 border rounded-md bg-muted">
                               <Loader2 className="h-4 w-4 animate-spin" />
                               <span className="text-sm">جاري تحميل المدن...</span>
                             </div>
                           )}
                           {formData.city && (
                             <div className="text-sm text-muted-foreground mt-1">
                               المدينة المحددة: {formData.city}
                             </div>
                           )}
                         </>
                       )}
                     </div>
                    
                     <div>
                       <Label htmlFor="region">المنطقة * (الأصلية: {originalData?.customer_province || 'غير محدد'})</Label>
                       {order?.delivery_partner === 'محلي' ? (
                         <Input
                           id="region"
                           name="region"
                           value={formData.region}
                           onChange={handleChange}
                           disabled={!canEdit}
                           placeholder="أدخل المنطقة"
                         />
                       ) : (
                         <>
                           {isLoadingRegions ? (
                             <div className="flex items-center gap-2 p-3 border rounded-md bg-muted">
                               <Loader2 className="h-4 w-4 animate-spin" />
                               <span className="text-sm">جاري تحميل المناطق...</span>
                             </div>
                           ) : regions.length > 0 ? (
                             <SearchableSelectFixed
                               value={formData.region_id}
                               onValueChange={(value) => handleSelectChange(value, 'region_id')}
                               disabled={!canEdit || !formData.city_id}
                               options={regions.map(region => ({
                                 value: region.id,
                                 label: region.name || region.name_ar || region.region_name || `منطقة ${region.id}`
                               }))}
                               placeholder="اختر المنطقة"
                               emptyText="لا توجد مناطق متاحة"
                               searchPlaceholder="البحث في المناطق..."
                               className="w-full"
                             />
                           ) : formData.city_id ? (
                             <div className="flex items-center gap-2 p-3 border rounded-md bg-muted">
                               <span className="text-sm">لا توجد مناطق متاحة لهذه المدينة</span>
                             </div>
                           ) : (
                             <Input
                               value=""
                               placeholder="اختر المدينة أولاً"
                               disabled={true}
                               className="bg-muted"
                             />
                           )}
                           {formData.region && (
                             <div className="text-sm text-muted-foreground mt-1">
                               المنطقة المحددة: {formData.region}
                             </div>
                           )}
                         </>
                       )}
                     </div>
                    
                    <div className="md:col-span-2">
                      <Label htmlFor="address">العنوان التفصيلي</Label>
                      <Textarea
                        id="address"
                        name="address"
                        value={formData.address}
                        onChange={handleChange}
                        disabled={!canEdit}
                        rows={3}
                      />
                    </div>
                    
                     <div>
                       <Label htmlFor="size">حجم الطلب * (الأصلي: {order?.delivery_partner_data?.package_size || 'غير محدد'})</Label>
                       {order?.delivery_partner === 'محلي' ? (
                         <Input
                           value="عادي (توصيل محلي)"
                           disabled={true}
                           className="bg-muted"
                         />
                       ) : packageSizes.length > 0 ? (
                         <SearchableSelectFixed
                           value={formData.size}
                           onValueChange={(value) => handleSelectChange(value, 'size')}
                           disabled={!canEdit}
                           options={packageSizes.map(size => ({
                             value: size.id,
                             label: size.name || `حجم ${size.id}`
                           }))}
                           placeholder="اختر حجم الطلب"
                           emptyText="لا توجد أحجام متاحة"
                           searchPlaceholder="البحث في الأحجام..."
                           className="w-full"
                         />
                       ) : (
                         <div className="flex items-center gap-2 p-3 border rounded-md bg-muted">
                           <Loader2 className="h-4 w-4 animate-spin" />
                           <span className="text-sm">جاري تحميل أحجام الطلبات...</span>
                         </div>
                       )}
                     </div>
                    
                    <div>
                      <Label htmlFor="delivery_fee">أجور التوصيل</Label>
                      <Input
                        id="delivery_fee"
                        name="delivery_fee"
                        type="number"
                        value={formData.delivery_fee}
                        onChange={handleChange}
                        disabled={!canEdit}
                        min="0"
                      />
                    </div>
                    
                    <div className="md:col-span-2">
                      <Label htmlFor="notes">ملاحظات</Label>
                      <Textarea
                        id="notes"
                        name="notes"
                        value={formData.notes}
                        onChange={handleChange}
                        disabled={!canEdit}
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
                      <Package className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">المنتجات</h3>
                    </div>
                    
                    {canEdit && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowProductDialog(true)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        إضافة منتج
                      </Button>
                    )}
                  </div>
                  
                  {selectedProducts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      لا توجد منتجات مضافة
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedProducts.map((item, index) => (
                        <div key={index} className="flex items-center gap-4 p-3 border rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium">{item.productName}</div>
                            <div className="text-sm text-muted-foreground">
                              {item.color && `اللون: ${item.color}`} {item.size && `القياس: ${item.size}`}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Label>الكمية:</Label>
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateProductQuantity(index, parseInt(e.target.value) || 1)}
                              disabled={!canEdit}
                              min="1"
                              className="w-20"
                            />
                          </div>
                          
                          <div className="text-lg font-semibold">
                            {(item.quantity * item.price).toLocaleString()} د.ع
                          </div>
                          
                          {canEdit && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeProduct(index)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                      
                      {/* الإجمالي */}
                      <div className="border-t pt-4">
                        <div className="flex justify-between items-center text-lg font-semibold">
                          <span>الإجمالي النهائي:</span>
                          <span>{calculateTotal().toLocaleString()} د.ع</span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* أزرار التحكم */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  إلغاء
                </Button>
                
                {canEdit && (
                  <Button
                    type="submit"
                    disabled={isLoading || selectedProducts.length === 0}
                    className="bg-primary hover:bg-primary/90"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        جاري الحفظ...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        حفظ التعديلات
                      </>
                    )}
                  </Button>
                )}
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* نافذة اختيار المنتجات */}
      <ProductSelectionDialog
        isOpen={showProductDialog}
        onClose={() => setShowProductDialog(false)}
        onProductSelect={handleProductSelect}
        products={products}
      />
    </>
  );
};

export default EditOrderDialog;