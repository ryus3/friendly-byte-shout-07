import React, { useState, useMemo } from 'react';
import { useVariants } from '@/contexts/VariantsContext';
import { Button } from '@/components/ui/button';
import Loader from '@/components/ui/loader';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2, Pencil, Star, Hash, Type } from 'lucide-react';
import AddEditSizeDialog from './AddEditSizeDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';

const SortableSizeItem = ({ item, onEdit, onDelete }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getSizeIcon = (type) => {
    switch (type) {
      case 'free': return <Star className="w-4 h-4 text-amber-500" />;
      case 'number': return <Hash className="w-4 h-4 text-blue-500" />;
      default: return <Type className="w-4 h-4 text-green-500" />;
    }
  };

  const getSizeTypeLabel = (type) => {
    switch (type) {
      case 'free': return 'حر';
      case 'number': return 'رقمي';
      default: return 'حرفي';
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="flex items-center gap-3 p-3 mb-2 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
    >
      <div {...listeners} className="cursor-grab p-1 hover:bg-accent rounded">
        <GripVertical className="w-5 h-5 text-muted-foreground" />
      </div>
      
      <div className="flex items-center gap-2 flex-1">
        {getSizeIcon(item.type)}
        <span className="font-medium text-lg">{item.name}</span>
        <Badge variant="outline" className="text-xs">
          {getSizeTypeLabel(item.type)}
        </Badge>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={() => onEdit(item)} className="h-8 w-8">
          <Pencil className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onDelete(item.id)} className="h-8 w-8 text-destructive hover:text-destructive">
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

const SizeList = React.memo(({ sizeType }) => {
  const { sizes, loading, deleteSize, updateSizeOrder, updateSize } = useVariants();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSize, setEditingSize] = useState(null);

  const filteredSizes = useMemo(() =>
    sizes.filter(s => s.type === sizeType).sort((a, b) => (a.display_order || 0) - (b.display_order || 0)),
    [sizes, sizeType]
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = filteredSizes.findIndex(s => s.id === active.id);
      const newIndex = filteredSizes.findIndex(s => s.id === over.id);
      updateSizeOrder(arrayMove(filteredSizes, oldIndex, newIndex));
    }
  };
  
  const handleEdit = (size) => {
    setEditingSize(size);
    setDialogOpen(true);
  };
  
  const handleSuccessfulSubmit = async (data) => {
    if (!editingSize) return false;
    const result = await updateSize(editingSize.id, data);
    if (result.success) {
        toast({ title: 'تم التعديل بنجاح' });
    }
    return result.success;
  }

  if (loading) return <Loader />;

  return (
    <div>
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={filteredSizes.map(s => s.id)} strategy={verticalListSortingStrategy}>
          {filteredSizes.map((size) => (
            <SortableSizeItem key={size.id} item={size} onEdit={handleEdit} onDelete={deleteSize} />
          ))}
        </SortableContext>
      </DndContext>
      <AddEditSizeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        size={editingSize}
        sizeType={sizeType}
        onSuccessfulSubmit={handleSuccessfulSubmit}
      />
    </div>
  );
});

const SizesManager = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { addSize } = useVariants();

  const handleBatchAdd = async (sizesToAdd) => {
     const promises = sizesToAdd.map(size => addSize(size));
     const results = await Promise.all(promises);
     const success = results.every(r => r.success);
     if (success) {
        toast({ title: 'تمت إضافة القياسات بنجاح' });
        setDialogOpen(false);
     }
     return success;
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 ml-2" />
          إضافة قياسات جديدة
        </Button>
      </div>
      <Tabs defaultValue="free" dir="rtl">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="free" className="flex items-center gap-2">
            <Star className="w-4 h-4" />
            مقاس حر
          </TabsTrigger>
          <TabsTrigger value="letter" className="flex items-center gap-2">
            <Type className="w-4 h-4" />
            قياسات حرفية
          </TabsTrigger>
          <TabsTrigger value="number" className="flex items-center gap-2">
            <Hash className="w-4 h-4" />
            قياسات رقمية
          </TabsTrigger>
        </TabsList>
        <TabsContent value="free">
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-5 h-5 text-amber-600" />
                <h3 className="font-semibold text-amber-800">المقاس الحر (Free Size)</h3>
              </div>
              <p className="text-sm text-amber-700">
                يستخدم للمنتجات التي لا تتطلب مقاس محدد مثل الإكسسوارات والأحزمة والقبعات
              </p>
            </div>
            <SizeList sizeType="free" />
          </div>
        </TabsContent>
        <TabsContent value="letter">
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Type className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold text-green-800">القياسات الحرفية</h3>
              </div>
              <p className="text-sm text-green-700">
                تستخدم للملابس والأحذية: XS, S, M, L, XL, XXL
              </p>
            </div>
            <SizeList sizeType="letter" />
          </div>
        </TabsContent>
        <TabsContent value="number">
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Hash className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-blue-800">القياسات الرقمية</h3>
              </div>
              <p className="text-sm text-blue-700">
                تستخدم للأحذية والملابس بمقاسات رقمية: 36, 38, 40, 42, 44
              </p>
            </div>
            <SizeList sizeType="number" />
          </div>
        </TabsContent>
      </Tabs>
      <AddEditSizeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccessfulSubmit={handleBatchAdd}
      />
    </>
  );
};

export default SizesManager;