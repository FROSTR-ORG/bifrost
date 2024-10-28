export type ApiResponse<T = any> = ApiResponseOk<T> | ApiResponseError

export interface ApiResponseOk<T = any> {
  ok   : true
  data : T
}

export interface ApiResponseError {
  ok  : false
  err : string
}
