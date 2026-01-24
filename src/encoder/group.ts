import { Buff, Bytes } from '@vbyte/buff'
import * as CONST      from '@/const.js'

import {
  Assert,
  normalize_obj,
  create_stream,
  to_bech32m,
  from_bech32m
} from '@/util/index.js'

import type {
  GroupPackage,
  MemberPackage,
} from '@/types/index.js'

/** New member data size (idx + pubkey only) */
const MEMBER_INDEX_SIZE  = 4
const MEMBER_PUBKEY_SIZE = 33
const MEMBER_DATA_SIZE   = MEMBER_INDEX_SIZE + MEMBER_PUBKEY_SIZE

type GroupDataFormat = 'member' | 'legacy'

/**
 * Detect the format of serialized group data based on remaining byte count.
 *
 * @param remaining - Number of remaining bytes after header.
 * @returns 'member' for new format, 'legacy' for commit format.
 * @throws If the data doesn't match either format.
 */
function detect_group_format (remaining : number) : GroupDataFormat {
  const is_member_format = remaining % MEMBER_DATA_SIZE === 0 &&
                           remaining % CONST.COMMIT_DATA_SIZE !== 0
  if (is_member_format) return 'member'
  if (remaining % CONST.COMMIT_DATA_SIZE === 0) return 'legacy'
  throw new Error('malformed group data: invalid member count')
}

/**
 * Encode a group package (new format with MemberPackage).
 *
 * @param pkg - The group package to encode.
 * @returns The group package encoded as a bech32m string.
 */
export function encode_group_package (
  pkg : GroupPackage
) : string {
  const data = serialize_group_data(pkg)
  return to_bech32m(data, 'bfgroup')
}

/**
 * Decode a group package.
 * Supports both new format (MemberPackage) and legacy format.
 * Legacy format data is converted to MemberPackage (static nonces are discarded).
 *
 * @param str - The group package to decode.
 * @returns The group package decoded from a bech32m string.
 */
export function decode_group_package (
  str : string
) : GroupPackage {
  const data = from_bech32m(str)
  return deserialize_group_data(data)
}

/**
 * Serialize a group package (new format).
 *
 * @param pkg - The group package to serialize.
 * @returns The serialized group package.
 */
export function serialize_group_data (
  pkg : GroupPackage
) : Buff {
  const thd = Buff.num(pkg.threshold, CONST.GROUP_THOLD_SIZE)
  const gpk = Buff.hex(pkg.group_pk, CONST.GROUP_PUBKEY_SIZE)
  const mem = pkg.members.map(member => serialize_member_data(member))
  return Buff.join([ gpk, thd, ...mem ])
}

/**
 * Deserialize a group package.
 * Auto-detects format based on member data size.
 *
 * @param data - The group package to deserialize.
 * @returns The deserialized group package.
 */
export function deserialize_group_data (
  data : Bytes
) : GroupPackage {
  const stream    = create_stream(Buff.bytes(data))
  const group_pk  = stream.read(CONST.COMMIT_PUBKEY_SIZE).hex
  const threshold = stream.read(CONST.GROUP_THOLD_SIZE).num

  const remaining = stream.size
  const format    = detect_group_format(remaining)
  const members   : MemberPackage[] = []

  if (format === 'member') {
    const count = remaining / MEMBER_DATA_SIZE
    for (let i = 0; i < count; i++) {
      const mbytes = stream.read(MEMBER_DATA_SIZE)
      members.push(deserialize_member_data(mbytes))
    }
  } else {
    // Legacy format - convert to new format (nonces discarded)
    const count = remaining / CONST.COMMIT_DATA_SIZE
    for (let i = 0; i < count; i++) {
      const cbytes = stream.read(CONST.COMMIT_DATA_SIZE)
      const { idx, pubkey } = deserialize_commit_data(cbytes)
      members.push({ idx, pubkey })
    }
  }

  Assert.size(stream.data, 0)
  return normalize_obj({ members, group_pk, threshold })
}

/**
 * Serialize member data (new format).
 */
function serialize_member_data (
  pkg : MemberPackage
) : Uint8Array {
  const idx = Buff.num(pkg.idx,    MEMBER_INDEX_SIZE)
  const spk = Buff.hex(pkg.pubkey, MEMBER_PUBKEY_SIZE)
  return Buff.join([ idx, spk ])
}

/**
 * Deserialize member data (new format).
 */
function deserialize_member_data (
  data : Uint8Array
) : MemberPackage {
  const stream = create_stream(data)
  Assert.size(stream.data, MEMBER_DATA_SIZE)
  const idx    = stream.read(MEMBER_INDEX_SIZE).num
  const pubkey = stream.read(MEMBER_PUBKEY_SIZE).hex
  Assert.size(stream.data, 0)
  return { idx, pubkey }
}

/**
 * Deserialize legacy commitment data (for backward-compatible reading).
 * Returns only idx and pubkey, discarding static nonces.
 */
function deserialize_commit_data (
  data : Uint8Array
) : { idx: number, pubkey: string } {
  const stream    = create_stream(data)
  Assert.size(stream.data, CONST.COMMIT_DATA_SIZE)
  const idx       = stream.read(CONST.COMMIT_INDEX_SIZE).num
  const pubkey    = stream.read(CONST.COMMIT_PUBKEY_SIZE).hex
  // Skip the static nonces (they're no longer used)
  stream.read(CONST.COMMIT_PNONCE_SIZE) // binder_pn
  stream.read(CONST.COMMIT_PNONCE_SIZE) // hidden_pn
  Assert.size(stream.data, 0)
  return { idx, pubkey }
}
