import { Buff } from '@cmdcode/buff'

import { generate_dealer_package } from '@frostr/bifrost/lib'

import {
  encode_group_package,
  encode_share_package
} from '@frostr/bifrost/encoder'

const DEFAULT_SECRETS = [ 'alice', 'bob', 'carol' ]

export default function (secrets = DEFAULT_SECRETS) {

  const share_seeds = secrets.map(e => Buff.str(e).digest.hex)
  const nonce_seeds = share_seeds.map(e => Buff.join([ e, e ]).hex)

  const pkg    = generate_dealer_package(2, 3, share_seeds, nonce_seeds)
  const group  = encode_group_package(pkg.group)
  const shares = pkg.shares.map(e => encode_share_package(e))
  const vector = { group, shares, seeds: share_seeds }

  return vector
}
