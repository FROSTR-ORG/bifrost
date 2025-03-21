import { Buff } from '@cmdcode/buff'

import {
  tweak_pubkey,
  tweak_seckey
} from './crypto.js'

import type {
  SharePackage,
  SighashVector,
  SighashShare,
  CommitPackage,
  SighashCommit
} from '@/types/index.js'

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

export function create_sighash_commit (
  session_id : string,
  commit     : CommitPackage,
  sigvec     : SighashVector
) : SighashCommit {
  // Get the binder hash.
  const bind_hash = get_sighash_binder(session_id, commit.idx, sigvec)
  // Tweak the hidden and binder nonces.
  const hidden_pn = tweak_pubkey(commit.hidden_pn, bind_hash)
  const binder_pn = tweak_pubkey(commit.binder_pn, bind_hash)
  // Unpack the sighash vector.
  const [ sighash ] = sigvec
  // Return the tweaked commitment.
  return { ...commit, binder_pn, hidden_pn, bind_hash, sighash, sid : session_id }
}

/**
 * Create a sighash share for a given session ID,
 * share package, and sighash vector.
 * 
 * @param session_id - The session ID.
 * @param share      - The share package.
 * @param sigvec     - The sighash vector.
 */
export function create_sighash_share (
  session_id : string,
  share      : SharePackage,
  sigvec     : SighashVector
) : SighashShare {
  // Get the binder hash.
  const bind_hash = get_sighash_binder(session_id, share.idx, sigvec)
  // Tweak the hidden and binder nonces.
  const hidden_sn = tweak_seckey(share.hidden_sn, bind_hash)
  const binder_sn = tweak_seckey(share.binder_sn, bind_hash)
  // Unpack the sighash vector.
  const [ sighash ] = sigvec
  // Return the tweaked member share.
  return { ...share, binder_sn, hidden_sn, bind_hash, sighash, sid : session_id }
}

/**
 * Get the session binder for a given session ID and member index.
 * 
 * @param session_id - The session ID.
 * @param member_idx - The member index.
 * @returns The session binder.
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
  return pre.digest.hex
}
