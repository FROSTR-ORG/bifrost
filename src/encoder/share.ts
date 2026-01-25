import { Buff, Bytes } from '@vbyte/buff'

import {
  SHARE_INDEX_SIZE,
  SHARE_SECKEY_SIZE,
  SHARE_DATA_SIZE,
  SHARE_SNONCE_SIZE,
  PREFIX_SHARE
} from '@/const.js'

import {
  Assert,
  normalize_obj,
  create_stream,
  to_bech32m,
  from_bech32m
} from '@/util/index.js'

import type { SharePackage } from '@/types/index.js'

/** New share data size (idx + seckey only) */
const NEW_SHARE_DATA_SIZE = SHARE_INDEX_SIZE + SHARE_SECKEY_SIZE

/**
 * Encode a member share package (new format without static nonces).
 *
 * @param pkg - The share package to encode.
 * @returns The share package encoded as a bech32m string.
 */
export function encode_share_package (
  pkg : SharePackage
) : string {
  const data = serialize_share_data(pkg)
  Assert.size(data, NEW_SHARE_DATA_SIZE)
  return to_bech32m(data, PREFIX_SHARE)
}

/**
 * Decode a member share package.
 * Supports both new format (36 bytes) and legacy format (100 bytes).
 *
 * @param str - The share package to decode.
 * @returns The share package decoded from a bech32m string.
 */
export function decode_share_package (
  sharestr : string
) : SharePackage {
  const data = from_bech32m(sharestr, PREFIX_SHARE)

  // Check size to determine format
  if (data.length === SHARE_DATA_SIZE) {
    // Legacy format with static nonces - extract just idx and seckey
    return deserialize_legacy_share_data(data)
  } else if (data.length === NEW_SHARE_DATA_SIZE) {
    // New format without static nonces
    return deserialize_share_data(data)
  } else {
    throw new Error(`invalid share data size: ${data.length}`)
  }
}

/**
 * Serialize a member share package (new format).
 *
 * @param pkg - The share package to encode.
 * @returns The serialized share data.
 */
export function serialize_share_data (
  pkg : SharePackage
) : Buff {
  const idx = Buff.num(pkg.idx,    SHARE_INDEX_SIZE)
  const ssk = Buff.hex(pkg.seckey, SHARE_SECKEY_SIZE)
  return Buff.join([ idx, ssk ])
}

/**
 * Deserialize a member share package (new format).
 *
 * @param data - The share data to deserialize.
 * @returns The deserialized share package.
 */
export function deserialize_share_data (
  data : Bytes
) : SharePackage {
  const stream = create_stream(Buff.bytes(data))
  Assert.size(stream.data, NEW_SHARE_DATA_SIZE)
  const idx    = stream.read(SHARE_INDEX_SIZE).num
  const seckey = stream.read(SHARE_SECKEY_SIZE).hex
  Assert.size(stream.data, 0)
  return normalize_obj({ idx, seckey })
}

/**
 * Deserialize a legacy share package and convert to new format.
 * Extracts only idx and seckey, discards static nonces.
 * This enables backward-compatible reading of old share strings.
 */
function deserialize_legacy_share_data (
  data : Bytes
) : SharePackage {
  const stream = create_stream(Buff.bytes(data))
  Assert.size(stream.data, SHARE_DATA_SIZE)
  const idx    = stream.read(SHARE_INDEX_SIZE).num
  const seckey = stream.read(SHARE_SECKEY_SIZE).hex
  // Skip the static nonces (they're no longer used)
  stream.read(SHARE_SNONCE_SIZE) // binder_sn
  stream.read(SHARE_SNONCE_SIZE) // hidden_sn
  Assert.size(stream.data, 0)
  return normalize_obj({ idx, seckey })
}
