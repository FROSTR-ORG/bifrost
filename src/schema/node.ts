import { z } from 'zod'
import base  from './base.js'
import nonce from './nonce.js'
import peer  from './peer.js'

const cache = z.object({
  ecdh : z.map(base.hex33, base.hex33).optional()
})

const middleware = z.object({
  ecdh : z.function().optional(),
  sign : z.function().optional()
})

const config = z.object({
  debug      : z.boolean(),
  middleware : middleware,
  policies   : peer.config.array(),
  sign_interval  : base.num,
  ecdh_interval  : base.num,
  nonce_pool     : nonce.pool_config_partial.optional()
})

export default { cache, config, middleware }
