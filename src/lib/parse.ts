import { parse_message } from '@cmdcode/nostr-p2p/lib'

import type {
  EventMessage,
  TypedMessage
} from '@cmdcode/nostr-p2p'

import type { ECDHPackage, SignaturePackage } from '@/types/index.js'

import Schema from '@/schema/index.js'

export function parse_ecdh_message (
  msg : EventMessage
) : TypedMessage<ECDHPackage> {
  const schema = Schema.pkg.ecdh_pkg
  const parsed = parse_message(msg, schema)
  if (parsed === null) throw new Error('response failed validation')
  return parsed
}

export function parse_psig_message (
  msg : EventMessage
) : TypedMessage<SignaturePackage> {
  const schema = Schema.pkg.sign_msg_pkg
  const parsed = parse_message(msg, schema)
  if (parsed === null) throw new Error('response failed validation')
  return parsed
}
