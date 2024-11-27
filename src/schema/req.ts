import { z } from 'zod'
import base  from './base.js'

const base_req = z.object({
  idx     : base.num,
  members : base.num.array()
})

const ecdh_req = base_req.extend({
  pubkey   : base.hex32,
  pubshare : base.hex
})

const sign_msg_req = base_req.extend({
  message : base.str,
})

export default {
  ecdh_req,
  sign_msg_req
}