import type { GroupSigningCtx }             from '@cmdcode/frost'
import type { CommitPackage, SharePackage } from './group.js'

export interface SignSessionContext extends GroupSigningCtx {
  session : SignSessionPackage
}

export interface SignSessionConfig {
  payload : string | null
  stamp   : number
  type    : string
  tweaks  : string[]
}

export interface SignRequestConfig extends SignSessionConfig {
  peers : string[]
}

export interface SignSessionTemplate extends SignSessionConfig {
  members : number[]
  message : string
}

export interface SignSessionPackage extends SignSessionTemplate {
  gid : string
  sid : string
}

export interface SignSessionCommit extends CommitPackage {
  bind_hash : string
}

export interface SignSessionMember extends SharePackage {
  bind_hash: string
}

export interface PartialSigPackage {
  idx     : number
  psig    : string
  pubkey  : string
  sid     : string
}
