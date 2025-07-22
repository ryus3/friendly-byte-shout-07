import { useState, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/UnifiedAuthContext';

export const useFullPurchases = () => {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(false);
  const { updateVariantStock, addExpense, refetchData } = useInventory();
  const { user } = useAuth();

  const addPurchase = useCallback(async (purchaseData) => {
    setLoading(true);
    try {
      // حساب التكلفة الإجمالية بشكل صحيح - فقط تكلفة المنتجات
      const itemsTotal = purchaseData.items.reduce((sum, item) => sum + (Number(item.costPrice) * Number(item.quantity)), 0);
      const shippingCost = Number(purchaseData.shippingCost) || 0;
      const transferCost = Number(purchaseData.transferCost) || 0;
      const totalAmount = itemsTotal; // فقط تكلفة المنتجات للفاتورة الأساسية

      console.log('🛒 حساب التكلفة الصحيح:', {
        supplier: purchaseData.supplier,
        itemsTotal,
        shippingCost,
        transferCost,
        totalAmount,
        cashSourceId: purchaseData.cashSourceId
      });

      // إضافة فاتورة الشراء مع التكلفة الصحيحة
      const { data: newPurchase, error } = await supabase
        .from('purchases')
        .insert({
          supplier_name: purchaseData.supplier,
          supplier_contact: purchaseData.supplierContact || null,
          total_amount: totalAmount,
          paid_amount: totalAmount,
          shipping_cost: shippingCost,
          transfer_cost: transferCost,
          purchase_date: purchaseData.purchaseDate ? 
            new Date(purchaseData.purchaseDate + 'T' + new Date().toTimeString().split(' ')[0]).toISOString() : 
            new Date().toISOString(),
          cash_source_id: purchaseData.cashSourceId,
          status: 'completed',
          items: purchaseData.items,
          created_by: user?.user_id
        })
        .select()
        .single();

      if (error) throw error;

      console.log('📋 تم إنشاء الفاتورة:', newPurchase);

      // إضافة عناصر الفاتورة لجدول purchase_items
      const purchaseItemsPromises = purchaseData.items.map(item => 
        supabase.from('purchase_items').insert({
          purchase_id: newPurchase.id,
          product_id: item.productId,
          variant_id: item.variantId,
          quantity: item.quantity,
          unit_cost: item.costPrice,
          total_cost: item.costPrice * item.quantity
        })
      );
      
      await Promise.all(purchaseItemsPromises);
      console.log('📦 تم إضافة عناصر الفاتورة');

      // معالجة المنتجات وإضافتها للمخزون بطريقة مبسطة ومضمونة
      for (const item of purchaseData.items) {
        try {
          console.log('📈 معالجة المنتج:', {
            sku: item.variantSku,
            quantity: item.quantity,
            costPrice: item.costPrice,
            productName: item.productName
          });
          
          // إضافة المنتج مباشرة بدون تعقيد
          await addProductDirectly(item, newPurchase.id, purchaseData.purchaseDate);
          
          console.log(`✅ تم معالجة ${item.variantSku} بنجاح`);
        } catch (error) {
          console.error(`❌ فشل معالجة ${item.variantSku}:`, error);
          throw error; // إيقاف العملية في حالة الفشل
        }
      }

      // خصم المبلغ الإجمالي الكامل من مصدر النقد (المنتجات + الشحن + التحويل)
      const fullTotalAmount = itemsTotal + shippingCost + transferCost;
      if (purchaseData.cashSourceId && fullTotalAmount > 0) {
        console.log('💰 خصم المبلغ الإجمالي من مصدر النقد:', {
          cashSourceId: purchaseData.cashSourceId,
          amount: fullTotalAmount
        });

        const { error: cashError } = await supabase.rpc('update_cash_source_balance', {
          p_cash_source_id: purchaseData.cashSourceId,
          p_amount: fullTotalAmount,
          p_movement_type: 'out',
          p_reference_type: 'purchase',
          p_reference_id: newPurchase.id,
          p_description: `فاتورة شراء ${newPurchase.purchase_number} - ${purchaseData.supplier}`,
          p_created_by: user?.user_id
        });

        if (cashError) {
          console.error('❌ خطأ في خصم المبلغ:', cashError);
          throw new Error(`فشل في خصم المبلغ من مصدر النقد: ${cashError.message}`);
        }

        console.log('✅ تم خصم المبلغ من مصدر النقد بنجاح');
      }

      // إضافة المصاريف بشكل صحيح
      // 1. مصروف الشراء (تكلفة المنتجات)
      if (itemsTotal > 0) {
        await addExpense({
          category: 'مشتريات',
          expense_type: 'operational',
          description: `شراء بضاعة - فاتورة ${newPurchase.purchase_number} من ${purchaseData.supplier}`,
          amount: itemsTotal,
          vendor_name: purchaseData.supplier,
          receipt_number: newPurchase.purchase_number,
          status: 'approved'
        });
        console.log(`✅ تم إضافة مصروف الشراء: ${itemsTotal} د.ع`);
      }

      // 2. مصروف الشحن
      if (shippingCost > 0) {
        await addExpense({
          category: 'شحن ونقل',
          expense_type: 'operational',
          description: `تكلفة شحن فاتورة شراء ${newPurchase.purchase_number} - ${purchaseData.supplier}`,
          amount: shippingCost,
          vendor_name: purchaseData.supplier,
          receipt_number: newPurchase.purchase_number + '-SHIP',
          status: 'approved'
        });
        console.log(`✅ تم إضافة مصروف الشحن: ${shippingCost} د.ع`);
      }

      // 3. مصروف التحويل
      if (transferCost > 0) {
        await addExpense({
          category: 'تكاليف التحويل',
          expense_type: 'operational',
          description: `تكلفة تحويل مالي فاتورة شراء ${newPurchase.purchase_number} - ${purchaseData.supplier}`,
          amount: transferCost,
          vendor_name: purchaseData.supplier,
          receipt_number: newPurchase.purchase_number + '-TRANSFER',
          status: 'approved'
        });
        console.log(`✅ تم إضافة مصروف التحويل: ${transferCost} د.ع`);
      }

      // تحديث قائمة المشتريات فوراً
      setPurchases(prev => [newPurchase, ...prev]);

      // إعادة تحميل البيانات للتأكد من التحديث الكامل
      setTimeout(async () => {
        await refetchData();
        console.log('🔄 تم إعادة تحميل البيانات بعد إضافة الفاتورة');
      }, 500);

      console.log('✅ تمت إضافة الفاتورة بنجاح:', newPurchase);
      
      toast({ 
        title: 'نجح', 
        description: `تمت إضافة فاتورة الشراء رقم ${newPurchase.purchase_number} بنجاح بمبلغ ${(itemsTotal + shippingCost + transferCost).toLocaleString()} د.ع`,
        variant: 'success'
      });

      return { success: true, purchase: newPurchase };
    } catch (error) {
      console.error("❌ خطأ في إضافة فاتورة الشراء:", error);
      toast({ 
        title: 'خطأ', 
        description: `فشل إضافة فاتورة الشراء: ${error.message}`, 
        variant: 'destructive' 
      });
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, [addExpense, refetchData, user]);

  // دالة مبسطة لإضافة المنتجات مباشرة
  const addProductDirectly = async (item, purchaseId, purchaseDate) => {
    try {
      const current_user_id = user?.user_id || (await supabase.from('profiles').select('user_id').limit(1)).data?.[0]?.user_id;
      
      // البحث عن المنتج الموجود أولاً بالاسم
      const { data: existingProduct } = await supabase
        .from('products')
        .select('id')
        .ilike('name', `%${item.productName}%`)
        .maybeSingle();

      // إذا وُجد منتج بنفس الاسم، البحث عن متغير بـ SKU
      const { data: existingVariant } = await supabase
        .from('product_variants')
        .select('id, product_id, products(id, name)')
        .eq('barcode', item.variantSku)
        .maybeSingle();

      let productId, variantId;

      if (existingVariant) {
        // المتغير موجود - نحديث المخزون فقط
        productId = existingVariant.product_id;
        variantId = existingVariant.id;
        
        // تحديث سعر التكلفة
        await supabase
          .from('product_variants')
          .update({ cost_price: item.costPrice })
          .eq('id', variantId);
        
        await supabase
          .from('products')
          .update({ cost_price: item.costPrice })
          .eq('id', productId);
          
      } else if (existingProduct) {
        // المنتج موجود ولكن بـ SKU جديد - إنشاء متغير جديد
        productId = existingProduct.id;
        
        // تحديث سعر التكلفة للمنتج الموجود
        await supabase
          .from('products')
          .update({ cost_price: item.costPrice })
          .eq('id', productId);

        // إنشاء متغير جديد للمنتج الموجود
        const { data: newVariant, error: variantError } = await supabase
          .from('product_variants')
          .insert({
            product_id: productId,
            barcode: item.variantSku,
            sku: item.variantSku,
            price: item.costPrice * 1.3,
            cost_price: item.costPrice,
            is_active: true
          })
          .select()
          .single();

        if (variantError) throw variantError;
        variantId = newVariant.id;
        
      } else {
        // إنشاء منتج جديد
        const { data: newProduct, error: productError } = await supabase
          .from('products')
          .insert({
            name: item.productName || 'منتج جديد',
            cost_price: item.costPrice,
            base_price: item.costPrice * 1.3,
            is_active: true,
            created_by: current_user_id
          })
          .select()
          .single();

        if (productError) throw productError;
        productId = newProduct.id;

        // إنشاء متغير للمنتج
        const { data: newVariant, error: variantError } = await supabase
          .from('product_variants')
          .insert({
            product_id: productId,
            barcode: item.variantSku,
            sku: item.variantSku,
            price: item.costPrice * 1.3,
            cost_price: item.costPrice,
            is_active: true
          })
          .select()
          .single();

        if (variantError) throw variantError;
        variantId = newVariant.id;
      }

      // تحديث المخزون
      const { data: existingInventory } = await supabase
        .from('inventory')
        .select('*')
        .eq('product_id', productId)
        .eq('variant_id', variantId)
        .single();

      if (existingInventory) {
        // تحديث الكمية الموجودة
        await supabase
          .from('inventory')
          .update({
            quantity: existingInventory.quantity + item.quantity,
            updated_at: new Date().toISOString(),
            last_updated_by: current_user_id
          })
          .eq('id', existingInventory.id);
      } else {
        // إنشاء سجل مخزون جديد
        await supabase
          .from('inventory')
          .insert({
            product_id: productId,
            variant_id: variantId,
            quantity: item.quantity,
            min_stock: 0,
            reserved_quantity: 0,
            last_updated_by: current_user_id
          });
      }

      // إضافة سجل التكلفة
      const purchaseDateTime = purchaseDate ? 
        new Date(purchaseDate + 'T' + new Date().toTimeString().split(' ')[0]).toISOString() : 
        new Date().toISOString();
        
      await supabase
        .from('purchase_cost_history')
        .insert({
          product_id: productId,
          variant_id: variantId,
          purchase_id: purchaseId,
          quantity: item.quantity,
          remaining_quantity: item.quantity,
          unit_cost: item.costPrice,
          purchase_date: purchaseDateTime
        });

      console.log(`✅ تم إضافة المنتج ${item.productName} بنجاح`);
    } catch (error) {
      console.error(`❌ فشل إضافة المنتج ${item.productName}:`, error);
      throw error;
    }
  };

  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('purchases')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPurchases(data || []);
    } catch (error) {
      console.error("خطأ في جلب المشتريات:", error);
      toast({ 
        title: 'خطأ', 
        description: 'فشل في جلب بيانات المشتريات', 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const deletePurchase = useCallback(async (purchaseId) => {
    try {
      setLoading(true);
      
      console.log('🗑️ بدء حذف الفاتورة:', purchaseId);
      
      const { data: result, error: deleteError } = await supabase.rpc('delete_purchase_completely', {
        p_purchase_id: purchaseId
      });

      if (deleteError) {
        console.error('❌ خطأ في حذف الفاتورة:', deleteError);
        throw new Error(`فشل في حذف الفاتورة: ${deleteError.message}`);
      }

      if (!result?.success) {
        console.error('❌ فشل حذف الفاتورة:', result?.error);
        throw new Error(result?.error || 'فشل غير محدد في حذف الفاتورة');
      }

      console.log('✅ نتيجة الحذف:', result);

      setPurchases(prev => prev.filter(p => p.id !== purchaseId));
      
      if (refetchData) {
        setTimeout(async () => {
          await refetchData();
          console.log('🔄 تم إعادة تحميل البيانات بعد الحذف');
        }, 500);
      }
      
      toast({ 
        title: 'تم الحذف بنجاح', 
        description: result.message || 'تم حذف الفاتورة وجميع متعلقاتها بنجاح',
        variant: 'success'
      });
      
      return { success: true, purchase: { id: purchaseId, purchase_number: result.purchase_number } };
    } catch (error) {
      console.error("❌ خطأ في حذف فاتورة الشراء:", error);
      toast({ 
        title: 'خطأ في الحذف', 
        description: `فشل حذف الفاتورة: ${error.message}`, 
        variant: 'destructive' 
      });
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, [refetchData, user]);

  const updatePurchase = useCallback(async (purchaseId, updates) => {
    try {
      const { data, error } = await supabase
        .from('purchases')
        .update(updates)
        .eq('id', purchaseId)
        .select()
        .single();

      if (error) throw error;

      setPurchases(prev => prev.map(p => p.id === purchaseId ? data : p));
      toast({ title: 'تم', description: 'تم تحديث فاتورة الشراء بنجاح' });
      
      return { success: true, purchase: data };
    } catch (error) {
      console.error("خطأ في تحديث فاتورة الشراء:", error);
      toast({ 
        title: 'خطأ', 
        description: 'فشل تحديث فاتورة الشراء', 
        variant: 'destructive' 
      });
      return { success: false };
    }
  }, []);

  return {
    purchases,
    setPurchases,
    loading,
    addPurchase,
    fetchPurchases,
    deletePurchase,
    updatePurchase,
  };
};
