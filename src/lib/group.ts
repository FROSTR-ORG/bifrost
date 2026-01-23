import { Buff }       from '@cmdcode/buff'
import { get_pubkey } from '@/util/crypto.js'
import { Assert }     from '@/util/assert.js'

import type {
  MemberPackage,
  GroupPackage,
  SharePackage
} from '@/types/index.js'

/**
 * Get the group ID from the given group package.
 *
 * For the new format (MemberPackage), the ID is computed from:
 * - group_pk
 * - threshold
 * - sorted member pubkeys
 *
 * @param group - The group package to get the ID from.
 * @returns The group ID.
 */
export function get_group_id (
  group : GroupPackage
) : string {
  // Sort members by index for deterministic ordering
  const sorted_members = [...group.members].sort((a, b) => a.idx - b.idx)

  // Build preimage: group_pk || threshold || member_pubkeys
  const parts = [
    Buff.hex(group.group_pk),
    Buff.num(group.threshold, 4),
    ...sorted_members.map(m => Buff.hex(m.pubkey))
  ]
  const preimg = Buff.join(parts)
  return preimg.digest.hex
}

/**
 * Find a member package for a given member public key.
 *
 * @param members - The members to search.
 * @param pubkey  - The public key to search for.
 * @returns The member package.
 */
export function get_member_by_pubkey (
  members : MemberPackage[],
  pubkey  : string
) : MemberPackage {
  const member = members.find(e => e.pubkey === pubkey)
  Assert.exists(member, 'member package not found for pubkey: ' + pubkey)
  return member
}

/**
 * Find a member package for a given member's index.
 *
 * @param members - The members to search.
 * @param idx     - The index to search for.
 * @returns The member package.
 */
export function get_member_by_idx (
  members : MemberPackage[],
  idx     : number
) : MemberPackage {
  const member = members.find(e => e.idx === idx)
  Assert.exists(member, 'member package not found for idx: ' + idx)
  return member
}

/**
 * Check if a share package is a member of a group.
 *
 * @param group - The group package.
 * @param share - The share package.
 * @returns True if the share package is a member of the group, false otherwise.
 */
export function is_group_member (
  group : GroupPackage,
  share : SharePackage
) : boolean {
  const idx    = share.idx
  const pubkey = get_pubkey(share.seckey, 'ecdsa')
  return group.members.some(e => e.idx === idx && e.pubkey === pubkey)
}

