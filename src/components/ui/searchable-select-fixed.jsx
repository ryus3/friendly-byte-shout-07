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

  // Dialog context detection
  const getDialogContainer = useCallback(() => {
    const dialogContent = document.querySelector('[data-radix-dialog-content]');
    const dialogOverlay = document.querySelector('[data-radix-dialog-overlay]');
    return dialogContent || dialogOverlay || document.body;
  }, []);

  // Enhanced portal container for dialog compatibility
  const getPortalContainer = useCallback(() => {
    const dialogContent = document.querySelector('[data-radix-dialog-content]');
    if (dialogContent) {
      // If inside dialog, create a dedicated container
      let dropdownContainer = dialogContent.querySelector('[data-dropdown-portal]');
      if (!dropdownContainer) {
        dropdownContainer = document.createElement('div');
        dropdownContainer.setAttribute('data-dropdown-portal', 'true');
        dropdownContainer.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 99999999999;
        `;
        dialogContent.appendChild(dropdownContainer);
      }
      return dropdownContainer;
    }
    return document.body;
  }, []);

  // Enhanced click outside handling for dialog compatibility
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!open) return;
      
      const isInsideDropdown = dropdownRef.current?.contains(event.target);
      const isInsideButton = buttonRef.current?.contains(event.target);
      
      if (!isInsideDropdown && !isInsideButton) {
        // Advanced dialog detection
        const dialogPortal = event.target.closest('[data-dropdown-portal]');
        const dialogOverlay = event.target.closest('[data-radix-dialog-overlay]');
        const dialogContent = event.target.closest('[data-radix-dialog-content]');
        const anyDialog = event.target.closest('[role="dialog"]');
        
        // Only close if not clicking on any dialog-related element
        if (!dialogPortal && !dialogOverlay && !dialogContent && !anyDialog) {
          setOpen(false);
        }
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

  // Enhanced focus management for dialog compatibility
  useEffect(() => {
    if (open && searchInputRef.current) {
      const isInDialog = !!document.querySelector('[data-radix-dialog-content]');
      const focusDelays = isInDialog ? [10, 50, 100, 200, 500, 1000] : [50, 100];
      
      focusDelays.forEach(delay => {
        setTimeout(() => {
          if (searchInputRef.current && open) {
            try {
              // Override dialog focus trap temporarily
              const originalTabIndex = searchInputRef.current.tabIndex;
              searchInputRef.current.tabIndex = 0;
              searchInputRef.current.focus({ preventScroll: true });
              searchInputRef.current.select();
              
              // Restore original tabIndex
              setTimeout(() => {
                if (searchInputRef.current) {
                  searchInputRef.current.tabIndex = originalTabIndex;
                }
              }, 10);
            } catch (e) {
              // Silent fail for focus attempts
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

  const handleOptionSelect = useCallback((optionValue) => {
    onValueChange(optionValue);
    setOpen(false);
    setSearch('');
  }, [onValueChange]);

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
          className="fixed bg-background border border-border rounded-md shadow-xl max-h-60 overflow-hidden animate-in fade-in-0 zoom-in-95 slide-in-from-top-2"
          style={{ 
            direction: 'rtl',
            left: buttonRef.current?.getBoundingClientRect().left || 0,
            top: (buttonRef.current?.getBoundingClientRect().bottom || 0) + 4,
            width: buttonRef.current?.getBoundingClientRect().width || 'auto',
            minWidth: '200px',
            maxWidth: '400px',
            pointerEvents: 'auto',
            isolation: 'isolate',
            transform: 'translateZ(0)',
            zIndex: '99999999999',
            contain: 'layout style paint'
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            e.stopImmediatePropagation();
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
                onKeyDown={(e) => {
                  e.stopPropagation();
                  e.stopImmediatePropagation();
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    setOpen(false);
                  }
                }}
                onKeyUp={(e) => {
                  e.stopPropagation();
                  e.stopImmediatePropagation();
                }}
                onInput={(e) => {
                  e.stopPropagation();
                  e.stopImmediatePropagation();
                }}
                onFocus={(e) => {
                  e.stopPropagation();
                  e.stopImmediatePropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.stopImmediatePropagation();
                }}
                className="pr-10 text-right border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
                autoComplete="off"
                autoFocus
                tabIndex={0}
                style={{ 
                  pointerEvents: 'auto',
                  userSelect: 'text',
                  caretColor: 'auto'
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
        getPortalContainer()
      )}
    </div>
  );
};

export default SearchableSelectFixed;