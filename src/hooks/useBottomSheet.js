import { useState, useCallback, useRef, useEffect } from 'react';

export const useBottomSheet = (isOpen, onClose) => {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [snapPosition, setSnapPosition] = useState('closed'); // 'closed', 'peek', 'half', 'full'
  const containerRef = useRef(null);
  const startY = useRef(0);
  const currentY = useRef(0);

  const snapPoints = {
    closed: '100%',
    peek: '85%', 
    half: '50%',
    full: '5%'
  };

  const handleTouchStart = useCallback((e) => {
    if (!isOpen) return;
    setIsDragging(true);
    startY.current = e.touches[0].clientY;
    currentY.current = dragY;
  }, [isOpen, dragY]);

  const handleTouchMove = useCallback((e) => {
    if (!isDragging) return;
    
    const deltaY = e.touches[0].clientY - startY.current;
    const newY = Math.max(0, currentY.current + deltaY);
    setDragY(newY);
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    const windowHeight = window.innerHeight;
    const threshold = windowHeight * 0.2;

    if (dragY > threshold) {
      // Close if dragged down significantly
      setSnapPosition('closed');
      setDragY(0);
      onClose();
    } else if (dragY < -threshold) {
      // Full open if dragged up significantly
      setSnapPosition('full');
      setDragY(0);
    } else {
      // Snap to nearest position
      setSnapPosition('half');
      setDragY(0);
    }
  }, [isDragging, dragY, onClose]);

  const handleMouseDown = useCallback((e) => {
    if (!isOpen) return;
    setIsDragging(true);
    startY.current = e.clientY;
    currentY.current = dragY;
  }, [isOpen, dragY]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    
    const deltaY = e.clientY - startY.current;
    const newY = Math.max(0, currentY.current + deltaY);
    setDragY(newY);
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    const windowHeight = window.innerHeight;
    const threshold = windowHeight * 0.2;

    if (dragY > threshold) {
      setSnapPosition('closed');
      setDragY(0);
      onClose();
    } else if (dragY < -threshold) {
      setSnapPosition('full');
      setDragY(0);
    } else {
      setSnapPosition('half');
      setDragY(0);
    }
  }, [isDragging, dragY, onClose]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  useEffect(() => {
    if (!isOpen) {
      setSnapPosition('closed');
      setDragY(0);
    } else {
      setSnapPosition('half');
    }
  }, [isOpen]);

  const getTransform = () => {
    if (!isOpen) return 'translateY(100%)';
    
    if (isDragging) {
      return `translateY(${dragY}px)`;
    }
    
    return `translateY(${snapPoints[snapPosition]})`;
  };

  const getBackdropOpacity = () => {
    if (!isOpen) return 0;
    
    if (isDragging) {
      const progress = Math.max(0, Math.min(1, 1 - (dragY / window.innerHeight)));
      return progress * 0.5;
    }
    
    return snapPosition === 'closed' ? 0 : 0.5;
  };

  return {
    containerRef,
    transform: getTransform(),
    backdropOpacity: getBackdropOpacity(),
    isDragging,
    snapPosition,
    handlers: {
      onTouchStart: handleTouchStart,
      onMouseDown: handleMouseDown,
    }
  };
};