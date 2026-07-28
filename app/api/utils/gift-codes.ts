import prisma from '../db';
import { generateGiftCode, giftUniqueViolationAction } from '@/src/utils/giftCodeUtils';

export interface NewGiftCodeData {
  source: 'purchase' | 'admin';
  purchaserEmail?: string | null;
  stripeSessionId?: string | null;
  stripePaymentId?: string | null;
}

// Creates a GiftCode with a freshly generated unique code, retrying on the
// (astronomically unlikely) code collision. Returns 'already-fulfilled' when
// the unique stripeSessionId shows this checkout session was already
// processed (replayed webhook).
export async function createUniqueGiftCode(data: NewGiftCodeData) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.giftCode.create({
        data: { ...data, code: generateGiftCode() },
      });
    } catch (error: any) {
      if (error?.code !== 'P2002') throw error;
      if (giftUniqueViolationAction(error?.meta?.target) === 'already-fulfilled') {
        return 'already-fulfilled' as const;
      }
      // code collision — loop regenerates
    }
  }
  throw new Error('Failed to generate a unique gift code');
}
