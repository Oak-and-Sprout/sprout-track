import { describe, it, expect } from 'vitest';
import { formPageStyles } from '@/src/components/ui/form-page/form-page.styles';

describe('formPageStyles.formContent', () => {
  it('spans full panel width without max-w-md', () => {
    expect(formPageStyles.formContent).not.toMatch(/max-w-md/);
    expect(formPageStyles.formContent).toMatch(/\bw-full\b/);
  });
});
