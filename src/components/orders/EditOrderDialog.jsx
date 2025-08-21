import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { useInventory } from '@/contexts/InventoryContext';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import ProductSelectionDialog from '@/components/products/ProductSelectionDialog';
import Loader from '@/components/ui/loader';
import { AlertTriangle, Package2, MapPin, Phone, User, DollarSign, Loader2 } from 'lucide-react';
import { getCities, getRegionsByCity, getPackageSizes } from '@/lib/alwaseet-api';

const EditOrderDialog = ({ open, onOpenChange, order }) => {
  const { updateOrder } = useInventory();
  const { isLoggedIn: isWaseetLoggedIn, token: waseetToken, editOrder: editAlWaseetOrder } = useAlWaseet();
  
  // Form states
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    customerPhone2: '',
    customerCity: '',
    customerProvince: '',
    customerAddress: '',
    totalAmount: 0,
    deliveryFee: 0,
    trackingNumber: '',
    deliveryPartner: '',
    notes: '',
    cityId: '',
    regionId: '',
    packageSize: ''
  });
  
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [showProductSelection, setShowProductSelection] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [canEdit, setCanEdit] = useState(true);
  
  // Al-Waseet data states - exactly like QuickOrderContent
  const [cities, setCities] = useState([]);
  const [regions, setRegions] = useState([]);
  const [packageSizes, setPackageSizes] = useState([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingRegions, setLoadingRegions] = useState(false);
  const [loadingPackageSizes, setLoadingPackageSizes] = useState(false);

  // Initialize form when dialog opens or order changes
  useEffect(() => {
    if (open && order) {
      initializeForm();
    }
  }, [open, order]);

  // Fetch Al-Waseet data - exactly like QuickOrderContent
  const fetchAlWaseetData = async () => {
    if (!waseetToken || !isWaseetLoggedIn) return;
    
    try {
      setLoadingCities(true);
      setLoadingPackageSizes(true);
      
      const [citiesResponse, sizesResponse] = await Promise.all([
        getCities(waseetToken),
        getPackageSizes(waseetToken)
      ]);
      
      console.log('🏙️ تم جلب المدن:', citiesResponse);
      console.log('📦 تم جلب أحجام الطلب:', sizesResponse);
      
      setCities(citiesResponse || []);
      setPackageSizes(sizesResponse || []);
      
    } catch (error) {
      console.error('❌ خطأ في جلب بيانات الوسيط:', error);
      toast({
        title: "خطأ",
        description: "فشل في جلب بيانات المدن وأحجام الطلب",
        variant: "destructive"
      });
    } finally {
      setLoadingCities(false);
      setLoadingPackageSizes(false);
    }
  };

  const fetchRegionsForCity = async (cityId) => {
    if (!waseetToken || !cityId) return;
    
    try {
      setLoadingRegions(true);
      const regionsResponse = await getRegionsByCity(waseetToken, cityId);
      console.log('🗺️ تم جلب المناطق للمدينة:', cityId, regionsResponse);
      setRegions(regionsResponse || []);
    } catch (error) {
      console.error('❌ خطأ في جلب المناطق:', error);
      toast({
        title: "خطأ", 
        description: "فشل في جلب المناطق",
        variant: "destructive"
      });
    } finally {
      setLoadingRegions(false);
    }
  };

  const initializeForm = async () => {
    if (!order) return;
    
    setLoadingData(true);
    console.log('📋 تهيئة نموذج تعديل الطلب:', order);
    
    try {
      // Check if order can be edited
      const editable = order.status === 'pending' || order.status === 'في انتظار التأكيد';
      setCanEdit(editable);
      
      // For Al-Waseet orders, fetch necessary data first
      if (order.delivery_partner === 'الوسيط') {
        await fetchAlWaseetData();
        
        // If city_id exists, fetch regions for that city
        if (order.city_id) {
          await fetchRegionsForCity(order.city_id);
        }
      }
      
      // Initialize form with order data - show original data exactly as stored
      const formDataObj = {
        customerName: order.customer_name || '',
        customerPhone: order.customer_phone || '',
        customerPhone2: order.customer_phone2 || '',
        customerCity: order.customer_city || '',
        customerProvince: order.customer_province || '',
        customerAddress: order.customer_address || '',
        totalAmount: order.total_amount || 0,
        deliveryFee: order.delivery_fee || 0,
        trackingNumber: order.tracking_number || '',
        deliveryPartner: order.delivery_partner || '',
        notes: order.notes || '',
        // Al-Waseet specific fields - use existing IDs directly and let them populate
        cityId: order.city_id?.toString() || '',
        regionId: order.region_id?.toString() || '', 
        packageSize: order.package_size?.toString() || ''
      };
      
      console.log('📝 بيانات النموذج المهيأة:', formDataObj);
      setFormData(formDataObj);
      
      // Set selected products
      if (order.products && Array.isArray(order.products)) {
        setSelectedProducts(order.products);
      }
      
    } catch (error) {
      console.error('❌ خطأ في تهيئة النموذج:', error);
      toast({
        title: "خطأ",
        description: "فشل في تحميل بيانات الطلب",
        variant: "destructive"
      });
    } finally {
      setLoadingData(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSelectChange = async (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // When city changes, fetch regions for Al-Waseet orders
    if (field === 'cityId' && value && order.delivery_partner === 'الوسيط') {
      // Reset region when city changes
      setFormData(prev => ({
        ...prev,
        regionId: ''
      }));
      
      // Fetch regions for the new city
      await fetchRegionsForCity(value);
    }
  };

  const calculateTotal = () => {
    const productsTotal = selectedProducts.reduce((total, product) => {
      return total + (product.price * product.quantity);
    }, 0);
    
    return productsTotal + (formData.deliveryFee || 0);
  };

  const handleProductSelect = (product) => {
    const existingProduct = selectedProducts.find(p => p.id === product.id);
    
    if (existingProduct) {
      setSelectedProducts(prev => prev.map(p => 
        p.id === product.id 
          ? { ...p, quantity: p.quantity + 1 }
          : p
      ));
    } else {
      setSelectedProducts(prev => [...prev, { 
        ...product, 
        quantity: 1,
        price: product.selling_price || product.price || 0
      }]);
    }
    
    setShowProductSelection(false);
  };

  const removeProduct = (productId) => {
    setSelectedProducts(prev => prev.filter(p => p.id !== productId));
  };

  const updateProductQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      removeProduct(productId);
      return;
    }
    
    setSelectedProducts(prev => prev.map(p => 
      p.id === productId 
        ? { ...p, quantity: parseInt(quantity) || 1 }
        : p
    ));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!canEdit) {
      toast({
        title: "تحذير",
        description: "لا يمكن تعديل هذا الطلب في حالته الحالية",
        variant: "destructive"
      });
      return;
    }

    if (!formData.customerName.trim() || !formData.customerPhone.trim()) {
      toast({
        title: "خطأ في البيانات",
        description: "يرجى ملء جميع الحقول المطلوبة",
        variant: "destructive"
      });
      return;
    }

    if (selectedProducts.length === 0) {
      toast({
        title: "خطأ في البيانات", 
        description: "يرجى إضافة منتج واحد على الأقل",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      const calculatedTotal = calculateTotal();
      
      // Prepare updated order data
      const updatedOrder = {
        ...order,
        customer_name: formData.customerName.trim(),
        customer_phone: formData.customerPhone.trim(),
        customer_phone2: formData.customerPhone2?.trim() || null,
        customer_city: formData.customerCity.trim(),
        customer_province: formData.customerProvince.trim(),
        customer_address: formData.customerAddress.trim(),
        total_amount: calculatedTotal,
        delivery_fee: formData.deliveryFee || 0,
        notes: formData.notes?.trim() || null,
        products: selectedProducts,
        updated_at: new Date().toISOString(),
        // Al-Waseet specific fields
        city_id: formData.cityId || null,
        region_id: formData.regionId || null,
        package_size: formData.packageSize || null
      };

      // Update order locally
      await updateOrder(order.id, updatedOrder);
      
      // If it's an Al-Waseet order, update with the delivery partner
      if (order.delivery_partner === 'الوسيط' && order.tracking_number) {
        console.log('📤 إرسال تحديث الطلب إلى الوسيط:', {
          qr_id: order.tracking_number,
          client_name: formData.customerName,
          client_mobile: formData.customerPhone,
          client_mobile2: formData.customerPhone2,
          city_id: parseInt(formData.cityId),
          region_id: parseInt(formData.regionId),
          location: formData.customerAddress,
          type_name: selectedProducts.map(p => p.name || p.title).join(', '),
          items_number: selectedProducts.reduce((total, p) => total + p.quantity, 0),
          price: calculatedTotal,
          package_size: parseInt(formData.packageSize),
          merchant_notes: formData.notes,
          replacement: 0
        });
        
        try {
          await editAlWaseetOrder({
            qr_id: order.tracking_number,
            client_name: formData.customerName,
            client_mobile: formData.customerPhone,
            client_mobile2: formData.customerPhone2,
            city_id: parseInt(formData.cityId),
            region_id: parseInt(formData.regionId),
            location: formData.customerAddress,
            type_name: selectedProducts.map(p => p.name || p.title).join(', '),
            items_number: selectedProducts.reduce((total, p) => total + p.quantity, 0),
            price: calculatedTotal,
            package_size: parseInt(formData.packageSize),
            merchant_notes: formData.notes,
            replacement: 0
          });
          
          console.log('✅ تم تحديث الطلب في الوسيط بنجاح');
        } catch (alWaseetError) {
          console.error('❌ خطأ في تحديث الطلب في الوسيط:', alWaseetError);
          toast({
            title: "تحذير",
            description: `تم تحديث الطلب محلياً ولكن فشل التحديث في شركة التوصيل: ${alWaseetError.message}`,
            variant: "destructive"
          });
        }
      }
      
      toast({
        title: "نجح التحديث",
        description: "تم تعديل الطلب بنجاح",
      });
      
      onOpenChange(false);
      
    } catch (error) {
      console.error('❌ خطأ في تحديث الطلب:', error);
      toast({
        title: "خطأ",
        description: `فشل في تحديث الطلب: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Get available cities for Al-Waseet orders - exactly like QuickOrderContent
  const getAvailableCities = () => {
    if (order?.delivery_partner === 'الوسيط') {
      console.log('🏙️ المدن المتاحة:', cities);
      return cities || [];
    }
    return [];
  };

  // Get available regions for selected city - exactly like QuickOrderContent
  const getAvailableRegions = () => {
    if (order?.delivery_partner === 'الوسيط') {
      console.log('🗺️ المناطق المتاحة:', regions);
      return regions || [];
    }
    return [];
  };

  // Get available package sizes for Al-Waseet orders - exactly like QuickOrderContent
  const getAvailablePackageSizes = () => {
    if (order?.delivery_partner === 'الوسيط') {
      console.log('📦 أحجام الطلب المتاحة:', packageSizes);
      return packageSizes || [];
    }
    // Default sizes for local orders - exactly like QuickOrderContent
    return [
      { id: 'small', name: 'صغير' },
      { id: 'normal', name: 'عادي' }, 
      { id: 'large', name: 'كبير' }
    ];
  };

  if (!order) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package2 className="h-5 w-5" />
              تعديل الطلب رقم: {order.order_number}
            </DialogTitle>
          </DialogHeader>

          {loadingData ? (
            <div className="flex justify-center py-8">
              <Loader className="w-8 h-8" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Warning if order cannot be edited */}
              {!canEdit && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="font-medium">
                      لا يمكن تعديل هذا الطلب لأن حالته: {order.status}
                    </span>
                  </div>
                </div>
              )}

              {/* Customer Information */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customerName" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    اسم العميل *
                  </Label>
                  <Input
                    id="customerName"
                    value={formData.customerName}
                    onChange={(e) => handleChange('customerName', e.target.value)}
                    placeholder="أدخل اسم العميل"
                    disabled={!canEdit}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customerPhone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    رقم الهاتف *
                  </Label>
                  <Input
                    id="customerPhone"
                    value={formData.customerPhone}
                    onChange={(e) => handleChange('customerPhone', e.target.value)}
                    placeholder="07xxxxxxxxx"
                    disabled={!canEdit}
                    required
                  />
                </div>

                {/* Secondary phone - always show for Al-Waseet orders */}
                {order.delivery_partner === 'الوسيط' && (
                  <div className="space-y-2">
                    <Label htmlFor="customerPhone2" className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      رقم الهاتف الثانوي
                    </Label>
                    <Input
                      id="customerPhone2"
                      value={formData.customerPhone2}
                      onChange={(e) => handleChange('customerPhone2', e.target.value)}
                      placeholder="07xxxxxxxxx (اختياري)"
                      disabled={!canEdit}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="deliveryFee" className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    رسوم التوصيل (دينار)
                  </Label>
                  <Input
                    id="deliveryFee"
                    type="number"
                    value={formData.deliveryFee}
                    onChange={(e) => handleChange('deliveryFee', parseInt(e.target.value) || 0)}
                    disabled={!canEdit}
                    min="0"
                  />
                </div>
              </div>

              {/* Location Information */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-lg font-semibold">
                  <MapPin className="h-5 w-5" />
                  معلومات التوصيل
                </div>

                {order.delivery_partner === 'الوسيط' ? (
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* City selection for Al-Waseet */}
                    <div className="space-y-2">
                      <Label>المدينة *</Label>
                      {loadingCities ? (
                        <div className="flex items-center gap-2 p-2 border rounded">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>جاري تحميل المدن...</span>
                        </div>
                      ) : (
                        <Select
                          value={formData.cityId}
                          onValueChange={(value) => handleSelectChange('cityId', value)}
                          disabled={!canEdit}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={
                              formData.cityId ? 
                              `المدينة الحالية: ${getAvailableCities().find(c => c.id.toString() === formData.cityId)?.name || 'غير محدد'}` : 
                              "اختر المدينة"
                            } />
                          </SelectTrigger>
                          <SelectContent>
                            {getAvailableCities().map((city) => (
                              <SelectItem key={city.id} value={city.id.toString()}>
                                {city.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    {/* Region selection for Al-Waseet */}
                    <div className="space-y-2">
                      <Label>المنطقة *</Label>
                      {loadingRegions ? (
                        <div className="flex items-center gap-2 p-2 border rounded">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>جاري تحميل المناطق...</span>
                        </div>
                      ) : (
                        <Select
                          value={formData.regionId}
                          onValueChange={(value) => handleSelectChange('regionId', value)}
                          disabled={!canEdit || !formData.cityId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={
                              formData.regionId ? 
                              `المنطقة الحالية: ${getAvailableRegions().find(r => r.id.toString() === formData.regionId)?.name || 'غير محدد'}` : 
                              "اختر المنطقة"
                            } />
                          </SelectTrigger>
                          <SelectContent>
                            {getAvailableRegions().map((region) => (
                              <SelectItem key={region.id} value={region.id.toString()}>
                                {region.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    {/* Package size for Al-Waseet */}
                    <div className="space-y-2">
                      <Label>حجم الطلب *</Label>
                      {loadingPackageSizes ? (
                        <div className="flex items-center gap-2 p-2 border rounded">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>جاري تحميل أحجام الطلب...</span>
                        </div>
                      ) : (
                        <Select
                          value={formData.packageSize}
                          onValueChange={(value) => handleSelectChange('packageSize', value)}
                          disabled={!canEdit}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={
                              formData.packageSize ? 
                              `الحجم الحالي: ${getAvailablePackageSizes().find(s => s.id.toString() === formData.packageSize)?.name || 'غير محدد'}` : 
                              "اختر حجم الطلب"
                            } />
                          </SelectTrigger>
                          <SelectContent>
                            {getAvailablePackageSizes().map((size) => (
                              <SelectItem key={size.id} value={size.id.toString()}>
                                {size.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Local delivery fields */
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="customerCity">المدينة</Label>
                      <Input
                        id="customerCity"
                        value={formData.customerCity}
                        onChange={(e) => handleChange('customerCity', e.target.value)}
                        placeholder="أدخل المدينة"
                        disabled={!canEdit}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="customerProvince">المحافظة</Label>
                      <Input
                        id="customerProvince"
                        value={formData.customerProvince}
                        onChange={(e) => handleChange('customerProvince', e.target.value)}
                        placeholder="أدخل المحافظة"
                        disabled={!canEdit}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="customerAddress">العنوان التفصيلي *</Label>
                  <Textarea
                    id="customerAddress"
                    value={formData.customerAddress}
                    onChange={(e) => handleChange('customerAddress', e.target.value)}
                    placeholder="أدخل العنوان التفصيلي"
                    disabled={!canEdit}
                    rows={3}
                    required
                  />
                </div>
              </div>

              {/* Products Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">المنتجات</h3>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowProductSelection(true)}
                    disabled={!canEdit}
                  >
                    إضافة منتج
                  </Button>
                </div>

                {selectedProducts.length > 0 ? (
                  <div className="space-y-2">
                    {selectedProducts.map((product) => (
                      <div key={product.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium">{product.name || product.title}</div>
                          <div className="text-sm text-gray-600">
                            السعر: {product.price?.toLocaleString()} دينار
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={product.quantity}
                            onChange={(e) => updateProductQuantity(product.id, e.target.value)}
                            className="w-16 text-center"
                            min="1"
                            disabled={!canEdit}
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => removeProduct(product.id)}
                            disabled={!canEdit}
                          >
                            حذف
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    لم يتم إضافة منتجات بعد
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">ملاحظات</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  placeholder="أدخل أي ملاحظات إضافية"
                  disabled={!canEdit}
                  rows={3}
                />
              </div>

              {/* Total */}
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <div className="flex justify-between items-center text-lg font-semibold">
                  <span>المجموع الكلي:</span>
                  <span>{calculateTotal().toLocaleString()} دينار</span>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  إلغاء
                </Button>
                <Button type="submit" disabled={loading || !canEdit}>
                  {loading ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <ProductSelectionDialog
        open={showProductSelection}
        onOpenChange={setShowProductSelection}
        onProductSelect={handleProductSelect}
      />
    </>
  );
};

export default EditOrderDialog;