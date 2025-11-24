import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Upload, Loader2, X } from 'lucide-react';

const LogoUploader = ({ currentLogo, onUpload }) => {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(currentLogo);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'خطأ',
        description: 'يرجى اختيار صورة',
        variant: 'destructive'
      });
      return;
    }

    try {
      setUploading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `storefront-logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('storefront_assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('storefront_assets')
        .getPublicUrl(filePath);

      setPreview(publicUrl);
      onUpload(publicUrl);

      toast({
        title: 'تم الرفع',
        description: 'تم رفع الشعار بنجاح'
      });
    } catch (err) {
      console.error('Error uploading logo:', err);
      toast({
        title: 'خطأ',
        description: 'فشل رفع الشعار',
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
        <div className="relative inline-block">
          <img
            src={preview}
            alt="Logo"
            className="h-32 w-32 object-contain border rounded-lg p-2"
          />
          <Button
            variant="destructive"
            size="icon"
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
            onClick={handleRemove}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div className="border-2 border-dashed rounded-lg p-8 text-center">
          <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground mb-2">اسحب الصورة هنا أو</p>
        </div>
      )}

      <div>
        <input
          type="file"
          id="logo-upload"
          accept="image/*"
          onChange={handleUpload}
          className="hidden"
          disabled={uploading}
        />
        <label htmlFor="logo-upload">
          <Button asChild disabled={uploading}>
            <span>
              {uploading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              {preview ? 'تغيير الشعار' : 'رفع شعار'}
            </span>
          </Button>
        </label>
      </div>
    </div>
  );
};

export default LogoUploader;
