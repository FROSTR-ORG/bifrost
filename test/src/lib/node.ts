import { BifrostNode }             from '@/index.js'
import { generate_dealer_package } from '@/lib/index.js'
import { hash_string }             from '@/test/lib/hash.js'

import type { BifrostNodeConfig } from '@/index.js'

import type {
  TestNodes,
  GroupTestVector
}  from '@/test/types.js'

export function generate_test_nodes (
  labels    : string[],
  relays    : string[],
  threshold : number,
  options   : Partial<BifrostNodeConfig> = {}
) : TestNodes {
  const secrets = labels.map(e => hash_string(e))
  const pkg     = generate_dealer_package(threshold, labels.length, secrets)
  const nodes   = pkg.shares.map((share, idx) => {
    return [ labels[idx], new BifrostNode(pkg.group, share, relays, options) ] as const
  })
  return { group : pkg.group, nodes : new Map(nodes) }
}

export function import_test_nodes (
  labels   : string[],
  vector   : GroupTestVector,
  relays   : string[],
  options? : Partial<BifrostNodeConfig>
) : TestNodes {
  const nodes = vector.shares.map((share, idx) => {
    return [ labels[idx], new BifrostNode(vector.group, share, relays, options) ] as const
  })
  return { group : vector.group, nodes : new Map(nodes) }
}
