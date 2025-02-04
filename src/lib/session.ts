import { Buff } from '@cmdcode/buff'
import { now }  from '@/util/index.js'

import { get_commit_by_pubkey } from './group.js'

import {
  get_commit_prefix,
  get_pubkey,
  get_session_ctx
} from '@cmdcode/frost/lib'

import {
  tweak_pubnonce,
  tweak_secnonce
} from './crypto.js'

import type {
  GroupPackage,
  MemberCommitPackage,
  MemberSharePackage,
  SessionConfig,
  SessionPackage,
  SharePackage,
} from '@/types/index.js'

export function create_session_pkg (
  group    : GroupPackage,
  members  : string[],
  message  : string,
  stamp    : number = now()
) : SessionPackage {
  const session = { members, message, stamp }
  const prefix  = get_session_prefix(group, session)
  const sid     = Buff.hex(prefix).digest.hex
  return { members, message, stamp, sid }
}

export function verify_session_pkg (
  group   : GroupPackage,
  session : SessionPackage
) : boolean {
  const prefix = get_session_prefix(group, session)
  const sid    = Buff.hex(prefix).digest.hex
  return sid === session.sid
}

export function get_member_commits (
  group   : GroupPackage,
  session : SessionConfig
) : MemberCommitPackage[] {
  const prefix = get_session_prefix(group, session)
  return session.members.map(pubkey => {
    const commit    = get_commit_by_pubkey(group.commits, pubkey)
    const bind_hash = get_session_binder(prefix, commit.idx)
    const binder_pn = tweak_pubnonce(commit.binder_pn, bind_hash)
    const hidden_pn = tweak_pubnonce(commit.hidden_pn, bind_hash)
    return { ...commit, binder_pn, hidden_pn, bind_hash }
  })
}

export function get_member_share (
  group   : GroupPackage,
  session : SessionConfig,
  share   : SharePackage
) : MemberSharePackage {
  const prefix    = get_session_prefix(group, session)
  const bind_hash = get_session_binder(prefix, share.idx)
  const binder_sn = tweak_secnonce(share.binder_sn, bind_hash)
  const hidden_sn = tweak_secnonce(share.hidden_sn, bind_hash)
  const binder_pn = get_pubkey(binder_sn)
  const hidden_pn = get_pubkey(hidden_sn)
  return { ...share, binder_sn, hidden_sn, binder_pn, hidden_pn, bind_hash }
}

export function get_member_ctx (
  group   : GroupPackage,
  session : SessionPackage,
  tweaks? : string[]
) {
  const commits = get_member_commits(group, session)
  return get_session_ctx(group.pubkey, commits, session.message, tweaks)
}

export function get_session_prefix (
  group   : GroupPackage,
  session : SessionConfig
) : string {
  const grp  = get_commit_prefix(group.commits, group.pubkey, session.message)
  const mbrs = session.members.map(e => Buff.bytes(e))
  const ts   = Buff.num(session.stamp, 4)
  return Buff.join([ ts, ...mbrs, grp ]).hex
}

export function get_session_binder (
  prefix : string | Uint8Array,
  index  : number
) : string {
  const pfx = Buff.bytes(prefix)
  const idx = Buff.num(index, 4)
  const pre = Buff.join([ idx, pfx ])
  return pre.digest.hex
}
