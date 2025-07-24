import React, { useState, useMemo } from 'react';
import { useVariants } from '@/contexts/VariantsContext';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import Loader from '@/components/ui/loader';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2, Pencil } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AddEditCategoryDialog from './AddEditCategoryDialog';

const SortableCategoryItem = ({ item, onEdit, onDelete }) => {
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
      className="flex items-center gap-2 p-2 mb-2 border rounded-md bg-card"
    >
      <div {...listeners} className="cursor-grab p-1">
        <GripVertical className="w-5 h-5 text-muted-foreground" />
      </div>
      <span className="flex-grow">{item.name}</span>
      <Button variant="ghost" size="icon" onClick={() => onEdit(item)}>
        <Pencil className="w-4 h-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => onDelete(item.id)}>
        <Trash2 className="w-4 h-4 text-destructive" />
      </Button>
    </div>
  );
};

const CategoryList = React.memo(({ categoryType, title }) => {
  const { categories, loading, deleteCategory, updateCategoryOrder } = useVariants();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  const filteredCategories = useMemo(() => 
    categories.filter(c => c.type === categoryType).sort((a, b) => a.order - b.order),
    [categories, categoryType]
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = filteredCategories.findIndex(c => c.id === active.id);
      const newIndex = filteredCategories.findIndex(c => c.id === over.id);
      updateCategoryOrder(arrayMove(filteredCategories, oldIndex, newIndex));
    }
  };

  const handleAdd = () => {
    setEditingCategory(null);
    setDialogOpen(true);
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setDialogOpen(true);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <Button onClick={handleAdd} size="sm" className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 border-0">
          <Plus className="w-4 h-4 ml-2" />
          إضافة
        </Button>
      </div>
      {loading ? <Loader /> : (
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={filteredCategories.map(c => c.id)} strategy={verticalListSortingStrategy}>
            {filteredCategories.map((cat) => (
              <SortableCategoryItem key={cat.id} item={cat} onEdit={handleEdit} onDelete={deleteCategory} />
            ))}
          </SortableContext>
        </DndContext>
      )}
      <AddEditCategoryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        category={editingCategory}
        categoryType={categoryType}
      />
    </div>
  );
});

const CategoriesManager = () => {
  return (
    <Tabs defaultValue="main_category" dir="rtl">
      <TabsList className="grid w-full grid-cols-1">
        <TabsTrigger value="main_category">التصنيف الرئيسي</TabsTrigger>
      </TabsList>
      <TabsContent value="main_category">
        <CategoryList categoryType="main_category" title="التصنيفات الرئيسية" />
      </TabsContent>
    </Tabs>
  );
};

export default CategoriesManager;