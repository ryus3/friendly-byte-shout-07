import { startOfToday, startOfWeek, startOfMonth, startOfYear, subDays, parseISO, endOfMonth, endOfWeek, endOfYear } from 'date-fns';
import { normalizePhone, extractOrderPhone } from '@/utils/phoneUtils';

export const filterOrdersByPeriod = (orders, period, returnDateRange = false) => {
  const now = new Date();
  let startDate, endDate = now;

  switch (period) {
    case 'today':
      startDate = startOfToday();
      endDate = new Date(); // end of today
      break;
    case 'week':
      startDate = startOfWeek(now, { weekStartsOn: 0 }); // Sunday
      endDate = endOfWeek(now, { weekStartsOn: 0 });
      break;
    case 'month':
      startDate = startOfMonth(now);
      endDate = endOfMonth(now);
      break;
    case 'year':
      startDate = startOfYear(now);
      endDate = endOfYear(now);
      break;
    default:
       if (returnDateRange) return { from: null, to: null };
      return orders;
  }

  if (returnDateRange) {
    return { from: startDate, to: endDate };
  }

  return orders.filter(order => {
    const createdAt = order.created_at || order.createdAt;
    if (!createdAt) return false;
    // Handle both ISO strings and Date objects
    const orderDate = typeof createdAt === 'string' ? parseISO(createdAt) : createdAt;
    // Additional safety check for valid date
    if (!orderDate || isNaN(orderDate.getTime())) return false;
    return orderDate >= startDate && orderDate <= endDate;
  });
};

export const calculateStats = (orders, products, period) => {
  const filteredOrders = filterOrdersByPeriod(orders, period);

  let receivedProfit = 0;
  let pendingProfit = 0;
  let receivedSales = 0;
  let pendingSales = 0;

  const productCosts = products.reduce((acc, product) => {
    product.variants.forEach(variant => {
      const cost = variant.cost || variant.price * 0.7; // Assume 70% cost if not specified
      acc[`${product.id}-${variant.color}-${variant.size}`] = cost;
    });
    return acc;
  }, {});

  filteredOrders.forEach(order => {
    let orderCost = 0;
    order.items.forEach(item => {
      const itemKey = `${item.productId}-${item.color}-${item.size}`;
      orderCost += (productCosts[itemKey] || item.price * 0.7) * item.quantity;
    });

    const orderProfit = order.total - orderCost;

    if (order.receipt_received === true) {
      receivedSales += order.total;
      receivedProfit += orderProfit;
    } else if (order.status !== 'cancelled' && order.status !== 'returned' && order.status !== 'returned_in_stock') {
      pendingSales += order.total;
      pendingProfit += orderProfit;
    }
  });

  const chartData = generateChartData(filteredOrders, productCosts, period);

  return {
    receivedProfit,
    pendingProfit,
    receivedSales,
    pendingSales,
    chartData,
  };
};

const generateChartData = (orders, productCosts, period) => {
  const days = period === 'week' ? 7 : 30;
  const dataPoints = Array.from({ length: days }, (_, i) => {
    const date = subDays(new Date(), days - 1 - i);
    return {
      date: date.toLocaleDateString('ar-SA', { day: '2-digit', month: '2-digit' }),
      sales: 0,
      profit: 0,
    };
  });

  orders.forEach(order => {
    const createdAt = order.createdAt || order.created_at;
    if (!createdAt) return;
    const orderDate = typeof createdAt === 'string' ? parseISO(createdAt) : createdAt;
    if (!orderDate || isNaN(orderDate.getTime())) return;
    const diffDays = Math.floor((new Date() - orderDate) / (1000 * 60 * 60 * 24));
    
    if (diffDays < days) {
      const index = days - 1 - diffDays;
      if (dataPoints[index]) {
        let orderCost = 0;
        order.items.forEach(item => {
          const itemKey = `${item.productId}-${item.color}-${item.size}`;
          orderCost += (productCosts[itemKey] || item.price * 0.7) * item.quantity;
        });
        
        if (order.status === 'delivered') {
          dataPoints[index].sales += order.total;
          dataPoints[index].profit += (order.total - orderCost);
        }
      }
    }
  });

  return {
    sales: dataPoints.map(d => ({ name: d.date, value: d.sales })),
    profit: dataPoints.map(d => ({ name: d.date, value: d.profit })),
  };
};

