import type { SignedMessage } from '@cmdcode/nostr-p2p'

import type {
  ECDHPackage,
  GroupPackage,
  SignSessionPackage,
  SharePackage,
  PartialSigPackage
} from '@/types/index.js'

import Schema from '@/schema/index.js'

/**
 * Parse an ECDH exchange message.
 * 
 * @param msg - The message to parse.
 * @returns The parsed message.
 */
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

/**
 * Parse a signature session message.
 * 
 * @param msg - The message to parse.
 * @returns The parsed message.
 */
export function parse_session_message (
  msg : SignedMessage
) : SignedMessage<SignSessionPackage> {
  try {
    const schema = Schema.sign.session
    const json   = JSON.parse(msg.data)
    const parsed = schema.parse(json)
    return { ...msg, data : parsed }
  } catch {
    throw new Error('session message failed validation')
  }
}

/**
 * Parse a partial signature message.
 * 
 * @param msg - The message to parse.
 * @returns The parsed message.
 */
export function parse_psig_message (
  msg : SignedMessage
) : SignedMessage<PartialSigPackage> {
  try {
    const schema = Schema.sign.psig_pkg
    const json   = JSON.parse(msg.data)
    const parsed = schema.parse(json)
    return { ...msg, data : parsed }
  } catch (err) {
    throw new Error('signature message failed validation')
  }
}

/**
 * Parse a group commitment package.
 * 
 * @param group_pkg - The message to parse.
 * @returns The parsed message.
 */
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

/**
 * Parse a member share package.
 * 
 * @param share_pkg - The message to parse.
 * @returns The parsed message.
 */
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