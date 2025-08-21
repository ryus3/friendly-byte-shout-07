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
import { toast } from '@/components/ui/use-toast';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { getCities, getRegionsByCity, getPackageSizes, editAlWaseetOrder } from '@/lib/alwaseet-api';
import SearchableSelectFixed from '@/components/ui/searchable-select-fixed';
import ProductSelectionDialog from '@/components/products/ProductSelectionDialog';
import { useInventory } from '@/contexts/InventoryContext';

const EditOrderDialog = ({ open, onOpenChange, order, onOrderUpdated }) => {
  const { isLoggedIn: isWaseetLoggedIn, token: waseetToken } = useAlWaseet();
  const { updateOrder, settings } = useInventory();
  
  // Simplified state management - unify with QuickOrderContent approach
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    phone2: '',
    city_id: '',
    region_id: '',
    address: '',
    notes: '',
    size: '',
    price: 0,
    delivery_fee: 0
  });
  
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [showProductDialog, setShowProductDialog] = useState(false);
  
  // Al-Waseet data - using same approach as QuickOrderContent
  const [cities, setCities] = useState([]);
  const [regions, setRegions] = useState([]);
  const [packageSizes, setPackageSizes] = useState([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingRegions, setLoadingRegions] = useState(false);
  const [loadingPackageSizes, setLoadingPackageSizes] = useState(false);

  // Load initial data when dialog opens - unified approach
  useEffect(() => {
    const loadInitialData = async () => {
      if (!open || !order) return;
      
      console.log('🔄 Loading order for edit:', order);
      
      // Determine if order can be edited
      const editable = order.status === 'pending' || order.status === 'في انتظار التأكيد';
      setCanEdit(editable);
      
      // Load Al-Waseet data if needed (for Al-Waseet orders only)
      if (order.delivery_partner === 'الوسيط' && isWaseetLoggedIn && waseetToken) {
        await loadAlWaseetData();
        // Initialize form after data is loaded for Al-Waseet orders
        setTimeout(initializeFormWithOrderData, 100);
      } else {
        // Initialize form immediately for local orders
        initializeFormWithOrderData();
      }
    };
    
    loadInitialData();
  }, [open, order, isWaseetLoggedIn, waseetToken]);

  // Reinitialize form when cities/package sizes change (for Al-Waseet orders)
  useEffect(() => {
    if (order && cities.length > 0 && packageSizes.length > 0 && order.delivery_partner === 'الوسيط') {
      initializeFormWithOrderData();
    }
  }, [cities, packageSizes, order]);

  // Load Al-Waseet data (cities, regions, package sizes) - same as QuickOrderContent
  const loadAlWaseetData = async () => {
    if (!waseetToken) return;
    
    try {
      // Load cities
      setLoadingCities(true);
      const citiesData = await getCities(waseetToken);
      setCities(Array.isArray(citiesData) ? citiesData : []);
      
      // Load package sizes
      setLoadingPackageSizes(true);
      const packageSizesData = await getPackageSizes(waseetToken);
      setPackageSizes(Array.isArray(packageSizesData) ? packageSizesData : []);
      
    } catch (error) {
      console.error('Error loading Al-Waseet data:', error);
      toast({
        title: "خطأ في تحميل البيانات",
        description: "فشل في تحميل بيانات الوسيط: " + error.message,
        variant: "destructive"
      });
    } finally {
      setLoadingCities(false);
      setLoadingPackageSizes(false);
    }
  };

  // Initialize form with order data - simplified approach
  const initializeFormWithOrderData = () => {
    if (!order) return;
    
    // Find matching city and region IDs if this is an Al-Waseet order
    let cityId = '';
    let regionId = '';
    let packageSizeId = '';
    
    if (order.delivery_partner === 'الوسيط' && cities.length > 0) {
      console.log('🏙️ البحث عن المدينة:', {
        orderCity: order.customer_city,
        availableCities: cities.map(c => ({ id: c.id, name: c.name }))
      });
      
      // Exact match first, then partial match
      const cityMatch = cities.find(c => {
        if (!c.name || !order.customer_city) return false;
        const cityName = c.name.trim().toLowerCase();
        const orderCity = order.customer_city.trim().toLowerCase();
        return cityName === orderCity || 
               cityName.includes(orderCity) || 
               orderCity.includes(cityName);
      });
      
      if (cityMatch) {
        cityId = String(cityMatch.id);
        console.log('✅ تم العثور على المدينة:', cityMatch);
        // Load regions for this city
        loadRegionsForCity(cityId);
      } else {
        console.log('❌ لم يتم العثور على المدينة المطابقة');
      }
      
      // Find package size - exact ID match first
      if (packageSizes.length > 0) {
        console.log('📦 البحث عن حجم الطلب:', {
          orderSize: order.package_size,
          availableSizes: packageSizes.map(s => ({ id: s.id, name: s.name }))
        });
        
        const sizeMatch = packageSizes.find(s => 
          String(s.id) === String(order.package_size) || 
          (s.name && order.package_size && s.name.includes(order.package_size))
        );
        packageSizeId = sizeMatch ? String(sizeMatch.id) : String(packageSizes[0]?.id) || '';
        
        if (sizeMatch) {
          console.log('✅ تم العثور على حجم الطلب:', sizeMatch);
        }
      }
    }
    
    // Set form data with proper type conversion
    const newFormData = {
      name: order.customer_name || '',
      phone: order.customer_phone || '',
      phone2: order.customer_phone2 || '',
      city_id: String(cityId),
      region_id: String(regionId),
      address: order.customer_address || '',
      notes: order.notes || '',
      size: String(packageSizeId),
      price: order.total_amount || 0,
      delivery_fee: order.delivery_fee || 0
    };
    
    console.log('📋 تعيين بيانات النموذج:', newFormData);
    setFormData(newFormData);
    
    // Set selected products
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
    }
  };

  // Load regions for selected city - same as QuickOrderContent
  const loadRegionsForCity = async (cityId) => {
    if (!cityId || !waseetToken) return;
    
    setLoadingRegions(true);
    try {
      const regionsData = await getRegionsByCity(waseetToken, cityId);
      setRegions(Array.isArray(regionsData) ? regionsData : []);
      
      // Try to find matching region with better logic
      if (order?.customer_province && regionsData.length > 0) {
        console.log('📍 البحث عن المنطقة:', {
          orderRegion: order.customer_province,
          availableRegions: regionsData.map(r => ({ id: r.id, name: r.name }))
        });
        
        const regionMatch = regionsData.find(r => {
          if (!r.name || !order.customer_province) return false;
          const regionName = r.name.trim().toLowerCase();
          const orderRegion = order.customer_province.trim().toLowerCase();
          return regionName === orderRegion || 
                 regionName.includes(orderRegion) || 
                 orderRegion.includes(regionName);
        });
        
        if (regionMatch) {
          console.log('✅ تم العثور على المنطقة:', regionMatch);
          setFormData(prev => ({ ...prev, region_id: String(regionMatch.id) }));
        } else {
          console.log('❌ لم يتم العثور على المنطقة المطابقة');
        }
      }
      
    } catch (error) {
      console.error('Error loading regions:', error);
    } finally {
      setLoadingRegions(false);
    }
  };

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
      await loadRegionsForCity(value);
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
                         <SearchableSelectFixed
                           options={cities.map(city => ({
                             value: city.id,
                             label: city.name || city.name_ar || city.city_name || `مدينة ${city.id}`
                           }))}
                           value={formData.city_id}
                           onValueChange={(value) => handleSelectChange(value, 'city_id')}
                           placeholder={formData.city_id && cities.length > 0 ? 
                             cities.find(c => c.id === formData.city_id)?.name || 
                             cities.find(c => c.id === formData.city_id)?.name_ar || 
                             "اختر المدينة" : "اختر المدينة"}
                           disabled={!canEdit || isLoading || loadingCities}
                         />
                       </div>
                       <div>
                         <Label htmlFor="region_id">المنطقة *</Label>
                         <SearchableSelectFixed
                           options={regions.map(region => ({
                             value: region.id,
                             label: region.name || region.name_ar || region.region_name || `منطقة ${region.id}`
                           }))}
                           value={formData.region_id}
                           onValueChange={(value) => handleSelectChange(value, 'region_id')}
                            placeholder={formData.region_id && regions.length > 0 ? 
                              regions.find(r => r.id === formData.region_id)?.name || 
                              regions.find(r => r.id === formData.region_id)?.name_ar || 
                              (loadingRegions ? "جاري التحميل..." : "اختر المنطقة") : 
                              (loadingRegions ? "جاري التحميل..." : "اختر المنطقة")}
                           disabled={!canEdit || isLoading || !formData.city_id || loadingRegions}
                         />
                       </div>
                        <div>
                          <Label htmlFor="size">حجم الطلب</Label>
                          <SearchableSelectFixed
                            options={packageSizes.length > 0 ? packageSizes.map(size => ({
                              value: size.id?.toString(),
                              label: size.name || size.package_name || `حجم ${size.id}`
                            })) : [
                              { value: "1", label: "صغير" },
                              { value: "2", label: "متوسط" },
                              { value: "3", label: "كبير" }
                            ]}
                            value={formData.size?.toString()}
                            onValueChange={(value) => handleSelectChange(value, 'size')}
                            placeholder={formData.size && packageSizes.length > 0 ? 
                              packageSizes.find(s => s.id?.toString() === formData.size?.toString())?.name || 
                              packageSizes.find(s => s.id?.toString() === formData.size?.toString())?.package_name || 
                              "اختر حجم الطلب" : "اختر حجم الطلب"}
                            disabled={!canEdit || isLoading || loadingPackageSizes}
                          />
                        </div>
                    </>
                  )}
                  <div className={order?.delivery_partner && order.delivery_partner !== 'محلي' ? "md:col-span-1" : "md:col-span-2"}>
                    <Label htmlFor="address">العنوان التفصيلي *</Label>
                    <Textarea
                      id="address"
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      disabled={!canEdit || isLoading}
                      placeholder="العنوان التفصيلي للعميل..."
                      rows={3}
                      required
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