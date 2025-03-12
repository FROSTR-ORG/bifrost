import { create_sighash_share } from '@/lib/sighash.js'

import type {
  SharePackage,
  SighashCommit,
  SighashShare,
  SignSessionPackage,
} from '@frostr/bifrost'

import { Assert } from '@/util/assert.js'

/**
 * Create the session shares for a given session and set of shares.
 * 
 * @param session - The session package.
 * @param shares  - The shares.
 * @returns The session shares.
 */
export function create_session_shares (
  session : SignSessionPackage,
  shares  : SharePackage[]
) : SighashShare[] {
  const members   = get_member_shares(session, shares)
  const sigshares : SighashShare[] = []
  for (const member of members) {
    for (const sigvec of session.hashes) {
      const sigshare = create_sighash_share(session.sid, member, sigvec)
      sigshares.push(sigshare)
    }
  }
  return sigshares
}

/**
 * Get the member shares for a given session and set of shares.
 * 
 * @param session - The session package.
 * @param shares  - The shares.
 */
export function get_member_shares (
  session : SignSessionPackage,
  shares  : SharePackage[]
) : SharePackage[] {
  return session.members.map(idx => {
    const share = shares.find(e => e.idx === idx)
    Assert.exists(share, 'share not found for member: ' + idx)
    return share
  })
}

/**
 * Get a sighash commit from a list of sighash commits.
 * 
 * @param commits  - The list of sighash commits.
 * @param idx      - The member index.
 * @param sighash  - The sighash.
 */
export function get_sighash_commit (
  commits  : SighashCommit[],
  idx      : number,
  sighash  : string
) : SighashCommit | undefined {
  return commits.find(e => e.idx === idx && e.sighash === sighash)
}

/**
 * Get a sighash share from a list of sighash shares.
 * 
 * @param shares   - The list of sighash shares.
 * @param idx      - The member index.
 * @param sighash  - The sighash.
 */
export function get_sighash_share (
  shares   : SighashShare[],
  idx      : number,
  sighash  : string
) : SighashShare | undefined {
  return shares.find(e => e.idx === idx && e.sighash === sighash)
}
