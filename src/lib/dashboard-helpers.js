import { startOfToday, startOfWeek, startOfMonth, startOfYear, subDays, parseISO, endOfMonth, endOfWeek, endOfYear } from 'date-fns';

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

    if (order.status === 'delivered') {
      receivedSales += order.total;
      receivedProfit += orderProfit;
    } else if (order.status !== 'cancelled' && order.status !== 'returned') {
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
    const orderDate = typeof order.createdAt === 'string' ? parseISO(order.createdAt) : order.createdAt;
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

export const getTopCustomers = (orders) => {
  if (!orders) return [];
  const customerCounts = orders.reduce((acc, order) => {
    const customerInfo = order.customerinfo || {};
    if (!customerInfo.phone) {
      return acc; // Skip orders without customer info
    }
    const phone = customerInfo.phone;
    const name = customerInfo.name || 'زبون غير معروف';
    if (!acc[phone]) {
      acc[phone] = { count: 0, name };
    }
    acc[phone].count++;
    return acc;
  }, {});

  return Object.entries(customerCounts)
    .map(([phone, data]) => ({ label: data.name, value: `${data.count} طلبات` }))
    .sort((a, b) => parseInt(b.value) - parseInt(a.value))
    .slice(0, 3);
};

export const getTopProvinces = (orders) => {
  if (!orders) return [];
  const provinceCounts = orders.reduce((acc, order) => {
    const customerInfo = order.customerinfo || {};
    if (!customerInfo.city) {
      return acc; // Skip orders without city info
    }
    const city = customerInfo.city;
    acc[city] = (acc[city] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(provinceCounts)
    .map(([city, count]) => ({ label: city, value: `${count} طلبات` }))
    .sort((a, b) => parseInt(b.value) - parseInt(a.value))
    .slice(0, 3);
};

export const getTopProducts = (orders) => {
  if (!orders) return [];
  const productCounts = orders.reduce((acc, order) => {
    if (!order.items) return acc;
    order.items.forEach(item => {
      acc[item.productName] = (acc[item.productName] || 0) + item.quantity;
    });
    return acc;
  }, {});

  return Object.entries(productCounts)
    .map(([name, count]) => ({ label: name, value: `${count} قطعة` }))
    .sort((a, b) => parseInt(b.value) - parseInt(a.value))
    .slice(0, 3);
};