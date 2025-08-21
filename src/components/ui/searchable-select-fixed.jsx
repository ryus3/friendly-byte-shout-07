import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

const SearchableSelectFixed = ({ 
  value, 
  onValueChange, 
  options = [], 
  placeholder = "اختر...", 
  searchPlaceholder = "بحث...", 
  emptyText = "لا توجد نتائج",
  className,
  disabled = false
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);
  const searchInputRef = useRef(null);

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    return options.filter(option => 
      (option.label || option.name || option.name_ar)?.toLowerCase().includes(search.toLowerCase())
    );
  }, [options, search]);

  // Enhanced type-safe option finding with multiple comparison methods
  const selectedOption = useMemo(() => {
    if (!value || !options || options.length === 0) return null;
    
    console.log('🔍 البحث عن الخيار المحدد:', { value, valueType: typeof value, optionsCount: options.length });
    
    // Try multiple comparison methods for robustness
    const found = options.find(option => {
      const optionValue = option.value || option.id;
      
      // Exact match first
      if (optionValue === value) return true;
      
      // String comparison (handles number-string conversions)
      if (String(optionValue) === String(value)) return true;
      
      // Numeric comparison for cases where one is string and other is number
      if (!isNaN(optionValue) && !isNaN(value) && Number(optionValue) === Number(value)) return true;
      
      return false;
    });
    
    console.log('🎯 الخيار الموجود:', found);
    return found || null;
  }, [value, options]);

  // Enhanced display text with fallback logic
  const displayText = useMemo(() => {
    if (!selectedOption) return placeholder;
    
    // Try multiple name properties in order of preference
    const name = selectedOption.label || 
                 selectedOption.name || 
                 selectedOption.name_ar || 
                 selectedOption.city_name || 
                 selectedOption.region_name ||
                 `Option ${selectedOption.id || selectedOption.value}`;
    
    console.log('📝 النص المعروض:', name);
    return name;
  }, [selectedOption, placeholder]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
          buttonRef.current && !buttonRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Focus search input when opening
  useEffect(() => {
    if (open && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  const handleToggle = () => {
    if (!disabled) {
      setOpen(!open);
      setSearch('');
    }
  };

  const handleOptionSelect = (optionValue) => {
    console.log('🎯 تم اختيار القيمة:', optionValue);
    onValueChange(optionValue);
    setOpen(false);
    setSearch('');
  };

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
  };

  return (
    <div className="relative w-full">
      {/* Trigger Button */}
      <Button
        ref={buttonRef}
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className={cn("w-full justify-between", className)}
        onClick={handleToggle}
        disabled={disabled}
        type="button"
      >
        <span className="truncate text-right flex-1">{displayText}</span>
        <ChevronDown className={cn("ml-2 h-4 w-4 shrink-0 opacity-50 transition-transform", open && "rotate-180")} />
      </Button>

      {/* Dropdown */}
      {open && createPortal(
        <div 
          ref={dropdownRef}
          className="fixed z-[9999] bg-background border border-border rounded-md shadow-lg max-h-60 overflow-hidden animate-in fade-in-0 zoom-in-95 slide-in-from-top-2"
          style={{ 
            direction: 'rtl',
            left: buttonRef.current?.getBoundingClientRect().left || 0,
            top: (buttonRef.current?.getBoundingClientRect().bottom || 0) + 4,
            width: buttonRef.current?.getBoundingClientRect().width || 'auto',
            minWidth: '200px',
            maxWidth: '400px'
          }}
        >
          {/* Search Input */}
          <div className="p-1 border-b border-border">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder={searchPlaceholder}
                value={search}
                onChange={handleSearchChange}
                className="pr-10 text-right border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
                autoComplete="off"
              />
            </div>
          </div>

          {/* Options List */}
          <div className="p-1 max-h-48 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {emptyText}
              </div>
            ) : (
              filteredOptions.map((option) => {
                const optionValue = option.value || option.id;
                const optionLabel = option.label || option.name || option.name_ar || option.city_name || option.region_name;
                
                // Enhanced type-safe selection check
                const isSelected = value === optionValue || 
                                 String(value) === String(optionValue) || 
                                 (!isNaN(value) && !isNaN(optionValue) && Number(value) === Number(optionValue));
                
                return (
                  <div
                    key={optionValue}
                    className={cn(
                      "relative flex cursor-pointer select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      "active:bg-accent active:text-accent-foreground",
                      "focus:bg-accent focus:text-accent-foreground",
                      "touch-manipulation",
                      isSelected && "bg-accent text-accent-foreground"
                    )}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleOptionSelect(optionValue);
                    }}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleOptionSelect(optionValue);
                    }}
                    style={{ 
                      WebkitTapHighlightColor: 'rgba(0,0,0,0)',
                      touchAction: 'manipulation',
                      userSelect: 'none'
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="flex-1 text-right">{optionLabel}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default SearchableSelectFixed;