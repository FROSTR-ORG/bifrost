import { Buff }              from '@cmdcode/buff'
import { BifrostNode }       from '@frostr/bifrost'
import { parse_test_vector } from './parse.js'

import {
  decode_group_pkg,
  decode_share_pkg,
  gen_dealer_pkg
} from '@frostr/bifrost/lib'

import type { BifrostNodeConfig } from '@frostr/bifrost'
import type { TestGroupPackage } from '@/test/types.js'

export function generate_test_nodes (
  labels    : string[],
  relays    : string[],
  threshold : number,
  options   : Partial<BifrostNodeConfig> = {}
) : TestGroupPackage {
  const secrets = labels.map(e => Buff.str(e).digest.hex)
  const pkg     = gen_dealer_pkg(threshold, labels.length, secrets)
  const nodes   = pkg.shares.map((share, idx) => {
    return [ labels[idx], new BifrostNode(pkg.group, share, relays, options) ] as const
  })
  return { group : pkg.group, nodes : new Map(nodes) }
}

export function import_test_nodes (
  relays   : string[],
  vector   : unknown,
  options? : Partial<BifrostNodeConfig>
) : TestGroupPackage {
  const vec    = parse_test_vector(vector)
  const group  = decode_group_pkg(vec.group)
  const nodes  = vec.shares.map(([ label, sharestr ]) => {
    const share = decode_share_pkg(sharestr)
    return [ label, new BifrostNode(group, share, relays, options) ] as const
  })
  return { group, nodes: new Map(nodes) }
}
