import React, { useState } from 'react';
import { useVariants } from '@/contexts/VariantsContext';
import AddEditColorDialog from '@/components/manage-variants/AddEditColorDialog';
import AddEditSizeDialog from '@/components/manage-variants/AddEditSizeDialog';

const AddVariantDialogs = ({ onAddColor, onAddSize, sizeType }) => {
    const [colorDialogOpen, setColorDialogOpen] = useState(false);
    const [sizeDialogOpen, setSizeDialogOpen] = useState(false);
    
    return (
        <>
            <button id="add-color-dialog-trigger" onClick={() => setColorDialogOpen(true)} className="hidden"></button>
            <AddEditColorDialog 
                open={colorDialogOpen} 
                onOpenChange={setColorDialogOpen} 
                onSuccessfulSubmit={onAddColor}
            />

            <button id="add-size-dialog-trigger" onClick={() => setSizeDialogOpen(true)} className="hidden"></button>
            <AddEditSizeDialog 
                open={sizeDialogOpen} 
                onOpenChange={setSizeDialogOpen} 
                onSuccessfulSubmit={onAddSize} 
                sizeType={sizeType}
            />
        </>
    );
};

export default AddVariantDialogs;