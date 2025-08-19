import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Trash2, Plus, AlertTriangle, Package, User, MapPin, Calendar, DollarSign, Save } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { editAlWaseetOrder } from '@/lib/alwaseet-api';
import SearchableSelectFixed from '@/components/ui/searchable-select-fixed';
import { iraqiProvinces } from '@/lib/iraq-provinces';
import ProductSelectionDialog from '@/components/products/ProductSelectionDialog';
import { useInventory } from '@/contexts/InventoryContext';
import { Loader2 } from 'lucide-react';

const EditOrderDialog = ({ isOpen, onOpenChange, order, onOrderUpdated }) => {
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
  const [canEdit, setCanEdit] = useState(false);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState([]);

  // تحميل البيانات الأساسية عند فتح النافذة
  useEffect(() => {
    if (isOpen) {
      if (cities.length === 0) fetchCities();
      if (packageSizes.length === 0) fetchPackageSizes();
    }
  }, [isOpen, cities.length, packageSizes.length, fetchCities, fetchPackageSizes]);

  // تهيئة النموذج عند فتح النافذة
  const initializeForm = useCallback(async () => {
    if (!order || !isOpen) return;
    
    console.log('تهيئة نموذج تعديل الطلب:', order);
    
    // تحديد ما إذا كان يمكن تعديل الطلب - السماح بالتعديل للطلبات pending أو shipped
    const editable = order.status === 'pending';
    setCanEdit(editable);
    
    // استخراج البيانات من الطلب
    const customerCity = order.customer_city || '';
    const customerRegion = order.customer_region || '';
    
    // البحث عن city_id إذا كان متوفراً
    let cityId = '';
    let regionId = '';
    
    if (customerCity && cities.length > 0) {
      const cityMatch = cities.find(c => 
        c.name?.toLowerCase() === customerCity.toLowerCase() ||
        c.name_ar?.toLowerCase() === customerCity.toLowerCase()
      );
      if (cityMatch) {
        cityId = cityMatch.id;
        
        // جلب المناطق لهذه المدينة
        if (cityId && regions.length === 0) {
          await fetchRegions(cityId);
        }
      }
    }
    
    if (customerRegion && regions.length > 0) {
      const regionMatch = regions.find(r => 
        r.name?.toLowerCase() === customerRegion.toLowerCase() ||
        r.name_ar?.toLowerCase() === customerRegion.toLowerCase()
      );
      if (regionMatch) {
        regionId = regionMatch.id;
      }
    }
    
    // تحضير المنتجات المحددة من عناصر الطلب
    if (order.items && Array.isArray(order.items)) {
      const productsFromOrder = order.items.map(item => ({
        productId: item.product_id,
        variantId: item.variant_id,
        quantity: item.quantity || 1,
        price: item.unit_price || 0,
        productName: item.product_name || item.productname || 'منتج',
        color: item.color || '',
        size: item.size || ''
      }));
      setSelectedProducts(productsFromOrder);
    }
    
    // ملء النموذج
    setFormData({
      name: order.customer_name || '',
      phone: order.customer_phone || '',
      city_id: cityId,
      region_id: regionId,
      city: customerCity,
      region: customerRegion,
      address: order.customer_address || '',
      notes: order.notes || '',
      size: order.delivery_partner_data?.package_size || 'normal',
      quantity: order.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 1,
      price: order.total_amount || 0,
      details: order.items?.map(item => 
        `${item.productname || item.product_name || 'منتج'} × ${item.quantity || 1}`
      ).join(', ') || '',
      delivery_fee: order.delivery_fee || 0
    });
    
    // ملء عناصر الطلب
    if (order.items && Array.isArray(order.items)) {
      setOrderItems(order.items.map(item => ({
        id: item.id || Math.random().toString(),
        product_name: item.productname || item.product_name || 'منتج',
        quantity: item.quantity || 1,
        unit_price: item.price || item.unit_price || 0,
        total_price: (item.quantity || 1) * (item.price || item.unit_price || 0),
        product_id: item.product_id,
        variant_id: item.variant_id
      })));
    }
    
  }, [order, isOpen, cities, regions, fetchRegions]);

  // تهيئة النموذج عند تغيير الطلب أو فتح النافذة
  useEffect(() => {
    initializeForm();
  }, [initializeForm]);

  // معالجة تغيير القيم
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // معالجة تغيير القوائم المنسدلة
  const handleSelectChange = (value, name) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // جلب المناطق عند تغيير المدينة
    if (name === 'city_id' && value) {
      fetchRegions(value);
      setFormData(prev => ({ ...prev, region_id: '' }));
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
        customer_region: formData.region || (formData.region_id ? 
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
      if (order.delivery_partner && order.delivery_partner !== 'محلي' && waseetToken) {
        const alwaseetData = {
          order_id: order.delivery_partner_data?.qr_id || order.qr_id || order.order_number,
          name: formData.name,
          phone: formData.phone,
          city_id: formData.city_id,
          region_id: formData.region_id,
          address: formData.address,
          notes: formData.notes,
          details: selectedProducts.map(item => 
            `${item.productName} (${item.color} ${item.size}) × ${item.quantity}`
          ).join(', '),
          quantity: selectedProducts.reduce((sum, item) => sum + item.quantity, 0),
          price: total,
          size: formData.size
        };
        
        await editAlWaseetOrder(alwaseetData, waseetToken);
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
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[95vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              تعديل الطلب {order?.delivery_partner_data?.qr_id || order?.qr_id || order?.order_number}
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
                    {/* المدينة - حسب نوع الطلب */}
                    {order?.delivery_partner === 'محلي' ? (
                      <div>
                        <Label htmlFor="city">المدينة</Label>
                        <Select value={formData.city} onValueChange={(value) => handleSelectChange(value, 'city')} disabled={!canEdit}>
                          <SelectTrigger>
                            <SelectValue placeholder="اختر المدينة" />
                          </SelectTrigger>
                          <SelectContent>
                            {iraqiProvinces.map((province) => (
                              <SelectItem key={province} value={province}>
                                {province}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div>
                        <Label htmlFor="city_id">المدينة</Label>
                        <SearchableSelectFixed
                          value={formData.city_id}
                          onValueChange={(value) => handleSelectChange(value, 'city_id')}
                          disabled={!canEdit}
                          options={cities.map(city => ({
                            value: city.id,
                            label: city.name
                          }))}
                          placeholder="اختر المدينة"
                          name="city_id"
                        />
                      </div>
                    )}
                    
                    {/* المنطقة - حسب نوع الطلب */}
                    {order?.delivery_partner === 'محلي' ? (
                      <div>
                        <Label htmlFor="region">المنطقة</Label>
                        <Input
                          id="region"
                          name="region"
                          value={formData.region}
                          onChange={handleChange}
                          disabled={!canEdit}
                          placeholder="أدخل المنطقة"
                        />
                      </div>
                    ) : (
                      <div>
                        <Label htmlFor="region_id">المنطقة</Label>
                        <SearchableSelectFixed
                          value={formData.region_id}
                          onValueChange={(value) => handleSelectChange(value, 'region_id')}
                          disabled={!canEdit || !formData.city_id}
                          options={regions.map(region => ({
                            value: region.id,
                            label: region.name
                          }))}
                          placeholder="اختر المنطقة"
                          name="region_id"
                        />
                      </div>
                    )}
                    
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
                    
                    {order?.delivery_partner !== 'محلي' && (
                      <div>
                        <Label htmlFor="size">حجم الطلب</Label>
                        <Select value={formData.size} onValueChange={(value) => handleSelectChange(value, 'size')} disabled={!canEdit}>
                          <SelectTrigger>
                            <SelectValue placeholder="اختر حجم الطلب" />
                          </SelectTrigger>
                          <SelectContent>
                            {packageSizes.map((size) => (
                              <SelectItem key={size.id} value={size.id}>
                                {size.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    
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