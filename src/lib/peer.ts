import { now }               from '@/util/helpers.js'
import { PEER_STATE_EXPIRY } from '@/const.js'

import type { PeerData } from '@/types/index.js'

export function get_peer_by_pubkey (
  peers : PeerData[],
  pubkey : string
) : PeerData | undefined {
  return peers.find(e => e.pubkey === pubkey)
}

export function get_peer_pubkeys (peers : PeerData[]) : string[] {
  return peers.map(e => e.pubkey)
}

export function get_recv_pubkeys (peers : PeerData[]) : string[] {
  return peers
    .filter(e => e.policy.recv)
    .map(e => e.pubkey)
}

export function get_send_pubkeys (peers : PeerData[]) : string[] {
  return peers
    .filter(e => e.policy.send)
    .map(e => e.pubkey)
}

export function get_expired_pubkeys (peers : PeerData[]) : string[] {
  return peers.filter(e => {
    return e.status === 'offline' || e.updated < now() - PEER_STATE_EXPIRY
  }).map(e => e.pubkey)
}
