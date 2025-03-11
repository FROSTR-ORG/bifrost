import { Buff }                  from '@cmdcode/buff'
import { get_group_signing_ctx } from '@cmdcode/frost/lib'

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
  SignSessionPackage,
  SharePackage,
  SignSessionContext,
  SignSessionTemplate,
  SignSessionConfig,
  SighashEntry,
  SighashCommit,
  SighashShare
} from '@/types/index.js'
import { now } from '@/util/index.js'

export const GET_DEFAULT_SESSION_CONFIG : () => SignSessionConfig = () => {
  return {
    content : null,
    stamp   : now(),
    type    : 'message',
  }
}

/**
 * Create a signature session template.
 * 
 * @param members - The members to include in the session.
 * @param message - The message to sign.
 * @param options - The options to use for the session.
 * @returns The signature session template.
 */
export function create_session_template (
  hashes  : SighashEntry[],
  members : number[],
  options : Partial<SignSessionConfig> = {}
) : SignSessionTemplate {
  return {
    ...GET_DEFAULT_SESSION_CONFIG(),
    ...options,
    hashes  : hashes,
    members : members.sort()
  }
}

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
  template : SignSessionTemplate
) : SignSessionPackage {
  // Get the group ID.
  const gid = get_group_id(group)
  // Get the session ID.
  const sid = get_session_id(gid, template)
  // Return the session package.
  return { ...template, gid, sid }
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
  session : SignSessionPackage
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
  template : SignSessionTemplate
) : string {
  // Get the members, message, and timestamp.
  const mbrs = template.members.map(e => Buff.bytes(e))
  const msgs = template.hashes.map(e => Buff.join(e))
  const cont = Buff.bytes(template.content ?? '00')
  const type = Buff.str(template.type)
  const ts   = Buff.num(template.stamp, 4)
  // Create the preimage.
  const pimg = Buff.join([ group_id, ...mbrs, ...msgs, cont, type, ts ])
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
export function get_sighash_binder (
  session_id : string | Uint8Array,
  member_idx : number,
  sighash    : SighashEntry
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

/**
 * Get the tweaked member share for a given session and share package.
 * 
 * @param session - The session package.
 * @param share   - The share package.
 * @returns The tweaked member share.
 */
export function create_session_shares (
  session : SignSessionPackage,
  share   : SharePackage
) : SighashShare[] {
  // Return the tweaked member share for each sighash.
  return session.hashes.map(vec => {
    // Unpack the sighash vector.
    const [ sighash ] = vec
    // Get the binder hash.
    const bind_hash = get_sighash_binder(session.sid, share.idx, vec)
    // Tweak the hidden and binder nonces.
    const hidden_sn = tweak_seckey(share.hidden_sn, bind_hash)
    const binder_sn = tweak_seckey(share.binder_sn, bind_hash)
    // Return the tweaked member share.
    return { ...share, binder_sn, hidden_sn, bind_hash, sighash }
  })
}

/**
 * Get the tweaked commitment for a given session and commitment package.
 * 
 * @param group   - The group package.
 * @param session - The session package.
 * @param idx     - The index of the commitment.
 * @returns The tweaked commitment.
 */
export function create_session_commits (
  group   : GroupPackage,
  session : SignSessionPackage,
  idx     : number
) : SighashCommit[] {
  // Get the group commitment.
  const commit = get_commit_by_idx(group.commits, idx)
  // Return the tweaked commitment for each sighash.
  return session.hashes.map(vec => {
    // Unpack the sighash vector.
    const [ sighash ] = vec
    // Get the binder hash.
    const bind_hash = get_sighash_binder(session.sid, idx, vec)
    // Tweak the hidden and binder nonces.
    const hidden_pn = tweak_pubkey(commit.hidden_pn, bind_hash)
    const binder_pn = tweak_pubkey(commit.binder_pn, bind_hash)
    // Return the tweaked commitment.
    return { ...commit, binder_pn, hidden_pn, bind_hash, sighash }
  })
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
  session : SignSessionPackage
) : SignSessionContext {
  // Get the public keys for the group.
  const pubkeys = group.commits.map(e => e.pubkey)
  // Create the sighash commitments.
  const sighash_commits = session.members
    .map(idx => create_session_commits(group, session, idx))
    .flat()
  // Create the context map.
  const sigmap = new Map()
  // For each sighash vector,
  for (const vec of session.hashes) {
    // Unpack the sighash vector.
    const [ sighash, ...tweaks ] = vec
    // Get the commits for the current sighash.
    const commits = sighash_commits.filter(e => e.sighash === sighash)
    // Get the group signing context.
    const context = get_group_signing_ctx(group.group_pk, commits, sighash, tweaks)
    // Add the context to the map.
    sigmap.set(sighash, context)
  }
  // Return the session context.
  return { pubkeys, session, sigmap }
}
