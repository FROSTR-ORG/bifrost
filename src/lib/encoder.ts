import { Buff } from '@cmdcode/buff'

import {
  Assert,
  normalize_obj
} from '@/util/index.js'

import type {
  CommitPackage,
  GroupPackage,
  SharePackage,
} from '@/types/index.js'

import * as CONST from '@/const.js'

/**
 * Encode a group commitment package.
 * 
 * @param pkg - The group package to encode.
 * @returns The group package encoded as a bech32m string.
 */
export function encode_group_pkg (
  pkg : GroupPackage
) : string {
  const thd  = Buff.num(pkg.threshold, CONST.GROUP_THOLD_SIZE)
  const gpk  = Buff.hex(pkg.group_pk, CONST.GROUP_PUBKEY_SIZE)
  const com  = pkg.commits.map(e => serialize_commit_data(e))
  const data = Buff.join([ gpk, thd, ...com ])
  Assert.size(data, CONST.GROUP_DATA_SIZE + (com.length * CONST.COMMIT_DATA_SIZE))
  return data.to_bech32m('bfgroup')
}

/**
 * Decode a group commitment package.
 * 
 * @param str - The group package to decode.
 * @returns The group package decoded from a bech32m string.
 */
export function decode_group_pkg (
  str : string
) : GroupPackage {
  const stream    = Buff.bech32m(str).stream
  const group_pk  = stream.read(CONST.COMMIT_PUBKEY_SIZE).hex
  const threshold = stream.read(CONST.GROUP_THOLD_SIZE).num
  Assert.ok(stream.size % CONST.COMMIT_DATA_SIZE === 0, 'commit data is malformed')
  const count   = stream.size / CONST.COMMIT_DATA_SIZE
  const commits : CommitPackage[] = []
  for (let i = 0; i < count; i++) {
    const cbytes = stream.read(CONST.COMMIT_DATA_SIZE)
    commits.push(deserialize_commit_data(cbytes))
  }
  Assert.size(stream.data, 0)
  return normalize_obj({ commits, group_pk, threshold })
}

/**
 * Encode a member share package.
 * 
 * @param pkg - The share package to encode.
 * @returns The share package encoded as a bech32m string.
 */
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

/**
 * Decode a member share package.
 * 
 * @param str - The share package to decode.
 * @returns The share package decoded from a bech32m string.
 */
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
  return normalize_obj({ idx, binder_sn, hidden_sn, seckey })
}

/**
 * Serialize a set of commitment data.
 * 
 * @param pkg - The commitment data to serialize.
 * @returns The serialized commitment data.
 */

function serialize_commit_data (
  pkg : CommitPackage
) : Uint8Array {
  const idx = Buff.num(pkg.idx,       CONST.COMMIT_INDEX_SIZE)
  const spk = Buff.hex(pkg.pubkey,    CONST.COMMIT_PUBKEY_SIZE)
  const bpn = Buff.hex(pkg.binder_pn, CONST.COMMIT_PNONCE_SIZE)
  const hpn = Buff.hex(pkg.hidden_pn, CONST.COMMIT_PNONCE_SIZE)
  return Buff.join([ idx, spk, bpn, hpn ])
}

/**
 * Deserialize a set of commitment data.
 * 
 * @param data - The commitment data to deserialize.
 * @returns The deserialized commitment data.
 */
function deserialize_commit_data (
  data : Uint8Array
) : CommitPackage {
  const stream    = new Buff(data).stream
  Assert.size(stream.data, CONST.COMMIT_DATA_SIZE)
  const idx       = stream.read(CONST.COMMIT_INDEX_SIZE).num
  const pubkey    = stream.read(CONST.COMMIT_PUBKEY_SIZE).hex
  const binder_pn = stream.read(CONST.COMMIT_PNONCE_SIZE).hex
  const hidden_pn = stream.read(CONST.COMMIT_PNONCE_SIZE).hex
  Assert.size(stream.data, 0)
  return { idx, binder_pn, hidden_pn, pubkey }
}
