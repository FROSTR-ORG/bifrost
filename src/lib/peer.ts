import { now }               from '@/util/helpers.js'
import { PEER_STATE_EXPIRY } from '@/const.js'

import type { NoncePool }                 from '@/class/pool.js'
import type { GroupPackage, PeerData }    from '@/types/index.js'

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

/**
 * Get pubkeys of peers that can be used for signing.
 * Filters by: send policy enabled AND nonce availability.
 *
 * @param peers - Array of peer data.
 * @param pool - The nonce pool to check availability against.
 * @param group - The group package containing member info.
 * @returns Array of pubkeys for peers that can sign.
 */
export function get_signable_pubkeys (
  peers : PeerData[],
  pool  : NoncePool,
  group : GroupPackage
) : string[] {
  return peers
    .filter(e => e.policy.send)
    .filter(e => {
      const member = group.members.find(m =>
        m.pubkey === e.pubkey || m.pubkey.slice(2) === e.pubkey
      )
      if (!member) return false
      return pool.can_sign(member.idx)
    })
    .map(e => e.pubkey)
}
