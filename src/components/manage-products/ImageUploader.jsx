import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Upload, Crop, Check, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

function getCroppedImg(image, crop, fileName) {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  canvas.width = crop.width;
  canvas.height = crop.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
      return Promise.reject(new Error('Could not get canvas context'));
  }

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    crop.width,
    crop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        console.error('Canvas is empty');
        reject(new Error('Canvas is empty'));
        return;
      }
      const file = new File([blob], fileName, { type: 'image/webp' });
      resolve(file);
    }, 'image/webp', 0.9);
  });
}


const ImageUploader = ({ onImageSelect, initialImage, onImageRemove }) => {
  const [displayImage, setDisplayImage] = useState(null);
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [sourceImage, setSourceImage] = useState(null);
  const [sourceFileName, setSourceFileName] = useState('new-image.webp');
  const imgRef = useRef(null);

  useEffect(() => {
    setDisplayImage(initialImage || null);
  }, [initialImage]);

  const onDrop = useCallback(acceptedFiles => {
    const file = acceptedFiles[0];
    if (file) {
      setSourceFileName(file.name);
      const reader = new FileReader();
      reader.addEventListener('load', () => setSourceImage(reader.result?.toString() || ''));
      reader.readAsDataURL(file);
      setIsCropModalOpen(true);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.png', '.jpg', '.webp'] },
    multiple: false
  });

  function onImageLoad(e) {
    imgRef.current = e.currentTarget;
    const { width, height } = e.currentTarget;
    const crop = centerCrop(
      makeAspectCrop({ unit: '%', width: 90 }, 1, width, height),
      width,
      height
    );
    setCrop(crop);
  }

  const handleCrop = async () => {
    if (completedCrop?.width && completedCrop?.height && imgRef.current) {
      try {
        const croppedImageFile = await getCroppedImg(imgRef.current, completedCrop, sourceFileName);
        onImageSelect(croppedImageFile);
        setDisplayImage(URL.createObjectURL(croppedImageFile));
      } catch (e) {
        console.error("Cropping failed", e);
      } finally {
        setIsCropModalOpen(false);
        setSourceImage(null);
      }
    }
  };
  
  const handleRemove = (e) => {
    e.stopPropagation();
    if(onImageRemove) {
        onImageRemove();
    }
    setDisplayImage(null);
    onImageSelect(null);
  }

  return (
    <>
      <div
        {...getRootProps()}
        className={`w-full h-full border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-colors relative group ${isDragActive ? 'border-primary bg-primary/10' : 'border-border'}`}
      >
        <input {...getInputProps()} />
        {displayImage ? (
          <>
            <img src={displayImage} alt="Preview" className="w-full h-full object-cover rounded-lg" />
            {onImageRemove && (
                <Button 
                    variant="destructive" 
                    size="icon" 
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 h-8 w-8"
                    onClick={handleRemove}
                >
                    <Trash2 className="w-4 h-4" />
                </Button>
            )}
          </>
        ) : (
          <div className="text-center text-muted-foreground p-4">
            <Upload className="mx-auto h-12 w-12" />
            <p className="text-xs mt-2">اسحب وأفلت الصورة هنا، أو انقر للاختيار</p>
          </div>
        )}
      </div>

      <Dialog open={isCropModalOpen} onOpenChange={setIsCropModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>قص الصورة</DialogTitle>
          </DialogHeader>
          {sourceImage && (
            <div className="flex justify-center my-4 max-h-[60vh] overflow-auto">
              <ReactCrop
                crop={crop}
                onChange={c => setCrop(c)}
                onComplete={c => setCompletedCrop(c)}
                aspect={1}
                minWidth={100}
                minHeight={100}
              >
                <img ref={imgRef} alt="Crop me" src={sourceImage} onLoad={onImageLoad} style={{maxHeight: '50vh'}} />
              </ReactCrop>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCropModalOpen(false)}>إلغاء</Button>
            <Button onClick={handleCrop}><Check className="w-4 h-4 ml-2" /> تأكيد القص</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ImageUploader;