import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Eye, Edit, Trash2, Printer, EyeOff } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from '@/components/ui/use-toast';
import { useInventory } from '@/contexts/InventoryContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import ProductDetailsDialog from './ProductDetailsDialog';
import PrintLabelsDialog from './PrintLabelsDialog';

const ManageProductActions = ({ product, onProductUpdate, refetchProducts }) => {
  const navigate = useNavigate();
  const { deleteProducts, updateProduct } = useInventory();
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);

  const handleToggleVisibility = async () => {
    setIsUpdatingVisibility(true);
    const newState = !product.is_active; // تبديل بسيط
    
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: newState })
        .eq('id', product.id);
      
      if (error) throw error;
      
      toast({
        title: `تم ${newState ? 'إظهار' : 'إخفاء'} المنتج`,
        description: `"${product.name}" الآن ${newState ? 'مرئي للعملاء' : 'مخفي عن العملاء'}.`,
      });
      
      // إعادة تحميل الصفحة لضمان التحديث
      window.location.reload();
      
    } catch (error) {
      console.error('Error updating product visibility:', error);
      toast({ title: "خطأ", description: "حدث خطأ أثناء تحديث ظهور المنتج.", variant: "destructive" });
    } finally {
      setIsUpdatingVisibility(false);
    }
  };

  const handleDelete = async () => {
    const { success } = await deleteProducts([product.id]);
    if (success) {
      toast({ title: "نجاح", description: `تم حذف المنتج "${product.name}" بنجاح.` });
      if (onProductUpdate) onProductUpdate();
    } else {
      toast({ title: "خطأ", description: "فشل حذف المنتج.", variant: "destructive" });
    }
    setIsDeleteOpen(false);
  };
  
  const handleEditProduct = () => {
    // الانتقال لصفحة إضافة المنتج مع بيانات المنتج للتعديل
    navigate('/add-product', { 
      state: { 
        editProduct: product,
        from: '/manage-products'
      } 
    });
  };

  return (
    <>
      <TooltipProvider>
        <div className="flex items-center justify-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => setIsViewOpen(true)}>
                <Eye className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>مشاهدة</p></TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className={`h-8 w-8 ${product.is_active ? 'text-green-500 hover:text-green-600' : 'text-red-500 hover:text-red-600'}`}
                onClick={handleToggleVisibility}
                disabled={isUpdatingVisibility}
              >
                {product.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{product.is_active ? 'إخفاء المنتج عن العملاء' : 'إظهار المنتج للعملاء'}</p>
            </TooltipContent>
          </Tooltip>
           <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-green-500" onClick={() => setIsPrintOpen(true)}>
                <Printer className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>طباعة ملصقات</p></TooltipContent>
          </Tooltip>
           <Tooltip>
             <TooltipTrigger asChild>
               <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-yellow-500" onClick={handleEditProduct}>
                 <Edit className="w-4 h-4" />
               </Button>
             </TooltipTrigger>
             <TooltipContent><p>تعديل</p></TooltipContent>
           </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setIsDeleteOpen(true)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent><p>حذف</p></TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      <ProductDetailsDialog product={product} open={isViewOpen} onOpenChange={setIsViewOpen} />
      <PrintLabelsDialog products={[product]} open={isPrintOpen} onOpenChange={setIsPrintOpen} />

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد تماماً؟</AlertDialogTitle>
            <AlertDialogDescription>
              هذا الإجراء لا يمكن التراجع عنه. سيؤدي هذا إلى حذف المنتج بشكل دائم
              وإزالة بياناته من خوادمنا.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              نعم، قم بالحذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ManageProductActions;