import { Assert } from '@/util/index.js'

import {
  get_pubkey,
  normalize_pubkey
} from './crypto.js'

import type {
  GroupPackage,
  SharePackage
} from '@/types/index.js'

export function get_group_indexes (
  group : GroupPackage
) : number[] {
  return group.commits.map(e => e.idx)
}

export function get_peer_pubkeys (
  group : GroupPackage,
  share : SharePackage
) : string[] {
  const pubkey = get_pubkey(share.seckey, 'ecdsa')
  return group.commits
    .filter(e => e.pubkey !== pubkey)
    .map(e => normalize_pubkey(e.pubkey, 'bip340'))
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
