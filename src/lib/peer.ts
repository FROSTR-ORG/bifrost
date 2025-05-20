import { copy_obj } from '@/util/helpers.js'

import type { PeerConfig, PeerData } from '@/types/index.js'

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

export function update_peer (
  peers  : PeerData[],
  config : PeerConfig
) : PeerData[] {
  const { pubkey, ...policy } = config
  const idx  = peers.findIndex(e => e.pubkey === pubkey)
  if (idx === -1) return peers
  const new_peers = copy_obj(peers)
  new_peers[idx].policy = policy
  return new_peers
}
