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

  // Enhanced outside click handling for dialogs
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Don't close if clicking on our own elements
      if (dropdownRef.current?.contains(event.target) || 
          buttonRef.current?.contains(event.target)) {
        return;
      }
      
      // Don't interfere with dialog interactions unless explicitly outside
      const isDialogOrModal = event.target.closest('[role="dialog"], [data-dialog], .dialog-overlay, [data-radix-dialog-overlay], [data-radix-dialog-content], .modal, .popover');
      
      // Only close if clearly outside both dropdown and dialog
      if (!isDialogOrModal) {
        setOpen(false);
      }
    };

    if (open) {
      // Delay listener to avoid immediate triggering
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside, { capture: true, passive: true });
        document.addEventListener('touchstart', handleClickOutside, { capture: true, passive: true });
      }, 100);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('touchstart', handleClickOutside, true);
    };
  }, [open]);

  // Enhanced focus management for dialog context
  useEffect(() => {
    if (open && searchInputRef.current) {
      // Multiple attempts with increasing delays for better reliability
      const focusAttempts = [10, 50, 100, 200];
      
      focusAttempts.forEach((delay, index) => {
        setTimeout(() => {
          if (searchInputRef.current && open) {
            try {
              searchInputRef.current.focus({ preventScroll: true });
              if (index === 0) searchInputRef.current.select();
            } catch (e) {
              console.warn('Focus attempt failed:', e);
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
    
    // Prevent event bubbling and default behavior
    event?.preventDefault?.();
    event?.stopPropagation?.();
    
    // Set value immediately
    onValueChange(optionValue);
    
    // Close dropdown with slight delay to ensure value is processed
    requestAnimationFrame(() => {
      setOpen(false);
      setSearch('');
    });
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

      {/* Enhanced Dropdown with maximum z-index and improved positioning */}
      {open && createPortal(
        <div 
          ref={dropdownRef}
          className="fixed bg-background border border-border rounded-md shadow-2xl max-h-60 overflow-hidden"
          style={{ 
            direction: 'rtl',
            left: buttonRef.current?.getBoundingClientRect().left || 0,
            top: (buttonRef.current?.getBoundingClientRect().bottom || 0) + 4,
            width: buttonRef.current?.getBoundingClientRect().width || 'auto',
            minWidth: '200px',
            maxWidth: '400px',
            zIndex: 999999999, // Maximum possible z-index
            position: 'fixed',
            pointerEvents: 'auto',
            isolation: 'isolate',
            transform: 'translateZ(0)', // Force hardware acceleration
            willChange: 'transform'
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.stopImmediatePropagation();
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            e.stopImmediatePropagation();
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.stopImmediatePropagation();
          }}
        >
          {/* Enhanced Search Input with full event isolation */}
          <div 
            className="p-1 border-b border-border" 
            onMouseDown={(e) => {
              e.stopPropagation();
              e.stopImmediatePropagation();
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              e.stopImmediatePropagation();
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.stopImmediatePropagation();
            }}
          >
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                ref={searchInputRef}
                placeholder={searchPlaceholder}
                value={search}
                onChange={handleSearchChange}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.stopImmediatePropagation();
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  e.stopImmediatePropagation();
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.stopImmediatePropagation();
                }}
                onFocus={(e) => {
                  e.stopPropagation();
                  e.stopImmediatePropagation();
                }}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  // Allow typing without closing dropdown
                }}
                className="pr-10 text-right border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
                autoComplete="off"
                tabIndex={0}
                style={{ 
                  touchAction: 'manipulation',
                  pointerEvents: 'auto',
                  isolation: 'isolate'
                }}
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
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.stopImmediatePropagation();
                      console.log('🖱️ Mouse selection:', optionValue);
                      handleOptionSelect(optionValue);
                    }}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.stopImmediatePropagation();
                      console.log('👆 Touch start:', optionValue);
                    }}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.stopImmediatePropagation();
                      console.log('👆 Touch selection:', optionValue);
                      handleOptionSelect(optionValue);
                    }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.stopImmediatePropagation();
                      console.log('👉 Pointer selection:', optionValue);
                      handleOptionSelect(optionValue);
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.stopImmediatePropagation();
                    }}
                    tabIndex={0}
                    role="option"
                    aria-selected={isSelected}
                    style={{ 
                      WebkitTapHighlightColor: 'rgba(0,0,0,0)',
                      touchAction: 'manipulation',
                      userSelect: 'none',
                      pointerEvents: 'auto',
                      isolation: 'isolate'
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