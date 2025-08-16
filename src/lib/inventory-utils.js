// أدوات موحدة للمخزون لضمان تطابق الحسابات في جميع الصفحات

export const getVariantInventoryObject = (variant) => {
  // قد يأتي ككائن مباشر أو كمصفوفة من صف واحد
  const invObj = Array.isArray(variant?.inventory) ? variant.inventory[0] : variant?.inventory;
  return invObj || null;
};

export const getVariantReserved = (variant) => {
  const invObj = getVariantInventoryObject(variant);
  const reserved = Number(
    (invObj?.reserved_quantity ?? invObj?.reserved_stock ??
     variant?.reserved_quantity ?? variant?.reserved_stock ?? variant?.reserved)
  ) || 0;
  return reserved < 0 ? 0 : reserved;
};

export const getVariantQuantity = (variant) => {
  const invObj = getVariantInventoryObject(variant);
  const qty = Number(invObj?.quantity ?? variant?.quantity) || 0;
  return qty < 0 ? 0 : qty;
};

export const getProductReserved = (product) => {
  if (!product?.variants || !Array.isArray(product.variants)) return 0;
  return product.variants.reduce((sum, v) => sum + getVariantReserved(v), 0);
};