export const getUniqueCustomerCount = (orders) => {
  const customerPhones = new Set(orders.map(order => order.customerinfo?.phone).filter(Boolean));
  return customerPhones.size;
};

// دالة تطبيع رقم الهاتف (موحّدة مع النظام)
const normalizePhoneNumber = (phone) => {
  return normalizePhone(phone) || null;
};

export const getTopCustomers = (orders) => {
  if (!orders || orders.length === 0) {
    console.log('⚠️ لا توجد طلبات للزبائن');
    return [];
  }
  
  console.log('📊 تحليل الزبائن - إجمالي الطلبات:', orders.length);
  console.log('📊 أول طلب في المصفوفة:', orders[0]);
  
  // فلترة الطلبات الموصلة أو المكتملة واستبعاد المرجعة والملغية
  const deliveredOrders = orders.filter(order => {
    const hasReceipt = !!order.receipt_received;
    const isReturnedOrCancelled = order.status === 'returned' || 
                                 order.status === 'cancelled' ||
                                 order.status === 'returned_in_stock' ||
                                 order.isArchived === true;
    return hasReceipt && !isReturnedOrCancelled;
  });
  
  console.log('✅ الطلبات المكتملة:', deliveredOrders.length);
  console.log('📊 عينة من الطلبات المكتملة:', deliveredOrders.slice(0, 3));
  
  if (deliveredOrders.length === 0) {
    console.log('⚠️ لا توجد طلبات مكتملة للزبائن!');
    return [];
  }
  
  const customerCounts = deliveredOrders.reduce((acc, order) => {
    const rawPhone = extractOrderPhone(order);
    const phone = normalizePhone(rawPhone);
    const name = order.customer_name || 
                 order.client_name || 
                 order.name ||
                 order.customerinfo?.name || 
                 'زبون غير محدد';
    
    // حساب الإيرادات من الطلب
    const orderRevenue = order.final_amount || order.total_amount || order.total || 0;
    
    console.log(`📞 الطلب ${order.id}: الهاتف الخام = "${rawPhone}", المطبع = "${phone}", الاسم = "${name}", الإيرادات = ${orderRevenue}`);
    
    if (!phone) {
      console.log('⚠️ رقم هاتف غير صالح، تجاهل الطلب');
      return acc;
    }
    
    if (!acc[phone]) {
      acc[phone] = { count: 0, name, phone, totalRevenue: 0 };
    }
    acc[phone].count++;
    acc[phone].totalRevenue += orderRevenue;
    return acc;
  }, {});

  const result = Object.entries(customerCounts)
    .map(([phone, data]) => ({ 
      label: data.name, 
      value: `${data.count} طلب`,
      phone: phone,
      orderCount: data.count,
      totalRevenue: data.totalRevenue,
      avgOrderValue: data.count > 0 ? data.totalRevenue / data.count : 0
    }))
    .sort((a, b) => b.orderCount - a.orderCount)
    .slice(0, 10); // زيادة العدد لعرض المزيد في النافذة
    
  console.log('📈 أفضل 3 زبائن:', result);
  return result;
};

