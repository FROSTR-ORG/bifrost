import {
  create_ecdh_share,
  derive_ecdh_secret
} from '@vbyte/frost/lib'

import type { SecretShare }               from '@vbyte/frost'
import type { ECDHEntry, ECDHPackage }    from '@/types/index.js'

/**
 * Create an ECDH exchange package for a single public key.
 *
 * @param members  - The members of the quorum.
 * @param ecdh_pk  - The public key to use for ECDH.
 * @param secshare - The secret share to use for ECDH.
 * @returns The ECDH exchange package with a single entry.
 */
export function create_ecdh_pkg (
  members  : number[],
  ecdh_pk  : string,
  secshare : SecretShare
) : ECDHPackage {
  // Create the ECDH share.
  const ecdh_share = create_ecdh_share(members, secshare, ecdh_pk)
  // Return the ECDH exchange package with a single entry.
  return {
    idx     : ecdh_share.idx,
    members,
    entries : [ { ecdh_pk, keyshare : ecdh_share.pubkey } ]
  }
}

/**
 * Create an ECDH exchange package for multiple public keys.
 *
 * @param members   - The members of the quorum.
 * @param ecdh_pks  - The public keys to use for ECDH.
 * @param secshare  - The secret share to use for ECDH.
 * @returns The ECDH exchange package with multiple entries.
 */
export function create_batched_ecdh_pkg (
  members  : number[],
  ecdh_pks : string[],
  secshare : SecretShare
) : ECDHPackage {
  // Create entries for each public key.
  const entries : ECDHEntry[] = ecdh_pks.map(ecdh_pk => {
    const ecdh_share = create_ecdh_share(members, secshare, ecdh_pk)
    return { ecdh_pk, keyshare : ecdh_share.pubkey }
  })
  // Get idx from first share (all shares have same idx since same secshare).
  const idx = entries.length > 0
    ? create_ecdh_share(members, secshare, ecdh_pks[0]).idx
    : secshare.idx
  // Return the ECDH exchange package.
  return { idx, members, entries }
}

/**
 * Combine ECDH exchange packages for a single ecdh_pk.
 *
 * Takes packages from multiple signers and combines the keyshares
 * for the specified ecdh_pk to derive the shared secret.
 *
 * @param pkgs    - The ECDH exchange packages from all signers.
 * @param ecdh_pk - The public key to derive the secret for.
 * @returns The derived ECDH shared secret.
 */
export function combine_ecdh_pkgs (
  pkgs    : ECDHPackage[],
  ecdh_pk : string
) : string {
  // Collect keyshares for the specified ecdh_pk from all packages.
  const keyshares = pkgs.map(pkg => {
    const entry = pkg.entries.find(e => e.ecdh_pk === ecdh_pk)
    if (!entry) {
      throw new Error(`ecdh_pk ${ecdh_pk} not found in package from idx ${pkg.idx}`)
    }
    return { idx : pkg.idx, pubkey : entry.keyshare }
  })
  // Return the derived ECDH secret.
  return derive_ecdh_secret(keyshares)
}

/**
 * Combine ECDH exchange packages for all ecdh_pks in the batch.
 *
 * @param pkgs - The ECDH exchange packages from all signers.
 * @returns Map of ecdh_pk to derived shared secret.
 */
export function combine_batched_ecdh_pkgs (
  pkgs : ECDHPackage[]
) : Map<string, string> {
  const results = new Map<string, string>()

  // Get all unique ecdh_pks from the first package (all packages should have same keys).
  if (pkgs.length === 0) return results

  const ecdh_pks = pkgs[0].entries.map(e => e.ecdh_pk)

  for (const ecdh_pk of ecdh_pks) {
    results.set(ecdh_pk, combine_ecdh_pkgs(pkgs, ecdh_pk))
  }

  return results
}
