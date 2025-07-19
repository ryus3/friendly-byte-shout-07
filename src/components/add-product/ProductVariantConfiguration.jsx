import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import ColorVariantCard from './ColorVariantCard';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const SortableColorCard = (props) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: props.color.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <ColorVariantCard {...props} dragHandleProps={listeners} />
    </div>
  );
};

const ProductVariantConfiguration = ({
  selectedColors,
  onColorOrderChange,
  allSizesForType,
  variants,
  setVariants,
  price,
  costPrice,
  profitAmount,
  imageFiles,
  setImageFiles,
}) => {
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = selectedColors.findIndex(c => c.id === active.id);
      const newIndex = selectedColors.findIndex(c => c.id === over.id);
      onColorOrderChange(arrayMove(selectedColors, oldIndex, newIndex));
    }
  };

  const handleImageSelect = (colorId, blob) => {
    setImageFiles(prev => ({
      ...prev,
      [colorId]: { file: blob, preview: URL.createObjectURL(blob) }
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>إعداد المتغيرات</CardTitle>
        <CardDescription>
          أدخل الكميات والأسعار لكل متغير. يمكنك سحب وإفلات الكروت لترتيب ظهور الألوان.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={selectedColors.map(c => c.id)} strategy={verticalListSortingStrategy}>
            {selectedColors.map(color => (
              <SortableColorCard
                key={color.id}
                color={color}
                allSizesForType={allSizesForType}
                variants={variants}
                setVariants={setVariants}
                price={price}
                costPrice={costPrice}
                profitAmount={profitAmount}
                handleImageSelect={(blob) => handleImageSelect(color.id, blob)}
                initialImage={imageFiles[color.id]?.preview}
              />
            ))}
          </SortableContext>
        </DndContext>
      </CardContent>
    </Card>
  );
};

export default ProductVariantConfiguration;