import { z } from 'zod'
import base  from './base.js'
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
  sign_ival  : base.num
})

export default { cache, config, middleware }
