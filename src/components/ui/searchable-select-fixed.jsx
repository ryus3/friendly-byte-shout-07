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
  
  // Detect if component is inside a Radix Dialog
  useEffect(() => {
    if (buttonRef.current) {
      const dialogContainer = buttonRef.current.closest('[data-radix-dialog-content], [role="dialog"]');
      setIsInDialog(!!dialogContainer);
    }
  }, [open]);

  // Close dropdown when clicking outside - improved for dialogs
  useEffect(() => {
    const handleClickOutside = (event) => {
      setTimeout(() => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
            buttonRef.current && !buttonRef.current.contains(event.target)) {
          const isDialogClick = event.target.closest('[role="dialog"], .dialog-overlay, [data-radix-dialog-overlay]');
          if (!isDialogClick) {
            setOpen(false);
          }
        }
      }, 100);
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
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
    setTimeout(() => {
      setOpen(false);
      setSearch('');
    }, 50);
  };

  const handleSearchChange = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setSearch(e.target.value);
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
        pointerEvents: 'auto'
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
            onKeyDown={(e) => e.stopPropagation()}
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
          // Inside Dialog: Use absolute positioning within dialog
          <div 
            className="absolute z-[9999] mt-1 w-full"
            style={{
              direction: 'rtl'
            }}
          >
            {renderDropdownContent()}
          </div>
        ) : (
          // Outside Dialog: Use portal with fixed positioning
          createPortal(
            <div 
              className="fixed z-[99999]"
              style={{ 
                direction: 'rtl',
                left: buttonRef.current?.getBoundingClientRect().left || 0,
                top: (buttonRef.current?.getBoundingClientRect().bottom || 0) + 4,
                width: buttonRef.current?.getBoundingClientRect().width || 'auto'
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