import { useState, useEffect, useCallback } from 'react';
import { optimizeImage, compressedStorage } from '@/utils/performance';

export const useOptimizedImages = () => {
  const [optimizedImages, setOptimizedImages] = useState(new Map());
  const [isProcessing, setIsProcessing] = useState(false);

  const optimizeAndCache = useCallback(async (file, key) => {
    setIsProcessing(true);
    
    try {
      // Check cache first
      const cached = compressedStorage.get(`img_${key}`);
      if (cached) {
        setOptimizedImages(prev => new Map(prev.set(key, cached)));
        return cached;
      }

      // Optimize image
      const optimized = await optimizeImage(file);
      const dataUrl = URL.createObjectURL(optimized);
      
      // Cache the result
      compressedStorage.set(`img_${key}`, dataUrl);
      setOptimizedImages(prev => new Map(prev.set(key, dataUrl)));
      
      return dataUrl;
    } catch (error) {
      console.warn('Image optimization failed:', error);
      return URL.createObjectURL(file);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const getOptimizedImage = useCallback((key) => {
    return optimizedImages.get(key) || compressedStorage.get(`img_${key}`);
  }, [optimizedImages]);

  return {
    optimizeAndCache,
    getOptimizedImage,
    isProcessing
  };
};