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

  // Advanced Dialog Context Detection with Multiple Fallbacks
  const getDialogContext = useCallback(() => {
    // Check for multiple dialog content selectors
    const dialogContent = document.querySelector('[data-radix-dialog-content]') ||
                         document.querySelector('[role="dialog"]') ||
                         document.querySelector('.dialog-content') ||
                         document.querySelector('[data-dialog-content]');
    
    const dialogOverlay = document.querySelector('[data-radix-dialog-overlay]') ||
                         document.querySelector('.dialog-overlay') ||
                         document.querySelector('[data-dialog-overlay]');
    
    return {
      content: dialogContent,
      overlay: dialogOverlay,
      isInDialog: !!(dialogContent || dialogOverlay)
    };
  }, []);

  // Revolutionary Portal Container for Ultimate Dialog Compatibility
  const getAdvancedPortalContainer = useCallback(() => {
    const { content: dialogContent, isInDialog } = getDialogContext();
    
    if (isInDialog && dialogContent) {
      // Create a supreme dropdown container within the dialog
      let supremeContainer = dialogContent.querySelector('[data-supreme-dropdown-portal]');
      if (!supremeContainer) {
        supremeContainer = document.createElement('div');
        supremeContainer.setAttribute('data-supreme-dropdown-portal', 'true');
        supremeContainer.setAttribute('data-dropdown-portal', 'true');
        supremeContainer.style.cssText = `
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          pointer-events: none !important;
          z-index: 999999999999999 !important;
          isolation: isolate !important;
          contain: layout style paint !important;
          transform: translateZ(0) !important;
          will-change: transform !important;
        `;
        
        // Append to dialog content or document body as fallback
        try {
          dialogContent.appendChild(supremeContainer);
        } catch (e) {
          document.body.appendChild(supremeContainer);
        }
      }
      return supremeContainer;
    }
    
    // Fallback to document body for non-dialog usage
    return document.body;
  }, [getDialogContext]);

  // Ultimate Click Outside Handler with Dialog Supremacy
  useEffect(() => {
    const handleSupremeClickOutside = (event) => {
      if (!open) return;
      
      const isInsideDropdown = dropdownRef.current?.contains(event.target);
      const isInsideButton = buttonRef.current?.contains(event.target);
      
      if (!isInsideDropdown && !isInsideButton) {
        const { isInDialog } = getDialogContext();
        
        // Supreme dialog detection with multiple selectors
        const dialogPortal = event.target.closest('[data-dropdown-portal]') ||
                           event.target.closest('[data-supreme-dropdown-portal]');
        const dialogOverlay = event.target.closest('[data-radix-dialog-overlay]') ||
                             event.target.closest('.dialog-overlay') ||
                             event.target.closest('[data-dialog-overlay]');
        const dialogContent = event.target.closest('[data-radix-dialog-content]') ||
                             event.target.closest('[role="dialog"]') ||
                             event.target.closest('.dialog-content');
        const anyDialogElement = event.target.closest('[data-dialog]') ||
                               event.target.closest('.dialog');
        
        // Enhanced condition: only close if truly outside all dialog-related elements
        const isInDialogContext = dialogPortal || dialogOverlay || dialogContent || anyDialogElement;
        
        if (isInDialog) {
          // Inside dialog: only close if clicking outside all dialog elements
          if (!isInDialogContext) {
            setOpen(false);
          }
        } else {
          // Outside dialog: normal behavior
          setOpen(false);
        }
      }
    };

    const handleSupremeEscapeKey = (event) => {
      if (event.key === 'Escape' && open) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        setOpen(false);
      }
    };

    const handleDialogFocusTrap = (event) => {
      // Override dialog focus trap when interacting with dropdown
      if (open && dropdownRef.current?.contains(event.target)) {
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
    };

    if (open) {
      // Use capture phase for supreme event handling
      document.addEventListener('mousedown', handleSupremeClickOutside, { capture: true, passive: false });
      document.addEventListener('touchstart', handleSupremeClickOutside, { capture: true, passive: false });
      document.addEventListener('keydown', handleSupremeEscapeKey, { capture: true, passive: false });
      document.addEventListener('focusin', handleDialogFocusTrap, { capture: true, passive: false });
      document.addEventListener('focusout', handleDialogFocusTrap, { capture: true, passive: false });
    }
    
    return () => {
      document.removeEventListener('mousedown', handleSupremeClickOutside, { capture: true });
      document.removeEventListener('touchstart', handleSupremeClickOutside, { capture: true });
      document.removeEventListener('keydown', handleSupremeEscapeKey, { capture: true });
      document.removeEventListener('focusin', handleDialogFocusTrap, { capture: true });
      document.removeEventListener('focusout', handleDialogFocusTrap, { capture: true });
    };
  }, [open, getDialogContext]);

  // Revolutionary Focus Management System for Ultimate Dialog Compatibility
  useEffect(() => {
    if (open && searchInputRef.current) {
      const { isInDialog } = getDialogContext();
      
      // Supreme focus strategy with escalating delays and multiple techniques
      const supremeFocusDelays = isInDialog 
        ? [5, 10, 25, 50, 100, 200, 350, 500, 750, 1000, 1500] 
        : [10, 50, 100];
      
      // Override dialog focus trap and input attributes
      const overrideDialogFocusTrap = () => {
        if (searchInputRef.current) {
          // Store original attributes
          const originalAttrs = {
            tabIndex: searchInputRef.current.tabIndex,
            disabled: searchInputRef.current.disabled,
            readOnly: searchInputRef.current.readOnly
          };
          
          // Supreme override
          searchInputRef.current.tabIndex = 0;
          searchInputRef.current.disabled = false;
          searchInputRef.current.readOnly = false;
          searchInputRef.current.style.pointerEvents = 'auto';
          searchInputRef.current.style.userSelect = 'text';
          searchInputRef.current.removeAttribute('aria-hidden');
          searchInputRef.current.removeAttribute('inert');
          
          return originalAttrs;
        }
        return null;
      };
      
      // Execute supreme focus strategy
      supremeFocusDelays.forEach((delay, index) => {
        setTimeout(() => {
          if (searchInputRef.current && open) {
            try {
              const originalAttrs = overrideDialogFocusTrap();
              
              // Multiple focus techniques
              searchInputRef.current.focus({ 
                preventScroll: false,
                focusVisible: true 
              });
              
              // Additional focus techniques for dialog context
              if (isInDialog) {
                // Force focus with click simulation
                searchInputRef.current.click();
                searchInputRef.current.select();
                
                // Blur and refocus technique
                if (index > 2) {
                  searchInputRef.current.blur();
                  setTimeout(() => {
                    if (searchInputRef.current && open) {
                      searchInputRef.current.focus();
                      searchInputRef.current.select();
                    }
                  }, 10);
                }
              }
              
              // Restore attributes after a delay
              setTimeout(() => {
                if (searchInputRef.current && originalAttrs) {
                  Object.assign(searchInputRef.current, originalAttrs);
                }
              }, 50);
              
            } catch (e) {
              // Silent fail but try alternative approaches
              if (isInDialog && searchInputRef.current) {
                searchInputRef.current.style.display = 'none';
                setTimeout(() => {
                  if (searchInputRef.current) {
                    searchInputRef.current.style.display = '';
                    searchInputRef.current.focus();
                  }
                }, 1);
              }
            }
          }
        }, delay);
      });
      
      // Continuous focus monitoring for dialog context
      if (isInDialog) {
        const focusMonitor = setInterval(() => {
          if (open && searchInputRef.current && document.activeElement !== searchInputRef.current) {
            try {
              searchInputRef.current.focus({ preventScroll: true });
            } catch (e) {
              // Silent fail
            }
          } else if (!open) {
            clearInterval(focusMonitor);
          }
        }, 200);
        
        // Cleanup monitor
        setTimeout(() => clearInterval(focusMonitor), 5000);
      }
    }
  }, [open, getDialogContext]);

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

      {/* Supreme Dropdown Portal with Ultimate Dialog Compatibility */}
      {open && createPortal(
        <div 
          ref={dropdownRef}
          data-dropdown-content="true"
          data-supreme-dropdown="true"
          className="fixed bg-popover border border-border rounded-md shadow-2xl max-h-60 overflow-hidden animate-in fade-in-0 zoom-in-95 slide-in-from-top-2"
          style={{ 
            direction: 'rtl',
            left: buttonRef.current?.getBoundingClientRect().left || 0,
            top: (buttonRef.current?.getBoundingClientRect().bottom || 0) + 4,
            width: buttonRef.current?.getBoundingClientRect().width || 'auto',
            minWidth: '200px',
            maxWidth: '500px',
            pointerEvents: 'auto !important',
            isolation: 'isolate',
            transform: 'translateZ(0)',
            zIndex: '999999999999999',
            contain: 'layout style paint',
            willChange: 'transform, opacity',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            position: 'fixed !important'
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
          onFocus={(e) => {
            e.stopPropagation();
            e.stopImmediatePropagation();
          }}
          onBlur={(e) => {
            e.stopPropagation();
            e.stopImmediatePropagation();
          }}
        >
          {/* Supreme Search Input with Ultimate Focus Management */}
          <div className="p-1 border-b border-border bg-popover">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                ref={searchInputRef}
                data-supreme-search="true"
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
                onBlur={(e) => {
                  e.stopPropagation();
                  e.stopImmediatePropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.stopImmediatePropagation();
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.stopImmediatePropagation();
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  e.stopImmediatePropagation();
                }}
                className="pr-10 text-right border-0 focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0 bg-background/50 backdrop-blur-sm"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                autoFocus
                tabIndex={0}
                disabled={false}
                readOnly={false}
                style={{ 
                  pointerEvents: 'auto !important',
                  userSelect: 'text !important',
                  caretColor: 'auto !important',
                  outline: 'none !important',
                  WebkitUserSelect: 'text !important',
                  MozUserSelect: 'text !important',
                  msUserSelect: 'text !important'
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
        getAdvancedPortalContainer()
      )}
    </div>
  );
};

export default SearchableSelectFixed;