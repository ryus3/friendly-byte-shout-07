import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db, storage } from '@/lib/firebase.js';
import { collection, onSnapshot, addDoc, doc, writeBatch, getDoc, setDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from './AuthContext';
import { toast } from '@/components/ui/use-toast.js';

const InventoryContext = createContext();

export const useInventory = () => useContext(InventoryContext);

export const InventoryProvider = ({ children }) => {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [aiOrders, setAiOrders] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({ deliveryFee: 5000 });

  useEffect(() => {
    if (!user) {
      setProducts([]);
      setOrders([]);
      setAiOrders([]);
      setPurchases([]);
      setCart([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribes = [
      onSnapshot(collection(db, 'products'), (snapshot) => {
        const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setProducts(productsData);
      }),
      onSnapshot(query(collection(db, 'orders'), where('status', '!=', 'pending_ai_approval')), (snapshot) => {
        const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setOrders(ordersData.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()));
      }),
      onSnapshot(query(collection(db, 'orders'), where('status', '==', 'pending_ai_approval')), (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAiOrders(data.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()));
      }),
      onSnapshot(collection(db, 'purchases'), (snapshot) => {
        const purchasesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPurchases(purchasesData.sort((a, b) => b.purchaseDate.toMillis() - a.purchaseDate.toMillis()));
      }),
      onSnapshot(doc(db, 'settings', 'app'), (doc) => {
        if (doc.exists()) {
          setSettings(doc.data());
        }
      }),
    ];

    setLoading(false);
    return () => unsubscribes.forEach(unsub => unsub());
  }, [user]);

  const addProduct = async (productData, imageFiles) => {
    try {
      const { general, ...colorSpecificImages } = imageFiles;
      
      const generalImageUrls = [];
      if (general && general.length > 0) {
        for (const file of general) {
            const imageRef = ref(storage, `products/${Date.now()}-general-${file.name}`);
            const snapshot = await uploadBytes(imageRef, file);
            generalImageUrls.push(await getDownloadURL(snapshot.ref));
        }
      }

      const colorImageUrls = {};
      for (const colorId in colorSpecificImages) {
          const file = colorSpecificImages[colorId];
          const imageRef = ref(storage, `products/${Date.now()}-color-${file.name}`);
          const snapshot = await uploadBytes(imageRef, file);
          colorImageUrls[colorId] = await getDownloadURL(snapshot.ref);
      }
      
      const variantsWithImages = productData.variants.map(variant => ({
        ...variant,
        image: colorImageUrls[variant.colorId] || null,
      }));

      const mainImage = generalImageUrls[0] || Object.values(colorImageUrls)[0] || null;

      const newProduct = {
        ...productData,
        variants: variantsWithImages,
        image: mainImage,
        images: generalImageUrls,
        createdAt: new Date(),
      };
      
      await addDoc(collection(db, 'products'), newProduct);
      return { success: true };
    } catch (error) {
        console.error("Error adding product:", error);
        return { success: false, error: error.message };
    }
  };
  
  const updateOrder = async (orderId, data) => {
    const orderRef = doc(db, 'orders', orderId);
    try {
        await updateDoc(orderRef, data);
        toast({ title: "نجاح", description: "تم تحديث الطلب بنجاح." });
        return { success: true };
    } catch (error) {
        console.error("Error updating order:", error);
        toast({ title: "خطأ", description: `فشل تحديث الطلب: ${error.message}`, variant: "destructive" });
        return { success: false };
    }
  };
  
  const deleteOrders = async (orderIds) => {
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
        return { success: false };
    }
  };

  const updateSettings = async (newSettings) => {
    try {
      const settingsRef = doc(db, 'settings', 'app');
      await setDoc(settingsRef, newSettings, { merge: true });
      toast({ title: "نجاح", description: "تم تحديث الإعدادات بنجاح." });
    } catch (error) {
      console.error("Error updating settings:", error);
      toast({ title: "خطأ", description: "فشل تحديث الإعدادات.", variant: "destructive" });
    }
  };

  const addToCart = (product, variant, quantity) => {
    const cartItem = {
      id: `${product.id}-${variant.color}-${variant.size}`,
      productId: product.id,
      productName: product.name,
      image: variant.image || product.image,
      color: variant.color,
      size: variant.size,
      quantity,
      price: variant.price || product.price,
      total: (variant.price || product.price) * quantity,
    };
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === cartItem.id);
      if (existingItem) {
        return prevCart.map(item =>
          item.id === cartItem.id
            ? { ...item, quantity: item.quantity + quantity, total: item.total + cartItem.total }
            : item
        );
      }
      return [...prevCart, cartItem];
    });
    toast({
      title: "تمت الإضافة للسلة",
      description: `${product.name} (${variant.color}, ${variant.size})`,
    });
  };

  const removeFromCart = (itemId) => {
    setCart(prevCart => prevCart.filter(item => item.id !== itemId));
  };

  const clearCart = () => {
    setCart([]);
  };

  const createOrder = async (customerInfo, items, trackingNumber = null, discount = 0, source = 'manual') => {
    if (items.length === 0) {
      toast({ title: "خطأ", description: "لا يمكن إنشاء طلب فارغ.", variant: "destructive" });
      return;
    }

    const batch = writeBatch(db);
    const itemsTotal = items.reduce((sum, item) => sum + item.total, 0);
    const finalTotal = itemsTotal + (settings.deliveryFee || 0) - discount;

    const newOrder = {
      customerInfo,
      items,
      subtotal: itemsTotal,
      deliveryFee: settings.deliveryFee || 0,
      discount,
      total: finalTotal,
      status: source === 'ai' ? 'pending_ai_approval' : 'pending',
      source: source,
      createdAt: new Date(),
      trackingNumber: trackingNumber || `RYUS-${Date.now()}`,
      createdBy: user.uid,
    };

    const orderRef = doc(collection(db, 'orders'));
    batch.set(orderRef, newOrder);

    if (newOrder.status !== 'pending_ai_approval') {
        for (const item of items) {
          const productRef = doc(db, 'products', item.productId);
          const productSnap = await getDoc(productRef);
          if (productSnap.exists()) {
            const productData = productSnap.data();
            const variantIndex = productData.variants.findIndex(v => v.color === item.color && v.size === item.size);
            if (variantIndex !== -1) {
              const newQuantity = productData.variants[variantIndex].quantity - item.quantity;
              if (newQuantity < 0) {
                throw new Error(`الكمية غير كافية للمنتج: ${item.productName}`);
              }
              productData.variants[variantIndex].quantity = newQuantity;
              batch.update(productRef, { variants: productData.variants });
            }
          }
        }
    }

    try {
      await batch.commit();
      if (source !== 'ai') {
        toast({ title: "نجاح", description: "تم إنشاء الطلب وتحديث المخزون بنجاح." });
        clearCart();
      }
      return { success: true, orderId: orderRef.id };
    } catch (error) {
      console.error("Error creating order:", error);
      toast({ title: "خطأ", description: `فشل إنشاء الطلب: ${error.message}`, variant: "destructive" });
      throw error;
    }
  };

  const getLowStockProducts = useCallback(() => {
    const lowStock = [];
    products.forEach(product => {
      product.variants.forEach(variant => {
        if (variant.quantity <= (product.minStock || 5)) {
          lowStock.push({
            name: product.name,
            variant: variant,
            stockLevel: variant.quantity,
          });
        }
      });
    });
    return lowStock;
  }, [products]);

  const value = {
    products,
    orders,
    aiOrders,
    purchases,
    cart,
    settings,
    loading,
    addProduct,
    addToCart,
    removeFromCart,
    clearCart,
    createOrder,
    getLowStockProducts,
    updateSettings,
    updateOrder,
    deleteOrders,
  };

  return (
    <InventoryContext.Provider value={value}>
      {children}
    </InventoryContext.Provider>
  );
};