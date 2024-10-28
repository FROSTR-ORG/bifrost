import type { SignedMessage } from '@cmdcode/nostr-p2p'

import type {
  ECDHPackage,
  GroupPackage,
  SessionPackage,
  SharePackage,
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

export function parse_session_message (
  msg : SignedMessage
) : SignedMessage<SessionPackage> {
  try {
    const schema = Schema.pkg.session
    const json   = JSON.parse(msg.data)
    const parsed = schema.parse(json)
    return { ...msg, data : parsed }
  } catch {
    throw new Error('session message failed validation')
  }
}


export function parse_psig_message (
  msg : SignedMessage
) : SignedMessage<SignaturePackage> {
  try {
    const schema = Schema.pkg.psig
    const json   = JSON.parse(msg.data)
    const parsed = schema.parse(json)
    return { ...msg, data : parsed }
  } catch (err) {
    console.log('error:', err)
    throw new Error('signature message failed validation')
  }
}

export function parse_group_pkg (
  group_pkg : unknown
) : GroupPackage {
  try {
    const schema = Schema.pkg.group
    return schema.parse(group_pkg)
  } catch (err) {
    console.log('error:', err)
    throw new Error('group package failed validation')
  }
}

export function parse_share_pkg (
  share_pkg : unknown
) : SharePackage {
  try {
    const schema = Schema.pkg.share
    return schema.parse(share_pkg)
  } catch (err) {
    console.log('error:', err)
    throw new Error('share package failed validation')
  }
}