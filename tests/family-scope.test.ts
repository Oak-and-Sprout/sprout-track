import { describe, it, expect } from 'vitest';
import { resolveFamilyScope } from '@/app/api/utils/family-scope';

describe('resolveFamilyScope', () => {
  describe('account/caretaker with a family', () => {
    it('no requested id -> ok with the auth family', () => {
      const result = resolveFamilyScope({ familyId: 'A' }, null);
      expect(result).toEqual({ ok: true, familyId: 'A' });
    });

    it('requested id matches auth family -> ok (shell/web happy path)', () => {
      const result = resolveFamilyScope({ familyId: 'A' }, 'A');
      expect(result).toEqual({ ok: true, familyId: 'A' });
    });

    it('requested id mismatches auth family -> 403 (the exploit, blocked)', () => {
      const result = resolveFamilyScope({ familyId: 'A' }, 'B');
      expect(result).toEqual({
        ok: false,
        status: 403,
        error: 'Not authorized for this family.',
      });
    });
  });

  describe('account/caretaker with no family', () => {
    it('mismatched requested id -> 403 (no-family exploit blocked)', () => {
      const result = resolveFamilyScope({ familyId: null }, 'B');
      expect(result).toEqual({
        ok: false,
        status: 403,
        error: 'User is not associated with a family.',
      });
    });

    it('no requested id -> 403', () => {
      const result = resolveFamilyScope({ familyId: null }, null);
      expect(result).toEqual({
        ok: false,
        status: 403,
        error: 'User is not associated with a family.',
      });
    });
  });

  describe('sysadmin', () => {
    it('requested id -> ok with the requested family (cross-family preserved)', () => {
      const result = resolveFamilyScope({ familyId: 'A', isSysAdmin: true }, 'B');
      expect(result).toEqual({ ok: true, familyId: 'B' });
    });

    it('no requested id but context has a family -> ok with the context family', () => {
      const result = resolveFamilyScope({ familyId: 'A', isSysAdmin: true }, null);
      expect(result).toEqual({ ok: true, familyId: 'A' });
    });

    it('neither requested id nor context family -> 400', () => {
      const result = resolveFamilyScope({ familyId: null, isSysAdmin: true }, null);
      expect(result).toEqual({
        ok: false,
        status: 400,
        error: 'System administrators must specify a familyId.',
      });
    });
  });
});
