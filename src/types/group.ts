/**
 * A single ECDH entry containing a public key and its corresponding keyshare.
 */
export interface ECDHEntry {
  ecdh_pk  : string
  keyshare : string
}

/**
 * Package for batched ECDH operations.
 * Contains member info and an array of ECDH entries.
 */
export interface ECDHPackage {
  idx     : number
  members : number[]
  entries : ECDHEntry[]
}

/**
 * Simplified SharePackage - nonces are now managed by NoncePool.
 */
export interface SharePackage {
  idx    : number
  seckey : string
}

/**
 * Member information within a group.
 */
export interface MemberPackage {
  idx    : number
  pubkey : string
}

/**
 * Group package containing group public key and member information.
 */
export interface GroupPackage {
  members   : MemberPackage[]
  group_pk  : string
  threshold : number
}

/**
 * Dealer package containing group and share information.
 */
export interface DealerPackage {
  group  : GroupPackage
  shares : SharePackage[]
}
