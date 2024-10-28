import {
  create_ecdh_share,
  derive_ecdh_secret
} from '@cmdcode/frost/lib'

import type { SecretShare } from '@cmdcode/frost'
import type { ECDHPackage } from '@/types/index.js'

export function create_ecdh_pkg (
  members  : number[],
  ecdh_pk  : string,
  secshare : SecretShare
) {
  const ecdh_share = create_ecdh_share(members, secshare, ecdh_pk)
  return { idx : ecdh_share.idx, keyshare : ecdh_share.pubkey, members, ecdh_pk }
}

export function combine_ecdh_pkgs (
  pkgs : ECDHPackage[]
) {
  const shares = pkgs.map(e => {
    return { idx : e.idx, pubkey : e.keyshare }
  })
  return derive_ecdh_secret(shares)
}
