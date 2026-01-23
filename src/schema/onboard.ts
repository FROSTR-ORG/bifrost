import { z }    from 'zod'
import base     from './base.js'
import pkg      from './package.js'
import nonce    from './nonce.js'

/**
 * Schema for onboard package (distributed via QR code).
 */
const onboard_pkg = z.object({
  share   : pkg.share,
  peer_pk : base.hex32,
  relays  : z.array(base.str.url()).min(1)
})

/**
 * Schema for onboard request (sent by new node).
 */
const onboard_req = z.object({
  share_pk : base.hex33,
  idx      : base.num
})

/**
 * Schema for onboard response (sent by existing peer).
 */
const onboard_res = z.object({
  group  : pkg.group,
  nonces : nonce.nonce_package,
  status : z.enum([ 'ok', 'error' ]),
  error  : base.str.optional()
})

/**
 * Schema for full onboard response with peer nonces.
 */
const full_onboard_res = onboard_res.extend({
  peer_nonces : z.array(nonce.nonce_package).optional()
})

export default {
  onboard_pkg,
  onboard_req,
  onboard_res,
  full_onboard_res
}
