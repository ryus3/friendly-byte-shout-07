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
      // منع الإغلاق أثناء التنقل بالكيبورد
      if (isNavigatingWithKeyboard) {
        return;
      }
      
      // تجنب الإغلاق المبكر عند التفاعل مع القائمة
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
          buttonRef.current && !buttonRef.current.contains(event.target)) {
        const isDialogClick = event.target.closest('[role="dialog"], .dialog-overlay, [data-radix-dialog-overlay]');
        if (!isDialogClick) {
          setOpen(false);
        }
      }
    };

    const handleEscapeKey = (event) => {
      if (event.key === 'Escape' && open) {
        setOpen(false);
        setSearch('');
        setIsNavigatingWithKeyboard(false);
      }
    };

    if (open) {
      // تأخير إضافة المستمعين لتجنب الإغلاق الفوري
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
        document.addEventListener('keydown', handleEscapeKey);
      }, 100);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [open, isNavigatingWithKeyboard]);

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

  // منع إغلاق القائمة عند استخدام لوحة المفاتيح
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      
      // تعيين فلاج التنقل بالكيبورد
      setIsNavigatingWithKeyboard(true);
      
      // البحث عن العنصر التالي أو السابق وتمييزه
      const options = dropdownRef.current?.querySelectorAll('[data-option]');
      if (options) {
        const currentIndex = Array.from(options).findIndex(opt => opt.classList.contains('bg-accent'));
        let nextIndex = -1;
        
        if (e.key === 'ArrowDown') {
          nextIndex = currentIndex < options.length - 1 ? currentIndex + 1 : 0;
        } else {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : options.length - 1;
        }
        
        // إزالة التمييز السابق
        options.forEach(opt => opt.classList.remove('bg-accent'));
        // إضافة التمييز للعنصر الجديد
        if (options[nextIndex]) {
          options[nextIndex].classList.add('bg-accent');
          options[nextIndex].scrollIntoView({ block: 'nearest' });
        }
      }
      
      // إزالة فلاج التنقل بالكيبورد بعد تأخير قصير
      setTimeout(() => setIsNavigatingWithKeyboard(false), 200);
      
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      // اختيار العنصر المميز
      const selectedOption = dropdownRef.current?.querySelector('[data-option].bg-accent');
      if (selectedOption) {
        selectedOption.click();
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
                onMouseEnter={(e) => {
                  // إزالة التمييز من العناصر الأخرى
                  const allOptions = dropdownRef.current?.querySelectorAll('[data-option]');
                  allOptions?.forEach(opt => opt.classList.remove('bg-accent'));
                  // تمييز العنصر الحالي
                  e.currentTarget.classList.add('bg-accent');
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