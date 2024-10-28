import { Buff }   from '@cmdcode/buff'
import { Assert } from '@/util/index.js'

import { secp256k1, schnorr }  from '@noble/curves/secp256k1'
import { Field } from '@noble/curves/abstract/modular'

type ECCPoint = ReturnType<typeof secp256k1.ProjectivePoint.fromHex>

const GP = secp256k1.ProjectivePoint.BASE
const _N = secp256k1.CURVE.n

const FD = Field(_N, 32, true)


export function get_seckey (
  secret : string | Uint8Array,
  even_y : boolean = false
) : string {
  // Convert the secret to a bigint, modulo the curve order.
  let   sk = serialize_bytes(secret).big % _N
  // If the format is bip340:
  if (even_y) {
    // Multiply the generator point by the secret.
    const pt = GP.multiply(sk)
    // Return the secret.
    return (pt.hasEvenY())
      // If the y-coordinate is even, return the secret.
      ? Buff.big(sk).hex
      // If the y-coordinate is odd, return the complement.
      : Buff.big(_N - sk).hex
  } else {
    // If the format is ecdsa, return the secret.
    return Buff.big(sk).hex
  }
}

export function get_pubkey (
  seckey : string | Uint8Array,
  format : 'bip340' | 'ecdsa'
) : string {
  // Convert the secret to a bigint.
  const sk = serialize_bytes(seckey).big
  // Multiply the generator point by the secret.
  const pt = GP.multiply(sk)
  // Return the public key.
  const pk = pt.toHex(true)
  // Normalize the public key.
  return normalize_pubkey(pk, format)
}

export function tweak_seckey (
  seckey : string | Uint8Array,
  tweak  : string | Uint8Array,
  even_y : boolean = false
) : string {
  // Convert the secret key and tweak to bigints.
  const sk  = serialize_bytes(seckey).big
  const twk = serialize_bytes(tweak).big
  // Add the key and tweak, modulo the curve order.
  const tweaked_sk = FD.add(sk, twk)
  // Convert the tweaked key to bytes.
  const new_secret = Buff.big(tweaked_sk)
  // Return the tweaked secret key.
  return get_seckey(new_secret, even_y)
}

export function tweak_pubkey (
  pubkey : string | Uint8Array,
  tweak  : string | Uint8Array,
  even_y : boolean = false
) : string {
  // Get the format of the public key.
  const format   = get_pubkey_format(pubkey)
  // Convert the tweak to a bigint.
  const twk_big  = serialize_bytes(tweak).big
  // Convert the public key to a projective point.
  const pub_pt   = lift_pubkey(pubkey)
  // Add the tweak to the public key.
  const tweak_pt = GP.multiply(twk_big)
  let tweaked_pt = pub_pt.add(tweak_pt)
  // If the format is bip340 and the y-coordinate is odd,
  if (even_y && !tweaked_pt.hasEvenY()) {
    // Negate the point.
    tweaked_pt = tweaked_pt.negate()
  }
  // Convert the tweaked point to a hex string.
  const pk = tweaked_pt.toHex(true)
  // Return the normalized public key.
  return normalize_pubkey(pk, format)
}

export function verify_seckey (
  seckey : string | Uint8Array
) : asserts seckey is string {
  const sk = serialize_bytes(seckey)
  Assert.size(sk, 32,    'ecdsa secret keys must be 32 bytes long')
  Assert.ok(sk.big < _N, 'ecdsa secret keys must be less than the curve order')
  Assert.ok(sk.big > 0,  'ecdsa secret keys must be greater than zero')
}

export function verify_pubkey (
  pubkey : string | Uint8Array,
  format : 'bip340' | 'ecdsa'
) {
  const pk = serialize_bytes(pubkey)
  if (format === 'bip340') {
    Assert.size(pk, 32, 'bip340 public keys must be 32 bytes long')
  } else if (format === 'ecdsa') {
    Assert.size(pk, 33, 'ecdsa public keys must be 33 bytes long')
  } else {
    throw new Error('invalid format: ' + format)
  }
  verify_point(pk)
}

export function verify_signature (
  signature : string | Uint8Array,
  message   : string | Uint8Array,
  pubkey    : string | Uint8Array,
  format    : 'bip340' | 'ecdsa'
) : boolean{
  const sig = serialize_bytes(signature)
  const msg = serialize_bytes(message)
  const pk  = serialize_pubkey(pubkey, format)
  return (format === 'bip340')
    ? schnorr.verify(sig, msg, pk)
    : secp256k1.verify(sig, msg, pk)
}

export function verify_point (
  pubkey : string | Uint8Array
) : asserts pubkey is string {
  try {
    const pt = lift_pubkey(pubkey)
    pt.assertValidity()
  } catch (err) {
    throw new Error('invalid secp256k1 point: ' + pubkey)
  }
}

export function verify_even_y (
  pubkey : string | Uint8Array
) : asserts pubkey is string {
  const pt = lift_pubkey(pubkey)
  Assert.ok(pt.hasEvenY(), 'pubkey must have an even y-coordinate')
}

export function lift_pubkey (
  pubkey : string | Uint8Array
) : ECCPoint {
  try {
    const pk = normalize_pubkey(pubkey, 'ecdsa')
    return secp256k1.ProjectivePoint.fromHex(pk)
  } catch (err) {
    throw new Error('invalid pubkey: ' + pubkey)
  }
}

export function serialize_pubkey (
  pubkey : string | Uint8Array,
  format : 'bip340' | 'ecdsa'
) : Buff {
  try {
    const pk = serialize_bytes(pubkey)
    if (pk.length === 33 && format === 'bip340') {
      return pk.slice(1)
    } else if (pk.length === 32 && format === 'ecdsa') {
      return pk.prepend(0x02)
    } else {
      return pk
    }
  } catch (err) {
    throw new Error('invalid pubkey: ' + String(pubkey))
  }
}

export function normalize_pubkey (
  pubkey : string | Uint8Array,
  format : 'bip340' | 'ecdsa'
) {
  const pk = serialize_pubkey(pubkey, format)
  return pk.hex
}

export function get_pubkey_format (
  pubkey : string | Uint8Array
) : 'bip340' | 'ecdsa' {
  const pk = serialize_bytes(pubkey)
  if (pk.length === 33) return 'ecdsa'
  if (pk.length === 32) return 'bip340'
  throw new Error('invalid pubkey: ' + String(pubkey))
}

export function serialize_bytes (
  bytes : string | Uint8Array
) : Buff {
  try {
    return Buff.bytes(bytes)
  } catch (err) {
    throw new Error('invalid bytes: ' + String(bytes))
  }
}
