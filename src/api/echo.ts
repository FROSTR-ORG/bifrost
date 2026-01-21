import { BifrostNode }         from '@/class/client.js'
import { finalize_message }    from '@cmdcode/nostr-p2p/lib'
import { Assert, parse_error } from '@/util/index.js'

import type { SignedMessage } from '@cmdcode/nostr-p2p'
import type { ApiResponse }   from '@/types/index.js'

/**
 * Handles incoming echo requests.
 *
 * Echo requests are used for self-testing to verify that a node can
 * send messages to itself through the relay network. This is useful
 * for diagnosing connectivity issues.
 *
 * When an echo request is received:
 * 1. Emits the request for debugging/logging
 * 2. Responds with the node's policy
 *
 * Note: Echo requests bypass normal peer authorization since they're
 * sent from self to self.
 *
 * Events emitted:
 * - `/echo/handler/req` - When an echo request is received
 * - `/echo/handler/res` - When a response is sent successfully
 * - `/echo/handler/rej` - When an error occurs
 *
 * @param node - The BifrostNode handling the request.
 * @param msg - The signed message containing the echo payload.
 */
export async function echo_handler_api (
  node : BifrostNode,
  msg  : SignedMessage<string>
) {
  // Try to parse the message.
  try {
    // Emit the request message.
    node.emit('/echo/handler/req', msg)
    // Get the peer data.
    const peer_data = node.peers.find(e => e.pubkey === msg.env.pubkey)
    // If the peer data is not found, throw an error.
    if (peer_data === undefined) throw new Error('peer data not found')
    // Finalize the response package.
    const envelope = finalize_message({
      data : JSON.stringify(peer_data.policy),
      id   : msg.id,
      tag  : '/echo/res'
    })
    // Publish the response package.
    const res = await node.client.publish(envelope, msg.env.pubkey)
    // If the response is not ok, throw an error.
    if (!res.ok) throw new Error('failed to publish response')
    // Emit the response package.
    node.emit('/echo/handler/res', res.data)
  } catch (err) {
    // Log the error.
    if (node.debug) console.log(err)
    // Emit the error.
    node.emit('/echo/handler/rej', [ parse_error(err), msg ])
  }
}

/**
 * Creates a request API function for echo testing.
 *
 * Returns a function that sends an echo request to self through the
 * relay network. This tests that the node can communicate with itself,
 * which verifies relay connectivity.
 *
 * Events emitted:
 * - `/echo/sender/res` - When a response is received
 * - `/echo/sender/rej` - When the request fails
 * - `/echo/sender/ret` - When the echo succeeds
 * - `/echo/sender/err` - When the response is invalid
 *
 * @param node - The BifrostNode to create the request API for.
 * @returns An async function that sends an echo challenge.
 *
 * @example
 * ```typescript
 * const echo = echo_request_api(node)
 * const result = await echo('test-challenge')
 * if (result.ok) {
 *   console.log('Echo successful:', result.data)
 * }
 * ```
 */
export function echo_request_api (node : BifrostNode) {

  return async (challenge : string) : Promise<ApiResponse<string>> => {

    let msg : SignedMessage<string> | null = null

    try {
      // Send the request to the peers.
      msg = await create_echo_request(node, challenge)
      // Emit the response.
      node.emit('/echo/sender/res', msg)
    } catch (err) {
      // Log the error.
      if (node.debug) console.log(err)
      // Parse the error.
      const reason = parse_error(err)
      // Emit the error.
      node.emit('/echo/sender/rej', [ reason, msg ])
      // Return the error.
      return { ok : false, err : reason }
    }

    try {
      Assert.ok(msg !== null, 'no response from self')
      // Emit the echo event.
      node.emit('/echo/sender/ret', [ msg.data ])
      // Return the echo event.
      return { ok : true, data : msg.data }
    } catch (err) {
      // Log the error.
      if (node.debug) console.log(err)
      // Parse the error.
      const reason = parse_error(err)
      // Emit the error.
      node.emit('/echo/sender/err', [ reason, msg ])
      // Return the error.
      return { ok : false, err : reason }
    }
  }
}

/**
 * Sends an echo request to self through the relay network.
 *
 * @param node - The BifrostNode sending the request.
 * @param challenge - The challenge string to echo.
 * @returns A Promise resolving to the signed echo response.
 * @throws Error if the request fails or times out.
 * @internal
 */
async function create_echo_request (
  node      : BifrostNode,
  challenge : string
) : Promise<SignedMessage<string>> {
  // Send a request to the peer nodes.
  const res = await node.client.request({
    data : challenge,
    tag  : '/echo/req'
  }, node.pubkey, {})
  // If the response is not ok, throw an error.
  if (!res.ok) throw new Error(res.reason)
  // Return the response.
  return res.inbox[0]
}
