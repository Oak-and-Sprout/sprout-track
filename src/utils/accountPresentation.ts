/**
 * Pure presentation mappers for the storybook account reskin.
 * Labels returned here are English source text — callers wrap them in t().
 */

export type SubscriptionView =
  | { kind: 'lifetime' }
  | { kind: 'trial'; daysLeft: number; endDate: Date | null }
  | { kind: 'active'; cancelAtPeriodEnd: boolean; endDate: Date | null }
  | { kind: 'expired' }
  | { kind: 'none' };

const DAY_MS = 24 * 60 * 60 * 1000;

export function getSubscriptionView(
  input: {
    accountStatus: string;
    planType?: string | null;
    trialEnds?: string | null;
    planExpires?: string | null;
    cancelAtPeriodEnd?: boolean;
  },
  now: Date
): SubscriptionView {
  if (input.planType === 'full') return { kind: 'lifetime' };
  if (input.accountStatus === 'trial') {
    const endDate = input.trialEnds ? new Date(input.trialEnds) : null;
    const daysLeft = endDate
      ? Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / DAY_MS))
      : 0;
    return { kind: 'trial', daysLeft, endDate };
  }
  if (input.accountStatus === 'expired') return { kind: 'expired' };
  if (input.accountStatus === 'active') {
    return {
      kind: 'active',
      cancelAtPeriodEnd: !!input.cancelAtPeriodEnd,
      endDate: input.planExpires ? new Date(input.planExpires) : null,
    };
  }
  return { kind: 'none' };
}

export function genderChip(
  gender?: string | null
): { label: 'Boy' | 'Girl'; variant: 'blue' } | null {
  if (gender === 'MALE') return { label: 'Boy', variant: 'blue' };
  if (gender === 'FEMALE') return { label: 'Girl', variant: 'blue' };
  return null;
}

export function caretakerChips(
  role: string,
  inactive: boolean
): { label: string; variant: 'teal' | 'blue' | 'red' }[] {
  const chips: { label: string; variant: 'teal' | 'blue' | 'red' }[] = [
    role === 'ADMIN'
      ? { label: 'Admin', variant: 'teal' }
      : { label: 'User', variant: 'blue' },
  ];
  if (inactive) chips.push({ label: 'Inactive', variant: 'red' });
  return chips;
}

/** '03:00' -> '3h', '02:30' -> '2h 30m', '00:45' -> '45m', invalid -> '' */
export function nudgeShort(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '');
  if (!m) return '';
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h && min) return `${h}h ${min}m`;
  if (h) return `${h}h`;
  return `${min}m`;
}
