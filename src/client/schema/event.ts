import { z } from 'zod'
import base  from './base.js'

const mid     = base.hex16
const payload = base.str
const subject = base.str.min(3).max(256)
const tags    = z.array(base.literal.array())

const envelope = z.tuple([ subject, mid, payload ])

const template = z.object({
  content    : base.str,
  created_at : base.stamp,
  kind       : base.num,
  pubkey     : base.hex32,
  tags
})

const signed = template.extend({
  id  : base.hex32,
  sig : base.hex64,
})

const message  = z.object({
  ctx  : signed,
  data : z.any(),
  mid,
  tag  : subject,
})

export default { envelope, message, signed, tags, template }
