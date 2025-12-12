import React from 'react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import { Plus, Minus } from 'lucide-react';

interface SolidsFeedFormProps {
  amount: string;
  unit: string;
  food: string;
  notes: string;
  loading: boolean;
  onAmountChange: (amount: string) => void;
  onUnitChange: (unit: string) => void;
  onFoodChange: (food: string) => void;
  onNotesChange: (notes: string) => void;
  onIncrement: () => void;
  onDecrement: () => void;
}

export default function SolidsFeedForm({
  amount,
  unit,
  food,
  notes,
  loading,
  onAmountChange,
  onUnitChange,
  onFoodChange,
  onNotesChange,
  onIncrement,
  onDecrement,
}: SolidsFeedFormProps) {
  return (
    <>
      <div>
        <label className="form-label mb-6">Amount ({unit})</label>
        <div className="flex items-center justify-center mb-6">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onDecrement}
            disabled={loading}
            className="bg-gradient-to-r from-teal-600 to-emerald-600 border-0 rounded-full h-14 w-14 flex items-center justify-center shadow-lg hover:shadow-xl hover:-translate-y-0.5"
          >
            <Minus className="h-5 w-5 text-white" />
          </Button>
          <Input
            type="text"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            className="w-24 mx-3 text-center"
            placeholder="Amount"
            inputMode="decimal"
            disabled={loading}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onIncrement}
            disabled={loading}
            className="bg-gradient-to-r from-teal-600 to-emerald-600 border-0 rounded-full h-14 w-14 flex items-center justify-center shadow-lg hover:shadow-xl hover:-translate-y-0.5"
          >
            <Plus className="h-5 w-5 text-white" />
          </Button>
        </div>
        <div className="mt-2 flex space-x-2">
          <Button
            type="button"
            variant={unit === 'TBSP' ? 'default' : 'outline'}
            className="w-full"
            onClick={() => onUnitChange('TBSP')}
            disabled={loading}
          >
            tbsp
          </Button>
          <Button
            type="button"
            variant={unit === 'G' ? 'default' : 'outline'}
            className="w-full"
            onClick={() => onUnitChange('G')}
            disabled={loading}
          >
            g
          </Button>
        </div>
      </div>
      <div className="mb-6">
        <label className="form-label">Food</label>
        <Input
          value={food}
          onChange={(e) => onFoodChange(e.target.value)}
          className="w-full"
          placeholder="Enter food"
          disabled={loading}
        />
      </div>
      <div className="mb-6">
        <label className="form-label">Notes</label>
        <Textarea
          id="notes"
          name="notes"
          placeholder="Enter any notes about the feeding"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={3}
          disabled={loading}
        />
      </div>
    </>
  );
}
