import { z } from 'zod'
import base  from './base.js'

/**
 * Schema for MemberPackage.
 */
const member = z.object({
  idx    : base.num,
  pubkey : base.hex33
})

/**
 * Schema for GroupPackage.
 */
const group = z.object({
  members   : z.array(member),
  group_pk  : base.hex33,
  threshold : base.num
})

/**
 * Schema for SharePackage.
 */
const share = z.object({
  idx    : base.num,
  seckey : base.hex32
})

const ecdh_entry = z.object({
  ecdh_pk  : base.hex,
  keyshare : base.hex
})

const ecdh = z.object({
  idx     : base.num,
  members : base.num.array(),
  entries : z.array(ecdh_entry)
})

export default {
  ecdh,
  ecdh_entry,
  group,
  member,
  share
}
