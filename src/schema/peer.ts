import { z }   from 'zod'
import base    from './base.js'
import nonce   from './nonce.js'

const policy = z.object({
  send : z.boolean(),
  recv : z.boolean()
})

const config = z.object({
  pubkey : base.hex32,
  policy : policy
})

const data = config.extend({
  status  : z.enum(['online', 'offline']),
  updated : base.stamp
})

/**
 * Schema for enhanced ping request with nonce pool info.
 * nonces is now just an array (NoncePackage = DerivedPublicNonce[])
 */
const ping_req = z.object({
  version     : base.num,
  pool_status : z.array(nonce.pool_status).optional(),
  nonces      : nonce.nonce_package.optional()
})

/**
 * Schema for enhanced ping response with nonce pool info.
 * nonces is now just an array (NoncePackage = DerivedPublicNonce[])
 */
const ping_res = z.object({
  policy      : policy,
  pool_status : z.array(nonce.pool_status).optional(),
  nonces      : nonce.nonce_package.optional()
})

export default { config, data, ping_req, ping_res, policy }
