import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useInventory } from '@/contexts/InventoryContext';
import { Button } from '@/components/ui/button';
import { ArrowRight, Printer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import PrintLabelsDialog from '@/components/manage-products/PrintLabelsDialog';
import { toast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const ManageLabelsPage = () => {
  const { products, loading } = useInventory();
  const navigate = useNavigate();
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.product_variants || []).some(v => v.barcode?.includes(searchTerm))
    );
  }, [products, searchTerm]);

  const selectedProducts = useMemo(() => 
    products.filter(p => selectedProductIds.includes(p.id)),
    [products, selectedProductIds]
  );

  const handleSelectProduct = (productId) => {
    setSelectedProductIds(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const handleSelectAll = (isChecked) => {
    if (isChecked) {
      setSelectedProductIds(filteredProducts.map(p => p.id));
    } else {
      setSelectedProductIds([]);
    }
  };

  const handlePrintLabels = () => {
    if (selectedProductIds.length === 0) {
      toast({
        title: "لا توجد منتجات محددة",
        description: "يرجى تحديد منتج واحد على الأقل لطباعة الملصقات.",
        variant: "destructive"
      });
      return;
    }
    setIsPrintDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>طباعة الملصقات - RYUS</title>
        <meta name="description" content="طباعة ملصقات الباركود للمنتجات." />
      </Helmet>
      
      <PrintLabelsDialog 
        open={isPrintDialogOpen}
        onOpenChange={setIsPrintDialogOpen}
        products={selectedProducts}
      />

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/')} className="w-full sm:w-auto">
            <ArrowRight className="h-4 w-4 ml-2" />
            رجوع
          </Button>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-center sm:text-right">طباعة الملصقات</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>تحديد المنتجات للطباعة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Label htmlFor="search">البحث في المنتجات</Label>
                <Input
                  id="search"
                  placeholder="البحث بالاسم أو الباركود..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={handlePrintLabels} disabled={selectedProductIds.length === 0}>
                  <Printer className="h-4 w-4 ml-2" />
                  طباعة الملصقات ({selectedProductIds.length})
                </Button>
              </div>
            </div>

            {filteredProducts.length > 0 && (
              <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                <Checkbox 
                  id="select-all"
                  checked={selectedProductIds.length === filteredProducts.length && filteredProducts.length > 0}
                  onCheckedChange={handleSelectAll}
                />
                <Label htmlFor="select-all" className="text-sm font-medium">تحديد الكل ({filteredProducts.length} منتج)</Label>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map((product) => (
                <Card key={product.id} className={`cursor-pointer transition-colors ${selectedProductIds.includes(product.id) ? 'bg-primary/10 border-primary' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Checkbox 
                        checked={selectedProductIds.includes(product.id)}
                        onCheckedChange={() => handleSelectProduct(product.id)}
                      />
                      <div className="flex-1 min-w-0" onClick={() => handleSelectProduct(product.id)}>
                        {product.images && product.images[0] && (
                          <div className="w-12 h-12 bg-muted rounded-lg mb-2 overflow-hidden">
                            <img 
                              src={product.images[0]} 
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <h3 className="font-medium text-sm line-clamp-2">{product.name}</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          {(product.product_variants || []).length} متغير
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                            {(product.base_price || 0).toLocaleString()} د.ع
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredProducts.length === 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">لا توجد منتجات مطابقة للبحث</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default ManageLabelsPage;