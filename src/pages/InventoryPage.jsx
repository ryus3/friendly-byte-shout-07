
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useInventory } from '@/contexts/SuperProvider';
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
import { cn } from '@/lib/utils';
import { useSalesStats } from '@/hooks/useSalesStats';

const InventoryList = ({ items, onEditStock, canEdit, stockFilter, isLoading, onSelectionChange, selectedItems, isMobile, getVariantSoldData: getSoldDataProp }) => {
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
                <div className="flex items-center gap-3 flex-shrink-0 min-w-0">
                  {/* الألوان المتوفرة كنقاط صغيرة */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(() => {
                      const seen = new Set();
                      const dots = [];
                      (product.variants || []).forEach(v => {
                        const qty = v?.quantity || 0;
                        const reserved = v?.reserved_quantity || v?.reserved || 0;
                        const available = qty - reserved;
                        if (available > 0) {
                          const key = v?.color_hex || v?.colors?.hex_code || v?.color || v?.color_name || v?.color_label || 'unknown';
                          if (!seen.has(key)) {
                            seen.add(key);
                            dots.push(
                              <span
                                key={key}
                                className="inline-block w-3 h-3 rounded-full border border-border"
                                style={{ backgroundColor: (v?.color_hex || v?.colors?.hex_code || 'transparent') }}
                                title={v?.color || v?.color_name || ''}
                              />
                            );
                          }
                        }
                      });
                      return dots.slice(0, 12);
                    })()}
                  </div>
                  <Badge 
                    variant={
                      product.stockLevel === 'out-of-stock' ? 'destructive' : 
                      product.stockLevel === 'low' ? 'secondary' : 
                      'default'
                    }
                    className="text-xs px-2 py-0.5 whitespace-nowrap leading-none shrink-0"
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
                {(() => {
                  const groupsMap = {};
                  (product.variants || []).forEach(v => {
                    const colorId = v.color_id || v.colors?.id || v.color || v.color_name || v.color_label || 'unknown';
                    const colorName = v.color || v.color_name || v.colors?.name || v.color_label || 'غير محدد';
                    const colorHex = v.color_hex || v.colors?.hex_code;
                    const image = (Array.isArray(v.images) && v.images[0]) || v.image || (product.images_by_color && (product.images_by_color[colorId] || product.images_by_color[colorName])) || (product.images && product.images[0]);
                    if (!groupsMap[colorId]) groupsMap[colorId] = { id: colorId, name: colorName, hex: colorHex, image, variants: [] };
                    groupsMap[colorId].variants.push(v);
                  });
                  // فلترة القياسات: عرض فقط القياسات التي لديها مخزون أو محجوز أو متاح أو مباع
                  const groups = Object.values(groupsMap)
                    .map(g => {
                      const filtered = (g.variants || []).filter(v => {
                        const qty = v?.quantity || 0;
                        const res = v?.reserved_quantity || v?.reserved || 0;
                        const available = Math.max(0, qty - res);
                        if (stockFilter === 'out-of-stock') {
                          // في وضع "مخزون نافذ" نعرض فقط القياسات/الألوان النافذة
                          return qty === 0 || available <= 0;
                        }
                        // في الوضع العادي نخفي القياسات النافذة حتى لو كانت مباعه سابقاً
                        return qty > 0 || res > 0 || available > 0;
                      });
                      return { ...g, variants: filtered };
                    })
                    .filter(g => (g.variants || []).length > 0);
                  if (groups.length === 0) {
                    return (
                      <div className="text-center py-4 text-muted-foreground">
                        <p>لا توجد متغيرات لهذا المنتج</p>
                      </div>
                    );
                  }
                  return (
                    <Accordion type="multiple" className="w-full space-y-2">
                      {groups.map(group => (
                        <AccordionItem key={group.id} value={String(group.id)} className="bg-accent/40 border border-border/60 rounded-lg">
                          <AccordionTrigger className="px-3 md:px-4 py-2 md:py-3 hover:no-underline">
                            {(() => {
                              const totals = (group.variants || []).reduce((acc, v) => {
                                const qty = v?.quantity || 0;
                                const res = v?.reserved_quantity || v?.reserved || 0;
                                acc.stock += qty; acc.reserved += res; acc.available += (qty - res); return acc;
                              }, { stock: 0, reserved: 0, available: 0 });
                              const hasLow = (group.variants || []).some(v => v?.stockLevel === 'low');
                              const hasMedium = (group.variants || []).some(v => v?.stockLevel === 'medium');
                              let level = 'high';
                              if (totals.stock === 0) level = 'out-of-stock';
                              else if (hasLow) level = 'low';
                              else if (hasMedium) level = 'medium';
                              const text = level === 'out-of-stock' ? 'نافذ' : level === 'low' ? 'منخفض' : level === 'medium' ? 'متوسط' : 'جيد';
                              const cls = level === 'out-of-stock' ? 'bg-gray-500/20 text-gray-400' : level === 'low' ? 'bg-red-500/20 text-red-400' : level === 'medium' ? 'bg-orange-500/20 text-orange-400' : 'bg-green-500/20 text-green-400';
                              return (
                                <div className="flex items-center justify-between w-full">
                                  <div className="flex items-center gap-3">
                                    {group.image ? (
                                      <img src={group.image} alt={`${product.name} - ${group.name}`} className="w-8 h-8 md:w-10 md:h-10 rounded-md object-cover" loading="lazy" />
                                    ) : (
                                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-md bg-muted" />
                                    )}
                                    <div className="flex items-center gap-2 font-semibold">
                                      {group.hex && <span className="inline-block w-3 h-3 rounded-full border" style={{ backgroundColor: group.hex }} />}
                                      <span>{group.name}</span>
                                      <Badge className={cn("text-[10px] md:text-xs px-1.5 py-0.5 whitespace-nowrap leading-none shrink-0", cls)}>{text}</Badge>
                                    </div>
                                  </div>
                                  <div className="text-xs text-muted-foreground hidden md:block">لون</div>
                                </div>
                              );
                            })()}
                          </AccordionTrigger>
                          <AccordionContent className="px-2 md:px-3 pb-3">
                              <div className="grid grid-cols-6 items-center gap-2 md:gap-6 p-2 md:p-3 text-xs sm:text-sm md:text-base font-semibold text-foreground border-b-2 border-primary/20 bg-muted/50 rounded-lg tracking-wide">
                                <div className="col-span-1 md:col-span-2 text-center whitespace-nowrap truncate leading-none">القياس</div>
                                <div className="col-span-1 text-center whitespace-nowrap truncate leading-none">المخزون</div>
                                <div className="col-span-1 text-center whitespace-nowrap truncate leading-none">محجوز</div>
                                <div className="col-span-1 text-center whitespace-nowrap truncate leading-none">متاح</div>
                                <div className="col-span-1 text-center whitespace-nowrap truncate leading-none">مباع</div>
                                <div className="col-span-1 text-center whitespace-nowrap truncate leading-none">الحالة</div>
                              </div>
                            {(group.variants || []).map(variant => (
                              <InventoryItem
                                key={variant.id}
                                variant={variant}
                                product={product}
                                onEditStock={canEdit ? () => onEditStock(product, variant) : null}
                                hideColorColumn={true}
                              />
                            ))}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  );
                })()}
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
  
  // لوق للتشخيص
  console.log('🔍 InventoryPage: البيانات الواردة:', {
    productsCount: allProducts?.length || 0,
    loading,
    hasProducts: !!allProducts,
    firstProduct: allProducts?.[0] ? {
      id: allProducts[0].id,
      name: allProducts[0].name,
      variantsCount: allProducts[0].variants?.length || 0,
      firstVariant: allProducts[0].variants?.[0] ? {
        id: allProducts[0].variants[0].id,
        quantity: allProducts[0].variants[0].quantity,
        inventory: allProducts[0].variants[0].inventory
      } : null
    } : null
  });
  const products = useFilteredProducts(allProducts); // تطبيق فلترة الصلاحيات
  const { allUsers, user } = useAuth();
  const { hasPermission, isAdmin } = usePermissions();
  const { sizes = [] } = useVariants() || {};
  const { getVariantSoldData } = useSalesStats();
  
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
    const productsToUse = (products || []).filter(p => p.is_active !== false);
    
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

    const norm = (v) => (v == null ? '' : String(v));

    // Helpers to robustly check relations from multiple schemas (normalize IDs)
    const hasDept = (p, id) => {
      if (!id || id === 'all') return true;
      const target = norm(id);
      return (
        (Array.isArray(p.product_departments) && p.product_departments.some(pd => [
          pd.department_id, pd.department?.id, pd.departments?.id, pd.department
        ].some(x => norm(x) === target))) ||
        [p.department_id, p.department, p?.categories?.department_id, p?.categories?.department?.id, p?.categories?.department].some(x => norm(x) === target)
      );
    };

    const hasCategory = (p, id) => {
      if (!id || id === 'all') return true;
      const target = norm(id);
      const c = p?.categories || {};
      return (
        (Array.isArray(p.product_categories) && p.product_categories.some(pc => [
          pc.category_id, pc.category?.id, pc.categories?.id, pc.category
        ].some(x => norm(x) === target))) ||
        [c?.main_category_id, c?.main_category?.id, c?.main_category].some(x => norm(x) === target)
      );
    };

    const hasProductType = (p, id) => {
      if (!id || id === 'all') return true;
      const target = norm(id);
      const c = p?.categories || {};
      return (
        (Array.isArray(p.product_product_types) && p.product_product_types.some(ppt => [
          ppt.product_type_id, ppt.product_type?.id, ppt.product_types?.id, ppt.product_type
        ].some(x => norm(x) === target))) ||
        [c?.product_type_id, c?.product_type?.id, c?.product_type].some(x => norm(x) === target)
      );
    };

    const hasSeason = (p, id) => {
      if (!id || id === 'all') return true;
      const target = norm(id);
      const c = p?.categories || {};
      return (
        (Array.isArray(p.product_seasons_occasions) && p.product_seasons_occasions.some(pso => [
          pso.season_occasion_id, pso.season_occasion?.id, pso.seasons_occasions?.id, pso.season_occasion
        ].some(x => norm(x) === target))) ||
        [c?.season_occasion_id, c?.season_occasion?.id, c?.season_occasion].some(x => norm(x) === target)
      );
    };

    // Department filter (from cards or dropdown)
    if (filters.department && filters.department !== 'all') {
      const before = items.length;
      items = items.filter(p => hasDept(p, filters.department));
      console.log('⚙️ فلترة القسم:', { dept: filters.department, before, after: items.length });
    }

    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      items = items.filter(p =>
        p?.name?.toLowerCase().includes(term) ||
        (p?.sku_base && p.sku_base.toLowerCase().includes(term)) ||
        (Array.isArray(p?.variants) && p.variants.some(v => v?.sku && v.sku.toLowerCase().includes(term)))
      );
    }

    if (filters.category && filters.category !== 'all') {
      const before = items.length;
      items = items.filter(p => hasCategory(p, filters.category));
      console.log('⚙️ فلترة التصنيف:', { cat: filters.category, before, after: items.length });
    }

    if (filters.productType && filters.productType !== 'all') {
      const before = items.length;
      items = items.filter(p => hasProductType(p, filters.productType));
      console.log('⚙️ فلترة النوع:', { type: filters.productType, before, after: items.length });
    }

    if (filters.seasonOccasion && filters.seasonOccasion !== 'all') {
      const before = items.length;
      items = items.filter(p => hasSeason(p, filters.seasonOccasion));
      console.log('⚙️ فلترة الموسم/المناسبة:', { season: filters.seasonOccasion, before, after: items.length });
    }

    if (filters.color && filters.color !== 'all') {
      const target = norm(filters.color);
      items = items.filter(p => Array.isArray(p?.variants) && p.variants.some(v => (
        [v?.color_id, v?.colors?.id, v?.color].some(x => norm(x) === target)
      )));
    }

    if (filters.size && filters.size !== 'all') {
      const target = norm(filters.size);
      items = items.filter(p => Array.isArray(p?.variants) && p.variants.some(v => (
        [v?.size_id, v?.sizes?.id, v?.size].some(x => norm(x) === target)
      )));
    }

    if (filters.price && (filters.price[0] > 0 || filters.price[1] < 500000)) {
      items = items.filter(p => Array.isArray(p?.variants) && p.variants.some(v => v?.price >= filters.price[0] && v?.price <= filters.price[1]));
    }

    if (filters.stockFilter && filters.stockFilter !== 'all') {
      if (filters.stockFilter === 'reserved') {
        items = items.filter(item => (item?.totalReserved || 0) > 0);
      } else if (filters.stockFilter === 'out-of-stock') {
        items = items.filter(item => Array.isArray(item?.variants) && item.variants.some(v => (v?.quantity || 0) === 0));
      } else if (filters.stockFilter === 'archived') {
        items = items.filter(item => Array.isArray(item?.variants) && item.variants.length > 0 && item.variants.every(v => (v?.quantity || 0) === 0));
      } else {
        items = items.filter(item => Array.isArray(item?.variants) && item.variants.some(v => v?.stockLevel === filters.stockFilter));
      }
    }

    return items;
  }, [inventoryItems, filters]);

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

        {/* النظام الموحد للإحصائيات وكروت الأقسام + بطاقة الأرشيف بنفس السطر */}
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
          extraCard={(
            <ArchivedProductsCard
              archivedCount={inventoryItems.filter(item => item.variants && item.variants.length > 0 && item.variants.every(v => (v.quantity || 0) === 0)).length}
              onViewArchive={() => setFilters(prev => ({ ...prev, stockFilter: 'archived' }))}
              onRestoreProduct={() => toast({ title: 'تنبيه', description: 'ميزة الاستعادة قيد الإعداد' })}
            />
          )}
        />
        

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
          getVariantSoldData={getVariantSoldData}
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
