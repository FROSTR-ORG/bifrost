export type PeerStatus = 'online' | 'offline'

export interface PeerPolicy {
  send : boolean,
  recv : boolean
}

export interface PeerConfig extends PeerPolicy {
  pubkey : string
}

export interface PeerData {
  policy  : PeerPolicy,
  pubkey  : string,
  status  : PeerStatus,
  updated : number
}
