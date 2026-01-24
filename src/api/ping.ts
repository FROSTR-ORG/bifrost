import { BifrostNode } from '@/class/client.js'
import Schema          from '@/schema/index.js'

import {
  Assert,
  now,
  parse_error
} from '@/util/index.js'

import {
  normalize_pubkey,
  pubkeys_match
} from '@/lib/util.js'

import type {
  RpcMessageData,
  RpcMessageEnvelope,
  RequestRpcMessage
} from '@vbyte/nostr-sdk'

import type {
  ApiResponse,
  PeerStatus,
  PingRequest,
  PingResponse
} from '@/types/index.js'

/** Current protocol version for ping messages */
const PROTOCOL_VERSION = 2

/**
 * Handles incoming ping requests from peers.
 *
 * When another node sends a ping request, this handler:
 * 1. Emits the request for debugging/logging
 * 2. Looks up the peer's data
 * 3. Processes incoming nonces if present
 * 4. Responds with policy, pool status, and optional nonces
 * 5. Updates the peer's status to 'online'
 *
 * Events emitted:
 * - `/ping/handler/req` - When a ping request is received
 * - `/ping/handler/res` - When a response is sent successfully
 * - `/ping/handler/rej` - When an error occurs
 *
 * @param node - The BifrostNode handling the request.
 * @param msg - The signed message containing the ping payload.
 */
export async function ping_handler_api (
  node : BifrostNode,
  msg  : RpcMessageEnvelope<RequestRpcMessage>
) {
  try {
    // Emit the request message
    node.emit('/ping/handler/req', msg)

    // Get the peer data
    const peer_data = node.peers.find(e => e.pubkey === msg.event.pubkey)
    if (peer_data === undefined) throw new Error('peer data not found')

    // Try to parse enhanced ping request from params
    const request = parse_ping_request(msg.params)

    // Get peer index from group
    const peer_member = node.group.members.find(m => pubkeys_match(m.pubkey, peer_data.pubkey))
    const peer_idx = peer_member?.idx

    // Process incoming nonces if present (pass peer_idx)
    if (request?.nonces && node.pool && peer_idx !== undefined) {
      node.pool.store_incoming(peer_idx, request.nonces)
    }

    // Build response with nonce pool information
    const response : PingResponse = {
      policy : peer_data.policy
    }

    // Include pool status if we have a pool
    if (node.pool && peer_idx !== undefined) {
      // Get pool status for all peers
      const peer_pks = new Map<number, string>()
      for (const member of node.group.members) {
        peer_pks.set(member.idx, normalize_pubkey(member.pubkey))
      }
      response.pool_status = node.pool.get_pool_status(peer_pks)

      // Include nonces if peer needs them FROM US (check OUTGOING pool)
      // This is the correct direction check - we're deciding whether to SEND nonces
      if (node.pool.should_send_nonces_to(peer_idx)) {
        response.nonces = node.pool.generate_for_peer(peer_idx)
      }
    }

    // Send the response using the new respond API
    const res = await node.client.respond(msg).accept(response)
    if (!res.ok) throw new Error('failed to publish response')

    // Update the peer state
    node.update_peer({
      ...peer_data,
      status  : 'online',
      updated : now()
    })

    // Emit the response
    node.emit('/ping/handler/res', msg)

  } catch (err) {
    if (node.debug) console.log(err)
    node.emit('/ping/handler/rej', [ parse_error(err), msg ])
  }
}

/**
 * Creates a request API function for pinging peers.
 *
 * Returns a function that sends a ping request to a specific peer
 * to check if they are online, get their policy, and exchange nonces.
 *
 * The process:
 * 1. Build ping request with pool status and optional nonces
 * 2. Send request to the peer
 * 3. Process response (policy, pool status, nonces)
 * 4. Update peer status and nonce pool
 *
 * Events emitted:
 * - `/ping/sender/res` - When a response is received
 * - `/ping/sender/rej` - When the request fails
 * - `/ping/sender/ret` - When the peer is confirmed online
 * - `/ping/sender/err` - When the response is invalid
 *
 * @param node - The BifrostNode to create the request API for.
 * @returns An async function that pings a peer by public key.
 *
 * @example
 * ```typescript
 * const ping = ping_request_api(node)
 * const result = await ping(peerPubkey)
 * if (result.ok) {
 *   console.log('Peer policy:', result.data.policy)
 * }
 * ```
 */
