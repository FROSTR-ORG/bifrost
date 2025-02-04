import { Buff }      from '@cmdcode/buff'
import { secp256k1 } from '@noble/curves/secp256k1'
import { Assert }    from '@/util/index.js'

export function tweak_secnonce (
  snonce : string | Uint8Array,
  tweak : string | Uint8Array
) : string {
  const sn_big  = Buff.bytes(snonce).big
  const twk_big = Buff.bytes(tweak).big
  const tweaked = (sn_big + twk_big) % secp256k1.CURVE.n
  return Buff.big(tweaked).hex
}

export function tweak_pubnonce (
  pnonce : string | Uint8Array,
  tweak  : string | Uint8Array
) : string {
  const G_pt      = secp256k1.ProjectivePoint.BASE
  const twk_big   = Buff.bytes(tweak).big
  const twk_pt    = G_pt.multiply(twk_big)
  const pnonce_pt = secp256k1.ProjectivePoint.fromHex(pnonce)
  return pnonce_pt.add(twk_pt).toHex(true)
}

export function normalize_pubkey (pubkey : string) {
  Assert.is_hex(pubkey)
  return (pubkey.length === 64)
    ? pubkey
    : pubkey.slice(2)
}
