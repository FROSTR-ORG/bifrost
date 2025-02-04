import { Buff } from '@cmdcode/buff'
import {
  generate_dealer_pkg,
  encode_group_pkg,
  encode_share_pkg
} from '@frostr/bifrost/lib'

const labels    = [ 'alice', 'bob', 'carol' ]
const secrets   = labels.map(e => Buff.str(e).digest.hex)
const threshold = 2

const dealer_pkg = generate_dealer_pkg(threshold, labels.length, secrets)

console.dir(dealer_pkg, { depth: null })

const group  = encode_group_pkg(dealer_pkg.group)
const shares = dealer_pkg.shares.map((e, idx) => [ labels[idx], encode_share_pkg(e) ])

console.log(JSON.stringify({ group, shares }, null, 2))
