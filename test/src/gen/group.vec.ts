import { Buff } from '@cmdcode/buff'

import { generate_dealer_pkg } from '@/lib/pkg.js'

import {
  encode_group_pkg,
  encode_share_pkg
} from '@/lib/encoder.js'

const DEFAULT_SECRETS = [ 'alice', 'bob', 'carol' ]

export default function (secrets = DEFAULT_SECRETS) {

  const share_seeds = secrets.map(e => Buff.str(e).digest.hex)
  const nonce_seeds = share_seeds.map(e => Buff.join([ e, e ]).hex)

  const pkg    = generate_dealer_pkg(2, 3, share_seeds, nonce_seeds)
  const group  = encode_group_pkg(pkg.group)
  const shares = pkg.shares.map(e => encode_share_pkg(e))
  const vector = { group, shares, seeds: share_seeds }

  return vector
}
