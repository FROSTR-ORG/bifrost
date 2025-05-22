import { z } from 'zod'
import base  from './base.js'

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

export default { config, data, policy }
