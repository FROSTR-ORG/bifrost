import { Buff }                  from '@cmdcode/buff'
import { get_group_signing_ctx } from '@cmdcode/frost/lib'
import { now }                   from '@/util/index.js'

import {
  get_commit_by_idx,
  get_group_id
} from './group.js'

import {
  tweak_pubkey,
  tweak_seckey
} from './crypto.js'

import type {
  GroupPackage,
  SessionCommit,
  SessionMember,
  SessionConfig, 
  SessionPackage,
  SharePackage,
  SessionContext
} from '@/types/index.js'

/**
 * Create a signature session package.
 * 
 * @param group    - The group package.
 * @param members  - The members to include in the session.
 * @param message  - The message to sign.
 * @param stamp    - The timestamp to use for the session.
 * @returns The signature session package.
 */
export function create_session_pkg (
  group    : GroupPackage,
  members  : number[],
  message  : string,
  stamp    : number = now()
) : SessionPackage {
  // Sort the members lexicographically.
  members = members.sort()
  // Create the session package.
  const session = { members, message, stamp }
  // Get the group ID and session ID.
  const gid = get_group_id(group)
  const sid = get_session_id(gid, session)
  // Return the session package.
  return { gid, members, message, stamp, sid }
}

/**
 * Verify a signature session package.
 * 
 * @param group   - The group package.
 * @param session - The session package to verify.
 * @returns True if the session package is valid, false otherwise.
 */
export function verify_session_pkg (
  group   : GroupPackage,
  session : SessionPackage
) : boolean {
  // Get the group ID and session ID.
  const gid = get_group_id(group)
  const sid = get_session_id(gid, session)
  // Return true if the session package is valid.
  return session.gid === gid && session.sid === sid
}

/**
 * Get the session ID for a given group and session configuration.
 * 
 * @param group_id - The group ID.
 * @param session  - The session configuration.
 * @returns The session ID.
 */
export function get_session_id (
  group_id : string,
  session  : SessionConfig
) : string {
  // Get the members, message, and timestamp.
  const mbrs = session.members.map(e => Buff.bytes(e))
  const msg  = Buff.bytes(session.message)
  const ts   = Buff.num(session.stamp, 4)
  // Create the preimage.
  const pimg = Buff.join([ group_id, ...mbrs, msg, ts ])
  // Return the session ID.
  return pimg.digest.hex
}

/**
 * Get the session binder for a given session ID and member index.
 * 
 * @param session_id - The session ID.
 * @param member_idx - The member index.
 * @returns The session binder.
 */
export function get_session_binder (
  session_id : string | Uint8Array,
  member_idx : number
) : string {
  // Get the session ID and member index.
  const sid = Buff.bytes(session_id)
  const idx = Buff.num(member_idx, 4)
  // Create the preimage.
  const pre = Buff.join([ sid, idx ])
  // Return the binder.
  return pre.digest.hex
}

/**
 * Get the tweaked member share for a given session and share package.
 * 
 * @param session - The session package.
 * @param share   - The share package.
 * @returns The tweaked member share.
 */
export function get_session_member (
  session : SessionPackage,
  share   : SharePackage
) : SessionMember {
  // Get the member's index and secret key.
  const { idx, seckey } = share
  // Get the binder hash.
  const bind_hash = get_session_binder(session.sid, share.idx)
  // Tweak the hidden and binder nonces.
  const hidden_sn = tweak_seckey(share.hidden_sn, bind_hash)
  const binder_sn = tweak_seckey(share.binder_sn, bind_hash)
  // Return the tweaked member share.
  return { idx, seckey, binder_sn, hidden_sn, bind_hash }
}

/**
 * Get the tweaked commitment for a given session and commitment package.
 * 
 * @param group   - The group package.
 * @param session - The session package.
 * @param idx     - The index of the commitment.
 * @returns The tweaked commitment.
 */
export function get_session_commit (
  group   : GroupPackage,
  session : SessionPackage,
  idx     : number
) : SessionCommit {
  // Get the commitment.
  const commit    = get_commit_by_idx(group.commits, idx)
  // Get the binder hash.
  const bind_hash = get_session_binder(session.sid, commit.idx)
  // Tweak the hidden and binder nonces.
  const hidden_pn = tweak_pubkey(commit.hidden_pn, bind_hash)
  const binder_pn = tweak_pubkey(commit.binder_pn, bind_hash)
  // Return the tweaked commitment.
  return { ...commit, binder_pn, hidden_pn, bind_hash }
}

/**
 * Get the session context for a given session and group package.
 * 
 * @param group   - The group package.
 * @param session - The session package.
 * @param tweaks  - The tweaks to use for the session.
 * @returns The session context.
 */
export function get_session_ctx (
  group   : GroupPackage,
  session : SessionPackage,
  tweaks? : string[]
) : SessionContext {
  // Get the commitments.
  const commits = session.members.map(idx => get_session_commit(group, session, idx))
  // Create the session context.
  const ctx     = get_group_signing_ctx(group.group_pk, commits, session.message, tweaks)
  // Return the session context.
  return { ...ctx, session }
}
