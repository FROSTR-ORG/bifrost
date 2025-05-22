import { BifrostNode }         from '@/class/client.js'
import { finalize_message }    from '@cmdcode/nostr-p2p/lib'
import { Assert, parse_error } from '@/util/index.js'

import type { SignedMessage } from '@cmdcode/nostr-p2p'
import type { ApiResponse }   from '@/types/index.js'

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
