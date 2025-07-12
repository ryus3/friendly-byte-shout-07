import { db } from '@/lib/firebase';
import { collection, addDoc, doc, writeBatch, getDoc, updateDoc } from 'firebase/firestore';
import { addNotification } from './notifications';

export const addPurchaseToFirestore = async (purchaseData, user, settings, updateSettings) => {
  const batch = writeBatch(db);
  const purchaseRef = doc(collection(db, 'purchases'));

  const newLastPurchaseId = (settings?.lastPurchaseId || 0) + 1;
  const shortId = `INV-${String(newLastPurchaseId).padStart(5, '0')}`;

  batch.set(purchaseRef, {
    ...purchaseData,
    shortId,
    createdAt: new Date(),
    createdBy: user.uid,
  });

  const productUpdates = new Map();

  purchaseData.items.forEach(item => {
    if (!productUpdates.has(item.productId)) {
      productUpdates.set(item.productId, { variants: [] });
    }
    productUpdates.get(item.productId).variants.push({
      sku: item.variantSku,
      quantity: item.quantity,
      costPrice: item.costPrice,
      salePrice: item.salePrice,
      isNew: item.isNewVariant,
      colorId: item.colorId,
      sizeId: item.sizeId,
      color: item.color,
      size: item.size,
      color_hex: item.color_hex,
    });
  });

  try {
    for (const [productId, update] of productUpdates.entries()) {
      const productRef = doc(db, 'products', productId);
      const productSnap = await getDoc(productRef);
      if (productSnap.exists()) {
        const product = productSnap.data();
        const newVariants = [...product.variants];
        let productCostUpdated = false;

        update.variants.forEach(itemUpdate => {
          const variantIndex = newVariants.findIndex(v => v.sku === itemUpdate.sku);
          if (variantIndex > -1) {
            newVariants[variantIndex].quantity += itemUpdate.quantity;
            newVariants[variantIndex].costPrice = itemUpdate.costPrice;
            newVariants[variantIndex].price = itemUpdate.salePrice;
          } else if (itemUpdate.isNew) {
            newVariants.push({
              sku: itemUpdate.sku,
              barcode: itemUpdate.sku,
              color: itemUpdate.color,
              size: itemUpdate.size,
              colorId: itemUpdate.colorId,
              sizeId: itemUpdate.sizeId,
              color_hex: itemUpdate.color_hex,
              quantity: itemUpdate.quantity,
              costPrice: itemUpdate.costPrice,
              price: itemUpdate.salePrice,
              image: null,
              hint: '',
            });
          }
        });
        
        const totalCostOfNewItems = update.variants.reduce((sum, v) => sum + (v.costPrice * v.quantity), 0);
        const totalQuantityOfNewItems = update.variants.reduce((sum, v) => sum + v.quantity, 0);
        if (totalQuantityOfNewItems > 0) {
            const averageCost = totalCostOfNewItems / totalQuantityOfNewItems;
            if (product.costPrice !== averageCost) {
                product.costPrice = averageCost;
                productCostUpdated = true;
            }
        }

        batch.update(productRef, { 
            variants: newVariants,
            ...(productCostUpdated && { costPrice: product.costPrice })
        });
      }
    }

    await batch.commit();
    await updateSettings({ lastPurchaseId: newLastPurchaseId });

    addNotification({
      type: 'purchase_added',
      title: 'تمت إضافة فاتورة شراء جديدة',
      message: `فاتورة من المورد ${purchaseData.supplier} بقيمة ${purchaseData.totalCost.toLocaleString()} د.ع`,
      data: { purchaseId: purchaseRef.id },
    });

    return { success: true, id: purchaseRef.id };
  } catch (error) {
    console.error("Error adding purchase: ", error);
    return { success: false, error: error.message };
  }
};

export const deletePurchaseFromFirestore = async (purchaseId) => {
  // This is a complex operation, as it would require reverting stock.
  // For now, we prevent deletion. A better approach would be to mark as "cancelled".
  console.warn("Deletion of purchases is a sensitive operation and is currently disabled.");
  return { success: false, error: "لا يمكن حذف المشتريات حالياً." };
};

export const deletePurchasesFromFirestore = async (purchaseIds) => {
  console.warn("Deletion of purchases is a sensitive operation and is currently disabled.");
  return { success: false, error: "لا يمكن حذف المشتريات حالياً." };
};