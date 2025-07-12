import { db } from '@/lib/firebase';
import { collection, doc, writeBatch, serverTimestamp, updateDoc } from 'firebase/firestore';
import { toast } from '@/components/ui/use-toast';

export const createOrderInFirestore = async (customerInfo, cartItems, products) => {
  const batch = writeBatch(db);

  const orderRef = doc(collection(db, 'orders'));
  const total = cartItems.reduce((sum, item) => sum + item.total, 0);
  const newOrder = {
    id: orderRef.id,
    customerInfo,
    items: cartItems,
    total,
    status: 'pending',
    createdAt: serverTimestamp(),
    trackingNumber: `RYUS-${Date.now()}`
  };
  batch.set(orderRef, newOrder);

  try {
    for (const item of cartItems) {
      const productRef = doc(db, 'products', item.productId);
      const productData = products.find(p => p.id === item.productId);
      if (productData) {
        const variants = [...productData.variants];
        const variantIndex = variants.findIndex(v => v.color === item.color && v.size === item.size);
        if (variantIndex !== -1) {
          const newQuantity = variants[variantIndex].quantity - item.quantity;
          if (newQuantity < 0) {
            throw new Error(`لا يوجد مخزون كاف للمنتج ${item.productName}`);
          }
          variants[variantIndex].quantity = newQuantity;
          batch.update(productRef, { variants });
        } else {
          throw new Error(`لم يتم العثور على متغير للمنتج ${item.productName}`);
        }
      } else {
        throw new Error(`لم يتم العثور على المنتج ${item.productName}`);
      }
    }

    await batch.commit();
    toast({
      title: "تم إنشاء الطلب بنجاح",
      description: `رقم التتبع: ${newOrder.trackingNumber}`,
    });
    return { success: true, order: newOrder };
  } catch (error) {
    console.error("Error creating order:", error);
    toast({
      title: "خطأ في إنشاء الطلب",
      description: error.message,
      variant: "destructive",
    });
    return { success: false, error: error.message };
  }
};

export const updateOrderInFirestore = async (orderId, data) => {
  const orderRef = doc(db, 'orders', orderId);
  try {
    await updateDoc(orderRef, { ...data, updatedAt: serverTimestamp() });
    toast({ title: "نجاح", description: "تم تحديث الطلب بنجاح." });
    return { success: true };
  } catch (error) {
    console.error("Error updating order:", error);
    toast({ title: "خطأ", description: `فشل تحديث الطلب: ${error.message}`, variant: "destructive" });
    return { success: false, error: error.message };
  }
};

export const deleteOrdersFromFirestore = async (orderIds) => {
  const batch = writeBatch(db);
  orderIds.forEach(id => {
    const orderRef = doc(db, 'orders', id);
    batch.delete(orderRef);
  });
  try {
    await batch.commit();
    toast({ title: "نجاح", description: `تم حذف ${orderIds.length} طلب(ات) بنجاح.` });
    return { success: true };
  } catch (error) {
    console.error("Error deleting orders:", error);
    toast({ title: "خطأ", description: `فشل حذف الطلبات: ${error.message}`, variant: "destructive" });
    return { success: false, error: error.message };
  }
};