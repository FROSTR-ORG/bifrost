import type { EventTemplate }    from '@cmdcode/nostr-p2p'
import type { PublicShare }      from "@cmdcode/frost"
import type { SignaturePackage } from './pkg.js'

export type SignType = 'ecdh' | 'event' | 'msg' | 'tx'

export interface RequestPackage {
  members : number[]
}

export interface ECDHRequest extends RequestPackage {
  share : PublicShare
}

export interface SignRequest extends RequestPackage {
  psig : SignaturePackage
}

export interface SignMessageRequest extends SignRequest {
  msg : string
}

export interface SignEventRequest extends SignRequest {
  event : EventTemplate
}
