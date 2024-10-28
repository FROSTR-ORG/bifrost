import { GroupPackage } from '@/types/index.js'
import { Assert }       from '@/util/index.js'
import { normalize_pubkey } from './crypto.js'

export function get_group_indexes (
  group : GroupPackage
) : number[] {
  return group.commits.map(e => e.idx)
}

export function get_author_pubkeys (
  group : GroupPackage
) : string[] {
  return group.commits.map(e => e.pubkey)
}

export function get_member_indexes (
  group   : GroupPackage,
  pubkeys : string[]
) : number[] {
  const indexes = group.commits
    .filter(e => pubkeys.includes(normalize_pubkey(e.pubkey, 'bip340')))
    .map(e => e.idx)
  Assert.ok(indexes.length === pubkeys.length, 'index count does not match pubkey count')
  return indexes
}
