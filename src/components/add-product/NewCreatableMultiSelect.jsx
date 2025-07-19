import React, { useState, useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, ChevronsUpDown, Check } from 'lucide-react';
import { cn } from "@/lib/utils";

const NewCreatableMultiSelect = ({ items, selectedItems, onSelect, title, itemLabel, onCreateNew }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const handleSelect = (item) => {
    const isSelected = selectedItems.some(s => s.id === item.id);
    if (isSelected) {
      onSelect(selectedItems.filter(s => s.id !== item.id));
    } else {
      onSelect([...selectedItems, item]);
    }
  };

  const handleCreate = () => {
    if (onCreateNew) {
      onCreateNew(search);
      setOpen(false);
      setSearch('');
    }
  };
  
  const filteredItems = useMemo(() => 
    items.filter(item => item[itemLabel].toLowerCase().includes(search.toLowerCase())),
    [items, itemLabel, search]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between text-right h-auto min-h-10">
          <div className="flex flex-wrap gap-1 flex-1 justify-start">
            {selectedItems.length > 0 ? (
              selectedItems.map(item => (
                <Badge key={item.id} variant="secondary" className="flex items-center gap-1">
                  {item.hex_code && (
                    <div 
                      className="w-3 h-3 rounded-full border"
                      style={{ backgroundColor: item.hex_code }}
                    />
                  )}
                  {item[itemLabel]}
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground">اختر {title}...</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 max-h-64 overflow-auto z-[9999] bg-background border shadow-lg" align="start">
        <Command>
          <CommandInput placeholder={`بحث عن ${title}...`} value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty className="p-2 text-sm text-center">
              <p>لا توجد نتائج.</p>
              {onCreateNew && search.trim() && (
                <Button variant="link" onClick={handleCreate} className="text-primary">
                  <PlusCircle className="w-4 h-4 ml-2" />
                  إضافة "{search}"
                </Button>
              )}
            </CommandEmpty>
            <CommandGroup>
              {filteredItems.map(item => {
                const isSelected = selectedItems.some(s => s.id === item.id);
                return (
                  <CommandItem
                    key={item.id}
                    value={item[itemLabel]}
                    onSelect={() => handleSelect(item)}
                    className="cursor-pointer"
                  >
                    <Check className={cn("ml-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                    <div className="flex items-center gap-2">
                      {item.hex_code && (
                        <div 
                          className="w-4 h-4 rounded-full border"
                          style={{ backgroundColor: item.hex_code }}
                        />
                      )}
                      <span>{item[itemLabel]}</span>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default NewCreatableMultiSelect;