import { NextRequest } from 'next/server';
import { withApiKeyAuth, ApiKeyContext, validateBabyAccess } from '../../../../auth';
import { checkRateLimit } from '../../../../rate-limiter';
import { hookSuccess, hookError } from '../../../../response';
import { createHookActivity, HookResult } from '../../../../create-activity';

// Bulk import path (#285). Items are created one at a time, in order (SQLite
// serializes writes anyway), and each succeeds or fails on its own. Batch
// entries are historical, so they never send push notifications or reset
// notification timers, and timer actions (start/end/...) are rejected.
const MAX_BATCH_SIZE = 100;

async function handlePost(req: NextRequest, ctx: ApiKeyContext, routeContext: any) {
  const rl = await checkRateLimit(ctx.keyId, 'BATCH');
  if (!rl.allowed) return rl.response!;

  const params = await routeContext.params;
  const babyId = params.babyId;
  const access = await validateBabyAccess(babyId, ctx);
  if (!access.valid) return access.error!;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return hookError('INVALID_JSON', 'Request body must be valid JSON', 400, rl.headers);
  }

  const items = body?.activities;
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_BATCH_SIZE) {
    return hookError('INVALID_BATCH', `activities must be an array of 1 to ${MAX_BATCH_SIZE} activity objects`, 400, rl.headers);
  }

  const results = [];
  for (const [index, item] of items.entries()) {
    let result: HookResult;
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      result = { ok: false, code: 'INVALID_ITEM', message: 'Each activity must be an object', status: 400 };
    } else {
      try {
        result = await createHookActivity(item, { familyId: ctx.familyId, babyId }, { notify: false, allowTimers: false });
      } catch (error) {
        console.error('Error creating batch activity via webhook:', error);
        result = { ok: false, code: 'INTERNAL_ERROR', message: 'Failed to create activity', status: 500 };
      }
    }
    results.push(result.ok
      ? { index, success: true, data: result.data }
      : { index, success: false, error: { code: result.code, message: result.message } });
  }

  const duplicates = results.filter((r) => r.success && r.data?.duplicate).length;
  const failed = results.filter((r) => !r.success).length;
  return hookSuccess(
    { results, created: results.length - duplicates - failed, duplicates, failed },
    { familyId: ctx.familyId, babyId },
    rl.headers
  );
}

export const POST = withApiKeyAuth(handlePost, 'write');
