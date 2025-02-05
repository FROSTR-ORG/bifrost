import type { SessionConfig } from '@/types/node.js'

export interface ECDHPackage {
  idx      : number
  keyshare : string
  members  : string[]
  peer_pk  : string
}

export interface SharePackage extends CommitPackage {
  binder_sn : string
  hidden_sn : string
  seckey    : string
}

export interface MemberSharePackage extends SharePackage {
  bind_hash : string
}

export interface CommitPackage {
  idx       : number
  binder_pn : string
  hidden_pn : string
  pubkey    : string
}

export interface MemberCommitPackage extends CommitPackage {
  bind_hash : string
}

export interface GroupPackage {
  commits   : CommitPackage[]
  pubkey    : string
  threshold : number
}

export interface DealerPackage {
  group  : GroupPackage
  shares : SharePackage[]
}

export interface SessionPackage extends SessionConfig {
  sid : string
}

export interface SignaturePackage extends SessionPackage {
  idx     : number
  psig    : string
  pubkey  : string
}
