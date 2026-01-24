import { Buff }                  from '@vbyte/buff'
import { get_group_signing_ctx } from '@vbyte/frost/lib'
import { now, sha256_digest }    from '@/util/index.js'

import {
  get_member_by_idx,
  get_group_id
} from './group.js'

import type {
  GroupPackage,
  MemberPackage,
  MemberPublicNonce,
  SignSessionPackage,
  SignSessionContext,
  SignSessionTemplate,
  SignSessionConfig
} from '@/types/index.js'

import Schema from '@/schema/index.js'

/**
 * CommitData represents public nonces for a member during signing.
 * This can come from session.nonces (MemberPublicNonce) or be constructed
 * from MemberPackage + nonces.
 */
interface CommitData {
  idx       : number
  pubkey    : string
  binder_pn : string
  hidden_pn : string
}

/**
 * SighashCommit is a commit bound to a specific sighash.
 */
interface SighashCommit extends CommitData {
  sid       : string
  sighash   : string
  bind_hash : string
}

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
 * @param members  - The members to include in the session.
 * @param messages - The message to sign.
 * @param options  - The options to use for the session.
 * @returns The signature session template.
 */
export function create_session_template (
  members  : number[],
  messages : string | string[][],
  options  : Partial<SignSessionConfig> = {}
) : SignSessionTemplate | null {
  // Format the message payload.
  const hashes = typeof messages === 'string'
    ? [ [ messages ] ]
    : messages
  // Parse the template.
  const schema = Schema.sign.template
  const parsed = schema.safeParse({
    ...GET_DEFAULT_SESSION_CONFIG(),
    ...options,
    hashes  : hashes,
    members : members.sort()
  })
  // Return the parsed template.
  return parsed.success ? parsed.data : null
}

/**
 * Create a signature session package.
 *
 * @param group    - The group package.
 * @param template - The session template.
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
  // Serialize session components
  const members_buf = template.members.map(idx => Buff.num(idx, 4))
  const hashes_buf  = template.hashes.map(hash => Buff.join(hash))
  const content_buf = Buff.bytes(template.content ?? '00')
  const type_buf    = Buff.str(template.type)
  const stamp_buf   = Buff.num(template.stamp, 4)
  // Preimage: group_id || members[4B each] || hashes || content || type || timestamp[4B]
  const preimage = Buff.join([ group_id, ...members_buf, ...hashes_buf, content_buf, type_buf, stamp_buf ])
  return sha256_digest(preimage).hex
}

/**
 * Create commit data from a member and their nonces.
 *
 * @param member - The member package.
 * @param nonce - The member public nonce for this member.
 * @returns The commit data.
 */
function create_commit_data (
  member : MemberPackage,
  nonce  : MemberPublicNonce
) : CommitData {
  return {
    idx       : member.idx,
    pubkey    : member.pubkey,
    binder_pn : nonce.binder_pn,
    hidden_pn : nonce.hidden_pn
  }
}

/**
 * Create a sighash commit from commit data.
 *
 * @param session_id - The session ID.
 * @param commit - The commit data.
 * @param sigvec - The sighash vector.
 * @returns The sighash commit.
 */
function create_sighash_commit_from_data (
  session_id : string,
  commit     : CommitData,
  sigvec     : [ string, ...string[] ]
) : SighashCommit {
  const [ sighash ] = sigvec
  // Create bind hash from session, index, and sighash
  const preimage = Buff.join([
    Buff.hex(session_id),
    Buff.num(commit.idx, 4),
    Buff.hex(sighash)
  ])
  const bind_hash = sha256_digest(preimage).hex

  return {
    ...commit,
    sid       : session_id,
    sighash,
    bind_hash
  }
}

/**
 * Get the tweaked commitment for a given session, using dynamic nonces.
 *
 * @param group   - The group package.
 * @param session - The session package (must include nonces).
 * @param idx     - The index of the member.
 * @returns The tweaked commitments for each sighash.
 */
export function create_member_commits (
  group   : GroupPackage,
  session : SignSessionPackage,
  idx     : number
) : SighashCommit[] {
  // Get the member.
  const member = get_member_by_idx(group.members, idx)

  // Get the nonce for this member from the session.
  const nonce = session.nonces?.find(n => n.idx === idx)
  if (!nonce) {
    throw new Error(`no nonce found for member ${idx} in session`)
  }

  // Create commit data.
  const commit = create_commit_data(member, nonce)

  // Return the tweaked commitment for each sighash.
  return session.hashes.map(vec => create_sighash_commit_from_data(session.sid, commit, vec))
}

/**
 * Create the session commits for a given session and group package.
 *
 * @param group   - The group package.
 * @param session - The session package (must include nonces).
 * @returns The session commits.
 */
export function create_session_commits (
  group   : GroupPackage,
  session : SignSessionPackage
) : SighashCommit[] {
  return session.members.flatMap(idx =>
    create_member_commits(group, session, idx)
  )
}

/**
 * Get the session context for a given session and group package.
 *
 * The session must include nonces with the public nonces
 * for all participating members.
 *
 * @param group   - The group package.
 * @param session - The session package (must include nonces).
 * @returns The session context.
 */
export function get_session_ctx (
  group   : GroupPackage,
  session : SignSessionPackage
) : SignSessionContext {
  // Validate that nonces are present
  if (!session.nonces || session.nonces.length === 0) {
    throw new Error('session must include nonces for dynamic nonce signing')
  }

  // Get the public keys for the group.
  const pubkeys = group.members.map(member => member.pubkey)

  // Create the sighash commitments.
  const session_commits = create_session_commits(group, session)

  // Create the context map.
  const sigmap = new Map()

  // For each sighash vector,
  for (const vec of session.hashes) {
    // Unpack the sighash vector.
    const [ sighash, ...tweaks ] = vec
    // Get the commits for the current sighash.
    const sighash_commits = session_commits.filter(commit => commit.sighash === sighash)
    // Get the group signing context.
    const context = get_group_signing_ctx(group.group_pk, sighash_commits, sighash, tweaks)
    // Add the context to the map.
    sigmap.set(sighash, context)
  }

  // Return the session context.
  return { pubkeys, session, sigmap }
}
