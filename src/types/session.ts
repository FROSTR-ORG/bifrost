import type { GroupSigningCtx }             from '@cmdcode/frost'
import type { CommitPackage, SharePackage } from './group.js'

export interface SessionContext extends GroupSigningCtx {
  session : SessionPackage
}

export interface SessionConfig {
  members : number[]
  message : string
  stamp   : number
}

export interface SessionPackage extends SessionConfig {
  gid : string
  sid : string
}

export interface SessionCommit extends CommitPackage {
  bind_hash : string
}

export interface SessionMember extends SharePackage {
  bind_hash: string
}

export interface SignaturePackage {
  idx     : number
  psig    : string
  pubkey  : string
  sid     : string
}
