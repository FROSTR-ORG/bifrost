import { z } from 'zod'
import base  from './base.js'

import {
  MIN_POOL_SIZE,
  MAX_POOL_SIZE
} from '@/const.js'

/**
 * Schema for base public nonce (binder_pn + hidden_pn only).
 */
const public_nonce = z.object({
  binder_pn : base.hex33,
  hidden_pn : base.hex33
})

/**
 * Schema for derived public nonce (with derivation code).
 * Used for pool storage and nonce packages.
 */
const derived_public_nonce = public_nonce.extend({
  code : base.hex32
})

/**
 * Schema for member public nonce (with member index).
 * Used only in signing wire format to identify member.
 */
const member_public_nonce = derived_public_nonce.extend({
  idx : base.num
})

/**
 * Schema for secret nonce pair (held locally, never transmitted).
 */
const secret_nonce = z.object({
  code      : base.hex32,
  binder_sn : base.hex32,
  hidden_sn : base.hex32
})

/**
 * Schema for nonce package (array of derived public nonces).
 * Sender/target are implicit from P2P context.
 */
const nonce_package = z.array(derived_public_nonce)

/**
 * Base schema for nonce pool configuration (without refinements).
 * Used for partial config validation where not all fields are present.
 */
const pool_config_base = z.object({
  pool_size          : base.num.min(MIN_POOL_SIZE).max(MAX_POOL_SIZE),
  min_threshold      : base.num.min(1),
  critical_threshold : base.num.min(1),
  replenish_count    : base.num.min(1)
})

/**
 * Schema for nonce pool configuration (with cross-field refinements).
 */
const pool_config = pool_config_base.refine(
  data => data.critical_threshold < data.min_threshold,
  { message: 'critical_threshold must be less than min_threshold' }
).refine(
  data => data.min_threshold < data.pool_size,
  { message: 'min_threshold must be less than pool_size' }
)

/**
 * Partial schema for nonce pool configuration.
 * Used when only some config fields need to be overridden.
 */
const pool_config_partial = pool_config_base.partial()

/**
 * Schema for nonce pool status.
 */
const pool_status = z.object({
  peer_idx   : base.num,
  peer_pk    : base.hex32,
  available  : base.num,
  needs_fill : base.bool,
  critical   : base.bool
})

/**
 * Schema for signing nonce (used during signing operations).
 */
const signing_nonce = z.object({
  idx       : base.num,
  binder_pn : base.hex33,
  hidden_pn : base.hex33
})

/**
 * Schema for nonce commit (signing nonce bound to session).
 */
const nonce_commit = signing_nonce.extend({
  sid       : base.hex32,
  sighash   : base.hex32,
  bind_hash : base.hex32
})

/**
 * Schema for serialized peer nonce state (for persistence).
 */
const peer_state = z.object({
  nonces : z.array(derived_public_nonce)
})

/**
 * Schema for nonce pool state (for persistence).
 */
const pool_state = z.object({
  our_idx  : base.num,
  outgoing : z.record(z.coerce.number(), peer_state),
  incoming : z.record(z.coerce.number(), peer_state)
})

export default {
  public_nonce,
  derived_public_nonce,
  member_public_nonce,
  secret_nonce,
  nonce_package,
  pool_config,
  pool_config_partial,
  pool_status,
  signing_nonce,
  nonce_commit,
  peer_state,
  pool_state
}
