import { Buff } from '@cmdcode/buff'
import { now }  from '@/util/index.js'

import {
  get_commit_prefix,
  get_pubkey,
  get_session_ctx,
  tweak_pubkey,
  tweak_seckey
} from '@cmdcode/frost/lib'

import type {
  CommitPackage,
  GroupPackage,
  SessionPackage,
  SharePackage
} from '@/types/index.js'

/**
 * Get the prefix string for a signature group.
 * 
 * @param group   The data packet for the signing group.
 * @param message The message to be signed (encoded in hex).
 * @returns       The prefix for the group (encoded in hex).
 */
export function get_session_prefix (
  group   : GroupPackage,
  message : string
) : string {
  const { commits, pubkey } = group
  return get_commit_prefix(commits, pubkey, message).hex
}

/**
 * Create a session package for orchestrating a new signature session.
 * 
 * @param group   The data packet for the signing group.
 * @param members A list of participating member indexes.
 * @param message The message to be signed (encoded in hex).
 * @param auxrand (optional) aux data for generating the session id.
 * @param stamp   (optional) creation timestamp for the session.
 * @returns       A session data packet.
 */
export function create_session_pkg (
  group    : GroupPackage,
  members  : number[],
  message  : string,
  auxrand ?: string,
  stamp    : number = now()
) : SessionPackage {
  const sid  = (typeof auxrand === 'string')
    ? Buff.hex(auxrand, 32).digest
    : Buff.random(32)
  const mbrs = Buff.json(members)
  const pfix = get_session_prefix(group, message)
  const stmp = Buff.num(stamp, 4)
  const pimg = Buff.join([ pfix, sid, stmp, mbrs ])
  const hash = pimg.digest.hex
  return { binder: hash, members, sid: sid.hex, stamp }
}

/**
 * Verify an existing session package.
 * 
 * @param group   The data packet for the signing group.
 * @param message The message to be signed (encoded in hex).
 * @param session The data packet for the signing session.
 * @returns       A boolean signalling if the session is valid.
 */
export function verify_session_pkg (
  group   : GroupPackage,
  message : string,
  session : SessionPackage
) {
  const { binder, members, sid, stamp } = session
  const mbrs   = Buff.json(members)
  const stmp   = Buff.num(stamp, 4)
  const prefix = get_session_prefix(group, message)
  const pimg   = Buff.join([ prefix, sid, stmp, mbrs ])
  const hash   = pimg.digest.hex
  return hash === binder
}

/**
 * Get the tweaked commits for a signing session.
 * @param commits A list of (untweaked) nonce commits for the signing group.
 * @param session The data packet for the signing session.
 * @returns       A list of tweaked nonce commits for the signing session.
 */
export function get_session_commits (
  commits : CommitPackage[],
  session : SessionPackage
) {
  return commits.map(e => {
    const { idx, pubkey, binder_pn: bpn, hidden_pn: hpn } = e
    const pimg  = Buff.join([ idx, pubkey, bpn, hpn, session.binder ])
    const tweak = pimg.digest
    const binder_pn = tweak_pubkey(bpn, tweak)
    const hidden_pn = tweak_pubkey(hpn, tweak)
    return { idx, pubkey, binder_pn, hidden_pn}
  })
}

export function get_session_share (
  session : SessionPackage,
  share   : SharePackage
) {
  const { idx, seckey, binder_sn: bsn, hidden_sn: hsn } = share
  const spk   = get_pubkey(seckey)
  const bpn   = get_pubkey(bsn)
  const hpn   = get_pubkey(hsn)
  const pimg  = Buff.join([ idx, spk, bpn, hpn, session.binder ])
  const tweak = pimg.digest
  const binder_sn = tweak_seckey(bsn, tweak)
  const hidden_sn = tweak_seckey(hsn, tweak)
  return { idx, seckey, binder_sn, hidden_sn }
}

/**
 * Get the extended signing session context
 * for the provided message and signing group.
 * 
 * @param group   The data packet for the signing group.
 * @param message The message to be signed (encoded in hex).
 * @param session The data packet for the signing session.
 * @param tweaks  (optional) tweaks to the group pubkey.
 * @returns       A session context object for the signing group.
 */
export function get_ext_session_ctx (
  group   : GroupPackage,
  message : string,
  session : SessionPackage,
  tweaks? : string[]
) {
  const commits = get_session_commits(group.commits, session)
  return get_session_ctx(group.pubkey, commits, message, tweaks)
}
