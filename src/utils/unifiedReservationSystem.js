/**
 * نظام الحجز الموحد - حساب الكميات المحجوزة الحقيقية
 * يحسب المخزون المحجوز بناءً على الطلبات النشطة
 */

/**
 * حساب الكمية المحجوزة لمتغير منتج معين
 * @param {string} variantId - معرف المتغير
 * @param {Array} orders - قائمة الطلبات
 * @returns {number} الكمية المحجوزة
 */
export const calculateReservedQuantityForVariant = (variantId, orders = []) => {
  if (!variantId || !Array.isArray(orders)) return 0;

  const activeOrderStatuses = ['pending', 'shipped', 'in_delivery'];
  
  return orders.reduce((totalReserved, order) => {
    // استبعاد طلبات الإرجاع من الحجز
    if (order.order_type === 'return') return totalReserved;
    
    // تحقق من أن الطلب يحجز مخزون
    if (!activeOrderStatuses.includes(order.status)) return totalReserved;
    
    // حساب الكمية المحجوزة من هذا الطلب لهذا المتغير
    const orderItems = order.order_items || order.items || [];
    const reservedFromThisOrder = orderItems.reduce((orderReserved, item) => {
      // استبعاد المنتجات الواردة (incoming) من الحجز
      if (item.item_direction === 'incoming') return orderReserved;
      
      if (item.variant_id === variantId) {
        return orderReserved + (item.quantity || 0);
      }
      return orderReserved;
    }, 0);
    
    return totalReserved + reservedFromThisOrder;
  }, 0);
};

/**
 * حساب إحصائيات المخزون لجميع المتغيرات
 * @param {Array} products - المنتجات
 * @param {Array} orders - الطلبات
 * @returns {Object} إحصائيات المخزون
 */
export const calculateInventoryStats = (products = [], orders = []) => {
  let totalProducts = 0;
  let reservedStock = 0;
  let lowStock = 0;
  let mediumStock = 0;
  let highStock = 0;
  let outOfStock = 0;

  products.forEach(product => {
    const variants = product.variants || product.product_variants || [];
    
    variants.forEach(variant => {
      totalProducts++;
      
      const stock = variant.quantity || 0;
      const reserved = calculateReservedQuantityForVariant(variant.id, orders);
      const available = Math.max(0, stock - reserved);
      
      if (reserved > 0) reservedStock += reserved;
      
      if (stock === 0) {
        outOfStock++;
      } else if (available <= 5) {
        lowStock++;
      } else if (available <= 10) {
        mediumStock++;
      } else {
        highStock++;
      }
    });
  });

  return {
    totalProducts,
    reservedStock,
    lowStock,
    mediumStock,
    highStock,
    outOfStock
  };
};

/**
 * تحديث المنتجات مع الكميات المحجوزة الحقيقية
 * @param {Array} products - المنتجات
 * @param {Array} orders - الطلبات
 * @returns {Array} المنتجات مع الكميات المحجوزة المحدثة
 */
export const updateProductsWithReservations = (products = [], orders = []) => {
  return products.map(product => ({
    ...product,
    variants: (product.variants || []).map(variant => {
      const reserved = calculateReservedQuantityForVariant(variant.id, orders);
      const available = Math.max(0, (variant.quantity || 0) - reserved);
      
      return {
        ...variant,
        reserved_quantity: reserved,
        available_quantity: available
      };
    }),
    product_variants: (product.product_variants || []).map(variant => {
      const reserved = calculateReservedQuantityForVariant(variant.id, orders);
      const available = Math.max(0, (variant.quantity || 0) - reserved);
      
      return {
        ...variant,
        reserved_quantity: reserved,
        available_quantity: available
      };
    })
  }));
};