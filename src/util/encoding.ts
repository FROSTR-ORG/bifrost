import { Buff, Stream } from '@vbyte/buff'
import { sha256 }       from '@noble/hashes/sha2.js'
import { bech32m }      from '@scure/base'

/** SHA256 hash of buffer data. Replaces: buff.digest */
export function sha256_digest (data : Uint8Array) : Buff {
  return Buff.bytes(sha256(data))
}

/** Create Stream from data. Replaces: new Buff(data).stream */
export function create_stream (data : Uint8Array) : Stream {
  return new Stream(data)
}

/** Encode as bech32m. Replaces: data.to_bech32m(prefix) */
export function to_bech32m (data : Uint8Array, prefix : string) : string {
  return bech32m.encode(prefix, bech32m.toWords(data), false)
}

/** Decode bech32m with optional prefix validation. Replaces: Buff.bech32m(str) */
export function from_bech32m (str : string, expectedPrefix?: string) : Buff {
  try {
    const { prefix, words } = bech32m.decode(str as `${string}1${string}`, false)
    if (expectedPrefix && prefix !== expectedPrefix) {
      throw new Error(`Invalid bech32m prefix: expected '${expectedPrefix}', got '${prefix}'`)
    }
    return Buff.bytes(new Uint8Array(bech32m.fromWords(words)))
  } catch (e) {
    // Re-throw our own prefix validation errors
    if (e instanceof Error && e.message.startsWith('Invalid bech32m prefix')) throw e
    throw new Error(`Invalid bech32m string: ${e instanceof Error ? e.message : 'decode failed'}`)
  }
}
