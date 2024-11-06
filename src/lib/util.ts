import { GroupPackage } from '@/types/index.js'

export function get_group_indexes (
  group : GroupPackage
) : number[] {
  return group.commits.map(e => e.idx)
}

export function get_author_pubkeys (
  group : GroupPackage
) : string[] {
  return group.commits.map(e => e.share_pk.slice(2))
}
