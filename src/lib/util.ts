import { GroupPackage } from '@/types/index.js'
import { Assert }       from '@/util/index.js'

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
    .filter(e => pubkeys.includes(e.pubkey))
    .map(e => e.idx)
  Assert.ok(indexes.length === pubkeys.length, 'index count does not match pubkey count')
  return indexes
}

export function normalize_pubkey (pubkey : string) {
  Assert.is_hex(pubkey)
  return (pubkey.length === 64)
    ? pubkey
    : pubkey.slice(2)
}
