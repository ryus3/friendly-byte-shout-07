import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Upload, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const BannerUploader = ({ currentBanner, onUpload }) => {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(currentBanner);
  const { toast } = useToast();

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation
    if (!file.type.startsWith('image/')) {
      toast({ 
        title: 'خطأ', 
        description: 'يجب أن يكون الملف صورة', 
        variant: 'destructive' 
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ 
        title: 'خطأ', 
        description: 'حجم الصورة يجب أن لا يتجاوز 5MB', 
        variant: 'destructive' 
      });
      return;
    }

    try {
      setUploading(true);

      const { data: { user } } = await supabase.auth.getUser();
      const fileName = `banner-${user.id}-${Date.now()}.${file.name.split('.').pop()}`;

      const { data, error } = await supabase.storage
        .from('storefront-assets')
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('storefront-assets')
        .getPublicUrl(fileName);

      setPreview(publicUrl);
      onUpload(publicUrl);

      toast({ 
        title: '✅ تم الرفع', 
        description: 'تم رفع البانر بنجاح' 
      });
    } catch (err) {
      console.error('Error uploading banner:', err);
      toast({ 
        title: 'خطأ', 
        description: 'فشل رفع البانر', 
        variant: 'destructive' 
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onUpload(null);
  };

  return (
    <div className="space-y-4">
      {preview ? (
        <div className="relative rounded-2xl overflow-hidden border-4 border-dashed border-primary/30">
          <img src={preview} alt="Banner" className="w-full h-64 object-cover" />
          <button
            onClick={handleRemove}
            className="absolute top-4 right-4 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center h-64 border-4 border-dashed border-primary/30 rounded-2xl cursor-pointer hover:border-primary/60 transition-colors bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
          <input
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="hidden"
            disabled={uploading}
          />
          {uploading ? (
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          ) : (
            <>
              <Upload className="h-12 w-12 text-primary mb-4" />
              <p className="text-lg font-semibold">اضغط لرفع البانر</p>
              <p className="text-sm text-muted-foreground">الحجم المثالي: 1920x400 بكسل</p>
            </>
          )}
        </label>
      )}
      <p className="text-sm text-muted-foreground text-center">
        البانر يظهر في أعلى الصفحة الرئيسية للمتجر (اختياري)
      </p>
    </div>
  );
};

export default BannerUploader;
