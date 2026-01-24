import { generate_dealer_package } from '@/lib/index.js'
import { hash_string }             from '@/test/lib/hash.js'

import {
  encode_group_package,
  encode_share_package
} from '@/encoder/index.js'

const labels    = [ 'alice', 'bob', 'carol' ]
const secrets   = labels.map(e => hash_string(e))
const threshold = 2

const dealer_package = generate_dealer_package(threshold, labels.length, secrets)

console.dir(dealer_package, { depth: null })

const group  = encode_group_package(dealer_package.group)
const shares = dealer_package.shares.map((e, idx) => [ labels[idx], encode_share_package(e) ])

console.log(JSON.stringify({ group, shares }, null, 2))
