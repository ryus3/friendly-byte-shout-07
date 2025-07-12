import React, { useState, useMemo } from 'react';
import { useVariants } from '@/contexts/VariantsContext';
import { Button } from '@/components/ui/button';
import Loader from '@/components/ui/loader';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2, Pencil } from 'lucide-react';
import AddEditSizeDialog from './AddEditSizeDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/use-toast';

const SortableSizeItem = ({ item, onEdit, onDelete }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="flex items-center gap-4 p-2 mb-2 border rounded-md bg-card"
    >
      <div {...listeners} className="cursor-grab p-1">
        <GripVertical className="w-5 h-5 text-muted-foreground" />
      </div>
      <span className="font-medium w-16 text-center">{item.value}</span>
      <Button variant="ghost" size="icon" onClick={() => onEdit(item)}>
        <Pencil className="w-4 h-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => onDelete(item.id)}>
        <Trash2 className="w-4 h-4 text-destructive" />
      </Button>
    </div>
  );
};

const SizeList = React.memo(({ sizeType }) => {
  const { sizes, loading, deleteSize, updateSizeOrder, updateSize } = useVariants();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSize, setEditingSize] = useState(null);

  const filteredSizes = useMemo(() =>
    sizes.filter(s => s.type === sizeType).sort((a, b) => a.order - b.order),
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
      <Tabs defaultValue="letter" dir="rtl">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="letter">قياسات حرفية (S, M, L)</TabsTrigger>
          <TabsTrigger value="number">قياسات رقمية (38, 40, 42)</TabsTrigger>
        </TabsList>
        <TabsContent value="letter">
          <SizeList sizeType="letter" />
        </TabsContent>
        <TabsContent value="number">
          <SizeList sizeType="number" />
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