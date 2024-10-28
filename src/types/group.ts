export interface ECDHPackage {
  ecdh_pk  : string
  idx      : number
  members  : number[]
  keyshare : string
}

export interface SharePackage {
  idx       : number
  binder_sn : string
  hidden_sn : string
  seckey    : string
}

export interface CommitPackage {
  idx       : number
  binder_pn : string
  hidden_pn : string
  pubkey    : string
}

export interface GroupPackage {
  commits   : CommitPackage[]
  group_pk  : string
  threshold : number
}

export interface DealerPackage {
  group  : GroupPackage
  shares : SharePackage[]
}
