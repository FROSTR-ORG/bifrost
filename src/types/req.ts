import { SignaturePackage } from "./pkg.js"

export type SignType = 'ecdh' | 'event' | 'msg' | 'tx'

export interface BaseRequest {
  id      : string
  members : number[]
  method  : string
}

export interface SignRequest extends BaseRequest {
  pkg : SignaturePackage
}
