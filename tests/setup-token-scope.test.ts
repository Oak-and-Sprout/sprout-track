import { describe, it, expect } from 'vitest';
import { setupTokenMayTarget } from '@/app/api/utils/setup-token-scope';

describe('setupTokenMayTarget', () => {
  it('bound token + matching id + any path -> true', () => {
    expect(setupTokenMayTarget({ familyId: 'A' }, 'A', '/api/caretaker')).toBe(true);
    expect(setupTokenMayTarget({ familyId: 'A' }, 'A', '/api/setup/start')).toBe(true);
  });

  it('bound token + mismatched id -> false', () => {
    expect(setupTokenMayTarget({ familyId: 'A' }, 'B', '/api/caretaker')).toBe(false);
  });

  it('unbound token + setup-start path -> true', () => {
    expect(setupTokenMayTarget({ familyId: null }, 'B', '/api/setup/start')).toBe(true);
  });

  it('unbound token + any other path -> false', () => {
    expect(setupTokenMayTarget({ familyId: null }, 'B', '/api/caretaker')).toBe(false);
    expect(setupTokenMayTarget({ familyId: null }, 'B', '/api/family/setup-status')).toBe(false);
    expect(setupTokenMayTarget({ familyId: null }, 'B', '/')).toBe(false);
  });
});
