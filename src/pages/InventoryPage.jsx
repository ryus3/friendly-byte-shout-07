
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useInventory } from '@/contexts/InventoryContext';
import { useFilteredProducts } from '@/hooks/useFilteredProducts';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from '@/components/ui/use-toast';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Download, Package, ChevronDown, Archive, Shirt, ShoppingBag, PackageOpen, Crown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import InventoryStats from '@/components/inventory/InventoryStats';
import InventoryFilters from '@/components/inventory/InventoryFilters';
import EditStockDialog from '@/components/inventory/EditStockDialog';
import BarcodeScannerDialog from '@/components/products/BarcodeScannerDialog';
import ReservedStockDialog from '@/components/inventory/ReservedStockDialog';
// تم حذف InventoryPDFGenerator - نستخدم النظام الجديد
import DepartmentOverviewCards from '@/components/inventory/DepartmentOverviewCards';
import ArchivedProductsCard from '@/components/inventory/ArchivedProductsCard';
import Loader from '@/components/ui/loader';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import InventoryItem from '@/components/inventory/InventoryItem';

const InventoryList = ({ items, onEditStock, canEdit, stockFilter, isLoading, onSelectionChange, selectedItems, isMobile }) => {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-20 w-full rounded-lg bg-card border p-3 flex items-center gap-4">
            <Checkbox disabled />
            <div className="w-12 h-12 rounded-md bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-muted" />
              <div className="h-3 w-1/2 rounded bg-muted" />
            </div>
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          </div>
        ))}
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-400 mb-2">لا توجد عناصر</h3>
        <p className="text-gray-500">جرب تغيير معايير البحث أو الفلترة</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-2 max-w-none">
      {items.map(product => (
        <div key={product.id} className="bg-card rounded-lg border">
          <div className="p-4">
            <div className="flex items-center gap-4 mb-4">
              <Checkbox
                checked={selectedItems.includes(product.id)}
                onCheckedChange={(checked) => onSelectionChange(product.id, checked)}
              />
              {product.images?.[0] ? (
                <img src={product.images[0]} alt={product.name} className="w-16 h-16 rounded-md object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-md bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center">
                  <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
              <div className="flex-1">
                <h3 className="font-bold text-lg text-foreground">{product.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {product.variants?.length || 0} متغيرات • إجمالي المخزون: {product.variants?.reduce((sum, v) => sum + (v.quantity || 0), 0) || 0}
                </p>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="grid grid-cols-12 items-center gap-4 p-2 text-sm font-medium text-muted-foreground border-b">
                <div className="col-span-4">المتغير</div>
                <div className="col-span-2 text-center">المخزون</div>
                <div className="col-span-2 text-center">محجوز</div>
                <div className="col-span-2 text-center">متاح</div>
                <div className="col-span-2 text-center">الحالة</div>
              </div>
              {(product.variants || []).map(variant => (
                <InventoryItem
                  key={variant.id}
                  variant={variant}
                  product={product}
                  onEditStock={canEdit ? () => onEditStock(product, variant) : null}
                />
              ))}
              {(!product.variants || product.variants.length === 0) && (
                <div className="text-center py-4 text-muted-foreground">
                  <p>لا توجد متغيرات لهذا المنتج</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};


const InventoryPage = () => {
  const { products: allProducts, orders, loading, settings, updateVariantStock } = useInventory();
  const products = useFilteredProducts(allProducts); // تطبيق فلترة الصلاحيات
  const { allUsers, user } = useAuth();
  const { hasPermission, isAdmin } = usePermissions();
  const [departments, setDepartments] = useState([]);
  
  console.log("📊 صفحة الجرد:", { 
    allProducts: allProducts?.length, 
    filteredProducts: products?.length, 
    loading, 
    user: user?.full_name,
    hasPermission: hasPermission('view_inventory')
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useMediaQuery("(max-width: 768px)");

  const [filters, setFilters] = useState({
    searchTerm: '',
    stockFilter: 'all',
    category: 'all',
    price: [0, 500000],
    color: 'all',
    size: 'all',
    productType: 'all',
    department: 'all',
    seasonOccasion: 'all'
  });
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);
  const [isReservedStockDialogOpen, setIsReservedStockDialogOpen] = useState(false);
  const [selectedItemsForExport, setSelectedItemsForExport] = useState([]);

  useEffect(() => {
    const searchParam = searchParams.get('search');
    const filterParam = searchParams.get('filter');
    const productParam = searchParams.get('product');
    const variantParam = searchParams.get('variant');
    const highlightParam = searchParams.get('highlight');
    
    // إذا جاء من إشعار مع معاملات البحث والفلترة
    if (searchParam || filterParam) {
      setFilters(currentFilters => ({
        ...currentFilters,
        searchTerm: searchParam || currentFilters.searchTerm,
        stockFilter: filterParam === 'low_stock' ? 'low' : filterParam || currentFilters.stockFilter
      }));
    }
    
    // إذا جاء من تنبيه المخزون مع معرف المنتج
    if (productParam && Array.isArray(products)) {
      const product = products.find(p => p?.id === productParam);
      if (product) {
        setFilters(currentFilters => ({
          ...currentFilters, 
          searchTerm: product.name,
          stockFilter: 'low'
        }));
      }
    }
    
    // إذا جاء مع معرف المتغير
    if (variantParam) {
      // البحث عن المتغير والمنتج المحدد
      let foundProduct = null;
      if (Array.isArray(products)) {
        products.forEach(product => {
          if (Array.isArray(product?.variants) && product.variants.some(v => v?.id === variantParam)) {
            foundProduct = product;
          }
        });
      }
      
      if (foundProduct) {
        setFilters(currentFilters => ({
          ...currentFilters,
          searchTerm: foundProduct.name,
          stockFilter: 'low'
        }));
      }
    }
    
    // إذا جاء مع معامل التمييز
    if (highlightParam) {
      setFilters(currentFilters => ({
        ...currentFilters, 
        searchTerm: highlightParam
      }));
    }
  }, [searchParams, products]);

  // جلب بيانات الأقسام
  useEffect(() => {
    fetchDepartmentsData();
  }, []);

  const fetchDepartmentsData = async () => {
    try {
      const { supabase } = await import('@/lib/customSupabaseClient');
      
      // جلب الأقسام الرئيسية
      const { data: deptData, error: deptError } = await supabase
        .from('departments')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (deptError) throw deptError;

      // ترتيب الأقسام حسب الأولوية المطلوبة
      const orderedDepts = [];
      const clothingDept = deptData?.find(d => d.name.includes('ملابس') || d.name.toLowerCase().includes('clothes'));
      const shoesDept = deptData?.find(d => d.name.includes('أحذية') || d.name.toLowerCase().includes('shoes'));
      const generalDept = deptData?.find(d => d.name.includes('مواد عامة') || d.name.includes('عامة') || d.name.toLowerCase().includes('general'));

      // إضافة الأقسام بالترتيب المطلوب
      if (clothingDept) orderedDepts.push({ ...clothingDept, order: 1 });
      if (shoesDept) orderedDepts.push({ ...shoesDept, order: 2 });
      if (generalDept) orderedDepts.push({ ...generalDept, order: 3 });

      // إضافة باقي الأقسام
      const otherDepts = deptData?.filter(d => 
        d !== clothingDept && d !== shoesDept && d !== generalDept
      ) || [];
      
      otherDepts.forEach((dept, index) => {
        orderedDepts.push({ ...dept, order: 4 + index });
      });

      // جلب عدد المنتجات لكل قسم
      const { data: productsData } = await supabase
        .from('product_departments')
        .select('department_id, products(id)')
        .eq('products.is_active', true);

      // حساب عدد المنتجات لكل قسم
      const productCounts = {};
      productsData?.forEach(pd => {
        if (productCounts[pd.department_id]) {
          productCounts[pd.department_id]++;
        } else {
          productCounts[pd.department_id] = 1;
        }
      });

      // إضافة العدد للأقسام
      const deptsWithCounts = orderedDepts.map(dept => ({
        ...dept,
        productCount: productCounts[dept.id] || 0
      }));

      setDepartments(deptsWithCounts);
    } catch (error) {
      console.error('خطأ في جلب بيانات الأقسام:', error);
    }
  };

  // أيقونات للأقسام المختلفة
  const getIconForDepartment = (name, index) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('ملابس') || lowerName.includes('clothes')) return Shirt;
    if (lowerName.includes('حقائب') || lowerName.includes('bag')) return ShoppingBag;
    if (lowerName.includes('أحذية') || lowerName.includes('shoes')) return PackageOpen;
    if (lowerName.includes('إكسسوار') || lowerName.includes('accessories')) return Crown;
    if (lowerName.includes('مواد عامة') || lowerName.includes('عامة')) return Package;
    return Package;
  };

  // ألوان متدرجة للكروت مع تنويع أكبر
  const getGradientForIndex = (index) => {
    const gradients = [
      'from-blue-500 to-blue-700',        // ملابس - أزرق
      'from-orange-500 to-red-600',       // أحذية - برتقالي لأحمر  
      'from-purple-500 to-pink-600',      // مواد عامة - بنفسجي لوردي
      'from-emerald-500 to-teal-600',     // قسم رابع - أخضر لتيل
      'from-yellow-500 to-orange-600',    // قسم خامس - أصفر لبرتقالي
      'from-indigo-500 to-purple-600',    // قسم سادس - نيلي لبنفسجي
      'from-cyan-500 to-blue-600'         // قسم سابع - سماوي
    ];
    
    return gradients[index % gradients.length];
  };

  const allCategories = useMemo(() => {
    if (!Array.isArray(products)) return [];
    const categories = new Set();
    products.forEach(p => {
      if (p?.categories?.main_category) {
        categories.add(p.categories.main_category);
      }
    });
    return Array.from(categories);
  }, [products]);

  const inventoryItems = useMemo(() => {
    console.log("🔍 إنشاء عناصر الجرد:", { 
      allProductsCount: allProducts?.length,
      filteredProductsCount: products?.length, 
      settingsLoaded: !!settings,
      userRole: user?.role,
      firstProduct: allProducts?.[0]?.name,
      hasVariants: allProducts?.[0]?.variants?.length,
      userIsAdmin: isAdmin
    });
    
    // استخدام المنتجات المفلترة حسب صلاحيات المستخدم
    // للمدير: يرى كل المنتجات، للموظفين: فقط المنتجات المرئية
    const productsToUse = isAdmin ? products : products.filter(p => p.is_active !== false);
    
    if (!Array.isArray(productsToUse) || !settings) {
      console.log("❌ بيانات غير مكتملة:", { 
        productsToUse: !!productsToUse, 
        productsToUseLength: productsToUse?.length,
        settings: !!settings 
      });
      return [];
    }
    
    const { lowStockThreshold = 5, mediumStockThreshold = 10 } = settings;

    // معالجة المنتجات مع التفاصيل
    const processedItems = productsToUse.map(product => {
        if (!product) {
          console.log("❌ منتج فارغ");
          return null;
        }
        
        console.log("📦 معالجة منتج:", product.name, "متغيرات:", product.variants?.length);
        
        const variantsWithLevels = Array.isArray(product.variants) 
          ? product.variants.map(variant => {
              if (!variant) return null;
              let stockLevel = 'high';
              const quantity = variant.quantity || 0;
              if (quantity === 0) stockLevel = 'out-of-stock';
              else if (quantity > 0 && quantity <= lowStockThreshold) stockLevel = 'low';
              else if (quantity > 0 && quantity <= mediumStockThreshold) stockLevel = 'medium';
              
              const stockPercentage = Math.min((quantity / (mediumStockThreshold + 5)) * 100, 100);
              return { ...variant, stockLevel, stockPercentage };
            }).filter(v => v !== null)
          : [];

        const totalStock = variantsWithLevels.reduce((acc, v) => acc + (v?.quantity || 0), 0);
        const totalReserved = variantsWithLevels.reduce((acc, v) => acc + (v?.reserved_quantity || 0), 0);
      
        const hasLowStockVariant = variantsWithLevels.some(v => v?.stockLevel === 'low');
        const hasMediumStockVariant = variantsWithLevels.some(v => v?.stockLevel === 'medium');

        let overallStockLevel = 'high';
        if (hasLowStockVariant) overallStockLevel = 'low';
        else if (hasMediumStockVariant) overallStockLevel = 'medium';
        else if (totalStock === 0) overallStockLevel = 'out-of-stock';

        return {
          ...product,
          totalStock,
          totalReserved,
          stockLevel: overallStockLevel,
          variants: variantsWithLevels,
        };
    }).filter(item => item !== null);
    
    console.log("✅ تمت معالجة العناصر:", processedItems.length);
    return processedItems;
  }, [products, settings, user, isAdmin]);
  
  const reservedOrders = useMemo(() => {
    const safeOrders = Array.isArray(orders) ? orders : [];
    const safeUsers = Array.isArray(allUsers) ? allUsers : [];
    return safeOrders
      .filter(o => o.status === 'pending')
      .map(o => {
        // تحويل عناصر الطلب إلى الشكل المطلوب
        const items = (o.order_items || []).map(item => ({
          id: item.id,
          productId: item.product_id,
          variantId: item.variant_id,
          productName: item.products?.name || 'منتج غير معروف',
          quantity: item.quantity,
          price: item.unit_price,
          color: item.product_variants?.colors?.name || 'لون غير محدد',
          size: item.product_variants?.sizes?.name || 'مقاس غير محدد',
          image: (item.product_variants?.images && item.product_variants.images.length > 0) 
            ? item.product_variants.images[0] 
            : (item.products?.images && item.products.images.length > 0)
            ? item.products.images[0]
            : '/placeholder.png'
        }));

        return {
          ...o,
          items,
          employeeName: safeUsers.find(u => u.id === o.created_by)?.full_name || 'غير معروف',
          // إضافة معلومات العميل بشكل صحيح
          customerinfo: {
            name: o.customer_name,
            phone: o.customer_phone,
            address: o.customer_address,
            city: o.customer_city,
            province: o.customer_province
          },
          trackingnumber: o.tracking_number || o.order_number
        };
      });
  }, [orders, allUsers]);

  const filteredItems = useMemo(() => {
    console.log("🔍 بدء الفلترة:", { 
      filters, 
      inventoryItemsCount: inventoryItems?.length,
      departmentFilter: filters.department 
    });
    
    if (!Array.isArray(inventoryItems)) return [];
    let items = [...inventoryItems];

    // تطبيق فلتر الأقسام من الكروت والفلاتر العادية
    if (filters.department && filters.department !== 'all') {
      console.log("🎯 تطبيق فلتر القسم:", filters.department);
      
      items = items.filter(product => {
        // البحث في علاقات الأقسام عبر product_departments
        const hasDepartmentRelation = product.product_departments?.some(pd => 
          pd.department_id === filters.department
        );
        
        // للتوافق: البحث في الحقل المباشر أيضاً
        const hasDirectDepartment = product.department_id === filters.department;
        
        console.log("📦 فحص المنتج:", product.name, {
          productDepts: product.product_departments?.map(pd => pd.department_id),
          directDept: product.department_id,
          targetDept: filters.department,
          hasRelation: hasDepartmentRelation,
          hasDirect: hasDirectDepartment
        });
        
        return hasDepartmentRelation || hasDirectDepartment;
      });
      
      console.log("✅ نتائج فلتر القسم:", items.length, "منتج");
    }

    // إزالة فلتر categoryFilter المضاعف
    // if (categoryFilter) { ... } // تم إزالته لتجنب التعارض

    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      items = items.filter(p =>
        p?.name?.toLowerCase().includes(term) ||
        (p?.sku_base && p.sku_base.toLowerCase().includes(term)) ||
        (Array.isArray(p?.variants) && p.variants.some(v => v?.sku && v.sku.toLowerCase().includes(term)))
      );
    }

    if (filters.category !== 'all') {
      items = items.filter(p => p?.categories?.main_category === filters.category);
    }
    
    if (filters.productType !== 'all') {
      items = items.filter(p => p?.categories?.product_type === filters.productType);
    }
    
    // تم إزالة فلترة القسم المضاعفة لأنها تعارض الفلترة الصحيحة أعلاه
    // if (filters.department !== 'all') {
    //   items = items.filter(p => p?.categories?.department === filters.department);
    // }
    
    if (filters.seasonOccasion !== 'all') {
      items = items.filter(p => p?.categories?.season_occasion === filters.seasonOccasion);
    }
    
    if (filters.color !== 'all') {
      items = items.filter(p => Array.isArray(p?.variants) && p.variants.some(v => v?.color === filters.color));
    }
    
    if (filters.size !== 'all') {
      items = items.filter(p => Array.isArray(p?.variants) && p.variants.some(v => v?.size === filters.size));
    }

    if (filters.price && (filters.price[0] > 0 || filters.price[1] < 500000)) {
      items = items.filter(p => Array.isArray(p?.variants) && p.variants.some(v => v?.price >= filters.price[0] && v?.price <= filters.price[1]));
    }

    if (filters.stockFilter !== 'all') {
      if (filters.stockFilter === 'reserved') {
        items = items.filter(item => (item?.totalReserved || 0) > 0);
      } else if (filters.stockFilter === 'out-of-stock') {
        items = items.filter(item => Array.isArray(item?.variants) && item.variants.some(v => (v?.quantity || 0) === 0));
      } else if (filters.stockFilter === 'archived') {
        items = items.filter(item => 
          Array.isArray(item?.variants) && item.variants.length > 0 && 
          item.variants.every(v => (v?.quantity || 0) === 0)
        );
      } else {
        items = items.filter(item => Array.isArray(item?.variants) && item.variants.some(v => v?.stockLevel === filters.stockFilter));
      }
    }

    return items;
  }, [inventoryItems, filters, categoryFilter]);

  const inventoryStats = useMemo(() => {
      if (!Array.isArray(inventoryItems)) return {
        lowStockCount: 0,
        mediumStockCount: 0,
        highStockCount: 0,
        reservedStockCount: 0,
        totalVariants: 0,
      };
      
      const variants = inventoryItems.flatMap(item => Array.isArray(item?.variants) ? item.variants : []);
      return {
          lowStockCount: variants.filter(v => v?.stockLevel === 'low').length,
          mediumStockCount: variants.filter(v => v?.stockLevel === 'medium').length,
          highStockCount: variants.filter(v => v?.stockLevel === 'high').length,
          reservedStockCount: inventoryItems.reduce((sum, item) => sum + (item?.totalReserved || 0), 0),
          totalVariants: variants.length,
      };
  }, [inventoryItems]);

  const handleEditStock = (product, variant) => {
    setEditingItem({ product, variant });
    setIsEditDialogOpen(true);
  };

  const handleFilterChange = useCallback((stockLevel) => {
    if (stockLevel === 'reserved') {
      setIsReservedStockDialogOpen(true);
    } else {
      setFilters(currentFilters => ({ ...currentFilters, stockFilter: stockLevel }));
    }
  }, []);



  const handleBarcodeScan = (decodedText) => {
    // البحث السريع في المنتجات
    const foundProduct = products.find(p => 
      p.variants?.some(v => 
        v.sku === decodedText || 
        v.barcode === decodedText ||
        v.id?.toString() === decodedText
      )
    );
    
    if (foundProduct) {
      const foundVariant = foundProduct.variants.find(v => 
        v.sku === decodedText || 
        v.barcode === decodedText ||
        v.id?.toString() === decodedText
      );
      
      // تحديد المنتج الموجود في القائمة
      setSelectedItemsForExport(prev => {
        const currentItems = Array.isArray(prev) ? [...prev] : [];
        if (!currentItems.includes(foundProduct.id)) {
          return [...currentItems, foundProduct.id];
        }
        return currentItems;
      });
      
      // عرض تفاصيل المنتج
      toast({ 
        title: "✅ تم العثور على المنتج", 
        description: `${foundProduct.name} - ${foundVariant?.color} ${foundVariant?.size} (المخزون: ${foundVariant?.quantity || 0})`,
        variant: "success"
      });
    } else {
      // البحث بالنص العادي
      setFilters(prev => ({ ...prev, searchTerm: decodedText }));
      toast({ 
        title: "🔍 تم البحث", 
        description: `البحث عن: ${decodedText}` 
      });
    }
    
    // عدم إغلاق المسح للمسح المستمر
    // setIsBarcodeScannerOpen(false);
  };

  const handleSelectionChange = (productId, isSelected) => {
    setSelectedItemsForExport(prev => {
      const currentItems = Array.isArray(prev) ? [...prev] : [];
      if (isSelected) {
        if (!currentItems.includes(productId)) {
          return [...currentItems, productId];
        }
        return currentItems;
      } else {
        return currentItems.filter(id => id !== productId);
      }
    });
  };

  if (loading) {
    console.log("⏳ جاري التحميل...");
    return <div className="flex h-full w-full items-center justify-center"><Loader /></div>;
  }

  console.log("✅ عرض صفحة الجرد مع:", { 
    inventoryItemsCount: inventoryItems?.length,
    filteredItemsCount: filteredItems?.length,
    statsReady: !!inventoryStats
  });

  return (
    <>
      <Helmet>
        <title>الجرد التفصيلي - نظام RYUS</title>
        <meta name="description" content="عرض وإدارة المخزون بشكل تفصيلي." />
      </Helmet>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">الجرد المفصل</h1>
            <p className="text-muted-foreground mt-1">إدارة مخزون جميع المنتجات والمقاسات</p>
          </div>
          
          <div className="flex gap-3">
            {/* تم استبدال نظام PDF القديم بنظام التقارير الجديد */}
          </div>
        </div>
        
        <InventoryStats
          inventoryItems={inventoryItems}
          lowStockCount={inventoryStats.lowStockCount}
          reservedStockCount={inventoryStats.reservedStockCount}
          onFilterChange={handleFilterChange}
          onViewArchive={() => setFilters(prev => ({ ...prev, stockFilter: 'archived' }))}
          onRestoreProduct={() => console.log('restore product')}
        />

        {/* صف موحد للأرشيف وكروت الأقسام */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* كروت الأقسام أولاً */}
          {departments.map((dept, index) => {
            const IconComponent = getIconForDepartment(dept.name, index);
            const gradientClass = getGradientForIndex(index);
            
            return (
              <Card 
                key={dept.id}
                className="cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl relative overflow-hidden"
                onClick={() => {
                  console.log("🔍 تم الضغط على القسم:", dept.name, "معرف:", dept.id);
                  setFilters(prev => ({ 
                    ...prev, 
                    department: dept.id, // استخدام معرف القسم بدلاً من الاسم
                    searchTerm: '', // مسح البحث عند تغيير القسم
                    stockFilter: 'all' // إعادة تعيين فلتر المخزون
                  }));
                  // إزالة categoryFilter لتجنب التعارض
                }}
              >
                <CardContent className="p-6">
                  <div className={`text-center space-y-4 bg-gradient-to-br ${gradientClass} text-white rounded-lg p-6 relative overflow-hidden`}>
                    {/* رقم القسم */}
                    <div className="absolute top-2 right-2">
                      <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs">
                        {dept.order}
                      </Badge>
                    </div>
                    
                    {/* الأيقونة */}
                    <div className="flex justify-center">
                      <div className="p-3 bg-white/10 rounded-full backdrop-blur-sm">
                        <IconComponent className="w-8 h-8" />
                      </div>
                    </div>
                    
                    {/* اسم القسم */}
                    <div>
                      <h4 className="font-bold text-lg">{dept.name}</h4>
                      {dept.description && (
                        <p className="text-xs opacity-90 mt-1">{dept.description}</p>
                      )}
                    </div>
                    
                    {/* عدد المنتجات */}
                    <div className="flex items-center justify-between pt-2 border-t border-white/20">
                      <div className="text-right">
                        <p className="text-xl font-bold">{dept.productCount}</p>
                        <p className="text-white/80 text-xs">منتج</p>
                      </div>
                      <div className="flex items-center gap-1 text-white/70">
                        <Package className="w-4 h-4" />
                        <span className="text-xs">متاح</span>
                      </div>
                    </div>
                    
                    {/* تأثير الخلفية */}
                    <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-white/5 rounded-full"></div>
                    <div className="absolute -top-2 -left-2 w-12 h-12 bg-white/5 rounded-full"></div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          
          {/* كارت الأرشيف على اليسار */}
          <Card className="cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl relative overflow-hidden"
                onClick={() => setFilters(prev => ({ ...prev, stockFilter: 'archived' }))}>
            <CardContent className="p-6">
              <div className="text-center space-y-4 bg-gradient-to-br from-slate-600 to-slate-800 text-white rounded-lg p-6 relative overflow-hidden">
                {/* أيقونة الأرشيف */}
                <div className="flex justify-center">
                  <div className="p-3 bg-white/10 rounded-full backdrop-blur-sm">
                    <Archive className="w-8 h-8" />
                  </div>
                </div>
                
                {/* عنوان الأرشيف */}
                <div>
                  <h4 className="font-bold text-lg">أرشيف المنتجات</h4>
                  <p className="text-xs opacity-90 mt-1">المنتجات النافذة والمؤرشفة</p>
                </div>
                
                {/* عدد المنتجات المؤرشفة */}
                <div className="flex items-center justify-between pt-2 border-t border-white/20">
                  <div className="text-right">
                    <p className="text-xl font-bold">{inventoryItems.filter(item => 
                      item.variants && item.variants.length > 0 && 
                      item.variants.every(v => (v.quantity || 0) === 0)
                    ).length}</p>
                    <p className="text-white/80 text-xs">مؤرشف</p>
                  </div>
                  <div className="flex items-center gap-1 text-white/70">
                    <span className="text-xs">عرض الأرشيف</span>
                  </div>
                </div>
                
                {/* تأثير الخلفية */}
                <div className="absolute -bottom-4 -right-4 w-16 h-16 bg-white/5 rounded-full"></div>
                <div className="absolute -top-2 -left-2 w-12 h-12 bg-white/5 rounded-full"></div>
              </div>
            </CardContent>
          </Card>
        </div>

        <InventoryFilters
          filters={filters}
          setFilters={setFilters}
          categories={allCategories}
          onBarcodeSearch={() => setIsBarcodeScannerOpen(true)}
        />

        <InventoryList
          items={filteredItems}
          isLoading={loading}
          onEditStock={handleEditStock}
          canEdit={hasPermission('edit_stock')}
          stockFilter={filters.stockFilter}
          onSelectionChange={handleSelectionChange}
          selectedItems={selectedItemsForExport}
          isMobile={isMobile}
        />
      </div>

      {editingItem && (
        <EditStockDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          item={editingItem}
          onSuccess={() => {
            // This will trigger a re-fetch in InventoryContext
          }}
        />
      )}

      <BarcodeScannerDialog
        open={isBarcodeScannerOpen}
        onOpenChange={setIsBarcodeScannerOpen}
        onScanSuccess={handleBarcodeScan}
      />
      
      <ReservedStockDialog
        open={isReservedStockDialogOpen}
        onOpenChange={setIsReservedStockDialogOpen}
        reservedOrders={reservedOrders}
        allUsers={allUsers}
      />
    </>
  );
};

export default InventoryPage;
