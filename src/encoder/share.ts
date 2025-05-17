import { Buff, Bytes } from '@cmdcode/buff'
import * as CONST      from '@/const.js'

import {
  Assert,
  normalize_obj
} from '@/util/index.js'

import type { SharePackage } from '@/types/index.js'

/**
 * Encode a member share package.
 * 
 * @param pkg - The share package to encode.
 * @returns The share package encoded as a bech32m string.
 */
export function encode_share_pkg (
  pkg : SharePackage
) : string {
  const data = serialize_share_data(pkg)
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
  sharestr : string
) : SharePackage {
  const data = Buff.bech32m(sharestr)
  return deserialize_share_data(data)
}

/**
 * Encode a member share package.
 * 
 * @param pkg - The share package to encode.
 * @returns The share package encoded as a bech32m string.
 */
export function serialize_share_data (
  pkg : SharePackage
) : Buff {
  const idx  = Buff.num(pkg.idx,       CONST.SHARE_INDEX_SIZE)
  const ssk  = Buff.hex(pkg.seckey,    CONST.SHARE_SECKEY_SIZE)
  const bsn  = Buff.hex(pkg.binder_sn, CONST.SHARE_SNONCE_SIZE)
  const hsn  = Buff.hex(pkg.hidden_sn, CONST.SHARE_SNONCE_SIZE)
  return Buff.join([ idx, ssk, bsn, hsn ])
}

/**
 * Deserialize a member share package.
 * 
 * @param data - The share data to deserialize.
 * @returns The deserialized share package.
 */
export function deserialize_share_data (
  data : Bytes
) : SharePackage {
  const stream    = new Buff(data).stream
  Assert.size(stream.data, CONST.SHARE_DATA_SIZE)
  const idx       = stream.read(CONST.SHARE_INDEX_SIZE).num
  const seckey    = stream.read(CONST.SHARE_SECKEY_SIZE).hex
  const binder_sn = stream.read(CONST.SHARE_SNONCE_SIZE).hex
  const hidden_sn = stream.read(CONST.SHARE_SNONCE_SIZE).hex
  Assert.size(stream.data, 0)
  return normalize_obj({ idx, binder_sn, hidden_sn, seckey })
}
