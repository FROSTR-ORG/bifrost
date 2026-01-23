import { Buff }                from '@cmdcode/buff'
import { generate_dealer_package } from '@frostr/bifrost/lib'

import {
  encode_group_package,
  encode_share_package
} from '@frostr/bifrost/encoder'

const labels    = [ 'alice', 'bob', 'carol' ]
const secrets   = labels.map(e => Buff.str(e).digest.hex)
const threshold = 2

const dealer_package = generate_dealer_package(threshold, labels.length, secrets)

console.dir(dealer_package, { depth: null })

const group  = encode_group_package(dealer_package.group)
const shares = dealer_package.shares.map((e, idx) => [ labels[idx], encode_share_package(e) ])

console.log(JSON.stringify({ group, shares }, null, 2))
