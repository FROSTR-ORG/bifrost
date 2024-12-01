import { Buff }   from '@cmdcode/buff'
import { Assert } from '@/util/index.js'

import {
  deserialize_commit_pkg,
  serialize_commit_pkg
} from '@/lib/encoder.js'

import type {
  CommitPackage,
  GroupPackage,
  SharePackage,
} from '@/types/index.js'

import * as CONST from '@/const.js'

export function encode_group_pkg (
  pkg : GroupPackage
) : string {
  const thd  = Buff.num(pkg.threshold, CONST.GROUP_THOLD_SIZE)
  const gpk  = Buff.hex(pkg.pubkey, CONST.GROUP_PUBKEY_SIZE)
  const com  = pkg.commits.map(e => serialize_commit_pkg(e))
  const data = Buff.join([ gpk, thd, ...com ])
  Assert.size(data, CONST.GROUP_DATA_SIZE + (com.length * CONST.COMMIT_DATA_SIZE))
  return data.to_bech32m('bfgroup')
}

export function decode_group_pkg (
  str : string
) : GroupPackage {
  const stream = Buff.bech32m(str).stream
  const pubkey = stream.read(CONST.COMMIT_PUBKEY_SIZE).hex
  const threshold = stream.read(CONST.GROUP_THOLD_SIZE).num
  Assert.ok(stream.size % CONST.COMMIT_DATA_SIZE === 0, 'commit data is malformed')
  const count   = stream.size / CONST.COMMIT_DATA_SIZE
  const commits : CommitPackage[] = []
  for (let i = 0; i < count; i++) {
    const cbytes = stream.read(CONST.COMMIT_DATA_SIZE)
    commits.push(deserialize_commit_pkg(cbytes))
  }
  Assert.size(stream.data, 0)
  return { commits, pubkey, threshold }
}

export function encode_share_pkg (
  pkg : SharePackage
) : string {
  const idx  = Buff.num(pkg.idx,       CONST.SHARE_INDEX_SIZE)
  const ssk  = Buff.hex(pkg.seckey,    CONST.SHARE_SECKEY_SIZE)
  const bsn  = Buff.hex(pkg.binder_sn, CONST.SHARE_SNONCE_SIZE)
  const hsn  = Buff.hex(pkg.hidden_sn, CONST.SHARE_SNONCE_SIZE)
  const data = Buff.join([ idx, ssk, bsn, hsn ])
  Assert.size(data, CONST.SHARE_DATA_SIZE)
  return data.to_bech32m('bfshare')
}

export function decode_share_pkg (
  str : string
) : SharePackage {
  const stream = Buff.bech32m(str).stream
  Assert.size(stream.data, CONST.SHARE_DATA_SIZE)
  const idx       = stream.read(CONST.SHARE_INDEX_SIZE).num
  const seckey    = stream.read(CONST.SHARE_SECKEY_SIZE).hex
  const binder_sn = stream.read(CONST.SHARE_SNONCE_SIZE).hex
  const hidden_sn = stream.read(CONST.SHARE_SNONCE_SIZE).hex
  Assert.size(stream.data, 0)
  return { idx, binder_sn, hidden_sn, seckey }
}
