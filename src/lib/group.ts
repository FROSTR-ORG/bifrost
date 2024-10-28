import { Buff }               from '@cmdcode/buff'
import { get_commits_prefix } from '@cmdcode/frost/lib'
import { Assert }             from '@/util/assert.js'

import type {
  CommitPackage,
  GroupPackage
} from '@/types/index.js'

export function get_group_id (
  group : GroupPackage
) : string {
  const prefix = get_commits_prefix(group.commits)
  const preimg = Buff.join([ prefix, group.group_pk ])
  return preimg.digest.hex
}

export function get_commit_by_pubkey (
  commits : CommitPackage[],
  pubkey  : string
) : CommitPackage {
  const commit = commits.find(e => e.pubkey === pubkey)
  Assert.exists(commit, 'commit package not found for pubkey: ' + pubkey)
  return commit
}

export function get_commit_by_idx (
  commits : CommitPackage[],
  idx     : number
) : CommitPackage {
  const commit = commits.find(e => e.idx === idx)
  Assert.exists(commit, 'commit package not found for idx: ' + idx)
  return commit
}
