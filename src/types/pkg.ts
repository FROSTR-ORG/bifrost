export interface ECDHPackage {
  idx      : number
  members  : number[]
  peer_pk  : string
  pubshare : string
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
  pubkey    : string
  threshold : number
}

export interface SessionPackage {
  binder  : string
  members : number[]
  sid     : string
  stamp   : number
}

export interface SignaturePackage {
  idx    : number
  psig   : string
  pubkey : string
}

export interface SignMessagePackage extends SignaturePackage {
  message : string
  session : SessionPackage
}

export interface KeySet {
  group  : GroupPackage,
  shares : SharePackage[]
}
