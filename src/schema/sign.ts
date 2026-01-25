import { z } from 'zod'
import base  from './base.js'
import nonce from './nonce.js'

/**
 * Nonce commit schema for signing.
 */
const nonce_commit = nonce.signing_nonce.extend({
  bind_hash : base.hex32,
  sid       : base.hex32,
  sighash   : base.hex32
})

/**
 * Nonce share schema for signing.
 */
const nonce_share = z.object({
  idx       : base.num,
  seckey    : base.hex32,
  binder_sn : base.hex32,
  hidden_sn : base.hex32,
  sid       : base.hex32,
  sighash   : base.hex32,
  bind_hash : base.hex32
})

const psig_entry  = z.tuple([ base.hex32, base.hex32 ])
const sighash_vec = z.tuple([ base.hex32 ]).rest(base.hex32)

const template = z.object({
  content : base.str.nullable(),
  hashes  : sighash_vec.array(),
  members : base.num.array(),
  stamp   : base.num,
  type    : base.str,
})

/**
 * Session schema with unified nonces array.
 * Uses MemberPublicNonce (idx + code + public points) instead of
 * separate nonce_commits and nonce_codes arrays.
 */
const session = template.extend({
  gid       : base.hex32,
  sid       : base.hex32,
  nonces    : z.array(nonce.member_public_nonce).optional(),
  replenish : z.array(nonce.nonce_package).optional()
})

/**
 * Partial signature package with replenishment.
 */
const psig_pkg = z.object({
  idx        : base.num,
  psigs      : psig_entry.array(),
  pubkey     : base.hex33,
  sid        : base.hex32,
  nonce_code : base.hex32.optional(),
  replenish  : nonce.nonce_package.optional()
})

export default {
  nonce_commit,
  nonce_share,
  psig_entry,
  psig_pkg,
  session,
  sighash_vec,
  template
}
