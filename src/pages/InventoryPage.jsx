
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useInventory } from '@/contexts/InventoryContext';
import { useFilteredProducts } from '@/hooks/useFilteredProducts';
import { useAuth } from '@/contexts/UnifiedAuthContext';
import { useVariants } from '@/contexts/VariantsContext';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from '@/components/ui/use-toast';
import { useSearchParams } from 'react-router-dom';
import { scrollToTopInstant } from '@/utils/scrollToTop';
import { Button } from '@/components/ui/button';
import { Download, Package, ChevronDown, Archive, Shirt, ShoppingBag, PackageOpen, Crown, QrCode } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import InventoryStats from '@/components/inventory/InventoryStats';
import InventoryFilters from '@/components/inventory/InventoryFilters';
import EditStockDialog from '@/components/inventory/EditStockDialog';
import BarcodeScannerDialog from '@/components/products/BarcodeScannerDialog';
import ReservedStockDialog from '@/components/inventory/ReservedStockDialog';

import UnifiedInventoryStats from '@/components/inventory/UnifiedInventoryStats';
import ArchivedProductsCard from '@/components/inventory/ArchivedProductsCard';
import Loader from '@/components/ui/loader';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import InventoryItem from '@/components/inventory/InventoryItem';
import { generateInventoryReportPDF } from '@/utils/pdfGenerator';
import { supabase } from '@/lib/customSupabaseClient';

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
      <Accordion type="multiple" className="w-full">
        {items.map(product => (
          <AccordionItem key={product.id} value={product.id} className="bg-card rounded-lg border mb-2">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-4 w-full">
                <Checkbox
                  checked={selectedItems.includes(product.id)}
                  onCheckedChange={(checked) => {
                    onSelectionChange(product.id, checked);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                {product.images?.[0] ? (
                  <img src={product.images[0]} alt={product.name} className="w-12 h-12 rounded-md object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-md bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center">
                    <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
                <div className="flex-1 text-right">
                  <h3 className="font-bold text-lg text-foreground">{product.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {product.variants?.length || 0} متغيرات • إجمالي المخزون: {product.variants?.reduce((sum, v) => sum + (v.quantity || 0), 0) || 0}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0 min-w-0">
                  <Badge 
                    variant={
                      product.stockLevel === 'out-of-stock' ? 'destructive' : 
                      product.stockLevel === 'low' ? 'secondary' : 
                      'default'
                    }
                    className="text-xs px-2 py-1 truncate max-w-20"
                  >
                    {product.stockLevel === 'out-of-stock' ? 'نفد' : 
                     product.stockLevel === 'low' ? 'منخفض' : 
                     product.stockLevel === 'medium' ? 'متوسط' : 'جيد'}
                  </Badge>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-3">
                {/* العناوين الثابتة */}
                <div className="grid grid-cols-11 items-center gap-1 md:gap-3 p-2 md:p-3 text-xs md:text-sm font-bold text-muted-foreground border-b-2 border-primary/20 bg-muted/50 rounded-lg">
                  <div className="col-span-4 md:col-span-3 text-right">المتغير</div>
                  <div className="col-span-1 md:col-span-2 text-center">المخزون</div>
                  <div className="col-span-1 md:col-span-2 text-center">محجوز</div>
                  <div className="col-span-2 md:col-span-2 text-center">متاح</div>
                  <div className="col-span-1 md:col-span-1 text-center">مباع</div>
                  <div className="col-span-2 md:col-span-1 text-center">الحالة</div>
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
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};


const InventoryPage = () => {
  const { products: allProducts, orders, loading, settings, updateVariantStock } = useInventory();
  const products = useFilteredProducts(allProducts); // تطبيق فلترة الصلاحيات
  const { allUsers, user } = useAuth();
  const { hasPermission, isAdmin } = usePermissions();
  const { sizes = [] } = useVariants() || {};
  
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

  // Scroll to top when page loads
  useEffect(() => {
    scrollToTopInstant();
  }, []);

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

  // تم نقل جلب بيانات الأقسام إلى useInventoryStats Hook

  // تم نقل دوال الأيقونات والتدرجات إلى DepartmentOverviewCards

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
    // استخدام المنتجات المفلترة حسب صلاحيات المستخدم
    // للمدير: يرى كل المنتجات، للموظفين: فقط المنتجات المرئية
    const productsToUse = isAdmin ? products : products.filter(p => p.is_active !== false);
    
    if (!Array.isArray(productsToUse) || !settings) {
      return [];
    }
    
    const { lowStockThreshold = 5, mediumStockThreshold = 10 } = settings;

    // معالجة المنتجات مع التفاصيل
    const processedItems = productsToUse.map(product => {
        if (!product) {
          return null;
        }
        
        const variantsWithLevels = Array.isArray(product.variants) 
          ? product.variants
              .map(variant => {
                if (!variant) return null;
                let stockLevel = 'high';
                const quantity = variant.quantity || 0;
                if (quantity === 0) stockLevel = 'out-of-stock';
                else if (quantity > 0 && quantity <= lowStockThreshold) stockLevel = 'low';
                else if (quantity > 0 && quantity <= mediumStockThreshold) stockLevel = 'medium';
                
                const stockPercentage = Math.min((quantity / (mediumStockThreshold + 5)) * 100, 100);
                return { ...variant, stockLevel, stockPercentage };
              })
              .filter(v => v !== null)
              .sort((a, b) => {
                // ترتيب حسب display_order للقياسات ثم حسب الألوان
                const aOrder = sizes.find(s => s.id === a.size_id)?.display_order || 999;
                const bOrder = sizes.find(s => s.id === b.size_id)?.display_order || 999;
                if (aOrder !== bOrder) return aOrder - bOrder;
                return (a.color || '').localeCompare(b.color || '');
              })
          : [];

        const totalStock = variantsWithLevels.reduce((acc, v) => acc + (v?.quantity || 0), 0);
        const totalReserved = variantsWithLevels.reduce((acc, v) => acc + (v?.reserved_quantity || v?.reserved || 0), 0);
      
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
    if (!Array.isArray(inventoryItems)) return [];
    let items = [...inventoryItems];

    // تطبيق فلتر الأقسام من الكروت والفلاتر العادية
    if (filters.department && filters.department !== 'all') {
      items = items.filter(product => {
        // البحث في علاقات الأقسام عبر product_departments
        const hasDepartmentRelation = product.product_departments?.some(pd => 
          pd.department_id === filters.department
        );
        
        // للتوافق: البحث في الحقل المباشر أيضاً
        const hasDirectDepartment = product.department_id === filters.department;
        
        return hasDepartmentRelation || hasDirectDepartment;
      });
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

  // تم نقل حسابات الإحصائيات إلى useInventoryStats Hook

  const handleEditStock = (product, variant) => {
    setEditingItem({ product, variant });
    setIsEditDialogOpen(true);
  };

  const handleFilterChange = useCallback((key, value) => {
    console.log('handleFilterChange called with:', key, value);
    
    // التعامل مع الاستدعاءات من InventoryStats (معامل واحد)
    if (typeof key === 'string' && value === undefined) {
      if (key === 'reserved') {
        console.log('Opening reserved stock dialog from stats...');
        setIsReservedStockDialogOpen(true);
        return;
      } else {
        console.log('Setting stockFilter from stats:', key);
        setFilters(currentFilters => ({ ...currentFilters, stockFilter: key }));
        return;
      }
    }
    
    // التعامل مع الاستدعاءات العادية (معاملين)
    if (key === 'stockFilter' && value === 'reserved') {
      console.log('Opening reserved stock dialog from filters...');
      setIsReservedStockDialogOpen(true);
      return;
    } else {
      console.log('Setting filter:', key, value);
      setFilters(currentFilters => ({ ...currentFilters, [key]: value }));
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
    return <div className="flex h-full w-full items-center justify-center"><Loader /></div>;
  }

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
            <Button 
              onClick={async () => {
                 try {
                   // تحضير البيانات للتصدير بالتنسيق الصحيح
                   let productsToExport = [];
                   
                   if (selectedItemsForExport.length > 0) {
                     // إذا كان هناك عناصر محددة، نأخذها من المخزون
                     productsToExport = inventoryItems.filter(item => selectedItemsForExport.includes(item.id));
                   } else {
                     // وإلا نأخذ جميع العناصر المفلترة
                     productsToExport = filteredItems;
                   }
                   
                   // تحويل المنتجات إلى متغيرات مسطحة
                   const exportData = productsToExport.flatMap(product => {
                     if (!product?.variants || !Array.isArray(product.variants)) {
                       return [];
                     }
                     
                     return product.variants.map(variant => ({
                       name: product.name || product.product_name || 'غير محدد',
                       color: variant.color_name || variant.color || 'غير محدد',
                       size: variant.size_name || variant.size || 'غير محدد', 
                       quantity: variant.quantity || 0,
                       price: variant.selling_price || variant.sale_price || variant.price || 0
                     }));
                   });
                   
                   if (exportData.length === 0) {
                     toast({ 
                       title: "تحذير", 
                       description: "لا توجد منتجات للتصدير",
                       variant: "destructive" 
                     });
                     return;
                   }
                   
                   const fileName = selectedItemsForExport.length > 0 
                     ? `الجرد_المحدد_${new Date().toISOString().split('T')[0]}`
                     : `الجرد_الكامل_${new Date().toISOString().split('T')[0]}`;
                   
                   await generateInventoryReportPDF(exportData, fileName);
                   
                   toast({ 
                     title: "تم بنجاح", 
                     description: `تم تصدير ${exportData.length} عنصر إلى PDF`,
                     variant: "success" 
                   });
                 } catch (error) {
                   console.error('Error exporting inventory:', error);
                   toast({ 
                     title: "خطأ في التصدير", 
                     description: "فشل في تصدير البيانات للـ PDF",
                     variant: "destructive" 
                   });
                 }
               }}
               className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 border-0"
            >
              <Download className="w-4 h-4 ml-2" />
              تصدير تقرير PDF
            </Button>
          </div>
        </div>

        {/* النظام الموحد للإحصائيات وكروت الأقسام */}
        <UnifiedInventoryStats 
          onFilterChange={handleFilterChange}
          onDepartmentFilter={(dept) => {
            setFilters(prev => ({ 
              ...prev, 
              department: dept.id,
              searchTerm: '',
              stockFilter: 'all'
            }));
          }}
        />
        
        {/* كارت الأرشيف منفصل */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-xl relative overflow-hidden min-h-[180px]"
                onClick={() => setFilters(prev => ({ ...prev, stockFilter: 'archived' }))}>
            <CardContent className="p-4">
              <div className="text-center space-y-3 bg-gradient-to-br from-slate-600 to-slate-800 text-white rounded-lg p-4 relative overflow-hidden h-full flex flex-col justify-between">
                {/* رقم الأرشيف */}
                <div className="absolute top-2 right-2">
                  <Badge variant="secondary" className="bg-white/20 text-white border-0 text-xs">
                    A
                  </Badge>
                </div>
                
                {/* الأيقونة */}
                <div className="flex justify-center">
                  <div className="p-3 bg-white/10 rounded-full backdrop-blur-sm">
                    <Archive className="w-8 h-8" />
                  </div>
                </div>
                
                {/* اسم الأرشيف */}
                <div>
                  <h4 className="font-bold text-base">أرشيف المنتجات</h4>
                </div>
                
                {/* عدد المنتجات المؤرشفة */}
                <div className="flex items-center justify-between pt-2 border-t border-white/20">
                  <div className="text-right">
                    <span className="text-xl font-bold">{inventoryItems.filter(item => 
                      item.variants && item.variants.length > 0 && 
                      item.variants.every(v => (v.quantity || 0) === 0)
                    ).length} <span className="text-white/80 text-sm">مؤرشف</span></span>
                  </div>
                  <div className="flex items-center gap-1 text-white/70">
                    <Archive className="w-4 h-4" />
                    <span className="text-xs">عرض</span>
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
          onFilterChange={handleFilterChange}
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
        onOpenChange={(open) => {
          console.log('🔍 INVENTORY PAGE - ReservedStockDialog Debug:', { 
            opening: open, 
            reservedOrdersCount: reservedOrders?.length,
            reservedOrdersSample: reservedOrders?.slice(0, 3).map(o => ({
              id: o.id,
              order_number: o.order_number,
              status: o.status,
              created_by: o.created_by,
              customer_name: o.customer_name,
              itemsCount: o.items?.length
            })),
            allUsersCount: allUsers?.length,
            currentUserId: user?.id,
            currentUserInfo: {
              id: user?.id,
              full_name: user?.full_name,
              username: user?.username,
              employee_code: user?.employee_code
            },
            isAdmin 
          });
          setIsReservedStockDialogOpen(open);
        }}
        reservedOrders={reservedOrders}
        allUsers={allUsers}
      />
    </>
  );
};

export default InventoryPage;
