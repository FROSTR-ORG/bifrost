/**
 * Onboard API
 *
 * Handles the onboarding process for new nodes joining the group.
 * When a node starts with just an OnboardPackage (share + peer info),
 * it uses this API to receive the full GroupPackage and initial nonces.
 */

import { BifrostNode } from '@/class/client.js'
import Schema          from '@/schema/index.js'

import { pubkeys_match } from '@/lib/util.js'

import {
  Assert,
  parse_error,
  onboardDebug
} from '@/util/index.js'

import type {
  RpcMessageData,
  RpcMessageEnvelope,
  RequestRpcMessage
} from '@vbyte/nostr-sdk'

import type {
  ApiResponse,
  OnboardRequest,
  OnboardResponse
} from '@/types/index.js'

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates an onboard response with group and nonces.
 *
 * @param node - The BifrostNode handling the request.
 * @param peer_idx - The peer's member index.
 * @returns An OnboardResponse with group and nonces.
 * @internal
 */
function build_onboard_response (
  node     : BifrostNode,
  peer_idx : number
) : OnboardResponse {
  return {
    group  : node.group,
    nonces : node.pool.generate_for_peer(peer_idx, node.pool.config.pool_size)
  }
}

// ============================================================================
// Handler API
// ============================================================================

/**
 * Handles incoming onboard requests from new nodes.
 *
 * When a new node contacts us for onboarding, this handler:
 * 1. Validates the request (checks the node is a valid group member)
 * 2. Generates initial nonces for the new node
 * 3. Returns the GroupPackage and nonce package
 *
 * Events emitted:
 * - `/onboard/handler/req` - When an onboard request is received
 * - `/onboard/handler/res` - When a response is sent successfully
 * - `/onboard/handler/rej` - When an error occurs
 *
 * @param node - The BifrostNode handling the request.
 * @param msg - The signed message containing the onboard request.
 */
export async function onboard_handler_api (
  node : BifrostNode,
  msg  : RpcMessageEnvelope<RequestRpcMessage> & { data: OnboardRequest }
) {
  try {
    // Emit the request message
    node.emit('/onboard/handler/req', msg)

    // Parse and validate the request
    const request = msg.data
    const parsed  = Schema.onboard.onboard_req.safeParse(request)
    if (!parsed.success) {
      throw new Error('invalid onboard request format')
    }

    // Verify the requester is a valid group member
    const member = node.group.members.find(m => m.idx === request.idx)
    if (!member) {
      throw new Error('requester not a valid group member')
    }

    // Build and send the success response
    const response = build_onboard_response(node, request.idx)
    const res = await node.client.respond(msg).accept(response)
    if (!res.ok) throw new Error('failed to publish onboard response')

    // Emit success
    node.emit('/onboard/handler/res', msg)

  } catch (err) {
    // Log and emit error
    onboardDebug('error: %O', err)
    node.emit('/onboard/handler/rej', [ parse_error(err), msg ])

    // Send error response via RPC reject
    try {
      await node.client.respond(msg).reject(parse_error(err))
    } catch {
      // Ignore publish errors for error response
    }
  }
}

// ============================================================================
// Request API
// ============================================================================

/**
 * Creates a request API function for onboarding.
 *
 * Returns a function that sends an onboard request to a specific peer
 * to receive the GroupPackage and initial nonces.
 *
 * The process:
 * 1. Send onboard request with our share pubkey and index
 * 2. Receive GroupPackage and initial nonces
 * 3. Store the nonces in our pool
 *
 * Events emitted:
 * - `/onboard/sender/res` - When a response is received
 * - `/onboard/sender/rej` - When the request fails
 * - `/onboard/sender/ret` - When onboarding completes successfully
 * - `/onboard/sender/err` - When the response is invalid
 *
 * @param node - The BifrostNode to create the request API for.
 * @returns An async function that requests onboarding from a peer.
 *
 * @example
 * ```typescript
 * const onboard = onboard_request_api(node)
 * const result = await onboard(peerPubkey)
 * if (result.ok) {
 *   console.log('Onboarded successfully')
 * }
 * ```
 */
export function onboard_request_api (node : BifrostNode) {

  return async (peer_pubkey : string) : Promise<ApiResponse<OnboardResponse>> => {

    let msg : RpcMessageData | null = null

    try {
      // Create the onboard request
      const request : OnboardRequest = {
        share_pk : node.signer.pubkey,
        idx      : node.signer.idx
      }

      // Send the request
      msg = await create_onboard_request(node, peer_pubkey, request)
      node.emit('/onboard/sender/res', msg)

    } catch (err) {
      onboardDebug('error: %O', err)
      const reason = parse_error(err)
      node.emit('/onboard/sender/rej', [ reason, msg ])
      return { ok: false, err: reason }
    }

    try {
      Assert.ok(msg !== null, 'no response from peer')

      // Parse the response
      const response = parse_onboard_response(msg)
      if (response === null) {
        throw new Error('invalid onboard response')
      }

      // Find the peer's member index
      const peer_member = node.group.members.find(m => pubkeys_match(m.pubkey, peer_pubkey))
      if (!peer_member) {
        throw new Error('peer not found in group members')
      }

      // Store the received nonces
      const stored = node.pool.store_incoming(peer_member.idx, response.nonces)

      // Emit success
      node.emit('/onboard/sender/ret', [ response, stored ])
      return { ok: true, data: response }

    } catch (err) {
      onboardDebug('error: %O', err)
      const reason = parse_error(err)
      node.emit('/onboard/sender/err', [ reason, msg ])
      return { ok: false, err: reason }
    }
  }
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Sends an onboard request to a specific peer.
 *
 * @internal
 */
async function create_onboard_request (
  node    : BifrostNode,
  pubkey  : string,
  request : OnboardRequest
) : Promise<RpcMessageData> {
  return node.client.request({
    method : 'onboard',
    params : [ JSON.stringify(request) ]
  }, pubkey)
}

/**
 * Parses an onboard response.
 *
 * @internal
 */
function parse_onboard_response (
  msg : RpcMessageData
) : OnboardResponse | null {
  try {
    // Check if this is an accept message with data
    if (msg.type !== 'accept') return null
    const data = (msg as { data: unknown }).data
    const parsed = Schema.onboard.onboard_res.safeParse(data)
    if (!parsed.success) return null
    return parsed.data as OnboardResponse
  } catch {
    return null
  }
}
