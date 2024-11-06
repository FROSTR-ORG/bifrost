import { create_key_group } from '@cmdcode/frost/lib'

import {
  create_group_pkg,
  create_share_pkg
} from '@/lib/pkg.js'

import { KeySet } from '@/types/index.js'

export function generate_key_set (
  threshold   : number,
  share_count : number,
  secrets     : string[] = []
) : KeySet {
  // Generate a group of secret shares.
  const key_group = create_key_group(threshold, share_count, secrets)
  // Create group package.
  const group  = create_group_pkg(key_group)
  // Create share packages.
  const shares = key_group.shares.map(e => create_share_pkg(e))
  // Return packages.
  return { group, shares }
}
