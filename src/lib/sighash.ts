import { Buff }          from '@vbyte/buff'
import { sha256_digest } from '@/util/encoding.js'

import type {
  SighashVector
} from '@/types/index.js'

/**
 * Format a message into a sighash vector.
 */
export function format_sigvector (
  message : string | string[]
) : SighashVector {
  if (Array.isArray(message)) {
    return message as SighashVector
  } else if (typeof message === 'string') {
    return [ message ] as SighashVector
  } else {
    throw new Error('invalid message payload')
  }
}

/**
 * Get the session binder for a given session ID and member index.
 *
 * @param session_id - The session ID.
 * @param member_idx - The member index.
 * @param sighash - The sighash vector.
 * @returns The session binder hash.
 */
export function get_sighash_binder (
  session_id : string,
  member_idx : number,
  sighash    : SighashVector
) : string {
  // Serialize the session ID, member index, and sighash vector.
  const sid = Buff.bytes(session_id)
  const idx = Buff.num(member_idx, 4)
  const msg = Buff.join(sighash)
  // Create the preimage.
  const pre = Buff.join([ sid, idx, msg ])
  // Return the binder.
  return sha256_digest(pre).hex
}
