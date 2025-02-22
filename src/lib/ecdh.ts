import {
  create_ecdh_share,
  derive_ecdh_secret
} from '@cmdcode/frost/lib'

import type { SecretShare } from '@cmdcode/frost'
import type { ECDHPackage } from '@/types/index.js'

/**
 * Create an ECDH exchange package.
 * 
 * @param members  - The members of the quorum.
 * @param ecdh_pk  - The public key to use for ECDH.
 * @param secshare - The secret share to use for ECDH.
 * @returns The ECDH exchange package.
 */
export function create_ecdh_pkg (
  members  : number[],
  ecdh_pk  : string,
  secshare : SecretShare
) {
  // Create the ECDH share.
  const ecdh_share = create_ecdh_share(members, secshare, ecdh_pk)
  // Return the ECDH exchange package.
  return { idx : ecdh_share.idx, keyshare : ecdh_share.pubkey, members, ecdh_pk }
}

/**
 * Combine ECDH exchange packages.
 * 
 * @param pkgs - The ECDH exchange packages to combine.
 * @returns The combined ECDH exchange package.
 */
export function combine_ecdh_pkgs (
  pkgs : ECDHPackage[]
) {
  // Create the partial ECDHkeyshares.
  const keyshares = pkgs.map(e => {
    return { idx : e.idx, pubkey : e.keyshare }
  })
  // Return the derived ECDH secret.
  return derive_ecdh_secret(keyshares)
}
