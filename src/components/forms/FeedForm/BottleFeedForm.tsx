import { useId } from 'react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import { Plus, Minus } from 'lucide-react';
import { useLocalization } from '@/src/context/localization';
import { useUnit } from '@/src/hooks/useUnit';

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
  breastMilkAmount?: string;
  formulaAmount?: string;
  onBreastMilkAmountChange?: (amount: string) => void;
  onFormulaAmountChange?: (amount: string) => void;
  onBreastMilkIncrement?: () => void;
  onBreastMilkDecrement?: () => void;
  onFormulaIncrement?: () => void;
  onFormulaDecrement?: () => void;
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
  breastMilkAmount,
  formulaAmount,
  onBreastMilkAmountChange,
  onFormulaAmountChange,
  onBreastMilkIncrement,
  onBreastMilkDecrement,
  onFormulaIncrement,
  onFormulaDecrement,
}: BottleFeedFormProps) {
  const { t } = useLocalization();
  const { unitSymbol } = useUnit();
  const formId = useId();
  const bottleTypes = ['Formula', 'Breast Milk', 'Formula/Breast', 'Milk', 'Other'];
  
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
            {t(type)}
          </Button>
        ))}
      </div>
      {bottleType === 'Formula/Breast' ? (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label htmlFor={`${formId}-breast-milk-amount`} className="form-label mb-2">{t('Breast Milk Amount')} ({unitSymbol(unit)})</label>
            <div className="flex items-center justify-center">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={onBreastMilkDecrement}
                disabled={loading}
                className="bg-gradient-to-r from-teal-600 to-emerald-600 border-0 rounded-full h-10 w-10 flex items-center justify-center shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                aria-label={t('Decrease breast milk amount')}
              >
                <Minus className="h-4 w-4 text-white" aria-hidden="true" />
              </Button>
              <Input
                id={`${formId}-breast-milk-amount`}
                type="text"
                value={breastMilkAmount || ''}
                onChange={(e) => onBreastMilkAmountChange?.(e.target.value)}
                className="w-16 mx-2 text-center"
                placeholder="0"
                inputMode="decimal"
                disabled={loading}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={onBreastMilkIncrement}
                disabled={loading}
                className="bg-gradient-to-r from-teal-600 to-emerald-600 border-0 rounded-full h-10 w-10 flex items-center justify-center shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                aria-label={t('Increase breast milk amount')}
              >
                <Plus className="h-4 w-4 text-white" aria-hidden="true" />
              </Button>
            </div>
          </div>
          <div>
            <label htmlFor={`${formId}-formula-amount`} className="form-label mb-2">{t('Formula Amount')} ({unitSymbol(unit)})</label>
            <div className="flex items-center justify-center">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={onFormulaDecrement}
                disabled={loading}
                className="bg-gradient-to-r from-teal-600 to-emerald-600 border-0 rounded-full h-10 w-10 flex items-center justify-center shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                aria-label={t('Decrease formula amount')}
              >
                <Minus className="h-4 w-4 text-white" aria-hidden="true" />
              </Button>
              <Input
                id={`${formId}-formula-amount`}
                type="text"
                value={formulaAmount || ''}
                onChange={(e) => onFormulaAmountChange?.(e.target.value)}
                className="w-16 mx-2 text-center"
                placeholder="0"
                inputMode="decimal"
                disabled={loading}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={onFormulaIncrement}
                disabled={loading}
                className="bg-gradient-to-r from-teal-600 to-emerald-600 border-0 rounded-full h-10 w-10 flex items-center justify-center shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                aria-label={t('Increase formula amount')}
              >
                <Plus className="h-4 w-4 text-white" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <label htmlFor={`${formId}-amount`} className="form-label mb-6">{t('Amount (')}{unitSymbol(unit)})</label>
          <div className="flex items-center justify-center mb-6">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onDecrement}
              disabled={loading}
              className="bg-gradient-to-r from-teal-600 to-emerald-600 border-0 rounded-full h-14 w-14 flex items-center justify-center shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              aria-label={t('Decrease amount')}
            >
              <Minus className="h-5 w-5 text-white" aria-hidden="true" />
            </Button>
            <Input
              id={`${formId}-amount`}
              type="text"
              value={amount}
              onChange={(e) => onAmountChange(e.target.value)}
              className="w-24 mx-3 text-center"
              placeholder={t("Amount")}
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
              aria-label={t('Increase amount')}
            >
              <Plus className="h-5 w-5 text-white" aria-hidden="true" />
            </Button>
          </div>
        </>
      )}
      <div className="mt-2 flex space-x-2">
        <Button
          type="button"
          variant={unit === 'OZ' ? 'default' : 'outline'}
          className="w-full"
          onClick={() => onUnitChange('OZ')}
          disabled={loading}
        >
          {t('oz')}
        </Button>
        <Button
          type="button"
          variant={unit === 'ML' ? 'default' : 'outline'}
          className="w-full"
          onClick={() => onUnitChange('ML')}
          disabled={loading}
        >
          {t('ml')}
        </Button>
      </div>
      <div className="mt-6">
        <label htmlFor={`${formId}-notes`} className="form-label">{t('Notes')}</label>
        <Textarea
          id={`${formId}-notes`}
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
