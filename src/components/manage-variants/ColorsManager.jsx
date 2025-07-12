import React, { useState, useMemo } from 'react';
import { useVariants } from '@/contexts/VariantsContext';
import { Button } from '@/components/ui/button';
import Loader from '@/components/ui/loader';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2, Pencil } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import AddEditColorDialog from './AddEditColorDialog';

const SortableColorItem = ({ item, onEdit, onDelete }) => {
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
      <div className="w-6 h-6 rounded-full border" style={{ backgroundColor: item.hex_code }}></div>
      <span className="flex-grow font-medium">{item.name}</span>
      <span className="text-sm text-muted-foreground">{item.hex_code}</span>
      <Button variant="ghost" size="icon" onClick={() => onEdit(item)}>
        <Pencil className="w-4 h-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => onDelete(item.id)}>
        <Trash2 className="w-4 h-4 text-destructive" />
      </Button>
    </div>
  );
};

const ColorsManager = () => {
  const { colors, loading, addColor, updateColor, deleteColor, updateColorOrder } = useVariants();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingColor, setEditingColor] = useState(null);

  const sortedColors = useMemo(() => 
    [...colors].sort((a, b) => a.order - b.order),
    [colors]
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = sortedColors.findIndex(c => c.id === active.id);
      const newIndex = sortedColors.findIndex(c => c.id === over.id);
      updateColorOrder(arrayMove(sortedColors, oldIndex, newIndex));
    }
  };

  const handleAdd = () => {
    setEditingColor(null);
    setDialogOpen(true);
  };

  const handleEdit = (color) => {
    setEditingColor(color);
    setDialogOpen(true);
  };

  const handleSuccess = async (data) => {
    let result;
    if (editingColor) {
      result = await updateColor(editingColor.id, data);
    } else {
      result = await addColor(data);
    }
    return result.success;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>إدارة الألوان</CardTitle>
            <CardDescription>إضافة وتعديل وحذف الألوان المتاحة للمنتجات.</CardDescription>
          </div>
          <Button onClick={handleAdd}>
            <Plus className="w-4 h-4 ml-2" />
            إضافة لون
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? <Loader /> : (
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sortedColors.map(c => c.id)} strategy={verticalListSortingStrategy}>
              {sortedColors.map((color) => (
                <SortableColorItem key={color.id} item={color} onEdit={handleEdit} onDelete={deleteColor} />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </CardContent>
      <AddEditColorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        color={editingColor}
        onSuccess={handleSuccess}
      />
    </Card>
  );
};

export default ColorsManager;