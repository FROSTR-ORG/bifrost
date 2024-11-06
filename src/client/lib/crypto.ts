import { Buff }               from '@cmdcode/buff'
import { secp256k1, schnorr } from '@noble/curves/secp256k1'
import { gcm }                from '@noble/ciphers/aes'
import { mod }                from '@noble/curves/abstract/modular'

export function gen_seckey (
  secret ?: string
) : string {
  let sbig = (secret !== undefined)
    ? Buff.hex(secret).big
    : Buff.random(32).big
  sbig = mod(sbig, secp256k1.CURVE.n)
  return Buff.big(sbig).hex
}

export function get_pubkey (
  seckey : string
) : string {
  const pbytes = schnorr.getPublicKey(seckey)
  return new Buff(pbytes).hex
}

export function get_shared_secret (
  seckey  : string,
  peer_pk : string
) : string {
  const sbytes = secp256k1.getSharedSecret(seckey, '02' + peer_pk, true)
  return new Buff(sbytes).slice(1).hex
}

export function sign_msg (
  seckey  : string,
  message : string
) {
  const sig = schnorr.sign(message, seckey)
  return new Buff(sig).hex
}

export function verify_sig (
  message   : string,
  pubkey    : string,
  signature : string
) {
  return schnorr.verify(signature, message, pubkey)
}

export function encrypt_content (
  secret  : string,
  content : string,
  iv?     : string
) {
  const cbytes = Buff.str(content)
  const sbytes = Buff.hex(secret)
  const vector = (iv !== undefined)
    ? Buff.hex(iv, 24)
    : Buff.random(24)
  const encrypted = gcm(sbytes, vector).encrypt(cbytes)
  return new Buff(encrypted).b64url + '?iv=' + vector.b64url
}

export function decrypt_content (
  secret  : string,
  content : string
) {
  const [ encryped, iv ] = content.split('?iv=')
  const cbytes = Buff.b64url(encryped)
  const sbytes = Buff.hex(secret)
  const vector = Buff.b64url(iv)
  const decrypted = gcm(sbytes, vector).decrypt(cbytes)
  return new Buff(decrypted).str
}
