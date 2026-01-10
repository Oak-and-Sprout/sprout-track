import React from 'react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import { Plus, Minus } from 'lucide-react';
import { useLocalization } from '@/src/context/localization';

interface BottleFeedFormProps {
  amount: string;
  unit: string;
  bottleType: string;
  notes: string;
  loading: boolean;
  onAmountChange: (amount: string) => void;
  onUnitChange: (unit: string) => void;
  onBottleTypeChange: (bottleType: string) => void;
  onNotesChange: (notes: string) => void;
  onIncrement: () => void;
  onDecrement: () => void;
}

export default function BottleFeedForm({
  amount,
  unit,
  bottleType,
  notes,
  loading,
  onAmountChange,
  onUnitChange,
  onBottleTypeChange,
  onNotesChange,
  onIncrement,
  onDecrement,
}: BottleFeedFormProps) {
  const { t } = useLocalization();
  const bottleTypes = ['Formula', 'Breast Milk', 'Formula\\Breast', 'Milk', 'Other'];
  
  return (
    <div>
      <label className="form-label mb-2">{t('Bottle Type')}</label>
      <div className="flex flex-wrap gap-2 mb-6">
        {bottleTypes.map((type) => (
          <Button
            key={type}
            type="button"
            variant={bottleType === type ? 'default' : 'outline'}
            className="flex-1 min-w-[100px]"
            onClick={() => onBottleTypeChange(type)}
            disabled={loading}
          >
            {type.replace('\\', '/')}
          </Button>
        ))}
      </div>
      <label className="form-label mb-6">{t('Amount (')}{unit === 'ML' ? 'ml' : 'oz'})</label>
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
          variant={unit === 'OZ' ? 'default' : 'outline'}
          className="w-full"
          onClick={() => onUnitChange('OZ')}
          disabled={loading}
        >
          oz
        </Button>
        <Button
          type="button"
          variant={unit === 'ML' ? 'default' : 'outline'}
          className="w-full"
          onClick={() => onUnitChange('ML')}
          disabled={loading}
        >
          ml
        </Button>
      </div>
      <div className="mt-6">
        <label className="form-label">{t('Notes')}</label>
        <Textarea
          id="notes"
          name="notes"
                    placeholder={t("Enter any notes about the feeding")}
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={3}
          disabled={loading}
        />
      </div>
    </div>
  );
}
