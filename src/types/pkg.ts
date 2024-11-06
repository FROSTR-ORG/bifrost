export interface SharePackage {
  idx       : number
  binder_sn : string
  hidden_sn : string
  share_sk  : string
}

export interface CommitPackage {
  idx       : number
  binder_pn : string
  hidden_pn : string
  share_pk  : string
}

export interface GroupPackage {
  commits   : CommitPackage[]
  pubkey    : string
  threshold : number
}

export interface SignaturePackage {
  idx    : number
  psig   : string
  pubkey : string
}

export interface KeySet {
  group  : GroupPackage,
  shares : SharePackage[]
}
