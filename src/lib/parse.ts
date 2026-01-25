import type { RpcMessageData, RpcMessageEnvelope, RequestRpcMessage } from '@vbyte/nostr-sdk'

import type {
  ECDHPackage,
  GroupPackage,
  OnboardRequest,
  SignSessionPackage,
  SharePackage,
  PartialSigPackage
} from '@/types/index.js'

import Schema        from '@/schema/index.js'
import { parse_error } from '@/util/helpers.js'

/**
 * Parse an ECDH exchange message.
 *
 * @param msg - The RPC message to parse.
 * @returns The parsed message with ECDH data.
 */
export function parse_ecdh_message (
  msg : RpcMessageData
) : RpcMessageEnvelope<RequestRpcMessage> & { data: ECDHPackage } {
  try {
    const schema = Schema.pkg.ecdh
    // For request messages, data is in params[0]; for accept messages, data is in data field
    let json : unknown
    if (msg.type === 'request') {
      json = JSON.parse((msg as { params: string[] }).params[0] ?? '{}')
    } else if (msg.type === 'accept') {
      json = (msg as { data: unknown }).data
    } else {
      throw new Error('unexpected message type')
    }
    const parsed = schema.parse(json)
    return { ...msg, data : parsed } as RpcMessageEnvelope<RequestRpcMessage> & { data: ECDHPackage }
  } catch (err) {
    throw new Error(`ecdh message failed validation: ${parse_error(err)}`)
  }
}

/**
 * Parse a signature session message.
 *
 * @param msg - The RPC message to parse.
 * @returns The parsed message with session data.
 */
export function parse_session_message (
  msg : RpcMessageData
) : RpcMessageEnvelope<RequestRpcMessage> & { data: SignSessionPackage } {
  try {
    const schema = Schema.sign.session
    // For request messages, data is in params[0]
    let json : unknown
    if (msg.type === 'request') {
      json = JSON.parse((msg as { params: string[] }).params[0] ?? '{}')
    } else {
      throw new Error('unexpected message type for session')
    }
    const parsed = schema.parse(json)
    return { ...msg, data : parsed } as RpcMessageEnvelope<RequestRpcMessage> & { data: SignSessionPackage }
  } catch (err) {
    throw new Error(`session message failed validation: ${parse_error(err)}`)
  }
}

/**
 * Parse a partial signature message.
 *
 * @param msg - The RPC message to parse.
 * @returns The parsed message with partial signature data.
 */
export function parse_psig_message (
  msg : RpcMessageData
) : RpcMessageData & { data: PartialSigPackage } {
  try {
    const schema = Schema.sign.psig_pkg
    // For accept messages, data is in data field
    let json : unknown
    if (msg.type === 'accept') {
      json = (msg as { data: unknown }).data
    } else {
      throw new Error('unexpected message type for psig')
    }
    const parsed = schema.parse(json)
    return { ...msg, data : parsed } as RpcMessageData & { data: PartialSigPackage }
  } catch (err) {
    throw new Error(`signature message failed validation: ${parse_error(err)}`)
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
    throw new Error(`group package failed validation: ${parse_error(err)}`)
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
    throw new Error(`share package failed validation: ${parse_error(err)}`)
  }
}

/**
 * Parse an onboard request message.
 *
 * @param msg - The RPC message to parse.
 * @returns The parsed message with onboard request data.
 */
export function parse_onboard_message (
  msg : RpcMessageData
) : RpcMessageEnvelope<RequestRpcMessage> & { data: OnboardRequest } {
  try {
    const schema = Schema.onboard.onboard_req
    // For request messages, data is in params[0]
    let json : unknown
    if (msg.type === 'request') {
      json = JSON.parse((msg as { params: string[] }).params[0] ?? '{}')
    } else {
      throw new Error('unexpected message type for onboard')
    }
    const parsed = schema.parse(json)
    return { ...msg, data : parsed } as RpcMessageEnvelope<RequestRpcMessage> & { data: OnboardRequest }
  } catch (err) {
    throw new Error(`onboard request failed validation: ${parse_error(err)}`)
  }
}