export interface BifrostNodeCache {
  ecdh : Map<string, string>
}

export interface BifrostNodeConfig {

}

export interface BifrostSignerConfig {

}

export interface SessionConfig {
  members : string[]
  message : string
  stamp   : number
}
