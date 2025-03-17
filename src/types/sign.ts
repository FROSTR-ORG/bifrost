import type { GroupSigningCtx } from '@cmdcode/frost'

import type { CommitPackage, SharePackage } from './group.js'

export type SighashVector   = [ sighash : string, ...tweaks : string[] ]
export type PartialSigEntry = [ sighash : string, psig : string ]
export type SignatureEntry  = [ sighash : string, pubkey : string, signature : string ]

export interface SighashCommit extends CommitPackage {
  sid       : string,
  sighash   : string,
  bind_hash : string
}

export interface SighashShare extends SharePackage {
  sid       : string,
  sighash   : string,
  bind_hash : string
}

export interface SignSessionConfig {
  content : string | null
  stamp   : number
  type    : string
}

export interface SignRequestConfig extends SignSessionConfig {
  peers : string[]
}

export interface SignSessionTemplate extends SignSessionConfig {
  hashes  : SighashVector[]
  members : number[]
}

export interface SignSessionPackage extends SignSessionTemplate {
  gid : string
  sid : string
}

export interface SignSessionContext {
  pubkeys : string[]
  session : SignSessionPackage
  sigmap : Map<string, GroupSigningCtx>
}

export interface PartialSigPackage {
  idx    : number
  psigs  : PartialSigEntry[]
  pubkey : string
  sid    : string
}

export interface PartialSigRecord {
  sighash : string,
  idx     : number,
  pubkey  : string,
  psig    : string
}
