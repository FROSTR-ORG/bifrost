import { Assert }         from '@/util/index.js'
import { convert_pubkey } from './crypto.js'

import type { GroupPackage } from '@/types/index.js'

/**
 * Get the indexes of the members in the group.
 * 
 * @param group - The group package.
 * @returns The indexes of the members in the group.
 */
export function get_group_indexes (
  group : GroupPackage
) : number[] {
  return group.commits.map(e => e.idx)
}

/**
 * Select a random subset of peers from a list of peers.
 * 
 * @param peers - The list of peers.
 * @param thold - The threshold.
 * @returns The selected peers.
 */
export function select_random_peers (
  peers : string[],
  thold : number
) : string[] {
  const rnd = () => Math.random() > 0.5 ? 1 : -1
  const idx = Math.min(peers.length, thold - 1)
  return peers.sort(rnd).slice(0, idx)
}

/**
 * Get the indexes for a given group and list of pubkeys.
 * 
 * @param group   - The group package.
 * @param pubkeys - The list of pubkeys.
 * @returns The indexes of the members in the group.
 */
export function get_member_indexes (
  group   : GroupPackage,
  pubkeys : string[]
) : number[] {
  const indexes = group.commits
    .filter(e => pubkeys.includes(convert_pubkey(e.pubkey, 'bip340')))
    .map(e => e.idx)
  Assert.ok(indexes.length === pubkeys.length, 'index count does not match pubkey count')
  return indexes
}
