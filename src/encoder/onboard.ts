/**
 * Onboard Package Encoder
 *
 * Encodes and decodes OnboardPackage to/from bech32m format.
 * Format: bfonboard1...
 *
 * Structure:
 * - share_idx (4 bytes)
 * - share_seckey (32 bytes)
 * - peer_pk (32 bytes)
 * - relay_count (2 bytes)
 * - relays (variable, length-prefixed strings)
 */

import { Buff, Bytes } from '@vbyte/buff'

import {
  SHARE_INDEX_SIZE,
  SHARE_SECKEY_SIZE,
  MAX_RELAY_LENGTH,
  MAX_RELAY_COUNT,
  PREFIX_ONBOARD
} from '@/const.js'

import {
  Assert,
  create_stream,
  to_bech32m,
  from_bech32m
} from '@/util/index.js'

import type { OnboardPackage, SharePackage } from '@/types/index.js'

/** Size constants */
const PEER_PK_SIZE      = 32
const RELAY_COUNT_SIZE  = 2
const RELAY_LEN_SIZE    = 2
const MIN_DATA_SIZE     = SHARE_INDEX_SIZE + SHARE_SECKEY_SIZE + PEER_PK_SIZE + RELAY_COUNT_SIZE

/**
 * Encode an onboard package to bech32m format.
 *
 * @param pkg - The onboard package to encode.
 * @returns The bech32m encoded string (bfonboard1...).
 */
export function encode_onboard_package (
  pkg : OnboardPackage
) : string {
  const data = serialize_onboard_data(pkg)
  return to_bech32m(data, PREFIX_ONBOARD)
}

/**
 * Decode an onboard package from bech32m format.
 *
 * @param str - The bech32m encoded string.
 * @returns The decoded onboard package.
 * @throws Error if the bech32m prefix is invalid.
 */
export function decode_onboard_package (
  str : string
) : OnboardPackage {
  const data = from_bech32m(str, PREFIX_ONBOARD)
  return deserialize_onboard_data(data)
}

/**
 * Serialize an onboard package to binary format.
 *
 * @param pkg - The onboard package to serialize.
 * @returns The serialized binary data.
 */
export function serialize_onboard_data (
  pkg : OnboardPackage
) : Buff {
  const parts : Uint8Array[] = []

  // Share data
  parts.push(Buff.num(pkg.share.idx, SHARE_INDEX_SIZE))
  parts.push(Buff.hex(pkg.share.seckey, SHARE_SECKEY_SIZE))

  // Peer pubkey
  parts.push(Buff.hex(pkg.peer_pk, PEER_PK_SIZE))

  // Relays (count + length-prefixed strings)
  parts.push(Buff.num(pkg.relays.length, RELAY_COUNT_SIZE))
  for (const relay of pkg.relays) {
    const relay_bytes = Buff.str(relay)
    parts.push(Buff.num(relay_bytes.length, RELAY_LEN_SIZE))
    parts.push(relay_bytes)
  }

  return Buff.join(parts)
}

/**
 * Deserialize an onboard package from binary format.
 *
 * @param data - The binary data to deserialize.
 * @returns The deserialized onboard package.
 */
export function deserialize_onboard_data (
  data : Bytes
) : OnboardPackage {
  const stream = create_stream(Buff.bytes(data))

  Assert.ok(stream.size >= MIN_DATA_SIZE, 'onboard data too short')

  // Read share data
  const idx    = stream.read(SHARE_INDEX_SIZE).num
  const seckey = stream.read(SHARE_SECKEY_SIZE).hex
  const share : SharePackage = { idx, seckey }

  // Read peer pubkey
  const peer_pk = stream.read(PEER_PK_SIZE).hex

  // Read relays
  const relay_count = stream.read(RELAY_COUNT_SIZE).num
  Assert.ok(relay_count <= MAX_RELAY_COUNT, 'relay count exceeds maximum allowed')
  const relays : string[] = []

  for (let i = 0; i < relay_count; i++) {
    const relay_len = stream.read(RELAY_LEN_SIZE).num
    Assert.ok(relay_len <= MAX_RELAY_LENGTH, 'relay URL length exceeds maximum allowed')
    const relay_str = stream.read(relay_len).str
    relays.push(relay_str)
  }

  Assert.size(stream.data, 0, 'extra data after onboard package')

  return { share, peer_pk, relays }
}
