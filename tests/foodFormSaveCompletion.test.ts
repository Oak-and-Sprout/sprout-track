import { describe, it, expect, vi } from 'vitest';
import { completeFoodLogSave } from '@/src/components/forms/FoodForm/food-form.utils';

describe('completeFoodLogSave', () => {
  it('closes the tracker after a successful save (issue #254)', () => {
    const onClose = vi.fn();
    completeFoodLogSave({ refreshData: vi.fn(), onClose });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('refreshes the tabs and notifies the parent before closing', () => {
    const calls: string[] = [];
    completeFoodLogSave({
      refreshData: () => calls.push('refreshData'),
      onSuccess: () => calls.push('onSuccess'),
      onClose: () => calls.push('onClose'),
    });
    expect(calls).toEqual(['refreshData', 'onSuccess', 'onClose']);
  });

  it('still closes when the parent passed no onSuccess', () => {
    const onClose = vi.fn();
    expect(() => completeFoodLogSave({ refreshData: vi.fn(), onClose })).not.toThrow();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
