import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/app/api/db';
import { withSysAdminAuth, ApiResponse } from '@/app/api/utils/auth';
import { giftCodeStatus, GiftCodeStatus, parseGenerateGiftCodesRequest, describeEmailFailure } from '@/src/utils/giftCodeUtils';
import { createUniqueGiftCode } from '@/app/api/utils/gift-codes';
import { sendGiftCodeEmail } from '@/app/api/utils/account-emails';

export interface GiftCodeRow {
  id: string;
  code: string;
  source: string;
  purchaserEmail: string | null;
  createdAt: string;
  redeemedAt: string | null;
  redeemedByEmail: string | null;
  revokedAt: string | null;
  status: GiftCodeStatus;
}

function saasGate(): NextResponse<ApiResponse<never>> | null {
  const deploymentMode = process.env.DEPLOYMENT_MODE || 'selfhosted';
  if (deploymentMode !== 'saas') {
    return NextResponse.json(
      { success: false, error: 'Gift codes are disabled in self-hosted mode' },
      { status: 404 }
    );
  }
  return null;
}

function toRow(code: {
  id: string;
  code: string;
  source: string;
  purchaserEmail: string | null;
  createdAt: Date;
  redeemedAt: Date | null;
  revokedAt: Date | null;
  redeemedByAccount: { email: string } | null;
}): GiftCodeRow {
  return {
    id: code.id,
    code: code.code,
    source: code.source,
    purchaserEmail: code.purchaserEmail,
    createdAt: code.createdAt.toISOString(),
    redeemedAt: code.redeemedAt ? code.redeemedAt.toISOString() : null,
    redeemedByEmail: code.redeemedByAccount?.email ?? null,
    revokedAt: code.revokedAt ? code.revokedAt.toISOString() : null,
    status: giftCodeStatus(code),
  };
}

export interface GenerateGiftCodesResult {
  codes: GiftCodeRow[];
  /** Non-null when the codes were created but the notification mail failed. */
  emailError: string | null;
}

async function getHandler(req: NextRequest): Promise<NextResponse<ApiResponse<GiftCodeRow[]>>> {
  const gate = saasGate();
  if (gate) return gate;

  try {
    const codes = await prisma.giftCode.findMany({
      orderBy: { createdAt: 'desc' },
      include: { redeemedByAccount: { select: { email: true } } },
    });
    return NextResponse.json({ success: true, data: codes.map(toRow) });
  } catch (error) {
    console.error('Error fetching gift codes:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch gift codes' },
      { status: 500 }
    );
  }
}

async function postHandler(req: NextRequest): Promise<NextResponse<ApiResponse<GenerateGiftCodesResult>>> {
  const gate = saasGate();
  if (gate) return gate;

  try {
    const body = await req.json();
    const { quantity, email, sendEmail: shouldSendEmail } = parseGenerateGiftCodesRequest(body);

    const created: GiftCodeRow[] = [];
    let emailError: string | null = null;
    for (let i = 0; i < quantity; i++) {
      const giftCode = await createUniqueGiftCode({
        source: 'admin',
        purchaserEmail: email,
      });
      // 'already-fulfilled' is impossible without a stripeSessionId
      if (giftCode === 'already-fulfilled') continue;
      if (shouldSendEmail) {
        const result = await sendGiftCodeEmail(email!, giftCode.code);
        if (!result.success) {
          console.error('Error sending admin gift code email:', result.error);
          // The codes are real and listed below regardless — but the admin must
          // be told the mail did not go out, or a silent provider rejection
          // (unverified sender, bad key) looks like a successful send.
          emailError = emailError ?? describeEmailFailure(result.error);
        }
      }
      created.push(toRow({ ...giftCode, redeemedByAccount: null }));
    }

    return NextResponse.json({ success: true, data: { codes: created, emailError } });
  } catch (error) {
    console.error('Error generating gift codes:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate gift codes' },
      { status: 500 }
    );
  }
}

export const GET = withSysAdminAuth(getHandler);
export const POST = withSysAdminAuth(postHandler);
