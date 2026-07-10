import { Caretaker } from '@prisma/client';
import { CaretakerResponse } from '../types';
import { formatForResponse } from './timezone';

/**
 * Serialize a Caretaker record for an API response.
 *
 * securityPin is stripped here (via destructuring) so caretaker PINs are never sent
 * to the client from any endpoint, authenticated or not. This is the single place
 * caretaker records should be converted to responses — do not spread `...caretaker`
 * directly into a response body, or the PIN will leak.
 */
export function toCaretakerResponse(caretaker: Caretaker): CaretakerResponse {
  const { securityPin: _securityPin, ...rest } = caretaker;
  return {
    ...rest,
    createdAt: formatForResponse(caretaker.createdAt) || '',
    updatedAt: formatForResponse(caretaker.updatedAt) || '',
    deletedAt: formatForResponse(caretaker.deletedAt),
  };
}
