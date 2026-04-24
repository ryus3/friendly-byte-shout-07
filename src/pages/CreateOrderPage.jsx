import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useInventory } from '@/contexts/InventoryContext';
import { useAlWaseet } from '@/contexts/AlWaseetContext';
import { toast } from '@/components/ui/use-toast';
import { createAlWaseetOrder } from '@/lib/alwaseet-api';
import { useCitiesCache } from '@/hooks/useCitiesCache';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, AlertTriangle, PackagePlus, Trash2 } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import DeliveryPartnerDialog from '@/components/DeliveryPartnerDialog';
import ProductSelectionDialog from '@/components/products/ProductSelectionDialog';
import devLog from '@/lib/devLogger';

const CreateOrderPage = () => {
  const { createOrder } = useInventory();
  const { isLoggedIn: isWaseetLoggedIn, token: waseetToken, activePartner } = useAlWaseet();
  const [deliveryPartnerDialogOpen, setDeliveryPartnerDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '', phone: '', second_phone: '', city_id: '', region_id: '', address: '', 
    notes: '', details: '', quantity: 1, price: 0, size: 'normal', type: 'new', promocode: ''
  });
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [cities, setCities] = useState([]);
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [loadingRegions, setLoadingRegions] = useState(false);
  const [productSelectOpen, setProductSelectOpen] = useState(false);

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const total = subtotal - discount;

  // ✅ استخدام الكاش المحلي للمدن والمناطق
  const { cities: cachedCities, getRegionsByCity: getCachedRegions, isLoaded: isCacheLoaded } = useCitiesCache();

  useEffect(() => {
    if(isWaseetLoggedIn && activePartner === 'alwaseet') {
      setFormData(prev => ({...prev, price: total}));
      if (isCacheLoaded && cachedCities.length > 0) {
        const mapped = cachedCities.map(c => ({ id: c.alwaseet_id || c.id, name: c.name }));
        setCities(mapped);
        devLog.log(`✅ CreateOrderPage: تم جلب ${mapped.length} مدينة من الكاش المحلي`);
      }
    }
  }, [isWaseetLoggedIn, activePartner, total, isCacheLoaded, cachedCities]);

  useEffect(() => {
    if (formData.city_id && isWaseetLoggedIn && isCacheLoaded) {
      setLoadingRegions(true);
      setRegions([]);
      setFormData(prev => ({ ...prev, region_id: '' }));
      
      // ✅ فلترة المناطق من الكاش المحلي مباشرة (بدون API)
      const cachedRegions = getCachedRegions(formData.city_id);
      if (cachedRegions && cachedRegions.length > 0) {
        const mapped = cachedRegions.map(r => ({ id: r.alwaseet_id || r.id, name: r.name }));
        setRegions(mapped);
        devLog.log(`✅ CreateOrderPage: تم فلترة ${mapped.length} منطقة من الكاش`);
      }
      setLoadingRegions(false);
    }
  }, [formData.city_id, isWaseetLoggedIn, isCacheLoaded, getCachedRegions]);
  
  useEffect(() => {
    // تصفية العناصر null/undefined وحساب البيانات بأمان
    const validCart = cart.filter(item => item != null);
    const detailsText = validCart.map(p => `${p?.productName} (${p?.color}, ${p?.size}) x${p?.quantity || 1}`).join(' | ');
    const quantityCount = validCart.reduce((sum, item) => sum + (item?.quantity || 1), 0);
    setFormData(prev => ({...prev, details: detailsText, quantity: quantityCount > 0 ? quantityCount : 1}));
  }, [cart]);


  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isWaseetLoggedIn) {
      toast({ title: "خطأ", description: "يجب تسجيل الدخول إلى شركة التوصيل أولاً.", variant: "destructive" });
      setDeliveryPartnerDialogOpen(true);
      return;
    }
    if (cart.length === 0) {
      toast({ title: "خطأ", description: "الرجاء اختيار منتج واحد على الأقل.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      devLog.log('🎯 بدء إنشاء طلب بالنهج الجديد (remote-first)...');
      
      // أولاً: إنشاء الطلب في الوسيط
      const validCart = cart.filter(item => item != null);
      const alWaseetPayload = { 
        ...formData,
        details: validCart.map(item => `${item?.productName} (${item?.color}, ${item?.size}) ×${item?.quantity || 1}`).join(' | '),
        quantity: validCart.reduce((sum, item) => sum + (item?.quantity || 1), 0),
        price: total + 50000, // إضافة رسوم التوصيل المقدرة
      };
      
      devLog.log('🚀 إنشاء طلب في الوسيط أولاً:', alWaseetPayload);
      const alWaseetResponse = await createAlWaseetOrder(alWaseetPayload, waseetToken);
      
      if (!alWaseetResponse?.id) {
        throw new Error('فشل إنشاء الطلب في الوسيط - لم يتم إرجاع معرف صحيح');
      }
      
      devLog.log('✅ تم إنشاء طلب الوسيط بنجاح:', alWaseetResponse);
      
      // ثانياً: إنشاء الطلب المحلي مع معرفات الوسيط
      const customerInfo = {
        name: formData.name, 
        phone: formData.phone,
        second_phone: formData.second_phone || '',
        address: `${formData.address}, ${regions.find(r => r.id == formData.region_id)?.name || ''}, ${cities.find(c => c.id == formData.city_id)?.name || ''}`,
        city: cities.find(c => c.id == formData.city_id)?.name || '', 
        region: regions.find(r => r.id == formData.region_id)?.name || '',
        notes: formData.notes,
        promo_code: formData.promocode || ''
      };

      // إضافة معرفات الوسيط إلى بيانات الطلب
      const deliveryPartnerData = {
        delivery_partner: 'alwaseet',
        delivery_partner_order_id: String(alWaseetResponse.id),
        qr_id: alWaseetResponse.qr_id || alWaseetResponse.tracking_id || String(alWaseetResponse.id),
        alwaseet_city_id: formData.city_id,
        alwaseet_region_id: formData.region_id,
        delivery_fee: 50000
      };

      // استخدام tracking_number من الوسيط كـ tracking_number محلي
      const trackingNumber = alWaseetResponse.qr_id || alWaseetResponse.tracking_id || String(alWaseetResponse.id);

      devLog.log('🏠 إنشاء طلب محلي مع معرفات الوسيط:', { customerInfo, deliveryPartnerData, trackingNumber });
      const localResult = await createOrder(customerInfo, cart, trackingNumber, discount, 'pending', null, deliveryPartnerData);

      if (localResult.success) {
        devLog.log('✅ تم إنشاء الطلب المحلي مع ربط كامل:', localResult);
        
        toast({ 
          title: "نجاح الإنشاء الكامل", 
          description: `تم إنشاء الطلب وربطه مع الوسيط بنجاح. رقم الطلب: ${localResult.trackingNumber}، معرف الوسيط: ${alWaseetResponse.id}`,
          variant: "success",
          duration: 6000
        });
        
        // تنظيف النموذج
        setFormData({ name: '', phone: '', second_phone: '', city_id: '', region_id: '', address: '', notes: '', details: '', quantity: 1, price: 0, size: 'normal', type: 'new', promocode: '' });
        setCart([]); 
        setDiscount(0);
      } else { 
        console.error('❌ فشل إنشاء الطلب المحلي رغم نجاح الوسيط:', localResult.error);
        
        // إشعار المستخدم أن الطلب موجود في الوسيط لكن فشل محلياً
        toast({ 
          title: "تحذير - طلب الوسيط موجود", 
          description: `تم إنشاء الطلب في الوسيط (${alWaseetResponse.id}) لكن فشل الحفظ محلياً: ${localResult.error}`,
          variant: "warning",
          duration: 8000
        });
      }
    } catch (error) {
      console.error('❌ خطأ في إنشاء الطلب:', error);
      toast({ 
        title: "خطأ في الإنشاء", 
        description: error.message || "فشل إنشاء الطلب.",
        variant: "destructive" 
      });
    } finally { 
      setLoading(false); 
    }
  };

  const handleAddToCart = (product, variant, quantity) => {
     const cartItem = {
      id: `${product.id}-${variant.sku}`, productId: product.id, sku: variant.sku, productName: product.name,
      image: variant.image || product.images?.[0] || null,
      color: variant.color, size: variant.size, quantity, price: variant.price || product.price,
      costPrice: variant.costPrice, stock: variant.quantity, total: (variant.price || product.price) * quantity
    };
    setCart(prev => {
        const existing = prev.find(item => item.id === cartItem.id);
        if (existing) {
            const newQty = existing.quantity + quantity;
            return prev.map(item => item.id === cartItem.id ? { ...item, quantity: newQty, total: item.price * newQty } : item);
        }
        return [...prev, cartItem];
    });
  };

  const handleRemoveFromCart = (itemId) => {
    setCart(prev => prev.filter(item => item.id !== itemId));
  };

  return (
    <>
      <Helmet>
        <title>طلب سريع - نظام RYUS</title>
      </Helmet>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold gradient-text">طلب سريع</h1>
          <p className="text-muted-foreground mt-1">إنشاء طلب جديد وإرساله لشركة التوصيل مباشرة.</p>
        </div>

        {!isWaseetLoggedIn && (
           <Alert variant="destructive" className="mt-6">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>تنبيه هام</AlertTitle>
                <AlertDescription>
                    <p>يجب عليك تسجيل الدخول إلى حسابك في شركة التوصيل لتتمكن من إنشاء طلبات.</p>
                    <Button variant="destructive" className="mt-4" onClick={() => setDeliveryPartnerDialogOpen(true)}>تسجيل الدخول</Button>
                </AlertDescription>
            </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <fieldset disabled={!isWaseetLoggedIn || loading}>
            <Card>
              <CardHeader><CardDescription>يرجى ملء جميع الحقول المطلوبة من شركة التوصيل.</CardDescription></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2"><Label htmlFor="name">اسم الزبون</Label><Input id="name" name="name" value={formData.name} onChange={handleChange} required /></div>
                <div className="space-y-2"><Label htmlFor="phone">رقم الهاتف الاساسي</Label><Input id="phone" name="phone" value={formData.phone} onChange={handleChange} required /></div>
                <div className="space-y-2"><Label htmlFor="second_phone">رقم الهاتف الثانوي</Label><Input id="second_phone" name="second_phone" value={formData.second_phone} onChange={handleChange} /></div>
                <div className="space-y-2"><Label htmlFor="city_id">المدينة</Label>
                  <Select name="city_id" onValueChange={(v) => handleSelectChange('city_id', v)} value={formData.city_id} required>
                    <SelectTrigger disabled={loadingCities}>{loadingCities ? 'جاري تحميل المدن...' : 'اختر مدينة'}</SelectTrigger>
                    <SelectContent>{cities.map(city => <SelectItem key={city.id} value={String(city.id)}>{city.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label htmlFor="region_id">المنطقة او القضاء</Label>
                  <Select name="region_id" onValueChange={(v) => handleSelectChange('region_id', v)} value={formData.region_id} required disabled={!formData.city_id || loadingRegions}>
                    <SelectTrigger>{loadingRegions ? 'جاري تحميل المناطق...' : 'اختر منطقة'}</SelectTrigger>
                    <SelectContent>{regions.map(region => <SelectItem key={region.id} value={String(region.id)}>{region.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label htmlFor="address">اقرب نقطة دالة</Label><Input id="address" name="address" value={formData.address} onChange={handleChange} required /></div>
                <div className="space-y-2"><Label htmlFor="details">نوع البضاعة</Label><Input id="details" name="details" value={formData.details} onChange={handleChange} required /></div>
                <div className="space-y-2"><Label htmlFor="quantity">عدد القطع</Label><Input type="number" id="quantity" name="quantity" value={formData.quantity} onChange={handleChange} required min="1"/></div>
                <div className="space-y-2"><Label htmlFor="price">السعر مع التوصيل</Label><Input type="number" id="price" name="price" value={formData.price} onChange={handleChange} required /></div>
                <div className="space-y-2"><Label htmlFor="size">حجم الطلب</Label>
                    <Select name="size" onValueChange={(v) => handleSelectChange('size', v)} value={formData.size}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="normal">عادي</SelectItem><SelectItem value="big">كبير</SelectItem></SelectContent>
                    </Select>
                </div>
                 <div className="space-y-2"><Label htmlFor="type">نوع الطلب</Label>
                    <Select name="type" onValueChange={(v) => handleSelectChange('type', v)} value={formData.type}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="new">طلب جديد</SelectItem><SelectItem value="replace">استبدال</SelectItem></SelectContent>
                    </Select>
                </div>
                <div className="space-y-2"><Label htmlFor="promocode">بروموكود</Label><Input id="promocode" name="promocode" value={formData.promocode} onChange={handleChange} /></div>
                <div className="md:col-span-2 space-y-2"><Label htmlFor="notes">الملاحظات</Label><Textarea id="notes" name="notes" value={formData.notes} onChange={handleChange} /></div>
                <div className="md:col-span-2 space-y-3 pt-4 border-t">
                    <div className="flex justify-between items-center"><Label>المنتجات (للنظام الداخلي)</Label><Button type="button" variant="outline" size="sm" onClick={() => setProductSelectOpen(true)}><PackagePlus className="w-4 h-4 ml-2"/>إضافة منتج</Button></div>
                     <div className="space-y-2">
                        {cart.map(item => (
                            <div key={item.id} className="flex items-center justify-between p-2 bg-secondary rounded-lg">
                                <div><p className="font-semibold">{item.productName}</p><p className="text-xs text-muted-foreground">{item.color}, {item.size} &times; {item.quantity}</p></div>
                                <div className="flex items-center gap-2"><p>{item.total.toLocaleString()} د.ع</p><Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemoveFromCart(item.id)}><Trash2 className="w-4 h-4 text-destructive"/></Button></div>
                            </div>))}
                    </div>
                     {cart.length > 0 && (<div className="space-y-3 pt-3 border-t"><div className="flex justify-between items-center"><span className="text-muted-foreground">المجموع الفرعي</span><span>{subtotal.toLocaleString()} د.ع</span></div><div className="flex items-center gap-2"><Label className="flex-shrink-0">خصم</Label><Input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value) || 0)} placeholder="مبلغ الخصم"/></div><div className="flex justify-between items-center text-lg font-bold"><span className="text-primary">المجموع الكلي للمنتجات</span><span className="text-primary">{total.toLocaleString()} د.ع</span></div></div>)}
                </div>
              </CardContent>
            </Card>
            <Button type="submit" className="mt-6 w-full" disabled={!isWaseetLoggedIn || loading || cart.length === 0}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              إنشاء الطلب
            </Button>
          </fieldset>
        </form>
      </div>
      <DeliveryPartnerDialog open={deliveryPartnerDialogOpen} onOpenChange={setDeliveryPartnerDialogOpen} />
      <ProductSelectionDialog open={productSelectOpen} onOpenChange={setProductSelectOpen} onAddToCart={handleAddToCart} />
    </>
  );
};

export default CreateOrderPage;