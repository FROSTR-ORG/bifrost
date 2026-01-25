/**
 * Public API exports for @frostr/bifrost/lib
 *
 * This module defines the stable, documented functions available to
 * external consumers. Internal functions are not re-exported here.
 *
 * @module
 */

// Package generation
export {
  generate_dealer_package,
  create_dealer_package,
  create_share_package,
  create_member_package,
} from './package.js'

// Group operations
export {
  get_group_id,
  is_group_member,
  get_member_by_pubkey,
  get_member_by_idx,
} from './group.js'

// Session management
export {
  create_session_template,
  create_session_pkg,
  verify_session_pkg,
  get_session_id,
  get_session_ctx,
} from './session.js'

// Utilities
export {
  normalize_pubkey,
  pubkeys_match,
  select_random_peers,
  get_group_indexes,
  get_member_indexes,
} from './util.js'
