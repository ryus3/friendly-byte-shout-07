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
      (option.label || option.name)?.toLowerCase().includes(search.toLowerCase())
    );
  }, [options, search]);

  const selectedOption = options.find(option => {
    const optionValue = option.value || option.id;
    // Fix type comparison - convert both to strings for accurate matching
    return String(optionValue) === String(value);
  });

  const displayText = selectedOption?.label || selectedOption?.name || placeholder;
  
  // Add console logging for debugging
  console.log('🔍 SearchableSelect Debug:', {
    value,
    valueType: typeof value,
    options: options.slice(0, 3),
    selectedOption,
    displayText
  });

  // Enhanced click outside handling for dialog compatibility
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!open) return;
      
      // Check if clicked element is inside our dropdown or button
      const isInsideDropdown = dropdownRef.current?.contains(event.target);
      const isInsideButton = buttonRef.current?.contains(event.target);
      
      if (!isInsideDropdown && !isInsideButton) {
        // Enhanced dialog detection
        const isDialogOverlay = event.target.closest('[data-radix-dialog-overlay], [data-dialog-overlay]');
        const isDialogContent = event.target.closest('[role="dialog"], [data-radix-dialog-content]');
        
        // Don't close if clicking on dialog overlay or content
        if (!isDialogOverlay && !isDialogContent) {
          setOpen(false);
        }
      }
    };

    if (open) {
      // Use capture phase to handle events before dialog's focus trap
      document.addEventListener('mousedown', handleClickOutside, true);
      document.addEventListener('touchstart', handleClickOutside, true);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('touchstart', handleClickOutside, true);
    };
  }, [open]);

  // Enhanced focus management for dialog compatibility
  useEffect(() => {
    if (open && searchInputRef.current) {
      // Multiple focus attempts with progressive delays
      const focusAttempts = [50, 100, 200, 300];
      
      focusAttempts.forEach(delay => {
        setTimeout(() => {
          if (searchInputRef.current && open) {
            try {
              searchInputRef.current.focus();
              searchInputRef.current.select();
            } catch (e) {
              console.log('Focus attempt failed:', e);
            }
          }
        }, delay);
      });
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
    // Immediate selection without delay
    onValueChange(optionValue);
    // Delay closing to ensure value is set
    setTimeout(() => {
      setOpen(false);
      setSearch('');
    }, 50);
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

      {/* Enhanced Dropdown Portal for Dialog Compatibility */}
      {open && createPortal(
        <div 
          ref={dropdownRef}
          className="fixed z-[999999999] bg-background border border-border rounded-md shadow-xl max-h-60 overflow-hidden animate-in fade-in-0 zoom-in-95 slide-in-from-top-2"
          style={{ 
            direction: 'rtl',
            left: buttonRef.current?.getBoundingClientRect().left || 0,
            top: (buttonRef.current?.getBoundingClientRect().bottom || 0) + 4,
            width: buttonRef.current?.getBoundingClientRect().width || 'auto',
            minWidth: '200px',
            maxWidth: '400px',
            pointerEvents: 'auto',
            isolation: 'isolate',
            transform: 'translateZ(0)'
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
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
                onKeyDown={(e) => e.stopPropagation()}
                onKeyUp={(e) => e.stopPropagation()}
                onInput={(e) => e.stopPropagation()}
                className="pr-10 text-right border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
                autoComplete="off"
                tabIndex={0}
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
                const optionLabel = option.label || option.name;
                const isSelected = String(value) === String(optionValue);
                
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
                    onTouchStart={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
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