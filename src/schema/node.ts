import { z } from 'zod'
import base  from './base.js'
import nonce from './nonce.js'
import peer  from './peer.js'

import {
  MIN_TIMEOUT,
  MAX_MSG_TIMEOUT,
  MAX_SUB_TIMEOUT,
  MAX_SIGN_BATCH_SIZE,
  MAX_ECDH_BATCH_SIZE
} from '@/const.js'

const middleware = z.object({
  ecdh : z.function().optional(),
  sign : z.function().optional()
})

const node_config = z.object({
  msg_timeout : z.number().min(MIN_TIMEOUT).max(MAX_MSG_TIMEOUT).optional(),
  sub_timeout : z.number().min(MIN_TIMEOUT).max(MAX_SUB_TIMEOUT).optional(),
  max_retries : z.number().min(0).max(10).optional()
}).optional()

const config = z.object({
  debug          : z.boolean(),
  middleware     : middleware,
  policies       : peer.config.array(),
  default_policy : peer.policy,
  sign_interval  : base.num,
  max_sign_batch : z.number().min(1).max(MAX_SIGN_BATCH_SIZE),
  ecdh_interval  : base.num,
  max_ecdh_batch : z.number().min(1).max(MAX_ECDH_BATCH_SIZE),
  pool_config    : nonce.pool_config_partial.optional(),
  node_config    : node_config
})

export default { config, middleware, node_config }
