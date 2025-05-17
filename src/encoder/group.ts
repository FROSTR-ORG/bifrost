import { Buff, Bytes } from '@cmdcode/buff'
import * as CONST      from '@/const.js'

import {
  Assert,
  normalize_obj
} from '@/util/index.js'

import type {
  CommitPackage,
  GroupPackage,
} from '@/types/index.js'

/**
 * Encode a group commitment package
 * 
 * @param pkg - The group package to encode.
 * @returns The group package encoded as a bech32m string.
 */
export function encode_group_pkg (
  pkg : GroupPackage
) : string {
  const data = serialize_group_data(pkg)
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
  const data = Buff.bech32m(str)
  return deserialize_group_data(data)
}

/**
 * Serialize a group commitment package.
 * 
 * @param pkg - The group package to serialize.
 * @returns The serialized group package.
 */
export function serialize_group_data (
  pkg : GroupPackage
) : Buff {
  const thd  = Buff.num(pkg.threshold, CONST.GROUP_THOLD_SIZE)
  const gpk  = Buff.hex(pkg.group_pk, CONST.GROUP_PUBKEY_SIZE)
  const com  = pkg.commits.map(e => serialize_commit_data(e))
  return Buff.join([ gpk, thd, ...com ])
}

/**
 * Deserialize a group commitment package.
 * 
 * @param data - The group package to deserialize.
 * @returns The deserialized group package.
 */
export function deserialize_group_data (
  data : Bytes
) : GroupPackage {
  const stream    = new Buff(data).stream
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
