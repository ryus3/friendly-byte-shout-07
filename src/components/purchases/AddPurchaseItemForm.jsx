import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';

const AddPurchaseItemForm = ({ products, newItem, setNewItem, onAddItem }) => (
  <div className="p-4 glass-effect rounded-lg border border-white/20">
    <h4 className="font-semibold text-white mb-4">إضافة منتج</h4>
    
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
      <div>
        <Label className="text-sm font-medium mb-2 block">المنتج</Label>
        <Select value={newItem.productId} onValueChange={(value) => setNewItem(prev => ({...prev, productId: value}))}>
          <SelectTrigger className="glass-effect border-white/20">
            <SelectValue placeholder="اختر المنتج" />
          </SelectTrigger>
          <SelectContent>
            {products.map(product => (
              <SelectItem key={product.id} value={product.id.toString()}>
                {product.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-sm font-medium mb-2 block">اللون</Label>
        <Input
          value={newItem.color}
          onChange={(e) => setNewItem(prev => ({...prev, color: e.target.value}))}
          className="glass-effect border-white/20"
          placeholder="اللون"
        />
      </div>

      <div>
        <Label className="text-sm font-medium mb-2 block">المقاس</Label>
        <Input
          value={newItem.size}
          onChange={(e) => setNewItem(prev => ({...prev, size: e.target.value}))}
          className="glass-effect border-white/20"
          placeholder="المقاس"
        />
      </div>

      <div>
        <Label className="text-sm font-medium mb-2 block">الكمية</Label>
        <Input
          type="number"
          value={newItem.quantity}
          onChange={(e) => setNewItem(prev => ({...prev, quantity: parseInt(e.target.value) || 0}))}
          className="glass-effect border-white/20"
          placeholder="الكمية"
          min="1"
        />
      </div>

      <div>
        <Label className="text-sm font-medium mb-2 block">التكلفة</Label>
        <Input
          type="number"
          value={newItem.cost}
          onChange={(e) => setNewItem(prev => ({...prev, cost: parseFloat(e.target.value) || 0}))}
          className="glass-effect border-white/20"
          placeholder="التكلفة"
          min="0"
        />
      </div>
    </div>

    <Button
      onClick={onAddItem}
      className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
    >
      <Plus className="w-4 h-4 ml-2" />
      إضافة المنتج
    </Button>
  </div>
);

export default AddPurchaseItemForm;