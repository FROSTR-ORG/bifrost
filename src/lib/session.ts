import { Buff }                  from '@cmdcode/buff'
import { get_group_signing_ctx } from '@cmdcode/frost/lib'
import { now }                   from '@/util/index.js'

import {
  get_commit_by_idx,
  get_group_id
} from './group.js'

import {
  tweak_pubkey,
  tweak_seckey
} from './crypto.js'

import type {
  GroupPackage,
  SessionCommit,
  SessionMember,
  SessionConfig, 
  SessionPackage,
  SharePackage,
  SessionContext
} from '@/types/index.js'

export function create_session_pkg (
  group    : GroupPackage,
  members  : number[],
  message  : string,
  stamp    : number = now()
) : SessionPackage {
  members = members.sort()
  const session = { members, message, stamp }
  const gid     = get_group_id(group)
  const sid     = get_session_id(gid, session)
  return { gid, members, message, stamp, sid }
}

export function verify_session_pkg (
  group   : GroupPackage,
  session : SessionPackage
) : boolean {
  const gid = get_group_id(group)
  const sid = get_session_id(gid, session)
  return session.gid === gid && session.sid === sid
}

export function get_session_id (
  group_id : string,
  session  : SessionConfig
) : string {
  const mbrs = session.members.map(e => Buff.bytes(e))
  const msg  = Buff.bytes(session.message)
  const ts   = Buff.num(session.stamp, 4)
  const pimg = Buff.join([ group_id, ...mbrs, msg, ts ])
  return pimg.digest.hex
}

export function get_session_binder (
  session_id : string | Uint8Array,
  member_idx : number
) : string {
  const sid = Buff.bytes(session_id)
  const idx = Buff.num(member_idx, 4)
  const pre = Buff.join([ sid, idx ])
  return pre.digest.hex
}

export function get_session_member (
  session : SessionPackage,
  share   : SharePackage
) : SessionMember {
  const { idx, seckey } = share
  const bind_hash = get_session_binder(session.sid, share.idx)
  const hidden_sn = tweak_seckey(share.hidden_sn, bind_hash)
  const binder_sn = tweak_seckey(share.binder_sn, bind_hash)
  return { idx, seckey, binder_sn, hidden_sn, bind_hash }
}

export function get_session_commit (
  group   : GroupPackage,
  session : SessionPackage,
  idx     : number
) : SessionCommit {
  const commit    = get_commit_by_idx(group.commits, idx)
  const bind_hash = get_session_binder(session.sid, commit.idx)
  const hidden_pn = tweak_pubkey(commit.hidden_pn, bind_hash)
  const binder_pn = tweak_pubkey(commit.binder_pn, bind_hash)
  return { ...commit, binder_pn, hidden_pn, bind_hash }
}

export function get_session_ctx (
  group   : GroupPackage,
  session : SessionPackage,
  tweaks? : string[]
) : SessionContext {
  const commits = session.members.map(idx => get_session_commit(group, session, idx))
  const ctx     = get_group_signing_ctx(group.group_pk, commits, session.message, tweaks)
  return { ...ctx, session }
}
