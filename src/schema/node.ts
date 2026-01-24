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

const sdk_config = z.object({
  msg_timeout : z.number().min(1000).max(300000).optional(),
  sub_timeout : z.number().min(1000).max(600000).optional(),
  max_retries : z.number().min(0).max(10).optional()
}).partial().optional()

const config = z.object({
  debug      : z.boolean(),
  middleware : middleware,
  policies   : peer.config.array(),
  sign_interval  : base.num,
  ecdh_interval  : base.num,
  nonce_pool     : nonce.pool_config_partial.optional(),
  sdk_config     : sdk_config
})

export default { cache, config, middleware, sdk_config }
