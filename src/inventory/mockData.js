import { subDays } from 'date-fns';

export const generateMockProducts = (count = 50) => {
  const products = [];
  const colors = ['أحمر', 'أزرق', 'أخضر', 'أسود', 'أبيض', 'رمادي', 'أصفر'];
  const sizes = ['S', 'M', 'L', 'XL', 'XXL'];
  const categories = ['ملابس رجالية', 'ملابس نسائية', 'أحذية', 'إكسسوارات', 'أطفال'];
  const brands = ['RYUS', 'Brand B', 'Brand C', 'Brand D'];

  for (let i = 1; i <= count; i++) {
    const price = Math.floor(Math.random() * 100 + 10) * 1000;
    const variants = [];
    const numColors = Math.floor(Math.random() * 3) + 1;
    const productColors = [...colors].sort(() => 0.5 - Math.random()).slice(0, numColors);
    
    productColors.forEach(color => {
      sizes.forEach(size => {
        let quantity = Math.floor(Math.random() * 50);
        
        if (i === 2) {
          quantity = 0;
          if (color === productColors[0] && size === 'S') quantity = 1;
          if (color === productColors[0] && size === 'M') quantity = 1;
          if (color === productColors[0] && size === 'L') quantity = 1;
        }

        variants.push({
          id: `var-${i}-${color.substring(0,2)}-${size}`,
          color,
          size,
          quantity: quantity,
          reserved: Math.floor(Math.random() * 5),
          price,
          costPrice: price * (0.6 + Math.random() * 0.1),
          sku: `SKU-${i}-${color.substring(0,2)}-${size}`,
          barcode: `BC-${i}-${color.substring(0,2)}-${size}`,
          image: `https://picsum.photos/seed/${i}${color}/400/400`,
        });
      });
    });

    products.push({
      id: `prod_${i}`,
      name: `منتج تجريبي ${i}`,
      brand: brands[i % brands.length],
      image: `https://picsum.photos/seed/${i}/400/400`,
      images: [`https://picsum.photos/seed/${i}/400/400`, `https://picsum.photos/seed/${i+100}/400/400`],
      categories: { main_category: categories[i % categories.length] },
      variants,
      minStock: 5,
    });
  }
  return products;
};

export const generateMockOrders = (count = 30) => {
    const orders = [];
    const statuses = ['pending', 'shipped', 'delivered', 'cancelled', 'processing', 'returned'];
    for(let i=1; i<=count; i++) {
        const total = Math.floor(Math.random() * 200 + 50) * 1000;
        orders.push({
            id: `order_${i}`,
            trackingNumber: `RYUS-${Math.floor(Math.random()*90000) + 10000}`,
            customerInfo: {
                name: `زبون ${i}`,
                phone: `0770000000${i.toString().padStart(2,'0')}`,
                address: `عنوان تجريبي ${i}`,
                city: 'بغداد'
            },
            items: [{
                productId: 'prod_1', productName: 'منتج 1', color: 'أحمر', size: 'M', quantity: 2, price: 25000, costPrice: 15000, total: 50000, image: 'https://picsum.photos/seed/1/100/100'
            }],
            total: total,
            status: statuses[i % statuses.length],
            createdAt: new Date(subDays(new Date(), Math.floor(Math.random() * 30))),
            createdBy: 'local_admin_id',
        })
    }
    return orders;
}

export const generateEmployeeOrders = () => {
    const employeeId = 'local_employee_id_1';
    return [
        {
            id: `order_emp_1`,
            trackingNumber: `RYUS-EMP-1001`,
            customerInfo: { name: `زبون الموظف 1`, phone: `07812345678`, address: `عنوان تجريبي`, city: 'بغداد' },
            items: [{ productId: 'prod_3', productName: 'منتج تجريبي 3', color: 'أزرق', size: 'L', quantity: 1, price: 30000, costPrice: 18000, total: 30000 }],
            total: 35000,
            status: 'pending',
            createdAt: new Date(subDays(new Date(), 2)),
            createdBy: employeeId,
            profitStatus: 'pending_settlement'
        },
        {
            id: `order_emp_2`,
            trackingNumber: `RYUS-EMP-1002`,
            customerInfo: { name: `زبون الموظف 2`, phone: `07823456789`, address: `عنوان تجريبي آخر`, city: 'البصرة' },
            items: [{ productId: 'prod_5', productName: 'منتج تجريبي 5', color: 'أسود', size: 'M', quantity: 2, price: 45000, costPrice: 25000, total: 90000 }],
            total: 95000,
            status: 'shipped',
            createdAt: new Date(subDays(new Date(), 5)),
            createdBy: employeeId,
            profitStatus: 'pending_settlement'
        },
        {
            id: `order_emp_3`,
            trackingNumber: `RYUS-EMP-1003`,
            customerInfo: { name: `زبون الموظف 3`, phone: `07834567890`, address: `عنوان ثالث`, city: 'أربيل' },
            items: [{ productId: 'prod_7', productName: 'منتج تجريبي 7', color: 'أبيض', size: 'S', quantity: 1, price: 20000, costPrice: 12000, total: 20000 }],
            total: 25000,
            status: 'returned',
            createdAt: new Date(subDays(new Date(), 10)),
            createdBy: employeeId,
            profitStatus: 'settled'
        },
        {
            id: `order_emp_4`,
            trackingNumber: `RYUS-EMP-1004`,
            customerInfo: { name: `زبون الموظف 4`, phone: `07845678901`, address: `عنوان رابع`, city: 'الموصل' },
            items: [
                { productId: 'prod_10', productName: 'منتج تجريبي 10', color: 'أخضر', size: 'XL', quantity: 1, price: 50000, costPrice: 30000, total: 50000 },
                { productId: 'prod_12', productName: 'منتج تجريبي 12', color: 'رمادي', size: 'M', quantity: 1, price: 22000, costPrice: 15000, total: 22000 }
            ],
            total: 77000,
            status: 'delivered',
            createdAt: new Date(subDays(new Date(), 3)),
            createdBy: employeeId,
            profitStatus: 'pending_settlement'
        }
    ];
};