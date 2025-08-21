import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SearchableSelectFixed from '@/components/ui/searchable-select-fixed';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Trash2, Plus, AlertTriangle, Package, User, MapPin, Calendar, DollarSign, Save, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { editAlWaseetOrder } from '@/lib/alwaseet-api';
import { iraqiProvinces } from '@/lib/iraq-provinces';
import ProductSelectionDialog from '@/components/products/ProductSelectionDialog';
import OrderDetailsForm from '@/components/quick-order/OrderDetailsForm';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';

const EditOrderDialog = ({ open, onOpenChange, order, onOrderUpdated }) => {
  const { cities, regions, packageSizes, fetchCities, fetchRegions, fetchPackageSizes, waseetToken, activePartner, setActivePartner } = useAlWaseet();
  const { products, updateOrder, settings, cart, clearCart, addToCart, removeFromCart } = useInventory();
  const { user, hasPermission } = useAuth();
  
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
    size: 'عادي',
    quantity: 1,
    price: 0,
    details: '',
    type: 'new',
    promocode: '',
    delivery_fee: 0
  });
  const [orderItems, setOrderItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingRegions, setIsLoadingRegions] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [originalData, setOriginalData] = useState(null);
  const [discount, setDiscount] = useState(0);
  const [customerData, setCustomerData] = useState(null);
  const [loyaltyDiscount, setLoyaltyDiscount] = useState(0);
  const [applyLoyaltyDiscount, setApplyLoyaltyDiscount] = useState(true);
  const [applyLoyaltyDelivery, setApplyLoyaltyDelivery] = useState(false);

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
    
    // تحضير المنتجات المحددة من عناصر الطلب وإضافتها للسلة
    if (order.items && Array.isArray(order.items)) {
      clearCart(); // مسح السلة أولاً
      
      // إضافة المنتجات للسلة
      order.items.forEach(item => {
        const cartItem = {
          id: `${item.product_id}-${item.variant_id}`,
          productId: item.product_id,
          variantId: item.variant_id,
          productName: item.product_name || item.productname || 'منتج',
          size: item.size || '',
          color: item.color || '',
          price: item.unit_price || item.price || 0,
          quantity: item.quantity || 1,
          total: (item.unit_price || item.price || 0) * (item.quantity || 1),
          image: item.image || '/placeholder.svg',
          barcode: item.barcode || '',
          sku: item.sku || ''
        };
        addToCart(null, cartItem, cartItem.quantity, false);
      });
      console.log('📦 المنتجات المحملة للسلة:', order.items);
    }
    
    // ملء النموذج بالبيانات
    const initialFormData = {
      name: order.customer_name || '',
      phone: order.customer_phone || '',
      phone2: order.customer_phone2 || '',
      city_id: '',
      region_id: '',
      city: order.customer_city || '',
      region: order.customer_province || '',
      address: order.customer_address || '',
      notes: order.notes || '',
      size: 'عادي',
      quantity: order.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 1,
      price: order.total_amount || 0,
      details: order.items?.map(item => 
        `${item.productname || item.product_name || 'منتج'} - ${item.color || ''} - ${item.size || ''} × ${item.quantity || 1}`
      ).join(', ') || '',
      type: 'new',
      promocode: '',
      delivery_fee: order.delivery_fee || settings?.deliveryFee || 0
    };
    
    setFormData(initialFormData);
    console.log('📝 تم تعبئة النموذج بالبيانات:', initialFormData);
    
  }, [order, open, clearCart, addToCart, settings]);

  // تهيئة النموذج عند تغيير الطلب أو فتح النافذة
  useEffect(() => {
    initializeForm();
  }, [initializeForm]);

  // إضافة useEffect لتحديث البيانات المحسوبة تلقائياً
  useEffect(() => {
    if (cart.length > 0) {
      const totalQuantity = cart.reduce((sum, item) => sum + item.quantity, 0);
      const detailsText = cart.map(item => 
        `${item.productName} - ${item.color} - ${item.size} × ${item.quantity}`
      ).join(', ');
      
      setFormData(prev => ({
        ...prev,
        quantity: totalQuantity,
        details: detailsText
      }));
    }
  }, [cart]);

  // حساب المجاميع
  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const total = subtotal - discount;

  // معالجة تغيير القيم
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // معالجة تغيير القوائم المنسدلة
  const handleSelectChange = async (value, name) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // جلب المناطق عند تغيير المدينة
    if (name === 'city_id' && value) {
      setIsLoadingRegions(true);
      try {
        await fetchRegions(value);
        // مسح المنطقة المحددة
        setFormData(prev => ({ ...prev, region_id: '', region: '' }));
      } catch (error) {
        console.error('خطأ في جلب المناطق:', error);
        toast({
          title: "خطأ",
          description: "فشل في جلب المناطق",
          variant: "destructive"
        });
      } finally {
        setIsLoadingRegions(false);
      }
    }
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

    if (cart.length === 0) {
      toast({
        title: "تنبيه",
        description: "يجب اختيار منتج واحد على الأقل",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      // حساب المجموع الجديد من السلة
      const newTotal = subtotal + (formData.delivery_fee || 0);
      const updatedFormData = {
        ...formData,
        price: newTotal,
        quantity: cart.reduce((sum, item) => sum + item.quantity, 0),
        details: cart.map(item => `${item.productName} - ${item.color} - ${item.size} × ${item.quantity}`).join(', ')
      };

      // تحضير بيانات المنتجات للحفظ من السلة
      const orderItems = cart.map(item => ({
        product_id: item.productId,
        variant_id: item.variantId,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.total
      }));

      // إعداد البيانات للتحديث
      const updateData = {
        customer_name: updatedFormData.name,
        customer_phone: updatedFormData.phone,
        customer_phone2: updatedFormData.phone2,
        customer_city: updatedFormData.city,
        customer_province: updatedFormData.region,
        customer_address: updatedFormData.address,
        notes: updatedFormData.notes,
        total_amount: newTotal,
        delivery_fee: updatedFormData.delivery_fee,
        final_amount: newTotal
      };

      // استخدام updateOrder من useInventory
      const result = await updateOrder(order.id, updateData, orderItems, order.items);

      if (!result.success) {
        throw new Error(result.error);
      }

      toast({
        title: "تم التحديث",
        description: "تم تحديث الطلب بنجاح",
        variant: "success"
      });

      // إذا نجح التحديث، إعلام المكون الأب ومسح السلة
      clearCart();
      onOrderUpdated?.();
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
                  <div>
                    <Label htmlFor="phone2">رقم الهاتف الثاني (اختياري)</Label>
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
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="city">المدينة</Label>
                    <Input
                      id="city"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      disabled={!canEdit || isLoading}
                    />
                  </div>
                  <div>
                    <Label htmlFor="region">المنطقة</Label>
                    <Input
                      id="region"
                      name="region"
                      value={formData.region}
                      onChange={handleChange}
                      disabled={!canEdit || isLoading}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="address">العنوان التفصيلي</Label>
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

            {/* استخدام OrderDetailsForm بدلاً من العرض المخصص */}
            <OrderDetailsForm
              formData={formData}
              handleChange={handleChange}
              handleSelectChange={handleSelectChange}
              setProductSelectOpen={setShowProductDialog}
              isSubmittingState={isLoading}
              isDeliveryPartnerSelected={true}
              packageSizes={packageSizes}
              loadingPackageSizes={false}
              activePartner={activePartner || 'local'}
              dataFetchError={null}
              settings={settings}
              discount={discount}
              setDiscount={setDiscount}
              subtotal={subtotal}
              total={total}
              customerData={customerData}
              loyaltyDiscount={loyaltyDiscount}
              applyLoyaltyDiscount={applyLoyaltyDiscount}
              onToggleLoyaltyDiscount={() => setApplyLoyaltyDiscount(!applyLoyaltyDiscount)}
              applyLoyaltyDelivery={applyLoyaltyDelivery}
              onToggleLoyaltyDelivery={() => setApplyLoyaltyDelivery(!applyLoyaltyDelivery)}
            />

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
                  disabled={isLoading || cart.length === 0}
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

      {showProductDialog && (
        <ProductSelectionDialog
          open={showProductDialog}
          onOpenChange={setShowProductDialog}
          selectedItems={cart}
        />
      )}
    </>
  );
};

export default EditOrderDialog;