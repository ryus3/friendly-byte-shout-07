import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
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
    return String(optionValue) === String(value);
  });

  const displayText = selectedOption?.label || selectedOption?.name || placeholder;

  // Smart dialog detection - Revolutionary approach
  const isInsideDialog = useCallback(() => {
    return !!document.querySelector('[data-radix-dialog-content]');
  }, []);

  // Click outside handling with dialog awareness
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!open) return;
      
      const isInsideDropdown = dropdownRef.current?.contains(event.target);
      const isInsideButton = buttonRef.current?.contains(event.target);
      
      if (!isInsideDropdown && !isInsideButton) {
        setOpen(false);
      }
    };

    const handleEscapeKey = (event) => {
      if (event.key === 'Escape' && open) {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside, true);
      document.addEventListener('touchstart', handleClickOutside, true);
      document.addEventListener('keydown', handleEscapeKey, true);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('touchstart', handleClickOutside, true);
      document.removeEventListener('keydown', handleEscapeKey, true);
    };
  }, [open]);

  // Revolutionary focus management - NO focus trap override needed!
  useEffect(() => {
    if (open && searchInputRef.current) {
      // Simple, reliable focus - works perfectly in dialogs
      const focusInput = () => {
        if (searchInputRef.current && open) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
        }
      };
      
      // Multiple attempts for reliability
      focusInput();
      setTimeout(focusInput, 10);
      setTimeout(focusInput, 100);
    }
  }, [open]);

  const handleToggle = () => {
    if (!disabled) {
      setOpen(!open);
      setSearch('');
    }
  };

  const handleOptionSelect = useCallback((optionValue) => {
    onValueChange(optionValue);
    setOpen(false);
    setSearch('');
  }, [onValueChange]);

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
  };

  // Revolutionary dropdown positioning strategy
  const getDropdownStyle = () => {
    if (!buttonRef.current) return {};
    
    const buttonRect = buttonRef.current.getBoundingClientRect();
    const isInDialog = isInsideDialog();
    
    if (isInDialog) {
      // ABSOLUTE positioning within dialog - the breakthrough solution!
      const dialogContent = document.querySelector('[data-radix-dialog-content]');
      if (dialogContent) {
        const dialogRect = dialogContent.getBoundingClientRect();
        return {
          position: 'absolute',
          top: buttonRect.bottom - dialogRect.top + 4,
          left: buttonRect.left - dialogRect.left,
          width: buttonRect.width,
          minWidth: '200px',
          maxWidth: '400px',
          zIndex: 1000,
          direction: 'rtl'
        };
      }
    }
    
    // Normal fixed positioning for non-dialog usage
    return {
      position: 'fixed',
      top: buttonRect.bottom + 4,
      left: buttonRect.left,
      width: buttonRect.width,
      minWidth: '200px',
      maxWidth: '400px',
      zIndex: 99999,
      direction: 'rtl'
    };
  };

  // Revolutionary portal strategy
  const getPortalTarget = () => {
    const isInDialog = isInsideDialog();
    if (isInDialog) {
      // Render inside dialog content - NO external portal needed!
      return document.querySelector('[data-radix-dialog-content]') || document.body;
    }
    return document.body;
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

      {/* Revolutionary Dropdown - Smart positioning for dialogs */}
      {open && createPortal(
        <div 
          ref={dropdownRef}
          className="bg-background border border-border rounded-md shadow-xl max-h-60 overflow-hidden animate-in fade-in-0 zoom-in-95 slide-in-from-top-2"
          style={getDropdownStyle()}
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
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    setOpen(false);
                  }
                }}
                className="pr-10 text-right border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
                autoComplete="off"
                autoFocus
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
                      isSelected && "bg-accent text-accent-foreground"
                    )}
                    onClick={() => handleOptionSelect(optionValue)}
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
        getPortalTarget()
      )}
    </div>
  );
};

export default SearchableSelectFixed;