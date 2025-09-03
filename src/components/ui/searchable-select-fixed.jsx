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
  const [isInDialog, setIsInDialog] = useState(false);
  const [isNavigatingWithKeyboard, setIsNavigatingWithKeyboard] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    return options.filter(option => 
      (option.label || option.name)?.toLowerCase().includes(search.toLowerCase())
    );
  }, [options, search]);

  const selectedOption = options.find(option => {
    const optionValue = option.value || option.id;
    return String(optionValue) === String(value);
  });

  // إضافة fallback للقيمة الموجودة بدون options - الحل الجذري النهائي
  const displayText = selectedOption?.label || selectedOption?.name || 
    (value && !selectedOption && options.length === 0 ? `القيمة: ${value}` : placeholder);
  
  // Detect touch device and dialog presence
  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
    
    if (buttonRef.current) {
      const dialogContainer = buttonRef.current.closest('[data-radix-dialog-content], [role="dialog"]');
      setIsInDialog(!!dialogContainer);
    }
  }, [open]);

  // Simplified interaction handling for better mobile support
  useEffect(() => {
    if (!open) return;

    const handleGlobalClick = (event) => {
      const target = event.target;
      const button = buttonRef.current;
      const dropdown = dropdownRef.current;

      // Don't close if clicking inside our components
      if (button?.contains(target) || dropdown?.contains(target)) {
        return;
      }

      // Close dropdown for outside clicks with minimal delay
      setTimeout(() => setOpen(false), 50);
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setSearch('');
        setIsNavigatingWithKeyboard(false);
        buttonRef.current?.focus();
      }
    };

    // Only listen to clicks, avoid touch conflicts
    document.addEventListener('click', handleGlobalClick, true);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('click', handleGlobalClick, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  // Focus search input when opening - enhanced for dialogs
  useEffect(() => {
    if (open && searchInputRef.current) {
      const delay = isInDialog ? 50 : 100;
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, delay);
    }
  }, [open, isInDialog]);

  const handleToggle = () => {
    if (!disabled) {
      setOpen(!open);
      setSearch('');
    }
  };

  const handleOptionSelect = (optionValue) => {
    onValueChange(optionValue);
    setOpen(false);
    setSearch('');
    setIsNavigatingWithKeyboard(false);
    // Return focus to the button after selection
    setTimeout(() => buttonRef.current?.focus(), 100);
  };

  const handleSearchChange = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setSearch(e.target.value);
  };

  // Improved keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      
      setIsNavigatingWithKeyboard(true);
      
      const options = dropdownRef.current?.querySelectorAll('[data-option]');
      if (options) {
        const currentIndex = Array.from(options).findIndex(opt => opt.classList.contains('bg-accent'));
        let nextIndex = -1;
        
        if (e.key === 'ArrowDown') {
          nextIndex = currentIndex < options.length - 1 ? currentIndex + 1 : 0;
        } else {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : options.length - 1;
        }
        
        // Remove previous highlight
        options.forEach(opt => opt.classList.remove('bg-accent'));
        // Add highlight to new option
        if (options[nextIndex]) {
          options[nextIndex].classList.add('bg-accent');
          options[nextIndex].scrollIntoView({ block: 'nearest' });
        }
      }
      
      // Reset keyboard navigation flag with minimal delay
      setTimeout(() => setIsNavigatingWithKeyboard(false), 100);
      
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      const selectedOption = dropdownRef.current?.querySelector('[data-option].bg-accent');
      if (selectedOption) {
        const value = selectedOption.getAttribute('data-value') || 
                     filteredOptions[Array.from(dropdownRef.current.querySelectorAll('[data-option]')).indexOf(selectedOption)]?.value;
        if (value) handleOptionSelect(value);
      }
      setIsNavigatingWithKeyboard(false);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setSearch('');
      setIsNavigatingWithKeyboard(false);
    }
  };

  // Render dropdown content
  const renderDropdownContent = () => (
    <div 
      ref={dropdownRef}
      className="bg-background border border-border rounded-md shadow-xl max-h-60 overflow-hidden animate-in fade-in-0 zoom-in-95 slide-in-from-top-2"
      style={{ 
        direction: 'rtl',
        minWidth: '200px',
        maxWidth: '400px',
        pointerEvents: 'auto',
        backgroundColor: 'hsl(var(--background))',
        borderColor: 'hsl(var(--border))',
        zIndex: 99999
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
              onKeyDown={handleKeyDown}
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
            const optionLabel = option.label || option.name;
            const isSelected = String(value) === String(optionValue);
            
            return (
              <div
                key={optionValue}
                data-option
                data-value={optionValue}
                className={cn(
                  "relative flex cursor-pointer select-none items-center rounded-sm py-2 px-3 text-sm outline-none transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  "focus:bg-accent focus:text-accent-foreground",
                  "touch-manipulation min-h-[44px]",
                  isSelected && "bg-accent text-accent-foreground"
                )}
                onTouchStart={(e) => {
                  // Track touch start for scroll detection
                  e.currentTarget.touchStartY = e.touches[0].clientY;
                  e.currentTarget.touchStartX = e.touches[0].clientX;
                  e.currentTarget.touchStartTime = Date.now();
                }}
                onTouchMove={(e) => {
                  // Track touch movement to detect scrolling
                  if (e.currentTarget.touchStartY !== undefined) {
                    const deltaY = Math.abs(e.touches[0].clientY - e.currentTarget.touchStartY);
                    const deltaX = Math.abs(e.touches[0].clientX - e.currentTarget.touchStartX);
                    
                    // If user moved more than 10px, it's likely scrolling
                    if (deltaY > 10 || deltaX > 10) {
                      e.currentTarget.isScrolling = true;
                    }
                  }
                }}
                onTouchEnd={(e) => {
                  if (isTouchDevice) {
                    e.stopPropagation();
                    
                    const touchDuration = Date.now() - (e.currentTarget.touchStartTime || 0);
                    const isScrolling = e.currentTarget.isScrolling;
                    
                    // Only select if it's a quick tap (not scrolling)
                    if (!isScrolling && touchDuration < 300) {
                      e.preventDefault();
                      handleOptionSelect(optionValue);
                    }
                    
                    // Reset touch tracking
                    e.currentTarget.touchStartY = undefined;
                    e.currentTarget.touchStartX = undefined;
                    e.currentTarget.touchStartTime = undefined;
                    e.currentTarget.isScrolling = false;
                  }
                }}
                onClick={(e) => {
                  if (!isTouchDevice) {
                    e.stopPropagation();
                    e.preventDefault();
                    handleOptionSelect(optionValue);
                  }
                }}
                onMouseEnter={(e) => {
                  if (!isTouchDevice) {
                    const allOptions = dropdownRef.current?.querySelectorAll('[data-option]');
                    allOptions?.forEach(opt => opt.classList.remove('bg-accent'));
                    e.currentTarget.classList.add('bg-accent');
                  }
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
    </div>
  );

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

      {/* Dropdown - Smart Portal Strategy */}
      {open && (
        isInDialog ? (
          // Inside Dialog: Use absolute positioning with enhanced z-index for regions
          <div 
            className="absolute z-[99999] mt-1 w-full"
            style={{
              direction: 'rtl',
              position: 'absolute',
              zIndex: 99999
            }}
          >
            {renderDropdownContent()}
          </div>
        ) : (
          // Outside Dialog: Use portal with enhanced z-index
          createPortal(
            <div 
              className="fixed z-[999999]"
              style={{ 
                direction: 'rtl',
                left: buttonRef.current?.getBoundingClientRect().left || 0,
                top: (buttonRef.current?.getBoundingClientRect().bottom || 0) + 4,
                width: buttonRef.current?.getBoundingClientRect().width || 'auto',
                zIndex: 999999,
                position: 'fixed'
              }}
            >
              {renderDropdownContent()}
            </div>,
            document.body
          )
        )
      )}
    </div>
  );
};

export default SearchableSelectFixed;