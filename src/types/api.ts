import { Json } from '@cmdcode/nostr-p2p'

export type ApiResponse<T = Json> = ApiResponseOk<T> | ApiResponseError

export interface ApiResponseOk<T = Json> {
  ok   : true
  data : T
}

export interface ApiResponseError {
  ok  : false
  err : string
}