export const getTopProvinces = (orders) => {
  if (!orders) {
    console.log('⚠️ لا توجد طلبات للمحافظات');
    return [];
  }
  
  console.log('🏙️ تحليل المحافظات - إجمالي الطلبات:', orders.length);
  
  // فلترة الطلبات الموصلة أو المكتملة واستبعاد المرجعة والملغية
  const deliveredOrders = orders.filter(order => {
    const hasReceipt = !!order.receipt_received;
    const isReturnedOrCancelled = order.status === 'returned' || 
                                 order.status === 'cancelled' ||
                                 order.status === 'returned_in_stock' ||
                                 order.isArchived === true;
    return hasReceipt && !isReturnedOrCancelled;
  });
  
  console.log('🏙️ الطلبات المكتملة للمحافظات:', deliveredOrders.length);
  console.log('🏙️ عينة من الطلبات المكتملة:', deliveredOrders.slice(0, 3));
  
  if (deliveredOrders.length === 0) {
    console.log('⚠️ لا توجد طلبات مكتملة للمحافظات!');
    return [];
  }
  
  const provinceCounts = deliveredOrders.reduce((acc, order) => {
    const city = order.customer_city || order.customer_province || 'غير محدد';
    const orderRevenue = order.final_amount || order.total_amount || order.total || 0;
    
    console.log(`🏙️ الطلب ${order.id}: المدينة = "${city}", الإيرادات = ${orderRevenue}`);
    
    if (!acc[city]) {
      acc[city] = { count: 0, totalRevenue: 0 };
    }
    acc[city].count++;
    acc[city].totalRevenue += orderRevenue;
    return acc;
  }, {});
  
  console.log('🏙️ إحصائيات المحافظات:', provinceCounts);

  return Object.entries(provinceCounts)
    .map(([city, data]) => ({ 
      label: city, 
      value: `${data.count} طلبات`,
      orders_count: data.count,
      total_revenue: data.totalRevenue
    }))
    .sort((a, b) => b.orders_count - a.orders_count)
    .slice(0, 10); // زيادة العدد للنافذة
};

export const getTopProducts = (orders) => {
  if (!orders) {
    console.log('⚠️ لا توجد طلبات للمنتجات');
    return [];
  }
  
  console.log('📦 تحليل المنتجات - إجمالي الطلبات:', orders.length);
  
  // فلترة الطلبات الموصلة أو المكتملة واستبعاد المرجعة والملغية
  const deliveredOrders = orders.filter(order => {
    const hasReceipt = !!order.receipt_received;
    const isReturnedOrCancelled = order.status === 'returned' || 
                                 order.status === 'cancelled' ||
                                 order.status === 'returned_in_stock' ||
                                 order.isArchived === true;
    return hasReceipt && !isReturnedOrCancelled;
  });
  
  console.log('📦 الطلبات المكتملة للمنتجات:', deliveredOrders.length);
  console.log('📦 عينة من الطلبات المكتملة:', deliveredOrders.slice(0, 3));
  
  if (deliveredOrders.length === 0) {
    console.log('⚠️ لا توجد طلبات مكتملة للمنتجات!');
    return [];
  }
  
  const productCounts = deliveredOrders.reduce((acc, order) => {
    // دعم كلاً من order.items و order.order_items
    const items = order.order_items || order.items || [];
    const orderTotal = order.final_amount || order.total_amount || order.total || 0;
    
    if (!Array.isArray(items) || items.length === 0) {
      console.log(`📦 الطلب ${order.id}: لا يحتوي على عناصر`);
      return acc;
    }
    
    console.log(`📦 الطلب ${order.id}: يحتوي على ${items.length} عنصر، إجمالي = ${orderTotal}`);
    items.forEach(item => {
      // دعم أسماء مختلفة للمنتج
      const productName = item.products?.name || item.product_name || item.name || 'منتج غير محدد';
      const quantity = parseInt(item.quantity) || 1;
      const itemPrice = item.unit_price || item.price || 0;
      const itemRevenue = itemPrice * quantity;
      
      console.log(`📦 المنتج: ${productName}, الكمية: ${quantity}, الإيرادات: ${itemRevenue}`);
      
      if (!acc[productName]) {
        acc[productName] = { quantity: 0, revenue: 0, orders: 0 };
      }
      acc[productName].quantity += quantity;
      acc[productName].revenue += itemRevenue;
      acc[productName].orders++;
    });
    return acc;
  }, {});
  
  console.log('📦 إحصائيات المنتجات:', productCounts);

  return Object.entries(productCounts)
    .map(([name, data]) => ({ 
      label: name, 
      value: `${data.quantity} قطعة`,
      orders_count: data.orders,
      total_revenue: data.revenue,
      quantity: data.quantity
    }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10); // زيادة العدد للنافذة
};