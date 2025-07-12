import { db, storage } from '@/lib/firebase';
import { collection, addDoc, updateDoc, doc, deleteDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { toast } from '@/components/ui/use-toast';

const uploadImage = async (imageFile, path, onProgress) => {
  if (typeof imageFile === 'string') {
    return imageFile; 
  }
  if (!imageFile) return null;

  const storageRef = ref(storage, `${path}/${Date.now()}_${imageFile.name}`);
  const uploadTask = uploadBytesResumable(storageRef, imageFile);

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) onProgress(progress);
      },
      (error) => {
        console.error('Upload failed:', error);
        reject(error);
      },
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
          resolve(downloadURL);
        });
      }
    );
  });
};

export const addProductToFirestore = async (productData, imageFiles, setUploadProgress) => {
  try {
    let totalImages = (imageFiles.general || []).filter(Boolean).length + Object.values(imageFiles.colorImages || {}).filter(Boolean).length;
    let uploadedCount = 0;
    
    const updateProgress = () => {
      if (totalImages > 0) {
        uploadedCount++;
        setUploadProgress((uploadedCount / totalImages) * 100);
      }
    };

    if (totalImages === 0) setUploadProgress(100);

    const generalImageUrls = await Promise.all(
      (imageFiles.general || []).map(file => {
        if (!file) return null;
        const promise = uploadImage(file, 'products/general', null);
        promise.then(updateProgress);
        return promise;
      })
    );

    const finalVariants = await Promise.all(productData.variants.map(async (variant) => {
      const colorImageFile = imageFiles.colorImages[variant.colorId];
      let imageUrl = null;
      if (colorImageFile) {
        const promise = uploadImage(colorImageFile, `products/variants`, null);
        promise.then(updateProgress);
        imageUrl = await promise;
      }
      return { ...variant, image: imageUrl };
    }));
    
    const productDoc = {
      ...productData,
      images: generalImageUrls.filter(Boolean),
      variants: finalVariants,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await addDoc(collection(db, 'products'), productDoc);
    return { success: true };
  } catch (error) {
    console.error('Error adding product:', error);
    return { success: false, error: error.message };
  }
};

export const updateProductInFirestore = async (productId, productData, imageFiles, setUploadProgress) => {
  try {
    const productRef = doc(db, 'products', productId);
    
    let totalImages = (imageFiles.general || []).filter(img => img && typeof img !== 'string').length + 
                      Object.values(imageFiles.colorImages || {}).filter(img => img && typeof img !== 'string').length;
    let uploadedCount = 0;

    const updateProgress = () => {
        if (totalImages > 0) {
            uploadedCount++;
            setUploadProgress((uploadedCount / totalImages) * 100);
        }
    };
    if (totalImages === 0) setUploadProgress(100);


    const generalImageUrls = await Promise.all(
      (imageFiles.general || []).map(fileOrUrl => {
        if (typeof fileOrUrl === 'string') return fileOrUrl;
        if (fileOrUrl) {
           const promise = uploadImage(fileOrUrl, 'products/general', null);
           promise.then(updateProgress);
           return promise;
        }
        return null;
      })
    );

    const finalVariants = await Promise.all(productData.variants.map(async (variant) => {
      const colorImageFileOrUrl = imageFiles.colorImages[variant.colorId];
      let imageUrl = variant.image || null; 
      if (colorImageFileOrUrl) {
        if (typeof colorImageFileOrUrl === 'string') {
          imageUrl = colorImageFileOrUrl;
        } else {
          const promise = uploadImage(colorImageFileOrUrl, `products/variants`, null);
          promise.then(updateProgress);
          imageUrl = await promise;
        }
      }
      return { ...variant, image: imageUrl };
    }));

    const dataToUpdate = {
      ...productData,
      images: generalImageUrls.filter(Boolean),
      variants: finalVariants,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(productRef, dataToUpdate);
    return { success: true };
  } catch (error) {
    console.error('Error updating product:', error);
    return { success: false, error: error.message };
  }
};


export const deleteProductFromFirestore = async (productId) => {
  try {
    await deleteDoc(doc(db, 'products', productId));
    toast({ title: "نجاح", description: "تم حذف المنتج بنجاح." });
    return { success: true };
  } catch (error) {
    console.error("Error deleting product:", error);
    toast({ title: "خطأ", description: `فشل حذف المنتج: ${error.message}`, variant: "destructive" });
    return { success: false, error: error.message };
  }
};

export const deleteProductsFromFirestore = async (productIds) => {
  const batch = writeBatch(db);
  productIds.forEach(id => {
    const docRef = doc(db, 'products', id);
    batch.delete(docRef);
  });

  try {
    await batch.commit();
    toast({ title: "نجاح", description: `تم حذف ${productIds.length} منتج(ات) بنجاح.` });
    return { success: true };
  } catch (error) {
    console.error("Error deleting products:", error);
    toast({ title: "خطأ", description: `فشل حذف المنتجات: ${error.message}`, variant: "destructive" });
    return { success: false, error: error.message };
  }
};