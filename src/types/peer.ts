export type PeerStatus = 'online' | 'offline'

export interface PeerPolicy {
  send : boolean,
  recv : boolean
}

export interface PeerConfig {
  policy : PeerPolicy,
  pubkey : string
}

export interface PeerData extends PeerConfig {
  status  : PeerStatus,
  updated : number
}