export function ping_request_api (node : BifrostNode) {

  return async (pubkey : string) : Promise<ApiResponse<PingResponse>> => {

    // Get the peer data
    const peer_data = node.peers.find(e => e.pubkey === pubkey)
    Assert.exists(peer_data, 'peer data not found')

    // Get peer index
    const peer_member = node.group.members.find(m => pubkeys_match(m.pubkey, pubkey))
    const peer_idx = peer_member?.idx

    let msg : RpcMessageData | null = null

    try {
      // Build the enhanced ping request
      const request : PingRequest = {
        version : PROTOCOL_VERSION
      }

      // Add pool status if we have a pool
      if (node.pool && peer_idx !== undefined) {
        const peer_pks = new Map<number, string>()
        for (const member of node.group.members) {
          peer_pks.set(member.idx, normalize_pubkey(member.pubkey))
        }
        request.pool_status = node.pool.get_pool_status(peer_pks)

        // Include nonces if peer needs them FROM US (check OUTGOING pool)
        // This is the correct direction check - we're deciding whether to SEND nonces
        if (node.pool.should_send_nonces_to(peer_idx)) {
          request.nonces = node.pool.generate_for_peer(peer_idx)
        }
      }

      // Send the request
      msg = await create_ping_request(node, pubkey, request)
      node.emit('/ping/sender/res', msg)

    } catch (err) {
      if (node.debug) console.log(err)
      const reason = parse_error(err)
      node.emit('/ping/sender/rej', [ reason, msg ])
      return { ok: false, err: reason }
    }

    try {
      Assert.ok(msg !== null, 'no response from peer')

      // Parse the response
      const response = parse_ping_response(msg)
      if (response === null) throw new Error('invalid ping response')

      // Store incoming nonces if present (pass peer_idx)
      if (response.nonces && node.pool && peer_idx !== undefined) {
        node.pool.store_incoming(peer_idx, response.nonces)
      }

      // Update the peer state
      const new_data = {
        ...peer_data,
        status  : 'online' as PeerStatus,
        updated : now()
      }
      node.update_peer(new_data)

      // Emit success
      node.emit('/ping/sender/ret', new_data)
      return { ok: true, data: response }

    } catch (err) {
      if (node.debug) console.log(err)
      const reason = parse_error(err)
      node.emit('/ping/sender/err', [ reason, msg ])

      // Update peer to offline
      node.update_peer({
        ...peer_data,
        status  : 'offline',
        updated : now()
      })

      return { ok: false, err: reason }
    }
  }
}

/**
 * Sends an enhanced ping request to a specific peer.
 *
 * @param node - The BifrostNode sending the request.
 * @param pubkey - The public key of the peer to ping.
 * @param request - The enhanced ping request payload.
 * @returns A Promise resolving to the RPC message response.
 * @throws Error if the request fails or times out.
 * @internal
 */
async function create_ping_request (
  node    : BifrostNode,
  pubkey  : string,
  request : PingRequest
) : Promise<RpcMessageData> {
  return node.client.request({
    method : 'ping',
    params : [ JSON.stringify(request) ]
  }, pubkey)
}

/**
 * Parses an incoming ping request.
 *
 * @param params - The request params array.
 * @returns The parsed ping request, or null if parsing fails.
 * @internal
 */
function parse_ping_request (params : string[]) : PingRequest | null {
  try {
    const data = params[0] ?? ''
    // Handle legacy "ping" string
    if (data === 'ping' || data === '') {
      return { version: 1 }
    }
    const json   = JSON.parse(data)
    const parsed = Schema.peer.ping_req.safeParse(json)
    if (!parsed.success) return null
    return parsed.data as PingRequest
  } catch {
    return null
  }
}

/**
 * Parses a ping response to extract policy and nonce information.
 *
 * @param msg - The RPC message containing the ping response.
 * @returns The parsed ping response, or null if parsing fails.
 * @internal
 */
function parse_ping_response (msg : RpcMessageData) : PingResponse | null {
  try {
    // Check if this is an accept message with data
    if (msg.type !== 'accept') return null
    const data = (msg as { data: unknown }).data

    // Try enhanced response format first
    const parsed = Schema.peer.ping_res.safeParse(data)
    if (parsed.success) {
      return parsed.data as PingResponse
    }

    // Fall back to legacy policy-only format
    const legacy = Schema.peer.policy.safeParse(data)
    if (legacy.success) {
      return { policy: legacy.data }
    }

    return null
  } catch {
    return null
  }
}
