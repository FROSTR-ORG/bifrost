import { Buff }                from '@cmdcode/buff'
import { BifrostNode }         from '@frostr/bifrost'
import { generate_dealer_pkg } from '@frostr/bifrost/lib'

import type { BifrostNodeConfig } from '@frostr/bifrost'

import type {
  TestNodes,
  GroupVector
}  from '@/test/types.js'

export function generate_test_nodes (
  labels    : string[],
  relays    : string[],
  threshold : number,
  options   : Partial<BifrostNodeConfig> = {}
) : TestNodes {
  const secrets = labels.map(e => Buff.str(e).digest.hex)
  const pkg     = generate_dealer_pkg(threshold, labels.length, secrets)
  const nodes   = pkg.shares.map((share, idx) => {
    return [ labels[idx], new BifrostNode(pkg.group, share, relays, options) ] as const
  })
  return { group : pkg.group, nodes : new Map(nodes) }
}

export function import_test_nodes (
  labels   : string[],
  vector   : GroupVector,
  relays   : string[],
  options? : Partial<BifrostNodeConfig>
) : TestNodes {
  const nodes = vector.shares.map((share, idx) => {
    return [ labels[idx], new BifrostNode(vector.group, share, relays, options) ] as const
  })
  return { group : vector.group, nodes : new Map(nodes) }
}
