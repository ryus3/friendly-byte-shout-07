import React, { createContext, useContext, useState } from 'react';

const VariantsContext = createContext();

export const useVariants = () => useContext(VariantsContext);

export const VariantsProvider = ({ children }) => {
  const [colors, setColors] = useState([
    { id: '1', name: 'أحمر', hex: '#ff0000' },
    { id: '2', name: 'أزرق', hex: '#0000ff' },
    { id: '3', name: 'أخضر', hex: '#00ff00' },
    { id: '4', name: 'أسود', hex: '#000000' },
    { id: '5', name: 'أبيض', hex: '#ffffff' }
  ]);
  
  const [sizes, setSizes] = useState([
    { id: '1', name: 'صغير', abbreviation: 'S' },
    { id: '2', name: 'متوسط', abbreviation: 'M' },
    { id: '3', name: 'كبير', abbreviation: 'L' },
    { id: '4', name: 'كبير جداً', abbreviation: 'XL' }
  ]);
  
  const [categories, setCategories] = useState([
    { id: '1', name: 'ملابس', description: 'ملابس متنوعة' },
    { id: '2', name: 'أحذية', description: 'أحذية مختلفة' },
    { id: '3', name: 'إكسسوارات', description: 'إكسسوارات متنوعة' }
  ]);

  const addColor = (color) => {
    const newColor = { id: Date.now().toString(), ...color };
    setColors(prev => [...prev, newColor]);
  };

  const updateColor = (id, updatedColor) => {
    setColors(prev => prev.map(color => 
      color.id === id ? { ...color, ...updatedColor } : color
    ));
  };

  const deleteColor = (id) => {
    setColors(prev => prev.filter(color => color.id !== id));
  };

  const addSize = (size) => {
    const newSize = { id: Date.now().toString(), ...size };
    setSizes(prev => [...prev, newSize]);
  };

  const updateSize = (id, updatedSize) => {
    setSizes(prev => prev.map(size => 
      size.id === id ? { ...size, ...updatedSize } : size
    ));
  };

  const deleteSize = (id) => {
    setSizes(prev => prev.filter(size => size.id !== id));
  };

  const addCategory = (category) => {
    const newCategory = { id: Date.now().toString(), ...category };
    setCategories(prev => [...prev, newCategory]);
  };

  const updateCategory = (id, updatedCategory) => {
    setCategories(prev => prev.map(category => 
      category.id === id ? { ...category, ...updatedCategory } : category
    ));
  };

  const deleteCategory = (id) => {
    setCategories(prev => prev.filter(category => category.id !== id));
  };

  const value = {
    colors,
    sizes,
    categories,
    addColor,
    updateColor,
    deleteColor,
    addSize,
    updateSize,
    deleteSize,
    addCategory,
    updateCategory,
    deleteCategory
  };

  return (
    <VariantsContext.Provider value={value}>
      {children}
    </VariantsContext.Provider>
  );
};