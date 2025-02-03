import type { SignedMessage } from '@cmdcode/nostr-p2p'

import type {
  ECDHPackage,
  SignaturePackage
} from '@/types/index.js'

import Schema from '@/schema/index.js'

export function parse_ecdh_message (
  msg : SignedMessage
) : SignedMessage<ECDHPackage> {
  try {
    const schema = Schema.pkg.ecdh
    const json   = JSON.parse(msg.data)
    const parsed = schema.parse(json)
    return { ...msg, data : parsed }
  } catch {
    throw new Error('ecdh message failed validation')
  }
}

export function parse_psig_message (
  msg : SignedMessage
) : SignedMessage<SignaturePackage> {
  try {
    const schema = Schema.pkg.sign
    const json   = JSON.parse(msg.data)
    const parsed = schema.parse(json)
    return { ...msg, data : parsed }
  } catch {
    throw new Error('signature message failed validation')
  }
}
